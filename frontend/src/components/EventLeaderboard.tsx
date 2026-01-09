import React, { useEffect, useState } from "react";
import { Trophy, Users, User, Medal, Award } from "lucide-react";
import { getAssetUrl } from "../utils/assetUrl";
import { eventsApi } from "../api/eventsApi";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";

interface EventLeaderboardEntry {
  rank: number;
  participantType: 'player' | 'team';
  participantId: string;
  participantName: string;
  avatarUrl?: string;
  country?: string;
  totalPoints: number;
  challengesCompleted: number;
  memberCount?: number;
}

interface EventLeaderboardProps {
  eventId: string;
  format: 'Player vs Player' | 'Team vs Team';
}

export function EventLeaderboard({ eventId, format }: EventLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<EventLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [eventId]);

  const loadLeaderboard = async () => {
    if (!eventId) return;
    
    setLoading(true);
    try {
      const data = await eventsApi.getEventLeaderboard(eventId);
      setLeaderboard(data || []);
    } catch (error: any) {
      console.error('Failed to load leaderboard:', error);
      toast.error('Failed to load leaderboard');
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Event Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Event Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold mb-2">No participants yet</p>
            <p className="text-sm">Be the first to register and compete!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Event Leaderboard
        </CardTitle>
        <p className="text-sm text-gray-400">
          {format === 'Team vs Team' ? 'Top teams' : 'Top players'} competing in this event
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaderboard.map((entry, idx) => (
            <div
              key={entry.participantId}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                entry.rank <= 3
                  ? 'bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-700/30'
                  : 'bg-gray-800/50 hover:bg-gray-800/70'
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                {/* Rank */}
                <div className="flex items-center justify-center w-12">
                  {getRankBadge(entry.rank) || (
                    <div className="text-2xl font-bold text-gray-500">
                      #{entry.rank}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="h-12 w-12">
                  <AvatarImage src={getAssetUrl(entry.avatarUrl)} />
                  <AvatarFallback>
                    {format === 'Team vs Team' ? (
                      <Users className="h-6 w-6" />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {entry.participantName}
                    {entry.rank === 1 && (
                      <Award className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400 flex items-center gap-3">
                    <span>{entry.challengesCompleted} challenges completed</span>
                    {format === 'Team vs Team' && entry.memberCount && (
                      <>
                        <span>•</span>
                        <span>{entry.memberCount} members</span>
                      </>
                    )}
                    {entry.country && (
                      <>
                        <span>•</span>
                        <span>{entry.country}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-gray-400' :
                    entry.rank === 3 ? 'text-amber-600' :
                    'text-cyan-400'
                  }`}>
                    {entry.totalPoints.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400">points</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length > 10 && (
          <div className="text-center mt-4 text-sm text-gray-500">
            Showing top {Math.min(leaderboard.length, 50)} participants
          </div>
        )}
      </CardContent>
    </Card>
  );
}
