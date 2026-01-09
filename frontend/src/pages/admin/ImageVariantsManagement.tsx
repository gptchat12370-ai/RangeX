import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Separator } from '../../components/ui/separator';
import { toast } from 'sonner';
import { httpClient } from '../../api/httpClient';

interface ImageVariant {
  id: string;
  baseOs: string;
  variantType: string;
  imageRef: string;
  version?: string; // NEW: specific version tag
  imageCategory?: string; // NEW: attacker/library/service
  displayName: string;
  description: string;
  cpuCores: number | string; // Can be string from DB
  memoryMb: number;
  diskGb: number;
  hourlyCostRm: number | string; // Can be string from DB
  suitableForRoles: string[];
  includedTools: string[];
  tags: string[];
  isActive: boolean;
  isAdminApproved: boolean;
  createdAt: string;
  updatedAt: string;
  hasGui?: boolean; // Has desktop GUI (VNC, RDP, Kasm)
  recommendedNetworkGroup?: string; // Auto-suggest network group
  notes?: string; // Admin notes
  defaultEntrypoints?: Array<{
    protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
}

export function ImageVariantsManagement() {
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVariant, setEditingVariant] = useState<ImageVariant | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    baseOs: '',
    variantType: 'standard',
    imageRef: '',
    version: '',
    imageCategory: 'library',
    displayName: '',
    description: '',
    cpuCores: '0.5',
    memoryMb: '512',
    diskGb: '10',
    hourlyCostRm: '0.05',
    suitableForRoles: '',
    includedTools: '',
    tags: '',
    hasGui: false,
    recommendedNetworkGroup: '',
    notes: '',
    defaultEntrypoints: [] as Array<{
      protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
      containerPort: number;
      exposedToSolver: boolean;
      description: string;
    }>,
  });

  useEffect(() => {
    loadVariants();
  }, []);

  const loadVariants = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get('/admin/image-variants');
      setVariants(data);
    } catch (error) {
      toast.error('Failed to load image variants');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await httpClient.patch(`/admin/image-variants/${id}/toggle-active`);
      toast.success('Variant status updated');
      loadVariants();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update variant');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will deactivate the variant.')) return;
    
    try {
      await httpClient.delete(`/admin/image-variants/${id}`);
      toast.success('Variant deactivated');
      loadVariants();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete variant');
    }
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        variantType: formData.variantType,
        imageRef: formData.imageRef,
        version: formData.version || undefined,
        imageCategory: formData.imageCategory,
        displayName: formData.displayName,
        description: formData.description,
        cpuCores: parseFloat(formData.cpuCores),
        memoryMb: parseInt(formData.memoryMb),
        diskGb: parseInt(formData.diskGb),
        hourlyCostRm: parseFloat(formData.hourlyCostRm),
        suitableForRoles: formData.suitableForRoles.split(',').map(r => r.trim()).filter(Boolean).join(','),
        includedTools: formData.includedTools.split(',').map(t => t.trim()).filter(Boolean).join(','),
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean).join(','),
        hasGui: formData.hasGui,
        recommendedNetworkGroup: formData.recommendedNetworkGroup || undefined,
        notes: formData.notes || undefined,
        defaultEntrypoints: formData.defaultEntrypoints.length > 0 ? formData.defaultEntrypoints : undefined,
      };
      
      // Only include baseOs when creating new variant
      if (!editingVariant) {
        payload.baseOs = formData.baseOs;
      }

      if (editingVariant) {
        await httpClient.put(`/admin/image-variants/${editingVariant.id}`, payload);
        toast.success('Image variant updated successfully');
      } else {
        await httpClient.post('/admin/image-variants', payload);
        toast.success('Image variant created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingVariant(null);
      setFormData({
        baseOs: '',
        variantType: 'standard',
        imageRef: '',
        version: '',
        imageCategory: 'library',
        displayName: '',
        description: '',
        cpuCores: '0.5',
        memoryMb: '512',
        diskGb: '10',
        hourlyCostRm: '0.05',
        suitableForRoles: '',
        includedTools: '',
        tags: '',
        hasGui: false,
        recommendedNetworkGroup: '',
        notes: '',
        defaultEntrypoints: [],
      });
      loadVariants();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || `Failed to ${editingVariant ? 'update' : 'create'} image variant`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Image Variants Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage platform library images available to creators
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadVariants}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVariant ? 'Edit Image Variant' : 'Add Image Variant'}</DialogTitle>
                <DialogDescription>
                  {editingVariant ? 'Update the platform library image variant' : 'Create a new platform library image variant for creators'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Display Name *</Label>
                    <Input
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="e.g., Kali Linux Standard"
                    />
                  </div>
                  <div>
                    <Label>Base OS *</Label>
                    <Input
                      value={formData.baseOs}
                      onChange={(e) => setFormData({ ...formData, baseOs: e.target.value })}
                      placeholder="e.g., kali, ubuntu, alpine"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Variant Type *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.variantType}
                      onChange={(e) => setFormData({ ...formData, variantType: e.target.value })}
                    >
                      <option value="lite">Lite</option>
                      <option value="standard">Standard</option>
                      <option value="full">Full</option>
                    </select>
                  </div>
                  <div>
                    <Label>Image Category *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.imageCategory}
                      onChange={(e) => setFormData({ ...formData, imageCategory: e.target.value })}
                    >
                      <option value="library">Library</option>
                      <option value="attacker">Attacker</option>
                      <option value="service">Service</option>
                    </select>
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="e.g., 2024.1, 22.04"
                    />
                  </div>
                </div>

                <div>
                  <Label>Image Reference *</Label>
                  <Input
                    value={formData.imageRef}
                    onChange={(e) => setFormData({ ...formData, imageRef: e.target.value })}
                    placeholder="e.g., kalilinux/kali-rolling:latest"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Full Docker image reference (repository:tag)</p>
                </div>

                <div>
                  <Label>Description *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the image variant"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>CPU Cores *</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={formData.cpuCores}
                      onChange={(e) => setFormData({ ...formData, cpuCores: e.target.value })}
                      placeholder="0.5"
                    />
                  </div>
                  <div>
                    <Label>Memory (MB) *</Label>
                    <Input
                      type="number"
                      value={formData.memoryMb}
                      onChange={(e) => setFormData({ ...formData, memoryMb: e.target.value })}
                      placeholder="512"
                    />
                  </div>
                  <div>
                    <Label>Disk (GB) *</Label>
                    <Input
                      type="number"
                      value={formData.diskGb}
                      onChange={(e) => setFormData({ ...formData, diskGb: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <Label>Cost (RM/hr) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.hourlyCostRm}
                      onChange={(e) => setFormData({ ...formData, hourlyCostRm: e.target.value })}
                      placeholder="0.05"
                    />
                  </div>
                </div>

                <div>
                  <Label>Suitable Roles (comma-separated)</Label>
                  <Input
                    value={formData.suitableForRoles}
                    onChange={(e) => setFormData({ ...formData, suitableForRoles: e.target.value })}
                    placeholder="e.g., attacker, internal, service"
                  />
                </div>

                <div>
                  <Label>Included Tools (comma-separated)</Label>
                  <Input
                    value={formData.includedTools}
                    onChange={(e) => setFormData({ ...formData, includedTools: e.target.value })}
                    placeholder="e.g., nmap, sqlmap, metasploit"
                  />
                </div>

                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., penetration-testing, lightweight"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="hasGui" className="text-sm font-semibold">Has GUI / Desktop</Label>
                      <p className="text-xs text-muted-foreground">Image includes desktop environment (VNC, RDP, Kasm)</p>
                    </div>
                    <Switch
                      id="hasGui"
                      checked={formData.hasGui}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasGui: checked })}
                    />
                  </div>
                  <div>
                    <Label>Recommended Network Group</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.recommendedNetworkGroup}
                      onChange={(e) => setFormData({ ...formData, recommendedNetworkGroup: e.target.value })}
                    >
                      <option value="">None (user decides)</option>
                      <option value="attacker">Attacker</option>
                      <option value="dmz">DMZ / Web Tier</option>
                      <option value="internal">Internal / Database</option>
                      <option value="mgmt">Management</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Auto-suggest network group when this variant is selected</p>
                  </div>
                </div>

                <div>
                  <Label>Admin Notes (optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal notes about this image variant (not shown to creators)"
                    rows={2}
                  />
                </div>

                <Separator className="my-6" />

                {/* Default Entrypoints Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Default Entrypoints</h3>
                      <p className="text-xs text-muted-foreground">
                        Pre-configured connection points for machines using this variant
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          defaultEntrypoints: [
                            ...formData.defaultEntrypoints,
                            {
                              protocol: 'http',
                              containerPort: 80,
                              exposedToSolver: true,
                              description: '',
                            }
                          ]
                        });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Entrypoint
                    </Button>
                  </div>

                  {formData.defaultEntrypoints.length === 0 ? (
                    <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-center">
                      <p className="text-xs text-muted-foreground">
                        No entrypoints configured. Click "Add Entrypoint" to define default connection points.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.defaultEntrypoints.map((entrypoint, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg border space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Protocol</Label>
                                <Select
                                  value={entrypoint.protocol}
                                  onValueChange={(value: any) => {
                                    const updated = [...formData.defaultEntrypoints];
                                    const portDefaults: Record<string, number> = {
                                      http: 80,
                                      https: 443,
                                      ssh: 22,
                                      rdp: 3389,
                                      vnc: 5900,
                                      tcp: 8080,
                                      udp: 8080,
                                    };
                                    updated[index] = {
                                      ...entrypoint,
                                      protocol: value,
                                      containerPort: portDefaults[value] || 80,
                                    };
                                    setFormData({ ...formData, defaultEntrypoints: updated });
                                  }}
                                >
                                  <SelectTrigger className="h-9 text-xs">
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
                              </div>
                              <div>
                                <Label className="text-xs">Container Port</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-xs"
                                  value={entrypoint.containerPort}
                                  onChange={(e) => {
                                    const updated = [...formData.defaultEntrypoints];
                                    updated[index] = {
                                      ...entrypoint,
                                      containerPort: parseInt(e.target.value) || 0,
                                    };
                                    setFormData({ ...formData, defaultEntrypoints: updated });
                                  }}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              className="h-9 w-9 p-0"
                              onClick={() => {
                                const updated = formData.defaultEntrypoints.filter((_, i) => i !== index);
                                setFormData({ ...formData, defaultEntrypoints: updated });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div>
                            <Label className="text-xs">Description (optional)</Label>
                            <Input
                              className="h-9 text-xs"
                              placeholder="e.g., Web Interface, SSH Access, VNC Desktop"
                              value={entrypoint.description}
                              onChange={(e) => {
                                const updated = [...formData.defaultEntrypoints];
                                updated[index] = {
                                  ...entrypoint,
                                  description: e.target.value,
                                };
                                setFormData({ ...formData, defaultEntrypoints: updated });
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <div>
                              <Label htmlFor={`expose-${index}`} className="text-xs font-semibold">
                                Expose to Solver by Default
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                When creators use this variant, this entrypoint will be solver-accessible
                              </p>
                            </div>
                            <Switch
                              id={`expose-${index}`}
                              checked={entrypoint.exposedToSolver}
                              onCheckedChange={(checked) => {
                                const updated = [...formData.defaultEntrypoints];
                                updated[index] = {
                                  ...entrypoint,
                                  exposedToSolver: checked,
                                };
                                setFormData({ ...formData, defaultEntrypoints: updated });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setEditingVariant(null);
                }}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.displayName || !formData.baseOs || !formData.imageRef || !formData.description}
                >
                  {editingVariant ? 'Update Variant' : 'Create Variant'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Library Images</CardTitle>
          <CardDescription>
            {variants.length} total variants ({variants.filter(v => v.isActive).length} active)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No image variants found. Run the seed script to populate.
            </div>
          ) : (
            <div className="space-y-4">
              {variants.map((variant) => (
                <Card key={variant.id} className={!variant.isActive ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{variant.displayName}</h3>
                          <Badge variant={variant.variantType === 'lite' ? 'default' : variant.variantType === 'standard' ? 'secondary' : 'outline'}>
                            {variant.variantType.toUpperCase()}
                          </Badge>
                          {variant.version && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400">
                              v{variant.version}
                            </Badge>
                          )}
                          {variant.imageCategory && (
                            <Badge variant="outline" className={
                              variant.imageCategory === 'attacker' ? 'bg-red-500/10 text-red-400' :
                              variant.imageCategory === 'service' ? 'bg-green-500/10 text-green-400' :
                              'bg-gray-500/10 text-gray-400'
                            }>
                              {variant.imageCategory.toUpperCase()}
                            </Badge>
                          )}
                          {!variant.isActive && (
                            <Badge variant="destructive">INACTIVE</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">{variant.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Image Ref:</span>
                            <div className="font-mono text-xs mt-1 bg-muted px-2 py-1 rounded">
                              {variant.imageRef}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Resources:</span>
                            <div className="text-muted-foreground mt-1">
                              {typeof variant.cpuCores === 'string' ? parseFloat(variant.cpuCores) : variant.cpuCores} vCPU, {variant.memoryMb}MB RAM
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Cost:</span>
                            <div className="text-green-400 mt-1">
                              RM {(typeof variant.hourlyCostRm === 'string' ? parseFloat(variant.hourlyCostRm) : variant.hourlyCostRm).toFixed(4)}/hr
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Roles:</span>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {variant.suitableForRoles.map((role) => (
                                <Badge key={role} variant="outline" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {variant.includedTools && variant.includedTools.length > 0 && (
                          <div className="mt-3">
                            <span className="text-sm font-medium">Tools: </span>
                            <span className="text-sm text-muted-foreground">
                              {variant.includedTools.join(', ')}
                            </span>
                          </div>
                        )}

                        {variant.tags && variant.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {variant.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingVariant(variant);
                            setFormData({
                              baseOs: variant.baseOs,
                              variantType: variant.variantType,
                              imageRef: variant.imageRef,
                              version: variant.version || '',
                              imageCategory: variant.imageCategory || 'library',
                              displayName: variant.displayName,
                              description: variant.description,
                              cpuCores: String(variant.cpuCores),
                              memoryMb: String(variant.memoryMb),
                              diskGb: String(variant.diskGb),
                              hourlyCostRm: String(variant.hourlyCostRm),
                              suitableForRoles: variant.suitableForRoles.join(', '),
                              includedTools: variant.includedTools.join(', '),
                              tags: variant.tags.join(', '),
                              hasGui: variant.hasGui || false,
                              recommendedNetworkGroup: variant.recommendedNetworkGroup || '',
                              notes: variant.notes || '',
                              defaultEntrypoints: variant.defaultEntrypoints || [],
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={variant.isActive ? 'outline' : 'default'}
                          onClick={() => handleToggleActive(variant.id)}
                        >
                          {variant.isActive ? (
                            <><EyeOff className="h-4 w-4" /></>
                          ) : (
                            <><Eye className="h-4 w-4" /></>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(variant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
