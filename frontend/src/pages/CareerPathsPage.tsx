import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Search, Plus, Trash2 } from "lucide-react";
import { creatorApi } from "../api/creatorApi";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";
import { SafeImage } from "../lib/imageUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

interface CareerPath {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  items?: any[];
}

export function CareerPathsPage() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const loadCareerPaths = async () => {
      setLoading(true);
      try {
        const data = await creatorApi.listCareerPaths();
        setCareerPaths(data || []);
      } catch {
        setCareerPaths([]);
      }
      setLoading(false);
    };
    loadCareerPaths();
  }, []);

  const filteredPaths = careerPaths.filter((path) =>
    path.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (path.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, pathId: string) => {
    e.stopPropagation();
    setDeleteId(pathId);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await creatorApi.deleteCareerPath(deleteId);
      toast.success("Career path deleted");
      setCareerPaths(careerPaths.filter(p => p.id !== deleteId));
    } catch (error) {
      console.error("Failed to delete career path:", error);
      toast.error("Failed to delete career path");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Career Paths</h1>
            <p className="text-muted-foreground">
              Structured learning paths to advance your cybersecurity career
            </p>
          </div>
        </div>
        
        {currentUser?.roleAdmin && (
          <Button onClick={() => navigate("/admin/career-paths/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Path
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search career paths..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="h-40 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPaths.map((path) => (
            <Card 
              key={path.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/career-paths/${path.id}`)}
            >
              <SafeImage
                src={path.coverImageUrl}
                alt={path.title}
                className="w-full h-40 object-cover"
                fallbackType="careerPath"
                fallbackClassName="h-40"
              />
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="mb-1">{path.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {path.description}
                  </p>
                </div>
                <Badge variant="outline">{path.isPublic ? "Public" : "Private"}</Badge>
                <div className="text-xs text-muted-foreground">{path.items?.length || 0} scenarios</div>
                {currentUser?.roleAdmin && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={(e) => handleDelete(e, path.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {!loading && filteredPaths.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No career paths found</p>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-2 border-red-500/30 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Career Path?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete this career path? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
