import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Download, Package, FileCode, Info, Server } from 'lucide-react';
import { httpClient } from '../../api/httpClient';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface Asset {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  assetLocation: 'machine-embedded' | 'downloadable';
  machineId: string | null;
  machineName: string | null;
  targetPath: string | null;
  permissions: string | null;
  description: string | null;
  uploadedAt: string;
  minioPath: string;
}

interface Machine {
  id: string;
  name: string;
  role: string;
}

interface AssetsPanelProps {
  scenarioId: string;
  versionId: string;
  machines: Machine[];
}

export const AssetsPanelNew: React.FC<AssetsPanelProps> = ({ scenarioId, versionId, machines }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Upload form fields
  const [assetLocation, setAssetLocation] = useState<'machine-embedded' | 'downloadable'>('downloadable');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [permissions, setPermissions] = useState('0644');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAssets();
  }, [scenarioId, versionId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get(`/creator/scenarios/${scenarioId}/versions/${versionId}/assets`);
      setAssets(response.data.assets || []);
    } catch (error: any) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
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

  const handleUpload = async () => {
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

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('assetLocation', assetLocation);
      
      if (assetLocation === 'machine-embedded') {
        formData.append('machineId', selectedMachineId);
        formData.append('targetPath', targetPath);
        formData.append('permissions', permissions);
      }
      
      if (description) {
        formData.append('description', description);
      }

      await httpClient.post(
        `/creator/scenarios/${scenarioId}/versions/${versionId}/upload-asset`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      toast.success(`✅ Asset uploaded to MinIO (${assetLocation})`);
      setUploadDialogOpen(false);
      resetForm();
      loadAssets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Delete this asset? This action cannot be undone.')) {
      return;
    }

    try {
      await httpClient.delete(`/creator/scenarios/${scenarioId}/versions/${versionId}/assets/${assetId}`);
      toast.success('Asset deleted from MinIO');
      loadAssets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete asset');
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setAssetLocation('downloadable');
    setSelectedMachineId('');
    setTargetPath('');
    setPermissions('0644');
    setDescription('');
  };

  const embeddedAssets = assets.filter(a => a.assetLocation === 'machine-embedded');
  const downloadableAssets = assets.filter(a => a.assetLocation === 'downloadable');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">Two Types of Assets:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Machine-Embedded:</strong> Files baked into Docker containers at build time (flags, configs, tools). 
              Deleted from MinIO after container pushed to AWS ECR.</li>
              <li><strong>Downloadable:</strong> Files solvers download during the challenge (PDFs, scripts, tools). 
              Remain in MinIO permanently, solver gets download links.</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Upload Button */}
      <div className="flex items-center gap-3">
        <Button onClick={() => document.getElementById('asset-upload-input')?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Asset
        </Button>
        <input
          id="asset-upload-input"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <span className="text-sm text-muted-foreground">
          {assets.length} total assets ({formatFileSize(assets.reduce((sum, a) => sum + a.fileSize, 0))})
        </span>
      </div>

      {/* Assets Tabs */}
      <Tabs defaultValue="embedded" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="embedded">
            <Package className="w-4 h-4 mr-2" />
            Machine-Embedded ({embeddedAssets.length})
          </TabsTrigger>
          <TabsTrigger value="downloadable">
            <Download className="w-4 h-4 mr-2" />
            Downloadable ({downloadableAssets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="embedded" className="space-y-3">
          {embeddedAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No machine-embedded assets yet</p>
                <p className="text-sm mt-1">Upload files to be baked into container images</p>
              </CardContent>
            </Card>
          ) : (
            embeddedAssets.map((asset) => (
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
            ))
          )}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Lifecycle:</strong> When admin approves scenario → Backend builds Docker images with these files → 
              Images pushed to AWS ECR → <strong>These assets deleted from MinIO</strong> (already in container images)
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="downloadable" className="space-y-3">
          {downloadableAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No downloadable assets yet</p>
                <p className="text-sm mt-1">Upload files for solvers to download during challenges</p>
              </CardContent>
            </Card>
          ) : (
            downloadableAssets.map((asset) => (
              <Card key={asset.id} className="cyber-border">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileCode className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-semibold">{asset.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(asset.fileSize)}
                          {' • '}
                          <code className="bg-muted px-1 rounded text-xs">{asset.minioPath}</code>
                        </p>
                        {asset.description && (
                          <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(asset.fileUrl, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
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
            ))
          )}
          <Alert className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 text-sm">
              <strong>Lifecycle:</strong> These files remain in MinIO permanently. When solver starts challenge, 
              they see "Assets" section with download links to these files.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>
              Choose where this asset should be deployed and configure its properties
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
                      File stays in MinIO. Solver gets download link in challenge interface. 
                      Perfect for: PDFs, scripts, tools, documentation
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
                      File added to Docker image at build time. Deleted from MinIO after container pushed to ECR. 
                      Perfect for: flags, configs, pre-installed tools
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
                        machines.map((machine) => (
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
                    placeholder="/root/flag.txt or /opt/tools/exploit.py"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Absolute path where file will be placed inside the container
                  </p>
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
            <Button onClick={handleUpload} disabled={loading}>
              {loading ? 'Uploading...' : 'Upload to MinIO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
