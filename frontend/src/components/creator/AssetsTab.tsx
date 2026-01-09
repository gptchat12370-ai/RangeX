import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Info, Upload, Trash2, Download, Package, FileCode, Server, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";
import { httpClient } from "../../api/httpClient";

interface AssetsTabProps {
  data: {
    assets?: any[];
    machines?: any[];
  };
  onChange: (updates: any) => void;
  scenarioId?: string;
  versionId?: string;
}

export function AssetsTab({ data, onChange, scenarioId, versionId }: AssetsTabProps) {
  const machines = data.machines || [];
  const assets = data.assets || [];
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<any>(null);
  const [assetLibrary, setAssetLibrary] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetLocation, setAssetLocation] = useState<'machine-embedded' | 'downloadable'>('downloadable');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [permissions, setPermissions] = useState('0644');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAssetLibrary();
  }, []);

  const loadAssetLibrary = async () => {
    try {
      const { data } = await httpClient.get('/admin/assets-library');
      setAssetLibrary(data || []);
    } catch (error) {
      console.error('Failed to load asset library:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
        return;
      }
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (assetLocation === 'machine-embedded' && !selectedMachineId) {
      toast.error('Please select a machine for embedded assets');
      return;
    }

    if (assetLocation === 'machine-embedded' && !targetPath) {
      toast.error('Please specify target path in container');
      return;
    }

    // Validate target path for machine-embedded assets
    if (assetLocation === 'machine-embedded') {
      const pathValidation = validateTargetPath(targetPath, selectedMachineId);
      if (!pathValidation.isValid) {
        toast.error(pathValidation.error || 'Invalid target path');
        return;
      }
    }

    // Store in local state (will be uploaded to MinIO when submitted for approval)
    const newAsset = {
      id: `asset-${Date.now()}`,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      file: selectedFile, // Keep File object for later upload
      assetLocation,
      machineId: assetLocation === 'machine-embedded' ? selectedMachineId : null,
      machineName: assetLocation === 'machine-embedded' 
        ? machines.find(m => m.id === selectedMachineId)?.name 
        : null,
      targetPath: assetLocation === 'machine-embedded' ? targetPath : null,
      permissions: assetLocation === 'machine-embedded' ? permissions : null,
      description: description || null,
      uploadedAt: new Date().toISOString(),
      status: 'pending-upload', // Will upload to MinIO on submission
    };

    onChange({ assets: [...assets, newAsset] });
    toast.success(`Asset added locally (will upload to MinIO on submission)`);
    setUploadDialogOpen(false);
    resetForm();
  };

  const handleDeleteAsset = (assetId: string) => {
    if (!confirm('Remove this asset? (No files deleted until submission)')) {
      return;
    }
    onChange({ assets: assets.filter((a: any) => a.id !== assetId) });
    toast.success('Asset removed from local state');
  };

  const handleSelectFromLibrary = (libraryAsset: any, location: 'machine-embedded' | 'downloadable') => {
    if (location === 'machine-embedded') {
      // For embedded assets, they're now added directly via the inline form
      // This function is now only used for downloadable assets from the inline library grid
      setSelectedLibraryAsset(libraryAsset);
      setAssetLocation('machine-embedded');
    } else {
      // Directly add as downloadable
      const newAsset = {
        id: `asset-${Date.now()}`,
        fileName: libraryAsset.name,
        fileSize: parseInt(libraryAsset.fileSizeBytes || '0'),
        assetLocation: 'downloadable',
        machineId: null,
        machineName: null,
        targetPath: null,
        permissions: null,
        description: libraryAsset.description,
        uploadedAt: new Date().toISOString(),
        status: 'library-reference',
        libraryAssetId: libraryAsset.id,
        fileUrl: libraryAsset.fileUrl,
      };
      onChange({ assets: [...assets, newAsset] });
      toast.success(`Added "${libraryAsset.name}" from library as downloadable`);
    }
  };

  const handleConfirmLibraryEmbedded = (libraryAsset?: any) => {
    const assetToAdd = libraryAsset || selectedLibraryAsset;
    if (!assetToAdd) return;
    if (!selectedMachineId || !targetPath) {
      toast.error('Please select machine and target path');
      return;
    }

    // Validate target path
    const pathValidation = validateTargetPath(targetPath, selectedMachineId);
    if (!pathValidation.isValid) {
      toast.error(pathValidation.error || 'Invalid target path');
      return;
    }

    const newAsset = {
      id: `asset-${Date.now()}`,
      fileName: assetToAdd.name,
      fileSize: parseInt(assetToAdd.fileSizeBytes || '0'),
      assetLocation: 'machine-embedded',
      machineId: selectedMachineId,
      machineName: machines.find(m => m.id === selectedMachineId)?.name,
      targetPath,
      permissions,
      description: assetToAdd.description,
      uploadedAt: new Date().toISOString(),
      status: 'library-reference',
      libraryAssetId: assetToAdd.id,
      fileUrl: assetToAdd.fileUrl,
    };

    onChange({ assets: [...assets, newAsset] });
    toast.success(`Added "${assetToAdd.name}" from library as embedded asset`);
    setSelectedLibraryAsset(null);
    resetForm();
  };

  // Path validation function
  const validateTargetPath = (path: string, machineId: string) => {
    if (!path || path.trim().length === 0) {
      return { isValid: false, error: 'Target path is required' };
    }

    const trimmedPath = path.trim();

    // Determine machine OS type (check if it's a Windows-based image)
    const machine = machines.find(m => m.id === machineId);
    const isWindowsMachine = machine?.imageRef?.toLowerCase().includes('windows') ||
                            machine?.imageRef?.toLowerCase().includes('nanoserver') ||
                            machine?.imageRef?.toLowerCase().includes('servercore');

    if (isWindowsMachine) {
      // Windows path validation: C:\path\to\file or \\?\C:\path
      const windowsPathRegex = /^[a-zA-Z]:\\\\(?:[^<>:"|?*\\r\\n]+\\\\)*[^<>:"|?*\\r\\n]*$/;
      const uncPathRegex = /^\\\\\\\\[^\\\\/:*?"<>|\\r\\n]+\\\\[^\\\\/:*?"<>|\\r\\n]+/;
      
      if (!windowsPathRegex.test(trimmedPath) && !uncPathRegex.test(trimmedPath)) {
        return {
          isValid: false,
          error: 'Invalid Windows path. Use format like C:\\\\path\\\\to\\\\file.txt'
        };
      }

      // Check for invalid characters in Windows paths
      if (/[<>:"|?*]/.test(trimmedPath.substring(3))) { // Skip drive letter check
        return {
          isValid: false,
          error: 'Windows path contains invalid characters: < > : " | ? *'
        };
      }
    } else {
      // Linux/Unix path validation: /path/to/file
      if (!trimmedPath.startsWith('/')) {
        return {
          isValid: false,
          error: 'Linux path must start with / (absolute path required)'
        };
      }

      // Check for invalid characters in Linux paths (null byte)
      if (trimmedPath.includes('\\0')) {
        return {
          isValid: false,
          error: 'Path contains null byte (invalid)'
        };
      }

      // Warn about potentially problematic paths
      if (trimmedPath.includes('//')) {
        return {
          isValid: false,
          error: 'Path contains double slashes (//). Use single slashes only'
        };
      }

      // Check path length (Linux typically max 4096)
      if (trimmedPath.length > 4096) {
        return {
          isValid: false,
          error: 'Path exceeds maximum length (4096 characters)'
        };
      }
    }

    return { isValid: true };
  };

  const resetForm = () => {
    setSelectedFile(null);
    setAssetLocation('downloadable');
    setSelectedMachineId('');
    setTargetPath('');
    setPermissions('0644');
    setDescription('');
  };

  const embeddedAssets = assets.filter((a: any) => a.assetLocation === 'machine-embedded');
  const downloadableAssets = assets.filter((a: any) => a.assetLocation === 'downloadable');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario Assets</CardTitle>
          <CardDescription>
            Upload files or select from the asset library in each tab below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Workflow:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Local Development:</strong> Add assets here (stored in browser memory)</li>
                  <li><strong>Submit for Approval:</strong> Assets uploaded to MinIO + scenario saved to database</li>
                  <li><strong>Admin Approves:</strong> Containers built with embedded assets → Pushed to ECR → Embedded assets deleted from MinIO</li>
                  <li><strong>Solver Plays:</strong> Containers deployed from ECR + downloadable assets available from MinIO</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {machines.length === 0 && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                No machines configured yet. Go to <strong>Environment tab</strong> to add machines before adding machine-embedded assets.
              </AlertDescription>
            </Alert>
          )}

          {/* Assets Tabs */}
          <Tabs defaultValue="embedded" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="embedded">
                <Server className="w-4 h-4 mr-2" />
                Machine-Embedded ({embeddedAssets.length})
              </TabsTrigger>
              <TabsTrigger value="downloadable">
                <Download className="w-4 h-4 mr-2" />
                Downloadable ({downloadableAssets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="embedded" className="space-y-4">
              {/* Configuration Form for Adding Embedded Assets */}
              {machines.length > 0 && (
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Add Machine-Embedded Asset
                    </CardTitle>
                    <CardDescription>
                      Select a machine and configure where the asset should be placed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Machine Selection */}
                    <div>
                      <Label>Select Machine *</Label>
                      <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose which machine will receive this asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((machine: any) => (
                            <SelectItem key={machine.id} value={machine.id}>
                              <div className="flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                {machine.name} ({machine.role}) - {machine.imageRef}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMachineId && (
                      <>
                        {/* Container Path */}
                        <div>
                          <Label>Container Path *</Label>
                          <Input
                            placeholder={
                              machines.find(m => m.id === selectedMachineId)?.imageRef?.toLowerCase().includes('windows')
                                ? "C:\\\\path\\\\to\\\\file.txt"
                                : "/root/flag.txt or /opt/tools/exploit.py"
                            }
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            {machines.find(m => m.id === selectedMachineId)?.imageRef?.toLowerCase().includes('windows') ? (
                              <p className="text-amber-600 dark:text-amber-400">
                                <strong>Windows:</strong> Use format C:\\\\path\\\\to\\\\file.txt
                              </p>
                            ) : (
                              <p className="text-blue-600 dark:text-blue-400">
                                <strong>Linux:</strong> Must start with / (e.g., /root/flag.txt)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Permissions */}
                        <div>
                          <Label>File Permissions</Label>
                          <Select value={permissions} onValueChange={setPermissions}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0644">0644 (rw-r--r--) - Read-only for others</SelectItem>
                              <SelectItem value="0755">0755 (rwxr-xr-x) - Executable</SelectItem>
                              <SelectItem value="0600">0600 (rw-------) - Owner only</SelectItem>
                              <SelectItem value="0400">0400 (r--------) - Read-only, owner only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Description */}
                        <div>
                          <Label>Description (Optional)</Label>
                          <Textarea
                            placeholder="Describe this asset's purpose..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                          />
                        </div>

                        {/* Upload from File */}
                        <div className="border-t pt-4">
                          <Label htmlFor="file-upload-embedded">Upload from File</Label>
                          <Input
                            id="file-upload-embedded"
                            type="file"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                if (file.size > 100 * 1024 * 1024) {
                                  toast.error('File size must be less than 100MB');
                                  return;
                                }
                                if (!selectedMachineId || !targetPath) {
                                  toast.error('Please select machine and target path first');
                                  return;
                                }
                                const pathValidation = validateTargetPath(targetPath, selectedMachineId);
                                if (!pathValidation.isValid) {
                                  toast.error(pathValidation.error || 'Invalid target path');
                                  return;
                                }
                                const newAsset = {
                                  id: `asset-${Date.now()}`,
                                  fileName: file.name,
                                  fileSize: file.size,
                                  file,
                                  assetLocation: 'machine-embedded' as const,
                                  machineId: selectedMachineId,
                                  machineName: machines.find(m => m.id === selectedMachineId)?.name,
                                  targetPath,
                                  permissions,
                                  description: description || null,
                                  uploadedAt: new Date().toISOString(),
                                  status: 'pending-upload',
                                };
                                onChange({ assets: [...assets, newAsset] });
                                toast.success(`Asset added locally (will upload to MinIO on submission)`);
                                resetForm();
                                e.target.value = '';
                              }
                            }}
                            className="cursor-pointer"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Max 100MB. Will be uploaded to MinIO on submission.</p>
                        </div>

                        {/* Asset Library Selection */}
                        <div className="border-t pt-4 mt-4">
                          <h4 className="text-sm font-semibold mb-3">Or Select from Asset Library</h4>
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {assetLibrary.map((asset: any) => (
                              <Card key={asset.id} className="hover:border-primary transition-colors">
                                <CardContent className="py-2 px-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm">{asset.name}</p>
                                        <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                                        <Badge variant="secondary" className="text-xs">{formatFileSize(parseInt(asset.fileSizeBytes || '0'))}</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmLibraryEmbedded(asset)}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Your Uploaded Assets */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Your Uploaded Assets ({embeddedAssets.length})
                </h3>
                {embeddedAssets.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No uploaded machine-embedded assets yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {embeddedAssets.map((asset: any) => (
                      <Card key={asset.id} className="cyber-border">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Server className="w-5 h-5 text-blue-500" />
                              <div>
                                <p className="font-semibold">{asset.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Machine: <Badge variant="outline">{asset.machineName || 'Unknown'}</Badge>
                                  {' → '}
                                  <code className="bg-muted px-1 rounded">{asset.targetPath}</code>
                                  {' '}
                                  ({formatFileSize(asset.fileSize)})
                                </p>
                                {asset.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                                )}
                                {asset.status === 'pending-upload' && (
                                  <Badge variant="secondary" className="mt-1 text-xs">Pending Upload</Badge>
                                )}
                                {asset.status === 'library-reference' && (
                                  <Badge variant="outline" className="mt-1 text-xs">From Library</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {asset.permissions}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAsset(asset.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Asset Library Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Select from Asset Library ({assetLibrary.length})
                </h3>
                {assetLibrary.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No assets available in library</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {assetLibrary.map((asset: any) => (
                      <Card key={asset.id} className="hover:border-primary transition-colors">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{asset.name}</p>
                                <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{asset.description}</p>
                              {asset.installCommand && (
                                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block">
                                  {asset.installCommand}
                                </code>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSelectFromLibrary(asset, 'machine-embedded')}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Select
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>Lifecycle:</strong> On approval → Built into Docker images → Pushed to ECR → <strong>Deleted from MinIO</strong>
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="downloadable" className="space-y-4">
              {/* Upload from File */}
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Downloadable Asset
                  </CardTitle>
                  <CardDescription>
                    Upload a file that solvers can download during the challenge
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="description-downloadable">Description (Optional)</Label>
                    <Textarea
                      id="description-downloadable"
                      placeholder="Describe this asset's purpose..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="file-upload-downloadable">Upload File</Label>
                    <Input
                      id="file-upload-downloadable"
                      type="file"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.size > 100 * 1024 * 1024) {
                            toast.error('File size must be less than 100MB');
                            return;
                          }
                          const newAsset = {
                            id: `asset-${Date.now()}`,
                            fileName: file.name,
                            fileSize: file.size,
                            file,
                            assetLocation: 'downloadable' as const,
                            machineId: null,
                            machineName: null,
                            targetPath: null,
                            permissions: null,
                            description: description || null,
                            uploadedAt: new Date().toISOString(),
                            status: 'pending-upload',
                          };
                          onChange({ assets: [...assets, newAsset] });
                          toast.success(`Asset added locally (will upload to MinIO on submission)`);
                          setDescription('');
                          e.target.value = '';
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max 100MB. Solvers will get a download link.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Your Uploaded Assets */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Your Uploaded Assets ({downloadableAssets.length})
                </h3>
                {downloadableAssets.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Download className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No uploaded downloadable assets yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {downloadableAssets.map((asset: any) => (
                      <Card key={asset.id} className="cyber-border">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileCode className="w-5 h-5 text-green-500" />
                              <div>
                                <p className="font-semibold">{asset.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(asset.fileSize)}
                                </p>
                                {asset.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                                )}
                                {asset.status === 'pending-upload' && (
                                  <Badge variant="secondary" className="mt-1 text-xs">Pending Upload</Badge>
                                )}
                                {asset.status === 'library-reference' && (
                                  <Badge variant="outline" className="mt-1 text-xs">From Library</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAsset(asset.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Asset Library Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Select from Asset Library ({assetLibrary.length})
                </h3>
                {assetLibrary.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No assets available in library</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {assetLibrary.map((asset: any) => (
                      <Card key={asset.id} className="hover:border-primary transition-colors">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{asset.name}</p>
                                <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{asset.description}</p>
                              {asset.installCommand && (
                                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block">
                                  {asset.installCommand}
                                </code>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSelectFromLibrary(asset, 'downloadable')}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Select
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  <strong>Lifecycle:</strong> Uploaded to MinIO on submission → <strong>Remain permanently</strong> → Solver gets download links
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
            <DialogDescription>
              Configure asset properties (will be uploaded to MinIO when you submit for approval)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedFile && (
              <Alert>
                <FileCode className="h-4 w-4" />
                <AlertDescription>
                  <strong>File:</strong> {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </AlertDescription>
              </Alert>
            )}

            {/* Asset Location Type */}
            <div className="space-y-3">
              <Label>Asset Location</Label>
              <RadioGroup value={assetLocation} onValueChange={(val) => setAssetLocation(val as any)}>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="downloadable" id="downloadable" />
                  <div className="flex-1">
                    <Label htmlFor="downloadable" className="cursor-pointer font-semibold">
                      Downloadable (Solver Downloads During Challenge)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      File stays in MinIO. Solver gets download link. Perfect for: PDFs, scripts, tools
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="machine-embedded" id="machine-embedded" />
                  <div className="flex-1">
                    <Label htmlFor="machine-embedded" className="cursor-pointer font-semibold">
                      Machine-Embedded (Baked Into Container)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      File added to Docker image. Deleted from MinIO after ECR push. Perfect for: flags, configs
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Machine-Embedded Configuration */}
            {assetLocation === 'machine-embedded' && (
              <>
                <div>
                  <Label htmlFor="machine">Target Machine *</Label>
                  <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                    <SelectTrigger id="machine">
                      <SelectValue placeholder="Select machine to embed this file into" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.length === 0 ? (
                        <SelectItem value="none" disabled>No machines configured</SelectItem>
                      ) : (
                        machines.map((machine: any) => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.name} ({machine.role})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="targetPath">Container Path *</Label>
                  <Input
                    id="targetPath"
                    placeholder={
                      selectedMachineId && machines.find(m => m.id === selectedMachineId)?.imageRef?.toLowerCase().includes('windows')
                        ? "C:\\\\path\\\\to\\\\file.txt"
                        : "/root/flag.txt or /opt/tools/exploit.py"
                    }
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Absolute path where file will be placed inside the container</p>
                    {selectedMachineId && machines.find(m => m.id === selectedMachineId)?.imageRef?.toLowerCase().includes('windows') ? (
                      <p className="text-amber-600 dark:text-amber-400">
                        <strong>Windows:</strong> Use format C:\\\\path\\\\to\\\\file.txt
                      </p>
                    ) : (
                      <p className="text-blue-600 dark:text-blue-400">
                        <strong>Linux:</strong> Must start with / (e.g., /root/flag.txt)
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="permissions">File Permissions</Label>
                  <Select value={permissions} onValueChange={setPermissions}>
                    <SelectTrigger id="permissions">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0644">0644 (rw-r--r--) - Read-only for others</SelectItem>
                      <SelectItem value="0755">0755 (rwxr-xr-x) - Executable</SelectItem>
                      <SelectItem value="0600">0600 (rw-------) - Owner only</SelectItem>
                      <SelectItem value="0400">0400 (r--------) - Read-only, owner only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Description (optional for both types) */}
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe this asset's purpose..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpload}>
              Add to Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
