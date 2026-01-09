import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAssetUrl } from "../utils/assetUrl";
import { creatorApi } from "../api/creatorApi";
import { solverApi } from "../api/solverApi";
import { ratingsApi } from "../api/favoritesApi";
import { useStore } from "../lib/store";
import { CareerPath, Scenario } from "../types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { RatingComponent } from "../components/RatingComponent";
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
import {
  ArrowLeft,
  Star,
  BookOpen,
  Clock,
  CheckCircle,
  Award,
  TrendingUp,
  Target,
  Trash2,
  PlayCircle,
  Edit,
} from "lucide-react";
import { toast } from "sonner";

export default function CareerPathDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);

  const [careerPath, setCareerPath] = useState<CareerPath | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | undefined>(undefined);
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadCareerPath();
  }, [id]);

  useEffect(() => {
    // Load progress after scenarios are loaded
    if (scenarios.length > 0 && currentUser?.history) {
      loadProgress();
    }
  }, [scenarios, currentUser]);

  const loadCareerPath = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pathData, solverScenarios] = await Promise.all([
        creatorApi.getCareerPath(id),
        solverApi.listScenarios(),
      ]);
      if (!pathData) {
        throw new Error("Career path not found");
      }
      setCareerPath(pathData);
      console.log('[CareerPath] pathData:', pathData);
      console.log('[CareerPath] pathData.items:', pathData.items);
      console.log('[CareerPath] solverScenarios count:', solverScenarios.length);
      console.log('[CareerPath] solverScenarios sample:', solverScenarios[0]);
      
      const ordered = (pathData.items || [])
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((it: any) => {
          const versionId = it.scenarioVersionId;
          console.log('[CareerPath] Looking for scenario with versionId:', versionId);
          
          // Try to find by scenarioId (parent ID) first, then by id (version ID)
          const found = solverScenarios.find((s: any) => {
            const matches = s.scenarioId === versionId || s.id === versionId;
            if (matches) {
              console.log('[CareerPath] MATCH FOUND:', s.title, 'scenarioId:', s.scenarioId, 'id:', s.id);
            }
            return matches;
          });
          
          if (!found) {
            console.warn('[CareerPath] Scenario version not found (may be outdated):', versionId);
            console.log('[CareerPath] This version may have been replaced. Career path needs updating.');
          }
          return found;
        })
        .filter((s: any) => s && s.status === 'PUBLISHED' && !s.isArchived) as Scenario[];
      
      console.log('[CareerPath] Final scenarios count:', ordered.length);
      setScenarios(ordered);
    } catch (err: any) {
      console.error("Failed to load career path", err);
      const is404 = err?.response?.status === 404;
      toast.error(is404 ? "Career path not found" : "Failed to load career path");
      navigate("/career-paths");
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = () => {
    // Check user history for completed scenarios that are IN this career path
    if (currentUser?.history && scenarios.length > 0) {
      const scenarioIdsInPath = new Set(scenarios.map(s => s.id));
      const completed = new Set(
        currentUser.history
          .filter(h => h.status === "Completed" && scenarioIdsInPath.has(h.scenarioId))
          .map(h => h.scenarioId)
      );
      setCompletedScenarios(completed);
    }
  };

  const handleRate = async (rating: number) => {
    if (!id) return;
    try {
      await ratingsApi.submitRating(id, rating);
      setUserRating(rating);
      toast.success("Rating submitted!");
      loadCareerPath(); // Refresh to get updated average
    } catch {
      toast.error("Failed to submit rating");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await creatorApi.deleteCareerPath(id);
      toast.success("Career path deleted");
      navigate("/career-paths");
    } catch (error) {
      console.error("Failed to delete career path:", error);
      toast.error("Failed to delete career path");
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const getTotalDuration = () =>
    scenarios.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const getTotalScenarios = () => scenarios.length;
  const getProgressPercentage = () => {
    if (scenarios.length === 0) return 0;
    return Math.round((completedScenarios.size / scenarios.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading career path...</p>
        </div>
      </div>
    );
  }

  if (!careerPath) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/career-paths")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Career Paths
          </Button>

          <div className="flex items-start gap-6">
            {careerPath.coverImageUrl && (
              <img
                src={getAssetUrl(careerPath.coverImageUrl)}
                alt={careerPath.title}
                className="w-48 h-32 object-cover rounded-lg"
              />
            )}

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{careerPath.title}</h1>
                  {careerPath.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {careerPath.ownerUserId === currentUser?.id && (
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="gap-2 text-red-500 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
              {careerPath.description && (
                <p className="text-muted-foreground">{careerPath.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{careerPath.rating?.toFixed?.(1) || "0.0"} ({careerPath.totalRatings || 0} ratings)</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{getTotalScenarios()} scenarios</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{Math.round(getTotalDuration() / 60)}h total</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>{completedScenarios.size}/{getTotalScenarios()} completed</span>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Progress</span>
                  <span className="font-semibold text-primary">{getProgressPercentage()}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>

              {/* Rating Component */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Rate this Career Path</p>
                <RatingComponent
                  careerPathId={id!}
                  currentRating={userRating}
                  onRate={handleRate}
                />
              </div>

              <div className="flex gap-2">
                {(currentUser.roleAdmin || currentUser.roleCreator) && (
                  <Button variant="default" onClick={() => navigate(`/career-paths/${id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Path
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="mb-6">Scenarios</h2>
        <div className="space-y-4">
          {scenarios.map((scenario, index) => {
            const isCompleted = completedScenarios.has(scenario.id);
            return (
              <Card key={scenario.id} className={`p-4 ${isCompleted ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-primary/10'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-sm">{index + 1}</span>
                    )}
                  </div>
                  {scenario.coverImageUrl && (
                    <img
                      src={getAssetUrl(scenario.coverImageUrl)}
                      alt={scenario.title}
                      className="w-32 h-20 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{scenario.title}</h3>
                      <Badge variant="outline">{scenario.difficulty}</Badge>
                      {isCompleted && <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Completed</Badge>}
                    </div>
                    {scenario.shortDesc && (
                      <p className="text-sm text-muted-foreground">{scenario.shortDesc}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline">{scenario.category}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {scenario.durationMinutes || 0}m
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => navigate(`/challenges/${scenario.id}`)}
                      variant={isCompleted ? "outline" : "default"}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {isCompleted ? "Replay" : "Start"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {scenarios.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">No scenarios linked yet.</Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="border-2 border-red-500/30 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Career Path?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete "{careerPath?.title}"? This action cannot be undone and will permanently remove this career path.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
