import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, Save, X, Award, Edit } from 'lucide-react';
import { getAssetUrl } from '../utils/assetUrl';
import { httpClient } from '../api/httpClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ImageCropper } from '../components/ImageCropper';

// Creative badge icon options
const BADGE_ICON_OPTIONS = [
  "https://api.dicebear.com/7.x/icons/svg?seed=badge1&icon=award",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge2&icon=star",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge3&icon=trophy",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge4&icon=target",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge5&icon=shield",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge6&icon=crown",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge7&icon=flame",
  "https://api.dicebear.com/7.x/icons/svg?seed=badge8&icon=lightning",
  "https://api.dicebear.com/7.x/shapes/svg?seed=badge9",
  "https://api.dicebear.com/7.x/shapes/svg?seed=badge10",
  "https://api.dicebear.com/7.x/identicon/svg?seed=badge11",
  "https://api.dicebear.com/7.x/identicon/svg?seed=badge12",
];

interface Scenario {
  id: string;
  title: string;
}

interface BadgeType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string;
  requirements?: {
    id: string;
    scenarioId: string;
    scenario?: Scenario;
  }[];
}

export default function BadgeManagementPage() {
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBadge, setEditingBadge] = useState<BadgeType | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [badgeToDelete, setBadgeToDelete] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [showIconCropper, setShowIconCropper] = useState(false);
  const [currentBadgeId, setCurrentBadgeId] = useState<string | null>(null);
  const [showIconSelector, setShowIconSelector] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    iconUrl: '',
    criteria: '',
    selectedScenarios: [] as string[],
  });

  useEffect(() => {
    loadBadges();
    loadScenarios();
  }, []);

  const loadBadges = async () => {
    try {
      const response = await httpClient.get('/admin/badges');
      setBadges(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  };

  const loadScenarios = async () => {
    try {
      const response = await httpClient.get('/creator/scenarios');
      setScenarios(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load scenarios');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', iconUrl: '', criteria: '', selectedScenarios: [] });
    setEditingBadge(null);
    setShowDialog(false);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.description) {
      toast.error('Name and description are required');
      return;
    }

    try {
      const response = await httpClient.post('/admin/badges', {
        name: formData.name,
        description: formData.description,
        iconUrl: formData.iconUrl || undefined,
        criteria: formData.criteria,
      });

      const badgeId = response.data.id;

      // Add scenario requirements
      for (const scenarioId of formData.selectedScenarios) {
        await httpClient.post(`/admin/badges/${badgeId}/requirements`, { scenarioId });
      }

      toast.success('Badge created successfully');
      resetForm();
      loadBadges();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create badge');
    }
  };

  const handleUpdate = async () => {
    if (!editingBadge) return;

    try {
      await httpClient.put(`/admin/badges/${editingBadge.id}`, {
        name: formData.name,
        description: formData.description,
        iconUrl: formData.iconUrl,
        criteria: formData.criteria,
      });

      // Delete old requirements
      for (const req of editingBadge.requirements || []) {
        await httpClient.delete(`/admin/badges/requirements/${req.id}`);
      }

      // Add new requirements
      for (const scenarioId of formData.selectedScenarios) {
        await httpClient.post(`/admin/badges/${editingBadge.id}/requirements`, { scenarioId });
      }

      toast.success('Badge updated successfully');
      resetForm();
      loadBadges();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update badge');
    }
  };

  const handleDelete = (badgeId: string) => {
    console.log('[BadgeManagementPage] Opening delete confirmation for badge:', badgeId);
    setBadgeToDelete(badgeId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!badgeToDelete) return;
    
    try {
      console.log('[BadgeManagementPage] Deleting badge:', badgeToDelete);
      console.log('[BadgeManagementPage] Calling DELETE /admin/badges/' + badgeToDelete);
      
      await httpClient.delete(`/admin/badges/${badgeToDelete}`);
      
      console.log('[BadgeManagementPage] Badge deleted successfully from API');
      toast.success('Badge and icon deleted successfully');
      
      setShowDeleteDialog(false);
      setBadgeToDelete(null);
      loadBadges();
    } catch (error: any) {
      console.error('[BadgeManagementPage] Error deleting badge:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete badge');
    }
  };

  const handleEdit = (badge: BadgeType) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl,
      criteria: badge.criteria,
      selectedScenarios: badge.requirements?.map(r => r.scenarioId) || [],
    });
    setShowDialog(true);
  };

  const handleUploadIcon = async (badgeId: string, file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setCurrentBadgeId(badgeId);
    setIconFile(file);
    setShowIconCropper(true);
  };

  const handleIconCropComplete = async (croppedBlob: Blob) => {
    if (!currentBadgeId) return;

    const formDataObj = new FormData();
    formDataObj.append('file', croppedBlob, 'icon.jpg');

    try {
      const response = await httpClient.post(`/admin/badges/${currentBadgeId}/upload-icon`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Update the badge locally with the new iconUrl (includes cache-busting timestamp)
      setBadges(prevBadges =>
        prevBadges.map(badge =>
          badge.id === currentBadgeId
            ? { ...badge, iconUrl: response.data.iconUrl }
            : badge
        )
      );
      
      toast.success('Icon uploaded successfully');
      // Reload all badges to ensure we have the latest data
      await loadBadges();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to upload icon');
    } finally {
      setCurrentBadgeId(null);
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedScenarios: prev.selectedScenarios.includes(scenarioId)
        ? prev.selectedScenarios.filter(id => id !== scenarioId)
        : [...prev.selectedScenarios, scenarioId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Loading badges...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Badge Management</h2>
          <p className="text-muted-foreground">Create and manage achievement badges</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Badge
        </Button>
      </div>

      {/* Badge Grid */}
      <div className="grid gap-4">
        {badges.map(badge => (
          <Card key={badge.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Badge Icon */}
                <Avatar className="h-16 w-16">
                  <AvatarImage src={getAssetUrl(badge.iconUrl)} alt={badge.name} />
                  <AvatarFallback className="bg-primary/10">
                    <Award className="h-8 w-8 text-primary" />
                  </AvatarFallback>
                </Avatar>

                {/* Badge Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold">{badge.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {badge.criteria}
                    </Badge>
                  </div>

                  {/* Requirements */}
                  {badge.requirements && badge.requirements.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Required Scenarios:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {badge.requirements.map(req => (
                          <Badge key={req.id} variant="secondary" className="text-xs">
                            {req.scenario?.title || 'Unknown'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <label>
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        Icon
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadIcon(badge.id, file);
                      }}
                    />
                  </label>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(badge)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(badge.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {badges.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No badges created yet</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4">
                Create Your First Badge
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBadge ? 'Edit Badge' : 'Create New Badge'}</DialogTitle>
            <DialogDescription>
              {editingBadge ? 'Update badge details and requirements' : 'Create a new achievement badge for users to earn'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Badge Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Penetration Tester"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this badge represents"
                rows={3}
              />
            </div>

            {/* Criteria */}
            <div className="space-y-2">
              <Label htmlFor="criteria">Criteria</Label>
              <Input
                id="criteria"
                value={formData.criteria}
                onChange={e => setFormData({ ...formData, criteria: e.target.value })}
                placeholder="e.g., Complete 10 challenges"
              />
              <p className="text-xs text-muted-foreground">
                Used for count-based badges. Leave scenario requirements empty to use this.
              </p>
            </div>

            {/* Icon URL */}
            <div className="space-y-2">
              <Label>Badge Icon</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarImage src={getAssetUrl(formData.iconUrl)} />
                  <AvatarFallback><Award className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <Input
                    value={formData.iconUrl}
                    onChange={e => setFormData({ ...formData, iconUrl: e.target.value })}
                    placeholder="Or paste icon URL"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowIconSelector(!showIconSelector)}
                  >
                    Choose Icon
                  </Button>
                </div>
              </div>
              
              {showIconSelector && (
                <div className="grid grid-cols-6 gap-3 p-4 bg-card/50 rounded-lg border">
                  {BADGE_ICON_OPTIONS.map((icon, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, iconUrl: icon });
                        setShowIconSelector(false);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                        formData.iconUrl === icon
                          ? "border-primary ring-2 ring-primary"
                          : "border-border"
                      }`}
                    >
                      <img src={icon} alt={`Icon ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Choose a preset icon or paste a custom URL. You can also upload a custom icon later.
              </p>
            </div>

            {/* Scenario Requirements */}
            <div className="space-y-2">
              <Label>Required Scenarios (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select specific scenarios users must complete to earn this badge
              </p>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                {scenarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No scenarios available</p>
                ) : (
                  scenarios.map(scenario => (
                    <div key={scenario.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`scenario-${scenario.id}`}
                        checked={formData.selectedScenarios.includes(scenario.id)}
                        onCheckedChange={() => toggleScenario(scenario.id)}
                      />
                      <label
                        htmlFor={`scenario-${scenario.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {scenario.title}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {formData.selectedScenarios.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.selectedScenarios.length} scenario(s) selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={editingBadge ? handleUpdate : handleCreate}>
              <Save className="h-4 w-4 mr-2" />
              {editingBadge ? 'Update Badge' : 'Create Badge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropper
        open={showIconCropper}
        onClose={() => {
          setShowIconCropper(false);
          setIconFile(null);
          setCurrentBadgeId(null);
        }}
        onCropComplete={handleIconCropComplete}
        imageFile={iconFile}
        title="Crop Badge Icon"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Badge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this badge? This will permanently remove the badge and its icon from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('[BadgeManagementPage] Cancelled badge deletion');
              setBadgeToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
