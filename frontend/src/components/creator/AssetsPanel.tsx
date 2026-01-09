import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Edit } from 'lucide-react';
import { httpClient } from '../../api/httpClient';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';

interface Asset {
  id: string;
  fileName: string;
  assetType: 'file' | 'config' | 'tool' | 'script';
  fileSize: number;
  fileUrl: string;
  machineId: string | null;
  machineName: string | null;
  targetPath: string | null;
  permissions: string | null;
  description: string | null;
  uploadedAt: string;
}

interface Machine {
  id: string;
  name: string;
  role: string;
}

interface AssetsPanelProps {
  scenarioId: string;
  versionId: string;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({ scenarioId, versionId }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetType, setAssetType] = useState<'file' | 'config' | 'tool' | 'script'>('file');
  const [machineId, setMachineId] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [permissions, setPermissions] = useState('0644');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAssets();
    loadMachines();
  }, [scenarioId, versionId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get(`/creator/scenarios/${scenarioId}/versions/${versionId}/assets`);
      setAssets(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const loadMachines = async () => {
    try {
      const response = await httpClient.get(`/creator/scenarios/${scenarioId}/versions/${versionId}`);
      setMachines(response.data.machines || []);
    } catch (error: any) {
      toast.error('Failed to load machines');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('assetType', assetType);
      
      if (machineId) {
        formData.append('machineId', machineId);
        formData.append('targetPath', targetPath);
        formData.append('permissions', permissions);
        formData.append('description', description);
      }

      await httpClient.post(
        `/creator/scenarios/${scenarioId}/versions/${versionId}/upload-asset`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      toast.success('Asset uploaded successfully');
      setUploadDialogOpen(false);
      resetForm();
      loadAssets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAssignment = (asset: Asset) => {
    setSelectedAsset(asset);
    setMachineId(asset.machineId || '');
    setTargetPath(asset.targetPath || '');
    setPermissions(asset.permissions || '0644');
    setDescription(asset.description || '');
    setAssignDialogOpen(true);
  };

  const handleUpdateAssignment = async () => {
    if (!selectedAsset) return;

    try {
      setLoading(true);
      await httpClient.put(`/creator/assets/${selectedAsset.id}/assign`, {
        machineId,
        targetPath,
        permissions,
        description,
      });

      toast.success('Assignment updated successfully');
      setAssignDialogOpen(false);
      resetForm();
      loadAssets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Delete ${asset.fileName}?`)) return;

    try {
      setLoading(true);
      await httpClient.delete(`/creator/scenarios/${scenarioId}/versions/${versionId}/asset`, {
        data: { fileUrl: asset.fileUrl },
      });

      toast.success('Asset deleted successfully');
      loadAssets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete asset');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedAsset(null);
    setAssetType('file');
    setMachineId('');
    setTargetPath('');
    setPermissions('0644');
    setDescription('');
  };

  const handleMachineChange = (value: string) => {
    if (value === 'none') {
      setMachineId('');
      setTargetPath('');
      setDescription('');
    } else {
      setMachineId(value);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'file': return 'default';
      case 'config': return 'secondary';
      case 'tool': return 'outline';
      case 'script': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Uploaded Assets ({assets.length})</h3>
          <p className="text-sm text-muted-foreground">
            Files to be baked into Docker images and deployed to ECR
          </p>
        </div>
        <Button onClick={() => document.getElementById('asset-upload')?.click()} disabled={loading}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Asset
        </Button>
        <input
          id="asset-upload"
          type="file"
          hidden
          onChange={handleFileSelect}
        />
      </div>

      {assets.length === 0 && !loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No assets uploaded yet. Upload files (flags, configs, tools) to be injected into containers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{asset.fileName}</p>
                      <Badge variant={getAssetTypeColor(asset.assetType) as any}>
                        {asset.assetType.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{formatFileSize(asset.fileSize)}</span>
                      {asset.machineName ? (
                        <>
                          <span>→ {asset.machineName}</span>
                          {asset.targetPath && (
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {asset.targetPath}
                            </code>
                          )}
                          {asset.permissions && (
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {asset.permissions}
                            </code>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600">Not Assigned</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAssignment(asset)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(asset)}
                      className="text-destructive hover:text-destructive"
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

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) { setUploadDialogOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>
              Upload a file to be injected into scenario containers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>File</Label>
              <p className="text-sm text-muted-foreground">
                {selectedFile?.name} ({selectedFile ? formatFileSize(selectedFile.size) : ''})
              </p>
            </div>

            <div>
              <Label>Asset Type</Label>
              <Select value={assetType} onValueChange={(value: any) => setAssetType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">Flag / File</SelectItem>
                  <SelectItem value="config">Configuration</SelectItem>
                  <SelectItem value="tool">Tool / Binary</SelectItem>
                  <SelectItem value="script">Script</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assign to Machine (Optional)</Label>
              <Select value={machineId || 'none'} onValueChange={handleMachineChange}>
                <SelectTrigger>
                  <SelectValue placeholder="None (assign later)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (assign later)</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {machineId && (
              <>
                <div>
                  <Label>Target Path in Container</Label>
                  <Input
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    placeholder="/var/www/html/flag.txt"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Absolute path where file will be placed in container
                  </p>
                </div>

                <div>
                  <Label>Permissions</Label>
                  <Select value={permissions} onValueChange={setPermissions}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0644">0644 (read-only)</SelectItem>
                      <SelectItem value="0755">0755 (executable)</SelectItem>
                      <SelectItem value="0777">0777 (full access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Root flag for privilege escalation"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={loading || !selectedFile}>
              {loading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Edit Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => { if (!open) { setAssignDialogOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset Assignment</DialogTitle>
            <DialogDescription>
              Assign this asset to a machine and specify where it should be placed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>File</Label>
              <p className="text-sm text-muted-foreground">{selectedAsset?.fileName}</p>
            </div>

            <div>
              <Label>Machine</Label>
              <Select value={machineId || 'none'} onValueChange={handleMachineChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a machine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {machineId && (
              <>
                <div>
                  <Label>Target Path</Label>
                  <Input
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    placeholder="/root/flag.txt"
                  />
                </div>

                <div>
                  <Label>Permissions</Label>
                  <Select value={permissions} onValueChange={setPermissions}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0644">0644 (read-only)</SelectItem>
                      <SelectItem value="0755">0755 (executable)</SelectItem>
                      <SelectItem value="0777">0777 (full access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAssignment} disabled={loading}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
