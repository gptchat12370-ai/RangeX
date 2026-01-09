import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, AlertCircle } from "lucide-react";
import { getAssetUrl } from "../utils/assetUrl";
import { eventsApi } from "../api/eventsApi";
import { teamsApi } from "../api/teamsApi";
import { useStore } from "../lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";

interface TeamRegistrationModalProps {
  eventId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  leaderId?: string;
  memberCount: number;
}

export function TeamRegistrationModal({ 
  eventId, 
  eventName, 
  isOpen, 
  onClose, 
  onSuccess 
}: TeamRegistrationModalProps) {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadUserTeams();
    }
  }, [isOpen]);

  const loadUserTeams = async () => {
    setLoadingTeams(true);
    try {
      const data = await teamsApi.list();
      // Filter teams where user is leader (check both leaderId and ownerUserId for backwards compatibility)
      const leaderTeams = (data || []).filter((t: any) => 
        t.leaderId === currentUser?.id || t.ownerUserId === currentUser?.id || t.leader === currentUser?.id
      );
      setTeams(leaderTeams);
      
      // Auto-select if only one team
      if (leaderTeams.length === 1) {
        setSelectedTeamId(leaderTeams[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load teams:', error);
      toast.error('Failed to load teams');
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedTeamId) {
      toast.error('Please select a team');
      return;
    }

    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    console.log('Registering team:', {
      teamId: selectedTeamId,
      teamName: selectedTeam?.name,
      teamLeaderId: selectedTeam?.leaderId,
      currentUserId: currentUser?.id,
    });

    setLoading(true);
    try {
      await eventsApi.registerTeamForEvent(eventId, selectedTeamId);
      toast.success('Team registered successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to register team';
      console.error('Team registration error:', error.response?.data);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    onClose();
    navigate('/teams/create');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Register Team for {eventName}</DialogTitle>
          <DialogDescription>
            Select a team you lead to register for this event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingTeams ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gray-800/50 rounded-lg p-8">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                <p className="text-lg font-semibold mb-2">No teams available</p>
                <p className="text-sm text-gray-400 mb-4">
                  You need to be a team leader to register a team for this event
                </p>
                <Button onClick={handleCreateTeam} className="gap-2">
                  <Users className="h-4 w-4" />
                  Create a Team
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Only team leaders can register their team. You're leading {teams.length} {teams.length === 1 ? 'team' : 'teams'}.
                </AlertDescription>
              </Alert>

              <RadioGroup value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <div className="space-y-3">
                  {teams.map(team => (
                    <div key={team.id} className="flex items-center space-x-3">
                      <RadioGroupItem value={team.id} id={team.id} />
                      <Label 
                        htmlFor={team.id} 
                        className="flex items-center gap-3 flex-1 cursor-pointer p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAssetUrl(team.avatarUrl)} />
                          <AvatarFallback>
                            <Users className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-semibold">{team.name}</div>
                          <div className="text-sm text-gray-400 flex items-center gap-2">
                            {team.country && (
                              <span className="flex items-center gap-1">
                                <span className="text-xs">🌍</span>
                                {team.country}
                              </span>
                            )}
                            {team.motto && (
                              <span className="italic">"{team.motto}"</span>
                            )}
                            {!team.country && !team.motto && (
                              <span>ID: {team.id.substring(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {teams.length > 0 && (
            <Button 
              onClick={handleRegister} 
              disabled={!selectedTeamId || loading}
            >
              {loading ? 'Registering...' : 'Register Team'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
