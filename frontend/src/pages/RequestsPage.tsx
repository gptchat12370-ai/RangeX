import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Users, Clock } from "lucide-react";
import { getAssetUrl } from "../utils/assetUrl";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { toast } from "sonner";
import { useStore } from "../lib/store";
import { teamsApi } from "../api/teamsApi";

interface TeamRequest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  teamId: string;
  teamName: string;
  requestedAt: string;
}

interface EventRequest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  eventId: string;
  eventName: string;
  participationType: "single" | "team";
  teamName?: string;
  requestedAt: string;
}

export function RequestsPage() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTeam, setUserTeam] = useState<any>(null);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        // Load user's team to check if they're a leader
        const team = await teamsApi.getUserTeam(currentUser.id);
        setUserTeam(team);
        
        // If user is team leader, load join requests for their team
        if (team && team.members) {
          const isOwner = team.members.some((m: any) => {
            if (typeof m === 'string') return false;
            return m.userId === currentUser.id && m.role === 'owner';
          });
          if (isOwner) {
            const requests = await teamsApi.getJoinRequests(team.id);
            setTeamRequests(requests || []);
          }
        }
        
        setEventRequests([]);
      } catch (error: any) {
        console.error('Failed to load requests:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRequests();
  }, [currentUser.id]);

  const handleAcceptTeamRequest = async (requestId: string) => {
    if (!userTeam) return;
    try {
      await teamsApi.approveJoinRequest(userTeam.id, requestId);
      setTeamRequests(teamRequests.filter((r) => r.id !== requestId));
      toast.success("Team request accepted");
      // Reload team to get updated member list
      const updatedTeam = await teamsApi.getUserTeam(currentUser.id);
      setUserTeam(updatedTeam);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to accept request");
    }
  };

  const handleRejectTeamRequest = async (requestId: string) => {
    if (!userTeam) return;
    try {
      await teamsApi.rejectJoinRequest(userTeam.id, requestId);
      setTeamRequests(teamRequests.filter((r) => r.id !== requestId));
      toast.success("Team request rejected");
    } catch (error: any) {
      toast.error("Failed to reject request");
    }
  };

  const handleAcceptEventRequest = (requestId: string) => {
    setEventRequests(eventRequests.filter((r) => r.id !== requestId));
    toast.success("Event request accepted");
  };

  const handleRejectEventRequest = (requestId: string) => {
    setEventRequests(eventRequests.filter((r) => r.id !== requestId));
    toast.success("Event request rejected");
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  const totalRequests = teamRequests.length + eventRequests.length;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl">Team Requests</h1>
        <p className="text-muted-foreground">
          Manage team join requests ({teamRequests.length} pending)
        </p>
      </div>

      <div className="mt-6 space-y-4">
          {teamRequests.length === 0 ? (
            <Card className="cyber-border">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending team requests</p>
              </CardContent>
            </Card>
          ) : (
            teamRequests.map((request) => (
              <Card key={request.id} className="cyber-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getAssetUrl(request.user?.avatarUrl)} />
                        <AvatarFallback>
                          {(request.user?.displayName || request.user?.email || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{request.user?.displayName || request.user?.email || 'User'}</span>
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeAgo(request.createdAt)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.message || `Requested to join ${userTeam?.name || 'your team'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectTeamRequest(request.id)}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptTeamRequest(request.id)}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
      </div>
    </div>
  );
}

