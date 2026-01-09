import React, { useState } from "react";
import { Clock, Users, Star, Heart, Play, ListPlus } from "lucide-react";
import { Scenario } from "../types";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { favoritesApi } from "../api/favoritesApi";
import { toast } from "sonner";
import { getDifficultyColor, getModeColor, formatDuration } from "../lib/utils";
import { getAssetUrl } from "../utils/assetUrl";

interface ScenarioCardProps {
  scenario: Scenario;
  onStart?: (scenarioId: string) => void;
  onView?: (scenarioId: string) => void;
  hasRunningSession?: boolean;
  onFavoritesChange?: () => void;
}

export function ScenarioCard({ scenario, onStart, onView, hasRunningSession = false, onFavoritesChange }: ScenarioCardProps) {
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    // Use version ID (s.id) for favorites, not parent ID
    const idToCheck = scenario.id; // Always use version ID for playlist_item FK
    if (idToCheck) {
      checkFavoriteStatus(idToCheck);
    } else {
      console.warn('[ScenarioCard] No scenario ID available:', scenario);
    }
  }, [scenario.id]);

  const checkFavoriteStatus = async (scenarioId: string) => {
    try {
      const response = await favoritesApi.checkFavorite(scenarioId);
      setIsFavorited(response.isFavorited);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    const scenarioId = scenario.id; // Use version ID for playlist_item FK
    if (favLoading || !scenarioId) {
      console.warn('[ScenarioCard] Cannot toggle favorite - no scenario ID');
      return;
    }
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
      // Trigger callback to reload favorites list
      if (onFavoritesChange) {
        onFavoritesChange();
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <>
      <Card className="group overflow-hidden hover:border-primary/50 transition-all duration-300 cyber-border">
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
        {scenario.coverImageUrl && !imageError ? (
          <img
            src={getAssetUrl(scenario.coverImageUrl)}
            alt={scenario.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => {
              console.warn(`Failed to load cover image: ${scenario.coverImageUrl}`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center cyber-grid">
            <Play className="h-16 w-16 text-primary/30" />
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge className={getDifficultyColor(scenario.difficulty)}>
            {scenario.difficulty}
          </Badge>
          <Badge className={getModeColor(scenario.mode)}>{scenario.mode}</Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title & Author */}
          <div>
            <h3
              className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors cursor-pointer"
              onClick={() => onView?.(scenario.id)}
            >
              {scenario.title}
            </h3>
            <p className="text-sm text-muted-foreground">by {scenario.author}</p>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">{scenario.shortDesc}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {scenario.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {scenario.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{scenario.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(scenario.durationMinutes)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{(scenario.rating || 0).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{scenario.followers}</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          className="flex-1 gap-2"
          onClick={() => onStart?.(scenario.id)}
          variant={hasRunningSession ? "default" : "default"}
        >
          <Play className="h-4 w-4" />
          {hasRunningSession ? "Continue" : "Start"}
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setShowAddToPlaylist(true)}>
                <ListPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add to Playlist</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button 
          variant="outline" 
          size="icon"
          onClick={toggleFavorite}
          disabled={favLoading}
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>
      </CardFooter>
    </Card>

      <AddToPlaylistDialog
        open={showAddToPlaylist}
        onOpenChange={setShowAddToPlaylist}
        challengeId={scenario.id}
        challengeTitle={scenario.title}
      />
    </>
  );
}