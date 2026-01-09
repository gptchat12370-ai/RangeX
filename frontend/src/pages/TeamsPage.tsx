import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Shield, Crown, Trophy, Globe, Lock } from "lucide-react";
import { Team } from "../types";
import { teamsApi } from "../api/teamsApi";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";

interface TeamFormData {
  name: string;
  motto: string;
  country: string;
  isOpen: boolean;
  registrationsOpen: boolean;
  description: string;
}

export function TeamsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<TeamFormData>({
    defaultValues: {
      isOpen: true,
      registrationsOpen: true,
    }
  });

  useEffect(() => {
    register("isOpen");
    register("registrationsOpen");
    loadTeams();
    loadUserTeam();
  }, []);

  useEffect(() => {
    if ((location.state as any)?.refetch) {
      loadTeams();
      loadUserTeam();
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  // Redirect to user's team if they have one
  useEffect(() => {
    if (userTeam && !loading) {
      navigate(`/teams/${userTeam.id}`);
    }
  }, [userTeam, loading, navigate]);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const data = await teamsApi.list();
      setTeams(data || []);
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const loadUserTeam = async () => {
    try {
      const mine = await teamsApi.getUserTeam(currentUser?.id || '');
      setUserTeam(mine || null);
    } catch (error) {
      // ignore if not found
    }
  };

  const onCreateTeam = async (data: TeamFormData) => {
    setCreating(true);
    try {
    const newTeam = await teamsApi.create({
      name: data.name,
      description: data.description,
      country: data.country,
      isOpen: data.isOpen,
      registrationsOpen: data.registrationsOpen,
    });
      await loadTeams();
      setUserTeam(newTeam);
      setCreateDialogOpen(false);
      reset();
      toast.success(`Team "${newTeam.name}" created successfully! You are now the team leader.`);
      navigate(`/teams/${newTeam.id}`, { state: { refetch: true } });
    } catch (error) {
      console.error("Failed to create team:", error);
      toast.error("Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async (team: Team) => {
    // Check if user already has a team
    if (userTeam) {
      toast.error("You can only join one team. Please leave your current team first.");
      return;
    }

    try {
      const result = await teamsApi.join(team.id);
      
      if (result.joined) {
        toast.success(`Successfully joined ${team.name}!`);
        await loadTeams();
        await loadUserTeam();
      } else {
        toast.success(`Join request submitted to ${team.name}. Waiting for approval.`);
        await loadTeams();
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to join team";
      toast.error(message);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteId) return;
    try {
      await teamsApi.deleteTeam(deleteId);
      setTeams((prev) => prev.filter((t) => t.id !== deleteId));
      setDeleteId(null);
      toast.success("Team deleted");
    } catch {
      toast.error("Failed to delete team");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground">
              Join a team or create your own to compete together
            </p>
          </div>
        </div>
        
        {/* Only show Create Team button if user doesn't have a team */}
        {!userTeam && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit(onCreateTeam)}>
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                  <DialogDescription>
                    Build your team to compete together in events and challenges. You can only be a member of one team.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Team Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter team name"
                      {...register("name", { required: "Team name is required" })}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motto">Team Motto</Label>
                    <Input
                      id="motto"
                      placeholder="Enter team motto"
                      {...register("motto")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      placeholder="Enter country"
                      {...register("country", { required: "Country is required" })}
                    />
                    {errors.country && (
                      <p className="text-sm text-red-500">{errors.country.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your team..."
                      rows={3}
                      {...register("description")}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Team Access *</Label>
                    <div className="space-y-2">
                      <div
                        className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setValue("isOpen", true);
                          setValue("registrationsOpen", true);
                        }}
                      >
                        <input
                          type="radio"
                          name="teamAccess"
                          id="open"
                          defaultChecked={true}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <Label htmlFor="open" className="cursor-pointer font-medium">
                            Open Team
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Anyone can join immediately without approval
                          </p>
                        </div>
                      </div>
                      
                      <div
                        className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setValue("isOpen", false);
                          setValue("registrationsOpen", true);
                        }}
                      >
                        <input
                          type="radio"
                          name="teamAccess"
                          id="approval"
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <Label htmlFor="approval" className="cursor-pointer font-medium">
                            Approval Required
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Members must request to join and wait for approval
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Team"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Show info if user has a team */}
        {userTeam && (
          <div className="text-sm text-muted-foreground">
            You're already a member of <span className="text-primary font-medium">{userTeam.name}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const isOwner = (team as any).ownerUserId === currentUser?.id;
            const isLeader = team.members?.some?.((m: any) => m.role === "owner" && m.userId === currentUser?.id);
            const isMember = team.members?.some?.((m: any) => m.userId === currentUser?.id);
            
            return (
              <Card 
                key={team.id} 
                className="cyber-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/teams/${team.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                      <AvatarImage src={getAssetUrl(team.avatarUrl)} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                        {team.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        {isLeader && <Crown className="h-4 w-4 text-yellow-400" />}
                      </div>
                      {team.motto && (
                        <p className="text-sm text-muted-foreground italic">"{team.motto}"</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {team.description && (
                    <p className="text-sm text-muted-foreground">{team.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{team.members?.length || 0} members</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>{team.country}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {team.openTeam ? (
                        <>
                          <Globe className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">Open</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 text-orange-400" />
                          <span className="text-orange-400">Private</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {team.registrationsOpen && (
                      <Badge className="bg-blue-500/20 text-blue-400">Recruiting</Badge>
                    )}
                    {isMember && (
                      <Badge className="bg-green-500/20 text-green-400">Member</Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  {isMember ? (
                    <Button className="w-full" variant="outline">
                      View Team
                    </Button>
                  ) : team.registrationsOpen ? (
                    <Button 
                      className="w-full" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinTeam(team);
                      }}
                      disabled={!!userTeam}
                    >
                      {team.openTeam ? "Join Team" : "Request to Join"}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline">
                      View Team
                    </Button>
                  )}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(team.id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTeam}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
