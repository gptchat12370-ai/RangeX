import React, { useState, useEffect } from "react";
import { X, Server, Network, AlertCircle, Download, Play, Square, Terminal, Container, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { toast } from "sonner";
import { dockerApi, DockerImage, RecommendedImage } from "../../api/dockerApi";
import { Skeleton } from "../ui/skeleton";
import { httpClient } from "../../api/httpClient";
import ImageVariantSelector from "./ImageVariantSelector";

// Best Practice: Match backend MachineInputDto structure exactly
interface Machine {
  id: string;
  name: string;
  role: "attacker" | "internal" | "service";
  
  // Image Configuration (matches backend)
  imageSourceType: 'platform_library' | 'custom_image';
  imageRef: string; // Docker image reference (e.g., "kali-tools:latest")
  imageVariantId?: string; // Only for platform_library images
  registryCredentialId?: string; // For private registry authentication
  
  // Network & Resource Configuration
  networkGroup: string;
  networkEgressPolicy: 'none' | 'session-only' | 'internet';
  resourceProfile: 'micro' | 'small' | 'medium' | 'large'; // Backend enum values
  
  // Access Control
  allowSolverEntry: boolean;
  allowFromAttacker: boolean;
  allowInternalConnections: boolean;
  isPivotHost: boolean;
  
  // Optional Configuration
  startupCommands?: string;
  entrypoints?: Array<{
    protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
  purposeTags?: string[]; // Frontend-only UI helper
  
  // Legacy/Display fields (keep for backward compatibility)
  imageName?: string; // Display name only
}

interface MachineConfigPanelProps {
  machine: Machine;
  onUpdate: (machine: Machine) => void;
  onClose: () => void;
}

export function MachineConfigPanel({ machine, onUpdate, onClose }: MachineConfigPanelProps) {
  const [localMachine, setLocalMachine] = useState(machine);
  
  // UI-only state (not sent to backend)
  const [imageTab, setImageTab] = useState<'ready' | 'public' | 'private'>('ready');
  const [tempImageRepo, setTempImageRepo] = useState('');
  const [tempImageTag, setTempImageTag] = useState('latest');
  const [tempRegistryUrl, setTempRegistryUrl] = useState('docker.io');
  const [advancedAccessMode, setAdvancedAccessMode] = useState(false);
  
  const [localImages, setLocalImages] = useState<DockerImage[]>([]);
  const [readyImages, setReadyImages] = useState<any[]>([]);
  const [recommendedImages, setRecommendedImages] = useState<RecommendedImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [dockerAvailable, setDockerAvailable] = useState(false);
  const [pullingImage, setPullingImage] = useState(false);
  const [testingContainer, setTestingContainer] = useState(false);
  const [runningTestContainer, setRunningTestContainer] = useState<string | null>(null);

  // Sync local state when machine prop changes (parent switches to different machine)
  useEffect(() => {
    setLocalMachine(machine);
    
    // Parse existing imageRef to populate temp fields for editing
    if (machine.imageRef && machine.imageSourceType === 'custom_image') {
      const parsed = parseImageRef(machine.imageRef);
      setTempImageRepo(parsed.repository);
      setTempImageTag(parsed.tag);
      
      // Set active tab based on image source
      if (machine.imageRef.includes('docker.io') || !machine.imageRef.includes('/')) {
        setImageTab('public');
      } else if (parsed.registry) {
        setImageTab('private');
        setTempRegistryUrl(parsed.registry);
      }
    }
  }, [machine]);

  useEffect(() => {
    loadDockerImages();
    loadReadyImages();
  }, []);

  // Helper: Parse imageRef correctly (handles registry:port/repo:tag and @sha256:digest)
  const parseImageRef = (ref: string): { registry?: string, repository: string, tag: string } => {
    // Handle digest format (e.g., nginx@sha256:abc...)
    if (ref.includes('@')) {
      const [repo, digest] = ref.split('@');
      return { repository: repo, tag: digest };
    }

    // Split on last : after last /
    const lastSlashIndex = ref.lastIndexOf('/');
    const afterSlash = ref.substring(lastSlashIndex + 1);
    const lastColonIndex = afterSlash.lastIndexOf(':');

    if (lastColonIndex === -1) {
      // No tag (use 'latest')
      return { repository: ref, tag: 'latest' };
    }

    const beforeColon = ref.substring(0, lastSlashIndex + 1 + lastColonIndex);
    const tag = afterSlash.substring(lastColonIndex + 1);

    return { repository: beforeColon, tag };
  };

  // Helper: Generate DNS-safe slug from machine name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Helper: Validate machine name
  const validateMachineName = (name: string): { valid: boolean, warning?: string } => {
    if (!name) return { valid: false, warning: 'Name is required' };
    if (name.length < 2) return { valid: false, warning: 'Name too short (min 2 chars)' };
    if (name.length > 32) return { valid: false, warning: 'Name too long (max 32 chars)' };
    if (/[A-Z]/.test(name)) return { valid: true, warning: 'Uppercase detected - will be converted to lowercase slug' };
    if (/\s/.test(name)) return { valid: true, warning: 'Spaces detected - will be converted to hyphens' };
    return { valid: true };
  };

  // Helper: Validate entrypoint
  const validateEntrypoint = (entrypoint: { protocol: string, containerPort: number }): { valid: boolean, error?: string } => {
    if (entrypoint.containerPort < 1 || entrypoint.containerPort > 65535) {
      return { valid: false, error: 'Port must be between 1-65535' };
    }
    return { valid: true };
  };

  // Helper: Get default port for protocol
  const getDefaultPort = (protocol: string): number => {
    const defaults: Record<string, number> = {
      ssh: 22,
      http: 80,
      https: 443,
      rdp: 3389,
      vnc: 5900,
      tcp: 8080,
      udp: 8080,
    };
    return defaults[protocol] || 80;
  };

  const loadReadyImages = async () => {
    try {
      // Use creator testing endpoint which returns ONLY cached images (ready for instant use)
      const response = await httpClient.get('/creator/testing/docker/images');
      console.log('Loaded ready images:', response.data);
      // Extract images array from response
      const images = response.data.images || [];
      setReadyImages(images);
    } catch (error) {
      console.error('Failed to load ready images', error);
      toast.error('Failed to load Platform Library images');
    }
  };

  const loadDockerImages = async () => {
    setLoadingImages(true);
    try {
      const { local, recommended, dockerAvailable: available } = await dockerApi.getImages();
      setLocalImages(local);
      setRecommendedImages(recommended);
      setDockerAvailable(available);
    } catch (error) {
      console.error("Failed to load Docker images", error);
      toast.error("Failed to load Docker images. Is Docker running?");
    } finally {
      setLoadingImages(false);
    }
  };

  const handleUpdate = async (updates: Partial<Machine>) => {
    console.log('🔥 handleUpdate called with:', updates);
    const updated = { ...localMachine, ...updates };
    console.log('🔥 Updated machine:', updated);
    setLocalMachine(updated);
    onUpdate(updated);
    console.log('🔥 onUpdate callback fired');
    
    // Auto-save to backend if machine has an ID (not a new unsaved machine)
    if (updated.id && !updated.id.startsWith('machine-')) {
      try {
        const { creatorApi } = await import('../../api/creatorApi');
        await creatorApi.updateMachine(updated.id, updated);
        console.log('✅ Machine saved to backend');
      } catch (err: any) {
        console.error('❌ Failed to auto-save machine:', err);
        toast.error('Failed to save machine changes');
      }
    }
  };

  const togglePurposeTag = (tag: string) => {
    const tags = localMachine.purposeTags || [];
    const updated = tags.includes(tag)
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    handleUpdate({ purposeTags: updated });
  };

  const handlePullImage = async (repository: string, tag: string) => {
    setPullingImage(true);
    try {
      await dockerApi.pullImage(repository, tag);
      toast.success(`Successfully pulled ${repository}:${tag}`);
      await loadDockerImages();
    } catch (error) {
      toast.error("Failed to pull image");
    } finally {
      setPullingImage(false);
    }
  };

  const handleTestContainer = async () => {
    // Use imageRef which is the actual Docker image reference
    if (!localMachine.imageRef) {
      toast.error("Please select an image first");
      return;
    }

    setTestingContainer(true);
    
    // Parse image reference correctly (handles registry:port/repo:tag)
    const { repository, tag } = parseImageRef(localMachine.imageRef);

    try {
      const result = await dockerApi.testContainer(repository, tag);
      setRunningTestContainer(result.containerId);
      toast.success(`Test container started: ${repository}:${tag}`);
    } catch (error: any) {
      console.error('Test container error:', error);
      toast.error(error?.response?.data?.message || "Failed to start test container");
    } finally {
      setTestingContainer(false);
    }
  };

  const handleStopTestContainer = async () => {
    if (!runningTestContainer) return;

    try {
      await dockerApi.stopContainer(runningTestContainer);
      setRunningTestContainer(null);
      toast.success("Test container stopped");
    } catch (error) {
      toast.error("Failed to stop test container");
    }
  };

  return (
    <Card className="cyber-border sticky top-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Machine Configuration</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Server className="h-4 w-4" />
            Basic Info
          </h3>

          <div className="space-y-2">
            <Label htmlFor="machine-name" className="text-xs font-semibold">
              Machine Name
            </Label>
            <Input
              id="machine-name"
              value={localMachine.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              placeholder="e.g., Web Server"
            />
            {(() => {
              const validation = validateMachineName(localMachine.name);
              if (validation.warning) {
                return (
                  <p className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validation.warning} → Slug: {generateSlug(localMachine.name)}
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine-role" className="text-xs font-semibold">
              Role
            </Label>
            <Select
              value={localMachine.role}
              onValueChange={(value: any) => {
                // Auto-configure based on role
                const allowSolverEntry = value === 'attacker';
                const networkGroup = value === 'attacker' ? 'attacker' : value === 'service' ? 'internal' : 'dmz';
                const networkEgressPolicy = value === 'attacker' ? 'internet' : value === 'service' ? 'none' : 'session-only';
                
                handleUpdate({ 
                  role: value, 
                  allowSolverEntry,
                  networkGroup,
                  networkEgressPolicy,
                  // Only reset image for attackers switching to/from attacker role
                  // Non-attackers keep their custom images
                  ...(value === 'attacker' && {
                    imageSourceType: 'platform_library' as const,
                    imageRef: '',
                    imageVariantId: undefined
                  }),
                  ...(value !== 'attacker' && localMachine.role === 'attacker' && {
                    imageSourceType: 'custom_image' as const,
                    imageRef: '',
                    imageVariantId: undefined
                  })
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attacker">Attacker (Kali Linux)</SelectItem>
                <SelectItem value="internal">Internal (Victim/Pivot/DB)</SelectItem>
                <SelectItem value="service">Service (Logging/API/Supporting)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {localMachine.role === 'attacker' 
                ? '✅ Entry point - Solver connects here first (uses curated Kali images)'
                : '❌ Not directly accessible to solver (use custom Docker images like DVWA, nginx, MySQL)'}
            </p>
          </div>

          {/* Resource Profile - Show for all roles */}
          <div className="space-y-2">
            <Label htmlFor="resource-profile" className="text-xs font-semibold">
              Resource Profile
            </Label>
            <Select
              value={localMachine.resourceProfile || 'small'}
              onValueChange={(value: any) => handleUpdate({ resourceProfile: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="micro">
                  <div className="flex items-center justify-between w-full">
                    <span>Micro</span>
                    <span className="text-xs text-muted-foreground ml-4">0.25 vCPU, 0.5 GB</span>
                  </div>
                </SelectItem>
                <SelectItem value="small">
                  <div className="flex items-center justify-between w-full">
                    <span>Small</span>
                    <span className="text-xs text-muted-foreground ml-4">0.5 vCPU, 1 GB</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center justify-between w-full">
                    <span>Medium</span>
                    <span className="text-xs text-muted-foreground ml-4">1 vCPU, 2 GB</span>
                  </div>
                </SelectItem>
                <SelectItem value="large">
                  <div className="flex items-center justify-between w-full">
                    <span>Large</span>
                    <span className="text-xs text-muted-foreground ml-4">2 vCPU, 4 GB</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {localMachine.role === 'attacker' && localMachine.imageVariantId
                ? 'Automatically set by image variant selection'
                : localMachine.role === 'attacker'
                ? 'Select computational resources (or choose an image variant below to auto-configure)'
                : 'Select computational resources for this machine'}
            </p>
          </div>

          {/* Image Variant Selector - Only for attacker role (Kali Linux images) */}
          {localMachine.role === 'attacker' && (
            <div className="space-y-2">
              <ImageVariantSelector
                role={localMachine.role}
                selectedVariantId={localMachine.imageVariantId || undefined}
                onChange={(variantId, variant) => {
                console.log('🔥 ImageVariantSelector onChange fired:', { variantId, variant });
                
                // Best Practice: Set imageSourceType and imageRef cleanly
                // Map variantType to backend resourceProfile enum
                const resourceProfileMap: Record<string, 'micro' | 'small' | 'medium' | 'large'> = {
                  'lite': 'micro',
                  'standard': 'medium',
                  'full': 'large',
                };
                
                // Auto-populate entrypoints from image variant
                const entrypoints = variant.defaultEntrypoints || [];
                const allowSolverEntry = entrypoints.some(e => e.exposedToSolver);
                
                // Auto-configure network settings based on role (ensure consistency)
                const networkGroup = localMachine.role === 'attacker' ? 'attacker' : 
                                    localMachine.role === 'service' ? 'internal' : 'dmz';
                const networkEgressPolicy: 'none' | 'session-only' | 'internet' = 
                  localMachine.role === 'attacker' ? 'internet' : 
                  localMachine.role === 'service' ? 'none' : 'session-only';
                
                const updates = {
                  imageSourceType: 'platform_library' as const,
                  imageVariantId: variantId,
                  imageRef: variant.imageRef, // Actual Docker image reference
                  imageName: variant.displayName, // Display name only
                  resourceProfile: resourceProfileMap[variant.variantType] || 'small' as const,
                  entrypoints, // Auto-populate from variant
                  allowSolverEntry, // Derive from entrypoints
                  networkGroup, // Ensure network group is correct
                  networkEgressPolicy, // Ensure network egress is correct
                };
                
                console.log('🔥 Calling handleUpdate with:', updates);
                handleUpdate(updates);
                toast.success(`Selected ${variant.displayName} - RM ${(typeof variant.hourlyCostRm === 'string' ? parseFloat(variant.hourlyCostRm) : variant.hourlyCostRm).toFixed(4)}/hr`);
              }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Purpose Tags</Label>
            <div className="flex flex-wrap gap-2">
              {["Web", "API", "Database", "AD", "Internal Service", "Logging"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => togglePurposeTag(tag)}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    localMachine.purposeTags?.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Docker Info Note */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
          <Container className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-300 mb-1">Docker Container</p>
            <p className="text-xs text-blue-300">
              This machine runs as a Docker container on AWS Fargate.
              {!dockerAvailable && " (Docker not detected on your system)"}
            </p>
          </div>
        </div>

        <Separator />

        {/* Image Selection Section - Only for internal/service roles */}
        {localMachine.role !== 'attacker' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Container className="h-4 w-4" />
                Docker Image Selection
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDockerImages}
                disabled={loadingImages}
              >
                <RefreshCw className={`h-3 w-3 ${loadingImages ? "animate-spin" : ""}`} />
              </Button>
            </div>

          <Tabs value={imageTab} onValueChange={(value: any) => setImageTab(value)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ready">
                Platform Library ({readyImages.length})
              </TabsTrigger>
              <TabsTrigger value="public">
                Public Docker Hub
              </TabsTrigger>
              <TabsTrigger value="private">
                Private Registry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ready" className="space-y-3 mt-4">
              {loadingImages ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : readyImages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No ready images available
                  <br />
                  <Button variant="link" size="sm" className="mt-2" onClick={() => setImageTab("public")}>
                    Browse public images →
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {readyImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => {
                        // Best Practice: Always set backend fields (imageSourceType + imageRef)
                        const imageRef = img.registryUrl 
                          ? `${img.registryUrl}/${img.name}:${img.tag}`
                          : `${img.name}:${img.tag}`;
                        handleUpdate({ 
                          imageSourceType: 'custom_image',
                          imageRef,
                          imageName: `${img.name}:${img.tag}`, // Display name
                          imageVariantId: undefined, // Clear variant ID
                        });
                      }}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        localMachine.imageRef === (img.registryUrl ? `${img.registryUrl}/${img.name}:${img.tag}` : `${img.name}:${img.tag}`)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{img.name}:{img.tag}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {img.description}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {img.minioPath ? (
                              <>
                                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                                  ✅ Cached ({img.imageSizeMb} MB)
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Pulls: {img.pullCount || 0}
                                </span>
                              </>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
                                ❌ Not cached
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">{img.category}</Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="public" className="space-y-3 mt-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="vulnerables/web-dvwa"
                    value={tempImageRepo}
                    onChange={(e) => {
                      const repo = e.target.value;
                      setTempImageRepo(repo);
                      
                      if (repo) {
                        const imageRef = `${repo}:${tempImageTag}`;
                        handleUpdate({ 
                          imageSourceType: 'custom_image',
                          imageRef,
                          imageName: imageRef, // Set for display in table
                          imageVariantId: undefined, // Clear variant ID
                        });
                      }
                    }}
                  />
                  <Input
                    placeholder="Tag (latest)"
                    className="w-32"
                    value={tempImageTag}
                    onChange={(e) => {
                      const tag = e.target.value || 'latest';
                      setTempImageTag(tag);
                      
                      if (tempImageRepo) {
                        const imageRef = `${tempImageRepo}:${tag}`;
                        handleUpdate({ 
                          imageSourceType: 'custom_image',
                          imageRef,
                          imageName: imageRef, // Set for display in table
                          imageVariantId: undefined, // Clear variant ID
                        });
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a public Docker Hub image (e.g., nginx, ubuntu:22.04, vulnerables/web-dvwa)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="private" className="space-y-3 mt-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Registry URL</Label>
                  <Input
                    placeholder="registry.example.com"
                    value={tempRegistryUrl}
                    onChange={(e) => {
                      const registry = e.target.value;
                      setTempRegistryUrl(registry);
                      
                      if (tempImageRepo) {
                        const imageRef = registry
                          ? `${registry}/${tempImageRepo}:${tempImageTag}`
                          : `${tempImageRepo}:${tempImageTag}`;
                        handleUpdate({ 
                          imageSourceType: 'custom_image',
                          imageRef,
                          imageName: imageRef,
                          imageVariantId: undefined,
                        });
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Image Repository</Label>
                    <Input
                      placeholder="username/image"
                      value={tempImageRepo}
                      onChange={(e) => {
                        const repo = e.target.value;
                        setTempImageRepo(repo);
                        
                        if (repo) {
                          const imageRef = tempRegistryUrl
                            ? `${tempRegistryUrl}/${repo}:${tempImageTag}`
                            : `${repo}:${tempImageTag}`;
                          handleUpdate({ 
                            imageSourceType: 'custom_image',
                            imageRef,
                            imageName: imageRef,
                            imageVariantId: undefined,
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Tag</Label>
                    <Input
                      placeholder="latest"
                      value={tempImageTag}
                      onChange={(e) => {
                        const tag = e.target.value || 'latest';
                        setTempImageTag(tag);
                        
                        if (tempImageRepo) {
                          const imageRef = tempRegistryUrl
                            ? `${tempRegistryUrl}/${tempImageRepo}:${tag}`
                            : `${tempImageRepo}:${tag}`;
                          handleUpdate({ 
                            imageSourceType: 'custom_image',
                            imageRef,
                            imageName: imageRef,
                            imageVariantId: undefined,
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <p className="text-xs text-orange-300">
                    <strong>Note:</strong> Private registry credentials must be configured in Settings before deploying scenarios with private images.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Image Info */}
          {localMachine.imageRef && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">Selected Image:</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {localMachine.imageRef}
                  </p>
                </div>
                {/* Show Test Run button if imageRef is set */}
                {localMachine.imageRef && (
                  <div className="flex gap-2">
                    {!runningTestContainer ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleTestContainer}
                        disabled={testingContainer}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {testingContainer ? "Starting..." : "Test Run"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStopTestContainer}
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Stop Test
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Test Run Explanation */}
              <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                <p className="font-semibold text-blue-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  What is Test Run?
                </p>
                <p className="text-blue-300 mt-1">
                  Test Run quickly starts a single container for validation. This is NOT the full scenario deployment - 
                  it's for debugging the image (checking if services start, ports work, etc.).
                </p>
              </div>
              
              {runningTestContainer && (
                <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                  <p className="font-semibold text-green-400">Test Container Running</p>
                  <p className="text-green-300 mt-1">Container: {runningTestContainer}</p>
                  <p className="text-green-300 text-xs mt-1">
                    You can access this container in Docker Desktop to verify it works as expected.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <Separator />

        {/* Connectivity Rules Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Network className="h-4 w-4" />
              Connectivity Rules
            </h3>
            {localMachine.role !== 'attacker' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedAccessMode(!advancedAccessMode)}
              >
                {advancedAccessMode ? '🔒 Lock' : '🔓 Advanced'}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="allow-solver-entry" className="text-xs font-semibold">
                  Allow Solver Direct Entry
                </Label>
                <p className="text-xs text-muted-foreground">
                  Solver can directly connect (entry point)
                </p>
              </div>
              <Switch
                id="allow-solver-entry"
                checked={localMachine.allowSolverEntry || false}
                onCheckedChange={(checked) => handleUpdate({ allowSolverEntry: checked })}
                disabled={localMachine.role === 'attacker' || !advancedAccessMode}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="allow-from-attacker" className="text-xs font-semibold">
                  Allow From Attacker Network
                </Label>
                <p className="text-xs text-muted-foreground">
                  Accept connections from attacker machines
                </p>
              </div>
              <Switch
                id="allow-from-attacker"
                checked={localMachine.allowFromAttacker || false}
                onCheckedChange={(checked) => handleUpdate({ allowFromAttacker: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="allow-internal-connections" className="text-xs font-semibold">
                  Allow Internal Connections
                </Label>
                <p className="text-xs text-muted-foreground">
                  Accept connections from internal machines
                </p>
              </div>
              <Switch
                id="allow-internal-connections"
                checked={localMachine.allowInternalConnections || false}
                onCheckedChange={(checked) => handleUpdate({ allowInternalConnections: checked })}
              />
            </div>
          </div>

          {localMachine.role !== 'attacker' && !advancedAccessMode && (
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
              <p className="text-yellow-400">
                <strong>Note:</strong> "Allow Solver Direct Entry" is locked for {localMachine.role} machines. 
                Click "Advanced" to override (not recommended for production).
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Entrypoints Configuration Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Entrypoints</h3>
              <p className="text-xs text-muted-foreground">
                {localMachine.imageVariantId 
                  ? 'Auto-configured from selected image variant'
                  : 'Define how solvers access this machine'}
              </p>
            </div>
            {!localMachine.imageVariantId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newEntrypoint = {
                    protocol: 'http' as const,
                    containerPort: getDefaultPort('http'),
                    exposedToSolver: localMachine.allowSolverEntry || false,
                    description: '',
                  };
                  handleUpdate({
                    entrypoints: [...(localMachine.entrypoints || []), newEntrypoint]
                  });
                }}
              >
                <Play className="h-3 w-3 mr-1" />
                Add Entrypoint
              </Button>
            )}
          </div>

          {localMachine.imageVariantId && localMachine.entrypoints && localMachine.entrypoints.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                ✨ <strong>Auto-configured from {localMachine.imageName || 'selected variant'}</strong> - These entrypoints are pre-configured and cannot be modified. To customize entrypoints, use a custom Docker image instead.
              </p>
            </div>
          )}

          {(!localMachine.entrypoints || localMachine.entrypoints.length === 0) && (
            <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-border text-center">
              <p className="text-xs text-muted-foreground">
                {localMachine.imageVariantId 
                  ? 'No entrypoints configured for this image variant. Contact admin to update variant configuration.'
                  : 'No entrypoints defined. Click "Add Entrypoint" to configure how solvers access this machine.'}
              </p>
              {!localMachine.imageVariantId && (
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Only machines with entrypoints marked "Exposed" will be accessible to solvers.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {(localMachine.entrypoints || []).map((entrypoint, index) => {
              const validation = validateEntrypoint(entrypoint);
              const hasDuplicate = (localMachine.entrypoints || []).some(
                (e, i) => i !== index && e.protocol === entrypoint.protocol && e.containerPort === entrypoint.containerPort
              );
              
              return (
              <div key={index} className={`p-3 rounded-lg border space-y-3 ${
                localMachine.imageVariantId 
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Protocol
                        {localMachine.imageVariantId && <Badge variant="secondary" className="text-xs">Read-only</Badge>}
                      </Label>
                      {localMachine.imageVariantId ? (
                        <div className="h-8 px-3 rounded-md border border-input bg-muted/50 flex items-center text-xs capitalize">
                          {entrypoint.protocol}
                        </div>
                      ) : (
                        <Select
                          value={entrypoint.protocol}
                          onValueChange={(value: any) => {
                            const updated = [...(localMachine.entrypoints || [])];
                            updated[index] = { 
                              ...entrypoint, 
                              protocol: value,
                              containerPort: getDefaultPort(value)
                            };
                            handleUpdate({ entrypoints: updated });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="https">HTTPS</SelectItem>
                            <SelectItem value="ssh">SSH</SelectItem>
                            <SelectItem value="rdp">RDP</SelectItem>
                            <SelectItem value="vnc">VNC</SelectItem>
                            <SelectItem value="tcp">TCP</SelectItem>
                            <SelectItem value="udp">UDP</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {entrypoint.protocol === 'udp' && (
                        <p className="text-xs text-yellow-500 mt-1">
                          ⚠️ UDP requires NLB (advanced)
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Container Port
                        {localMachine.imageVariantId && <Badge variant="secondary" className="text-xs">Read-only</Badge>}
                      </Label>
                      <Input
                        type={localMachine.imageVariantId ? "text" : "number"}
                        placeholder="80"
                        className={`h-8 text-xs ${!validation.valid || hasDuplicate ? 'border-red-500' : ''}`}
                        value={entrypoint.containerPort}
                        onChange={(e) => {
                          if (localMachine.imageVariantId) return;
                          const updated = [...(localMachine.entrypoints || [])];
                          updated[index] = { ...entrypoint, containerPort: parseInt(e.target.value) || 0 };
                          handleUpdate({ entrypoints: updated });
                        }}
                        readOnly={!!localMachine.imageVariantId}
                        disabled={!!localMachine.imageVariantId}
                      />
                      {!validation.valid && (
                        <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                      )}
                      {hasDuplicate && (
                        <p className="text-xs text-red-500 mt-1">Duplicate port</p>
                      )}
                    </div>
                  </div>
                  
                  {!localMachine.imageVariantId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2 h-8 w-8 p-0"
                      onClick={() => {
                        const updated = (localMachine.entrypoints || []).filter((_, i) => i !== index);
                        handleUpdate({ entrypoints: updated });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-xs flex items-center gap-1">
                    Description (optional)
                    {localMachine.imageVariantId && <Badge variant="secondary" className="text-xs">Read-only</Badge>}
                  </Label>
                  <Input
                    placeholder="e.g., Web UI, SSH Access, RDP Console"
                    className="h-8 text-xs"
                    value={entrypoint.description || ''}
                    onChange={(e) => {
                      if (localMachine.imageVariantId) return;
                      const updated = [...(localMachine.entrypoints || [])];
                      updated[index] = { ...entrypoint, description: e.target.value };
                      handleUpdate({ entrypoints: updated });
                    }}
                    readOnly={!!localMachine.imageVariantId}
                    disabled={!!localMachine.imageVariantId}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-background/50 rounded">
                  <div>
                    <Label htmlFor={`exposed-${index}`} className="text-xs font-semibold flex items-center gap-1">
                      Expose to Solver
                      {localMachine.imageVariantId && <Badge variant="secondary" className="text-xs">Read-only</Badge>}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {localMachine.imageVariantId
                        ? 'Configured by image variant'
                        : localMachine.allowSolverEntry || advancedAccessMode
                        ? 'Allow direct access from outside'
                        : 'Disabled - machine access locked'}
                    </p>
                  </div>
                  <Switch
                    id={`exposed-${index}`}
                    checked={entrypoint.exposedToSolver}
                    onCheckedChange={(checked) => {
                      if (localMachine.imageVariantId) {
                        toast.error('Cannot modify - entrypoints are configured by image variant');
                        return;
                      }
                      if (!localMachine.allowSolverEntry && !advancedAccessMode) {
                        toast.error('Enable "Allow Solver Direct Entry" in Connectivity Rules first');
                        return;
                      }
                      const updated = [...(localMachine.entrypoints || [])];
                      updated[index] = { ...entrypoint, exposedToSolver: checked };
                      handleUpdate({ entrypoints: updated });
                    }}
                    disabled={!!localMachine.imageVariantId || (!localMachine.allowSolverEntry && !advancedAccessMode)}
                  />
                </div>
                {!localMachine.allowSolverEntry && !advancedAccessMode && entrypoint.exposedToSolver && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                    <p className="text-yellow-400">
                      ⚠️ Entrypoint exposure will be ignored at deployment because "Allow Solver Direct Entry" is disabled.
                    </p>
                  </div>
                )}
              </div>
            );
            })}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              <strong>Port Mapping:</strong> In local Docker testing, entrypoints with "Expose to Solver" enabled 
              will get unique host ports auto-assigned (8000+) to avoid conflicts. In production (Fargate), 
              entrypoints use ALB/NLB routing instead.
            </p>
          </div>
        </div>

        <Separator />

        {/* Networking Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Network className="h-4 w-4" />
            Networking & Isolation
          </h3>

          {/* Network Group Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-2">
              Network Group (Security Isolation)
              <Badge variant="secondary" className="text-xs">Auto-configured by role</Badge>
            </Label>
            <Select
              value={localMachine.networkGroup || "dmz"}
              onValueChange={(value) => handleUpdate({ networkGroup: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attacker">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">🔴 Attacker</span>
                  </div>
                </SelectItem>
                <SelectItem value="dmz">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-orange-600">🟠 DMZ / Web Tier</span>
                  </div>
                </SelectItem>
                <SelectItem value="internal">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-600">🔵 Internal / Database</span>
                  </div>
                </SelectItem>
                <SelectItem value="mgmt">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-600">🟢 Management</span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600">⚪ Custom Network</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Comprehensive Helper Text */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                🔒 Network Isolation Explained:
              </p>
              <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                {localMachine.networkGroup === 'attacker' && (
                  <>
                    <p>• <strong>Attacker machines</strong> can scan and access DMZ hosts by default</p>
                    <p>• Must pivot through DMZ to reach Internal networks (unless pivot point exists)</p>
                    <p>• Solvers connect to this machine via SSH/RDP to perform pentesting</p>
                    <p>• Each session gets unique IP address for realistic nmap/arp-scan</p>
                  </>
                )}
                {localMachine.networkGroup === 'dmz' && (
                  <>
                    <p>• <strong>DMZ/Web machines</strong> are exposed to attackers (HTTP/HTTPS/SSH)</p>
                    <p>• Can connect to Internal databases/services on specific ports</p>
                    <p>• Ideal for: web servers, APIs, public-facing services</p>
                    <p>• Isolated from other sessions via AWS security groups</p>
                  </>
                )}
                {localMachine.networkGroup === 'internal' && (
                  <>
                    <p>• <strong>Internal machines</strong> are protected from direct attacker access</p>
                    <p>• Only DMZ machines can connect (database ports only by default)</p>
                    <p>• Requires pivoting through DMZ to reach from attacker</p>
                    <p>• Ideal for: databases, internal APIs, sensitive services</p>
                  </>
                )}
                {localMachine.networkGroup === 'mgmt' && (
                  <>
                    <p>• <strong>Management machines</strong> are solver-accessible like attacker</p>
                    <p>• Use for: jump boxes, monitoring systems, admin consoles</p>
                    <p>• Can be configured with custom access rules</p>
                  </>
                )}
                {localMachine.networkGroup === 'custom' && (
                  <>
                    <p>• <strong>Custom network</strong> requires manual security group configuration</p>
                    <p>• Define your own isolation rules and pivot points</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Network Egress Policy */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-2">
              Outbound Internet Access
              <Badge variant="secondary" className="text-xs">Auto-configured by role</Badge>
            </Label>
            <Select
              value={localMachine.networkEgressPolicy || 'none'}
              onValueChange={(value: 'none' | 'session-only' | 'internet') => 
                handleUpdate({ networkEgressPolicy: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="space-y-0.5">
                    <div className="font-semibold">🚫 No Internet (Isolated)</div>
                    <div className="text-xs text-muted-foreground">Cannot reach internet or other sessions</div>
                  </div>
                </SelectItem>
                <SelectItem value="session-only">
                  <div className="space-y-0.5">
                    <div className="font-semibold">🔒 Session-Only</div>
                    <div className="text-xs text-muted-foreground">Can reach other machines in same session</div>
                  </div>
                </SelectItem>
                <SelectItem value="internet">
                  <div className="space-y-0.5">
                    <div className="font-semibold">🌐 Full Internet</div>
                    <div className="text-xs text-muted-foreground">Can download updates, C2 callbacks, DNS</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {localMachine.networkEgressPolicy === 'none' && 'Recommended for databases and sensitive services'}
              {localMachine.networkEgressPolicy === 'session-only' && 'Allows internal communication within this session'}
              {localMachine.networkEgressPolicy === 'internet' && 'Required for: package updates, reverse shells, DNS resolution'}
            </p>
          </div>

          {/* Pivot Point Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="is-pivot" className="text-xs font-semibold">
                Pivot Point
              </Label>
              <p className="text-xs text-muted-foreground">
                Allows routing from attacker to internal networks
              </p>
            </div>
            <Switch
              id="is-pivot"
              checked={localMachine.isPivotHost || false}
              onCheckedChange={(checked) => handleUpdate({ isPivotHost: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
