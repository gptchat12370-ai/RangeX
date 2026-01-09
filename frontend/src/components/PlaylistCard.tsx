import React from "react";
import { ListMusic, Star, Users, Play, Crown } from "lucide-react";
import { Playlist } from "../types";
import { getAssetUrl } from "../utils/assetUrl";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PlaylistCardProps {
  playlist: Playlist;
  onClick?: (playlistId: string) => void;
}

export function PlaylistCard({ playlist, onClick }: PlaylistCardProps) {
  return (
    <Card className="group overflow-hidden hover:border-primary/50 transition-all duration-300 cyber-border cursor-pointer"
      onClick={() => onClick?.(playlist.id)}
    >
      {/* Cover Image */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-accent/10 to-primary/10">
        {playlist.coverImageUrl ? (
          <img
            src={getAssetUrl(playlist.coverImageUrl)}
            alt={playlist.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center cyber-grid">
            <ListMusic className="h-16 w-16 text-primary/30" />
          </div>
        )}
        {playlist.isCareerPath && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white gap-1">
              <Crown className="h-3 w-3" />
              Career Path
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {playlist.title}
          </h3>
          
          {playlist.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {playlist.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {playlist.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              <span>{playlist.scenarios.length} challenges</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{(playlist.rating || 0).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{playlist.followers}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
