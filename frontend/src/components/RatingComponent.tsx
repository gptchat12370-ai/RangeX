import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { ratingsApi } from "../api/favoritesApi";

interface RatingComponentProps {
  scenarioId?: string;
  currentRating?: number; // Average rating (read-only display)
  userRating?: number;
  totalRatings?: number;
  onRate?: (rating: number) => void;
  disabled?: boolean;
  readonly?: boolean; // If true, shows only the average rating without allowing clicks
}

export function RatingComponent({
  scenarioId,
  currentRating = 0,
  userRating,
  totalRatings = 0,
  onRate,
  disabled = false,
  readonly = false,
}: RatingComponentProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [tempRating, setTempRating] = useState(userRating || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (scenarioId && !userRating) {
      loadUserRating();
    }
  }, [scenarioId]);

  const loadUserRating = async () => {
    if (!scenarioId) return;
    try {
      const response = await ratingsApi.getUserRating(scenarioId);
      if (response.userRating) {
        setTempRating(response.userRating);
      }
    } catch (error) {
      console.error('Failed to load user rating:', error);
    }
  };

  const handleRate = async (rating: number) => {
    if (disabled || isSubmitting || readonly) return;
    
    setTempRating(rating);
    
    if (scenarioId) {
      try {
        setIsSubmitting(true);
        await ratingsApi.submitRating(scenarioId, rating);
        toast.success(`Rated ${rating} X${rating > 1 ? "'s" : ""}!`);
        onRate?.(rating);
      } catch (error) {
        console.error('Failed to submit rating:', error);
        toast.error('Failed to submit rating');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onRate?.(rating);
      toast.success(`Rated ${rating} X${rating > 1 ? "'s" : ""}!`);
    }
  };

  // If readonly, show only the average rating without interaction
  if (readonly) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <X
              key={rating}
              className={`h-5 w-5 ${
                rating <= currentRating
                  ? "fill-cyan-500 text-cyan-500"
                  : "fill-none text-muted-foreground/40"
              }`}
              strokeWidth={2}
            />
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{(currentRating || 0).toFixed(1)}</span>
          {totalRatings > 0 && <span className="ml-1">({totalRatings})</span>}
        </div>
      </div>
    );
  }

  const displayRating = hoveredRating || tempRating || currentRating;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => handleRate(rating)}
            onMouseEnter={() => !disabled && setHoveredRating(rating)}
            onMouseLeave={() => !disabled && setHoveredRating(null)}
            disabled={disabled || isSubmitting}
            className={`transition-all duration-150 ${
              disabled || isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
            }`}
          >
            <X
              className={`h-5 w-5 transition-colors ${
                rating <= displayRating
                  ? "fill-cyan-500 text-cyan-500"
                  : "fill-none text-muted-foreground/40"
              }`}
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">{(currentRating || 0).toFixed(1)}</span>
        {totalRatings > 0 && <span className="ml-1">({totalRatings})</span>}
      </div>
    </div>
  );
}
