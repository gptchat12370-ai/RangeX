import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CareerPath } from "../../types";
import { creatorApi } from "../../api/creatorApi";
import { getAssetUrl } from "../../utils/assetUrl";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Star, 
  Users, 
  BookOpen,
  Crown 
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

export default function CareerPathsManagementPage() {
  const navigate = useNavigate();
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pathToDelete, setPathToDelete] = useState<CareerPath | null>(null);

  useEffect(() => {
    loadCareerPaths();
  }, []);

  const loadCareerPaths = async () => {
    setLoading(true);
    try {
      const data = await creatorApi.listCareerPaths();
      setCareerPaths(data);
    } catch (error) {
      console.error("Failed to load career paths:", error);
      toast.error("Failed to load career paths");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pathToDelete) return;
    
    try {
      await creatorApi.deleteCareerPath(pathToDelete.id);
      await loadCareerPaths();
      toast.success("Career path deleted successfully");
    } catch (error) {
      console.error("Failed to delete career path:", error);
      toast.error("Failed to delete career path");
    } finally {
      setDeleteDialogOpen(false);
      setPathToDelete(null);
    }
  };

  const openDeleteDialog = (path: CareerPath) => {
    setPathToDelete(path);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Manage Career Paths</h1>
            <p className="text-muted-foreground">
              Create and manage structured learning paths for users
            </p>
          </div>
        </div>
        
        <Button onClick={() => navigate("/admin/career-paths/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Career Path
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading career paths...</p>
        </div>
      ) : careerPaths.length === 0 ? (
        <Card className="p-12 text-center">
          <Crown className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="mb-2">No Career Paths Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first career path to provide structured learning for users
          </p>
          <Button onClick={() => navigate("/admin/career-paths/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Career Path
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {careerPaths.map((path) => (
            <Card key={path.id} className="overflow-hidden">
              <div className="flex items-start gap-4 p-6">
                {path.coverImageUrl && (
                  <img
                    src={getAssetUrl(path.coverImageUrl)}
                    alt={path.title}
                    className="w-48 h-32 object-cover rounded"
                  />
                )}
                
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="mb-1">{path.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {path.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {path.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{path.rating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{path.followers.toLocaleString()} followers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{path.playlists.length} playlists</span>
                    </div>
                    <div className="text-xs">
                      Updated: {new Date(path.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/career-paths/${path.id}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(path)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Career Path?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pathToDelete?.title}"? This action cannot be undone
              and will affect all users following this path.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
