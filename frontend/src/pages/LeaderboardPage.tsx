import React, { useEffect, useState } from "react";
import { Trophy, Medal, Award, TrendingUp, Zap, Users as UsersIcon } from "lucide-react";
import { LeaderboardEntry, TeamLeaderboardEntry } from "../types";
import { leaderboardApi } from "../api/leaderboardApi";
import { getAssetUrl } from "../utils/assetUrl";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { formatDuration } from "../lib/utils";
import { toast } from "sonner";

export function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [timeframe, setTimeframe] = useState<"all" | "month" | "week">("all");
  const [leaderboardType, setLeaderboardType] = useState<"users" | "teams">("users");

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      if (leaderboardType === "users") {
        try {
          const data = await leaderboardApi.getGlobal(timeframe);
          setLeaderboard(data);
        } catch {
          toast.error("Failed to load leaderboard");
          setLeaderboard([]);
        }
      } else {
        try {
          const data = await leaderboardApi.getTeams(timeframe);
          setTeamLeaderboard(data);
        } catch {
          toast.error("Failed to load team leaderboard");
          setTeamLeaderboard([]);
        }
      }
      setLoading(false);
    };
    loadLeaderboard();
  }, [timeframe, leaderboardType]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-orange-400" />;
      default:
        return <span className="text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30";
      case 2:
        return "bg-gradient-to-r from-gray-500/20 to-gray-400/20 border-gray-400/30";
      case 3:
        return "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-400/30";
      default:
        return "bg-card/50";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">
          See how you rank against other cybersecurity professionals
        </p>
      </div>

      {/* Leaderboard Type Selector */}
      <Tabs value={leaderboardType} onValueChange={(v) => setLeaderboardType(v as "users" | "teams")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users">
            <UsersIcon className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Trophy className="mr-2 h-4 w-4" />
            Teams
          </TabsTrigger>
        </TabsList>

        {/* Users Leaderboard */}
        <TabsContent value="users" className="space-y-6 mt-6">
          {/* Top 3 Podium */}
          {!loading && leaderboard.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 2nd Place */}
          <Card className="cyber-border bg-gradient-to-br from-gray-500/10 to-gray-400/10 md:mt-8">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <Medal className="h-12 w-12 text-gray-400" />
              </div>
              <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-gray-400">
                <AvatarImage src={getAssetUrl(leaderboard[1].avatarUrl)} />
                <AvatarFallback>{leaderboard[1].username[0]}</AvatarFallback>
              </Avatar>
              <h3 className="font-bold">{leaderboard[1].username}</h3>
              <p className="text-sm text-muted-foreground mb-2">{leaderboard[1].country}</p>
              <div className="text-2xl font-bold text-primary mb-1">
                {leaderboard[1].points.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">points</p>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className="cyber-border cyber-glow bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <Trophy className="h-16 w-16 text-yellow-400" />
              </div>
              <Avatar className="h-20 w-20 mx-auto mb-3 border-4 border-yellow-400">
                <AvatarImage src={getAssetUrl(leaderboard[0].avatarUrl)} />
                <AvatarFallback>{leaderboard[0].username[0]}</AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-xl">{leaderboard[0].username}</h3>
              <p className="text-sm text-muted-foreground mb-2">{leaderboard[0].country}</p>
              <div className="text-3xl font-bold text-primary mb-1">
                {leaderboard[0].points.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">points</p>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className="cyber-border bg-gradient-to-br from-orange-500/10 to-red-500/10 md:mt-8">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <Medal className="h-12 w-12 text-orange-400" />
              </div>
              <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-orange-400">
                <AvatarImage src={getAssetUrl(leaderboard[2].avatarUrl)} />
                <AvatarFallback>{leaderboard[2].username[0]}</AvatarFallback>
              </Avatar>
              <h3 className="font-bold">{leaderboard[2].username}</h3>
              <p className="text-sm text-muted-foreground mb-2">{leaderboard[2].country}</p>
              <div className="text-2xl font-bold text-primary mb-1">
                {leaderboard[2].points.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">points</p>
            </CardContent>
          </Card>
        </div>
      )}

          {/* Full User Leaderboard */}
          <Card className="cyber-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Global Rankings</CardTitle>
                <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All Time</TabsTrigger>
                    <TabsTrigger value="month">This Month</TabsTrigger>
                    <TabsTrigger value="week">This Week</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:border-primary/50 ${getRankBg(entry.rank)}`}
                    >
                      <div className="w-12 flex items-center justify-center font-bold">
                        {getRankIcon(entry.rank)}
                      </div>

                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getAssetUrl(entry.avatarUrl)} />
                        <AvatarFallback>{entry.username[0]}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <h4 className="font-bold">{entry.username}</h4>
                        <p className="text-sm text-muted-foreground">{entry.country}</p>
                      </div>

                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground">Avg. Time</p>
                        <p className="font-medium">{formatDuration(entry.avgCompletionTimeMin)}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Points</p>
                        <p className="text-xl font-bold text-primary">
                          {entry.points.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Leaderboard */}
        <TabsContent value="teams" className="space-y-6 mt-6">
          {/* Top 3 Teams Podium */}
          {!loading && teamLeaderboard.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 2nd Place */}
              <Card className="cyber-border bg-gradient-to-br from-gray-500/10 to-gray-400/10 md:mt-8">
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-4">
                    <Medal className="h-12 w-12 text-gray-400" />
                  </div>
                  <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-gray-400">
                    <AvatarImage src={getAssetUrl(teamLeaderboard[1].avatarUrl)} />
                    <AvatarFallback>{teamLeaderboard[1].teamName[0]}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold">{teamLeaderboard[1].teamName}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{teamLeaderboard[1].country}</p>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {teamLeaderboard[1].totalPoints.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">points</p>
                  <Badge variant="outline" className="mt-2">
                    {teamLeaderboard[1].memberCount} members
                  </Badge>
                </CardContent>
              </Card>

              {/* 1st Place */}
              <Card className="cyber-border cyber-glow bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-4">
                    <Trophy className="h-16 w-16 text-yellow-400" />
                  </div>
                  <Avatar className="h-20 w-20 mx-auto mb-3 border-4 border-yellow-400">
                    <AvatarImage src={getAssetUrl(teamLeaderboard[0].avatarUrl)} />
                    <AvatarFallback>{teamLeaderboard[0].teamName[0]}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-xl">{teamLeaderboard[0].teamName}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{teamLeaderboard[0].country}</p>
                  <div className="text-3xl font-bold text-primary mb-1">
                    {teamLeaderboard[0].totalPoints.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">points</p>
                  <Badge className="mt-2 bg-yellow-500/20 text-yellow-400">
                    <Trophy className="h-3 w-3 mr-1" />
                    {teamLeaderboard[0].recentWins} recent wins
                  </Badge>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              <Card className="cyber-border bg-gradient-to-br from-orange-500/10 to-red-500/10 md:mt-8">
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-4">
                    <Medal className="h-12 w-12 text-orange-400" />
                  </div>
                  <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-orange-400">
                    <AvatarImage src={getAssetUrl(teamLeaderboard[2].avatarUrl)} />
                    <AvatarFallback>{teamLeaderboard[2].teamName[0]}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold">{teamLeaderboard[2].teamName}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{teamLeaderboard[2].country}</p>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {teamLeaderboard[2].totalPoints.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">points</p>
                  <Badge variant="outline" className="mt-2">
                    {teamLeaderboard[2].memberCount} members
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Team Leaderboard */}
          <Card className="cyber-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Rankings</CardTitle>
                <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All Time</TabsTrigger>
                    <TabsTrigger value="month">This Month</TabsTrigger>
                    <TabsTrigger value="week">This Week</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {teamLeaderboard.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:border-primary/50 ${getRankBg(entry.rank)}`}
                    >
                      <div className="w-12 flex items-center justify-center font-bold">
                        {getRankIcon(entry.rank)}
                      </div>

                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getAssetUrl(entry.avatarUrl)} />
                        <AvatarFallback>{entry.teamName[0]}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <h4 className="font-bold">{entry.teamName}</h4>
                        <p className="text-sm text-muted-foreground">{entry.country}</p>
                      </div>

                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground">Members</p>
                        <div className="flex items-center gap-1 font-medium">
                          <UsersIcon className="h-4 w-4 text-blue-400" />
                          {entry.memberCount}
                        </div>
                      </div>

                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground">Recent Wins</p>
                        <div className="flex items-center gap-1 font-medium">
                          <Trophy className="h-4 w-4 text-yellow-400" />
                          {entry.recentWins}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Points</p>
                        <p className="text-xl font-bold text-primary">
                          {entry.totalPoints.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
