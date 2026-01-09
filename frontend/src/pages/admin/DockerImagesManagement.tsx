import React, { useState, useEffect } from 'react';
import { Download, Trash2, RefreshCw, Database, CheckCircle, XCircle, Container, Plus, Search, Edit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import { httpClient } from '../../api/httpClient';

interface DockerImage {
  id: string;
  name: string;
  tag: string;
  registryUrl: string;
  description?: string;
  category?: string;
  isPublic: boolean;
  isReadyImage: boolean;
  minioPath?: string;
  imageSizeMb?: number;
  pullCount?: number;
  lastPulledAt?: string;
}

interface StorageStats {
  totalImages: number;
  cachedImages: number;
  totalSizeMb: number;
}

export function DockerImagesManagement() {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pullingImages, setPullingImages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [newImage, setNewImage] = useState({
    name: '',
    tag: '', // No default - user must specify version
    registryUrl: 'docker.io',
    description: '',
    category: 'Base Images',
    isPublic: true,
    isReadyImage: true,
  });

  useEffect(() => {
    loadImages();
    loadStorageStats();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const { data } = await httpClient.get('/docker-images/all');
      console.log('Loaded images:', data);
      setImages(data);
    } catch (error: any) {
      console.error('Error loading images:', error);
      toast.error(error.response?.data?.message || 'Failed to load Docker images');
    } finally {
      setLoading(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const { data } = await httpClient.get('/docker-images/stats/storage');
      setStorageStats(data);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleAddImage = async () => {
    try {
      const { data: created } = await httpClient.post('/docker-images', newImage);
      toast.success('Docker image added successfully');
      setShowAddDialog(false);
      setNewImage({
        name: '',
        tag: '', // Reset to empty
        registryUrl: 'docker.io',
        description: '',
        category: 'Base Images',
        isPublic: true,
        isReadyImage: true,
      });
      loadImages();
      loadStorageStats();
      
      // Auto-pull if public
      if (newImage.isPublic) {
        toast.info('Pulling image in background...');
        handlePullImage(created.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add image');
    }
  };

  const handlePullImage = async (imageId: string) => {
    setPullingImages((prev) => new Set(prev).add(imageId));
    toast.info('Pulling Docker image...');
    
    try {
      const { data: result } = await httpClient.post(`/docker-images/${imageId}/pull-and-store`);
      toast.success(`Image pulled successfully (${result.sizeMb} MB)`);
      loadImages();
      loadStorageStats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to pull image');
    } finally {
      setPullingImages((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const handleDeleteImage = async (imageId: string, imageName: string) => {
    if (!confirm(`Are you sure you want to delete ${imageName}?`)) return;

    try {
      await httpClient.delete(`/docker-images/${imageId}`);
      toast.success('Image deleted successfully');
      loadImages();
      loadStorageStats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete image');
    }
  };

  const handleToggleReady = async (imageId: string, currentValue: boolean) => {
    try {
      await httpClient.put(`/docker-images/${imageId}`, { isReadyImage: !currentValue });
      toast.success(currentValue ? 'Image hidden from creators' : 'Image visible to creators');
      loadImages();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update image');
    }
  };

  const filteredImages = images.filter(img => {
    const matchesSearch = img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         img.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || img.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(images.map(img => img.category || 'Uncategorized')))];
  const readyCount = images.filter(img => img.isReadyImage).length;
  const cachedCount = images.filter(img => img.minioPath).length;

  return (
    <div className="space-y-6">
      {/* Storage Stats */}
      {storageStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Images</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{images.length}</div>
              <p className="text-xs text-muted-foreground">
                {readyCount} visible to creators
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cached</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cachedCount}</div>
              <p className="text-xs text-muted-foreground">
                Ready for instant deploy
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageStats.totalSizeMb} MB</div>
              <p className="text-xs text-muted-foreground">
                MinIO cache
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Not Cached</CardTitle>
              <XCircle className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{images.length - cachedCount}</div>
              <p className="text-xs text-muted-foreground">
                Need to pull
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Images Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Docker Images</CardTitle>
              <CardDescription>
                Manage container images for scenario creation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadImages} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Cache Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Registry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading images...
                  </TableCell>
                </TableRow>
              ) : filteredImages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery || categoryFilter !== 'all' ? 'No images match your filters' : 'No images found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredImages.map((image) => (
                  <TableRow key={image.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium font-mono text-sm">{image.name}:{image.tag}</div>
                        {image.description && (
                          <div className="text-xs text-muted-foreground mt-1">{image.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {image.category || 'Uncategorized'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={image.isReadyImage}
                          onCheckedChange={() => handleToggleReady(image.id, image.isReadyImage)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {image.isReadyImage ? 'Visible' : 'Hidden'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {image.minioPath ? (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Cached
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Cached
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {image.imageSizeMb ? `${image.imageSizeMb} MB` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {image.registryUrl}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!image.minioPath && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePullImage(image.id)}
                            disabled={pullingImages.has(image.id)}
                          >
                            {pullingImages.has(image.id) ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                Pull & Cache
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewImage({
                              name: image.name,
                              tag: image.tag,
                              registryUrl: image.registryUrl,
                              description: image.description || '',
                              category: image.category || 'Base Images',
                              isPublic: image.isPublic,
                              isReadyImage: image.isReadyImage,
                            });
                            setShowAddDialog(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteImage(image.id, `${image.name}:${image.tag}`)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Image Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Docker Image</DialogTitle>
            <DialogDescription>
              Add a new Docker image to the platform library
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Image Name</Label>
                <Input
                  placeholder="nginx"
                  value={newImage.name}
                  onChange={(e) => setNewImage({ ...newImage, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Tag *</Label>
                <Input
                  placeholder="e.g., 2024.1, v1.16, 22.04"
                  value={newImage.tag}
                  onChange={(e) => setNewImage({ ...newImage, tag: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Specify exact version (avoid 'latest' for reproducibility)
                </p>
              </div>
            </div>
            <div>
              <Label>Registry URL</Label>
              <Input
                placeholder="docker.io"
                value={newImage.registryUrl}
                onChange={(e) => setNewImage({ ...newImage, registryUrl: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Web server for hosting applications"
                value={newImage.description}
                onChange={(e) => setNewImage({ ...newImage, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newImage.category} onValueChange={(value) => setNewImage({ ...newImage, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Base Images">Base Images</SelectItem>
                  <SelectItem value="Web Servers">Web Servers</SelectItem>
                  <SelectItem value="Databases">Databases</SelectItem>
                  <SelectItem value="Attacker Tools">Attacker Tools</SelectItem>
                  <SelectItem value="Vulnerable Apps">Vulnerable Apps</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newImage.isPublic}
                  onCheckedChange={(checked) => setNewImage({ ...newImage, isPublic: checked })}
                />
                <Label>Public Image</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newImage.isReadyImage}
                  onCheckedChange={(checked) => setNewImage({ ...newImage, isReadyImage: checked })}
                />
                <Label>Visible to Creators</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddImage} disabled={!newImage.name || !newImage.tag}>
              Add Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
