import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Playlist, Scenario, UserProgress } from "../types";
import { playlistApi, playlistsApi } from "../api/playlistApi";
import { solverApi } from "../api/solverApi";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Card } from "../components/ui/card";
import { 
  ArrowLeft, 
  Star, 
  Users, 
  Clock, 
  Heart,
  PlayCircle,
  Plus,
  Edit,
  Trash2,
  Lock,
  Globe
} from "lucide-react";
import { toast } from "sonner";

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const loadPlaylist = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [playlistData, solverScenarios] = await Promise.all([
        playlistApi.get(id),
        solverApi.listScenarios(),
      ]);

      if (!playlistData) {
        throw new Error("Playlist not found");
      }
      setPlaylist(playlistData);

      // Map items to scenarios using solver list and filter out hidden/archived ones
      const items = playlistData.items || [];
      const ordered = items
        .map((it: any) => {
          const scenarioId = it.scenarioVersionId || it;
          return solverScenarios.find((s: any) => s.id === scenarioId);
        })
        .filter((s: any) => s && s.status === 'PUBLISHED' && !s.isArchived);
      setScenarios(ordered as any);

      setIsFollowing(false);
    } catch (error: any) {
      console.error("Failed to load playlist:", error);
      const is404 = error?.response?.status === 404;
      toast.error(is404 ? "Playlist not found" : "Failed to load playlist");
      navigate("/playlists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Refetch when returning to this page to avoid stale data
    loadPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFavoritesChange = () => {
    // Reload playlist when favorites are added/removed
    if (playlist?.kind === 'favorites' || playlist?.title?.toLowerCase() === 'favorites') {
      loadPlaylist();
    }
  };

  const handleFollow = async () => {
    if (!playlist) return;
    
    try {
      await playlistsApi.follow(playlist.id);
      setIsFollowing(true);
      toast.success("Following playlist");
    } catch (error) {
      toast.error("Failed to follow");
    }
  };

  const handleFavorite = async () => {
    if (!playlist) return;
    
    try {
      // This would add the playlist itself to favorites
      toast.success("Added to favorites");
    } catch (error) {
      toast.error("Failed to favorite");
    }
  };

  const getTotalDuration = (): number => {
    return scenarios.reduce((sum, scenario) => sum + scenario.durationMinutes, 0);
  };

  const isOwner = playlist && playlist.ownerUserId === currentUser?.id;
  const canEdit = isOwner && playlist.kind !== "favorites" && playlist.title?.toLowerCase() !== 'favorites';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/playlists")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Playlists
          </Button>

          <div className="flex items-start gap-6">
            {playlist.coverImageUrl && (
              <img
                src={getAssetUrl(playlist.coverImageUrl)}
                alt={playlist.title}
                className="w-48 h-32 object-cover rounded-lg"
              />
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1>{playlist.title}</h1>
                {playlist.kind === "curated" && (
                  <Badge variant="outline">Admin Curated</Badge>
                )}
                {playlist.kind === "favorites" && (
                  <Badge variant="outline">
                    <Heart className="mr-1 h-3 w-3" />
                    Favorites
                  </Badge>
                )}
                {playlist.kind === "favorites" || playlist.visibility === "private" ? (
                  <Badge variant="secondary">
                    <Lock className="mr-1 h-3 w-3" />
                    Private
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Globe className="mr-1 h-3 w-3" />
                    Public
                  </Badge>
                )}
              </div>
              
              {playlist.description && (
                <p className="text-muted-foreground mb-4">{playlist.description}</p>
              )}
              
              {playlist.tags && playlist.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {playlist.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                {playlist.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{(playlist.rating || 0).toFixed(1)}</span>
                  </div>
                )}
                {playlist.followers !== undefined && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{(playlist.followers || 0).toLocaleString()} followers</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <PlayCircle className="h-4 w-4" />
                  <span>{(scenarios || []).length} scenarios</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{Math.round(getTotalDuration() / 60)}h {getTotalDuration() % 60}m total</span>
                </div>
              </div>

              <div className="flex gap-2">
                {/* Show Edit button for playlist owners (excluding Favorites) */}
                {playlist.ownerUserId === currentUser?.id && playlist.title?.toLowerCase() !== 'favorites' && (
                  <Button variant="default" onClick={() => navigate(`/playlists/${id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Playlist
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {progress && (
        <div className="border-b bg-card/30">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg">Your Progress</h3>
              <span className="text-sm text-muted-foreground">
                {progress.progressPct}% Complete
              </span>
            </div>
            <Progress value={progress.progressPct} className="h-3" />
          </div>
        </div>
      )}

      {/* Scenarios List */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2>Scenarios</h2>
        </div>
        
        {scenarios.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No scenarios in this playlist yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {scenarios.map((scenario, index) => {
              const isCompleted = progress?.completedScenarioIds.includes(scenario.id);
              
              return (
                <Card key={scenario.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm">{index + 1}</span>
                    </div>
                    
                    {scenario.coverImageUrl && (
                      <img
                        src={getAssetUrl(scenario.coverImageUrl)}
                        alt={scenario.title}
                        className="w-32 h-20 object-cover rounded-lg"
                      />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3>{scenario.title}</h3>
                        {isCompleted && (
                          <Badge variant="outline" className="text-xs">
                            ✓ Completed
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {scenario.shortDesc}
                      </p>
                      
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline">{scenario.mode}</Badge>
                        <Badge variant="outline">{scenario.type}</Badge>
                        <Badge variant="outline">{scenario.difficulty}</Badge>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{scenario.durationMinutes}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{scenario.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => navigate(`/challenges/${scenario.id}`)}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Start
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
