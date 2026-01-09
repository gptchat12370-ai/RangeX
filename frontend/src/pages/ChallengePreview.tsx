import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from 'dompurify';
import { getAssetUrl } from "../utils/assetUrl";
import {
  ArrowLeft,
  Play,
  Heart,
  Clock,
  Users,
  Star,
  Target,
  BookOpen,
  Zap,
} from "lucide-react";
import { Scenario } from "../types";
import { solverApi } from "../api/solverApi";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Skeleton } from "../components/ui/skeleton";
import { RatingComponent } from "../components/RatingComponent";
import { favoritesApi } from "../api/favoritesApi";
import { getDifficultyColor, getModeColor, formatDuration } from "../lib/utils";
import { useScenarioDetail } from "../hooks/useScenarioDetail";
import { toast } from "sonner";
import { useStore } from "../lib/store";

interface ChallengePreviewProps {
  onStart: (scenarioId: string) => void;
  onBack: () => void;
}

export function ChallengePreview({ onStart, onBack }: ChallengePreviewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const { data: detail, loading, refetch } = useScenarioDetail(id);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [userRating, setUserRating] = useState<number | undefined>(undefined);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Check if user has running NON-EVENT session for this scenario
  const hasRunningSession = React.useMemo(() => {
    if (!currentUser?.history || !id) return false;
    return currentUser.history.some(h => 
      h.scenarioId === id && 
      h.status === "In Progress" &&
      !(h as any).eventId  // Exclude event sessions
    );
  }, [currentUser?.history, id]);

  // Check if user has running EVENT session for this scenario
  const hasEventSession = React.useMemo(() => {
    if (!currentUser?.history || !id) return null;
    return currentUser.history.find(h => 
      h.scenarioId === id && 
      h.status === "In Progress" &&
      (h as any).eventId  // Only event sessions
    );
  }, [currentUser?.history, id]);

  useEffect(() => {
    // Use version ID (s.id) for favorites check
    const idToCheck = scenario?.id;
    if (idToCheck) {
      checkFavoriteStatus(idToCheck);
    }
  }, [scenario?.id]);

  const checkFavoriteStatus = async (scenarioId: string) => {
    try {
      const response = await favoritesApi.checkFavorite(scenarioId);
      setIsFavorited(response.isFavorited);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    const scenarioId = scenario?.id; // Use version ID for playlist_item FK
    if (!scenarioId || favLoading) return;
    try {
      setFavLoading(true);
      if (isFavorited) {
        await favoritesApi.removeFavorite(scenarioId);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(scenarioId);
        setIsFavorited(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setFavLoading(false);
    }
  };

  const handleRate = (rating: number) => {
    setUserRating(rating);
    // Refetch to update average rating
    refetch();
  };

  useEffect(() => {
    if (!detail) {
      setScenario(null);
      return;
    }
    const mapped: Scenario = {
      id: detail.id,
      scenarioId: detail.scenarioId, // Parent scenario ID for ratings/favorites
      title: detail.title || detail.name || "Untitled",
      shortDesc: detail.shortDescription || detail.description || "",
      author: detail.author || "Unknown",
      tags: detail.tags || [],
      coverUrl: detail.coverImageUrl, // Map coverImageUrl to coverUrl
      mode: detail.mode || "Single Player",
      type: detail.scenarioType || detail.type || "Cyber Challenge",
      difficulty: detail.difficulty || "Medium",
      durationMinutes: detail.durationMinutes || detail.estimatedMinutes || 60,
      category: detail.category || "Other",
      rating: detail.rating || 0,
      averageRating: detail.averageRating,
      totalRatings: detail.totalRatings,
      followers: detail.followers || 0,
      mission: detail.mission || [],
      rules: detail.rules || { codeOfEthics: "" },
      machines: detail.machines || [],
      questions: detail.questions || [],
      assets: detail.assets || [],
      validationPolicy: detail.validationPolicy || "OnSubmit",
      scoringPolicy: detail.scoringPolicy || "AllOrNothing",
      hintPolicy: detail.hintPolicy || "Disabled",
    };
    setScenario(mapped);
  }, [detail]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Challenge not found</p>
          <Button variant="link" onClick={onBack} className="mt-4">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative h-80 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 cyber-grid">
        {scenario.coverImageUrl && (
          <img
            src={DOMPurify.sanitize(getAssetUrl(scenario.coverImageUrl), { ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i })}
            alt={scenario.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        <div className="relative container mx-auto px-6 h-full flex flex-col justify-end pb-8">
          <Button
            variant="ghost"
            className="w-fit mb-4 gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Challenges
          </Button>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className={getDifficultyColor(scenario.difficulty)}>
              {scenario.difficulty}
            </Badge>
            <Badge className={getModeColor(scenario.mode)}>{scenario.mode}</Badge>
            <Badge variant="outline">{scenario.type}</Badge>
            <Badge variant="outline">{scenario.category}</Badge>
          </div>

          <h1 className="text-4xl font-bold mb-2">{scenario.title}</h1>
          <p className="text-lg text-muted-foreground mb-4">by {scenario.author}</p>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>{formatDuration(scenario.durationMinutes)}</span>
            </div>
            <RatingComponent
              scenarioId={scenario.scenarioId}
              currentRating={scenario.rating}
              userRating={userRating}
              totalRatings={scenario.followers}
              onRate={handleRate}
              readonly={true}
            />
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <span>{scenario.followers} enrolled</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-400" />
              <span>{scenario.questions.length} questions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>About this Challenge</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{scenario.shortDesc}</p>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>Topics Covered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {scenario.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Learning Outcomes */}
            <Card className="cyber-border bg-gradient-to-br from-blue-500/5 to-purple-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Learning Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail?.learningOutcomes ? (
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.learningOutcomes) }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No learning outcomes specified for this challenge.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Environment Info */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>Lab Environment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This challenge includes {scenario.machines.length} machine(s) configured for your practice:
                  </p>
                  {scenario.machines.map((machine) => (
                    <div
                      key={machine.id}
                      className="p-3 bg-card/50 rounded-lg border flex items-start gap-3"
                    >
                      <div className={`p-2 rounded ${
                        machine.role === "attacker" ? "bg-red-500/20" : "bg-blue-500/20"
                      }`}>
                        <Target className={`h-4 w-4 ${
                          machine.role === "attacker" ? "text-red-400" : "text-blue-400"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{machine.name}</h4>
                        <p className="text-xs text-muted-foreground capitalize">
                          {machine.role} · {machine.kind} · {machine.access.join(", ")} access
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CTA Card */}
            <Card className="cyber-border cyber-glow sticky top-6">
              <CardContent className="p-6 space-y-4">
                {hasEventSession ? (
                  // Show event session notice
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-primary/30 bg-primary/10">
                      <p className="text-sm text-muted-foreground">
                        You have an active event session for this challenge.
                      </p>
                    </div>
                    <Button
                      className="w-full gap-2 h-12"
                      size="lg"
                      onClick={() => {
                        // Navigate to events page to continue from there
                        const eventId = (hasEventSession as any).eventId;
                        navigate(`/events/${eventId}`);
                        toast.info('Continue your event challenge from the event page');
                      }}
                    >
                      <Play className="h-5 w-5" />
                      Go to Event Page
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2 h-12"
                    size="lg"
                    onClick={() => onStart(scenario.id)}
                  >
                    <Play className="h-5 w-5" />
                    {hasRunningSession ? "Continue Challenge" : "Start Challenge"}
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={toggleFavorite}
                    disabled={favLoading}
                  >
                    <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                    {isFavorited ? 'Saved' : 'Save'}
                  </Button>
                </div>

                <div className="pt-4 border-t space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Validation</span>
                    <span className="font-medium">{scenario.validationPolicy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Scoring</span>
                    <span className="font-medium">{scenario.scoringPolicy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hints</span>
                    <span className="font-medium">{scenario.hintPolicy}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate this Challenge */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="text-base">Rate this Challenge</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <RatingComponent
                    scenarioId={scenario.id}
                    currentRating={scenario.rating}
                    userRating={userRating}
                    totalRatings={scenario.followers}
                    onRate={handleRate}
                  />
                  <p className="text-xs text-muted-foreground">
                    Share your experience to help others
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="text-base">Prerequisites</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Basic understanding of {scenario.category.toLowerCase()}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Familiarity with command line interface</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Stable internet connection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
