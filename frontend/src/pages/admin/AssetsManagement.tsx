import React, { useEffect, useState } from "react";
import { Upload, Plus, Edit, Trash2, Package, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { httpClient } from "../../api/httpClient";

interface Asset {
  id: string;
  name: string;
  description: string;
  version?: string;
  category?: string;
  installCommand?: string;
  website?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  fileChecksum?: string;
  packageName?: string;
  packageManager?: string;
  usageCount?: number;
  isActive?: boolean;
}

export function AssetsManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "",
    category: "",
    installCommand: "",
    website: "",
    packageName: "",
    packageManager: "",
  });

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const { data } = await httpClient.get('/admin/assets');
      setAssets(data || []);
    } catch (error) {
      console.error("Failed to load assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      let assetId: string;
      
      // Step 1: Create or update asset metadata
      if (editingAsset) {
        await httpClient.put(`/admin/assets/${editingAsset.id}`, formData);
        assetId = editingAsset.id;
        toast.success("Asset updated successfully");
      } else {
        const { data } = await httpClient.post('/admin/assets', formData);
        assetId = data.id;
        toast.success("Asset created successfully");
      }

      // Step 2: Upload file if selected
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);

        await httpClient.post(`/admin/assets/${assetId}/upload-file`, uploadFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        toast.success("File uploaded successfully");
      }

      setDialogOpen(false);
      resetForm();
      loadAssets();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save asset");
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    try {
      await httpClient.delete(`/admin/assets/${assetToDelete}`);
      toast.success("Asset deleted successfully");
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
      loadAssets();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete asset");
    }
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description,
      version: asset.version || "",
      category: asset.category || "",
      installCommand: asset.installCommand || "",
      website: asset.website || "",
      packageName: asset.packageName || "",
      packageManager: asset.packageManager || "",
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAsset(null);
    resetForm();
    setDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setAssetToDelete(id);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      version: "",
      category: "",
      installCommand: "",
      website: "",
      packageName: "",
      packageManager: "",
    });
    setSelectedFile(null);
    setEditingAsset(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'binary': return 'bg-purple-500/10 text-purple-400';
      case 'script': return 'bg-blue-500/10 text-blue-400';
      case 'tool': return 'bg-green-500/10 text-green-400';
      case 'library': return 'bg-yellow-500/10 text-yellow-400';
      case 'config': return 'bg-gray-500/10 text-gray-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Asset Library Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage reusable assets (binaries, scripts, tools) that creators can add to their Docker environments
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No assets in library. Add binaries, scripts, or tools that creators can include in their environments.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Asset
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {assets.map((asset) => (
                <Card key={asset.id} className="border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{asset.name}</h3>
                          {asset.version && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400">
                              v{asset.version}
                            </Badge>
                          )}
                          {asset.category && (
                            <Badge variant="outline" className={getCategoryColor(asset.category)}>
                              {asset.category}
                            </Badge>
                          )}
                          {asset.usageCount !== undefined && asset.usageCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Used in {asset.usageCount} scenario(s)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{asset.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {asset.packageManager && (
                            <div>
                              <span className="font-medium">Package Manager:</span>
                              <div className="text-muted-foreground">{asset.packageManager}</div>
                            </div>
                          )}
                          {asset.packageName && (
                            <div>
                              <span className="font-medium">Package Name:</span>
                              <div className="text-muted-foreground font-mono text-xs">{asset.packageName}</div>
                            </div>
                          )}
                          {asset.fileUrl && (
                            <div>
                              <span className="font-medium">File:</span>
                              <div className="text-green-400 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {formatFileSize(asset.fileSizeBytes)}
                              </div>
                            </div>
                          )}
                        </div>
                        {asset.installCommand && (
                          <div className="mt-3">
                            <span className="text-xs font-medium text-muted-foreground">Install Command:</span>
                            <div className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1">
                              {asset.installCommand}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(asset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(asset.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingAsset ? 'Edit Asset' : 'Add New Asset'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Assets will be available for creators to include in their Docker environments
            </p>
          </DialogHeader>
          <div className="grid gap-6">
            {/* File Upload Section - Prominent */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/20">
              <Label className="text-base font-semibold mb-3 block">Asset File Upload</Label>
              <div className="space-y-3">
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept="*/*"
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm bg-green-500/10 text-green-400 px-3 py-2 rounded">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload binaries, scripts, or configuration files (max 100MB). This file will be mounted in Docker containers when creators select this asset.
                </p>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Nmap Network Scanner"
                  />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="e.g., 7.94"
                  />
                </div>
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this asset do? How will creators use it?"
                  rows={3}
                />
              </div>
            </div>

            {/* Package Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Package Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Security Tool, Network Scanner"
                  />
                </div>
                <div>
                  <Label>Package Manager</Label>
                  <Input
                    value={formData.packageManager}
                    onChange={(e) => setFormData({ ...formData, packageManager: e.target.value })}
                    placeholder="e.g., apt, yum, pip, npm"
                  />
                </div>
              </div>
              <div>
                <Label>Package Name</Label>
                <Input
                  value={formData.packageName}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  placeholder="e.g., nmap, metasploit-framework"
                />
              </div>
              <div>
                <Label>Install Command</Label>
                <Input
                  value={formData.installCommand}
                  onChange={(e) => setFormData({ ...formData, installCommand: e.target.value })}
                  placeholder="e.g., apt-get install -y nmap"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Command to install this asset via package manager (alternative to file upload)
                </p>
              </div>
              <div>
                <Label>Website / Documentation</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://nmap.org"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name || !formData.description}>
              <Upload className="h-4 w-4 mr-2" />
              {editingAsset ? 'Update Asset' : 'Create Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will deactivate the asset. Are you sure?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
