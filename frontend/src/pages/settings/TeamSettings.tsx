import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Trash2, LogOut, Camera, UserPlus, Settings as SettingsIcon, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { toast } from "sonner";
import { teamsApi, Team } from "../../api/teamsApi";

const TEAM_LOGO_OPTIONS = [
  "https://api.dicebear.com/7.x/shapes/svg?seed=team1",
  "https://api.dicebear.com/7.x/shapes/svg?seed=team2",
  "https://api.dicebear.com/7.x/shapes/svg?seed=team3",
  "https://api.dicebear.com/7.x/identicon/svg?seed=team4",
  "https://api.dicebear.com/7.x/identicon/svg?seed=team5",
  "https://api.dicebear.com/7.x/bottts/svg?seed=team6",
  "https://api.dicebear.com/7.x/bottts/svg?seed=team7",
  "https://api.dicebear.com/7.x/bottts/svg?seed=team8",
];

export default function TeamSettings() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<(Team & { logo?: string; role?: string; membersCount?: number })[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showLogoSelector, setShowLogoSelector] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [inviteUserId, setInviteUserId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await teamsApi.list();
        const withCounts = data.map((t) => ({
          ...t,
          logo: TEAM_LOGO_OPTIONS[0],
          role: t.members?.find((m) => m.role === "owner") ? "Leader" : "Member",
          membersCount: t.members?.length || 0,
        }));
        setTeams(withCounts);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load teams");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    try {
      await teamsApi.deleteTeam(selectedTeam);
      toast.success("Team deleted");
      setTeams(teams.filter((t) => t.id !== selectedTeam));
    } catch {
      toast.error("Delete failed");
    } finally {
      setShowDeleteDialog(false);
      setSelectedTeam(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!selectedTeam) return;
    try {
      await teamsApi.leaveTeam(selectedTeam);
      toast.success("You have left the team");
      setTeams(teams.filter((t) => t.id !== selectedTeam));
    } catch {
      toast.error("Leave failed");
    } finally {
      setShowLeaveDialog(false);
      setSelectedTeam(null);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name) {
      toast.error("Team name required");
      return;
    }
    try {
      const created = await teamsApi.create({ name: newTeam.name, description: newTeam.description });
      setTeams([...teams, { ...created, membersCount: created.members?.length || 0 }]);
      setNewTeam({ name: "", description: "" });
      toast.success("Team created");
    } catch (e) {
      console.error(e);
      toast.error("Failed to create team");
    }
  };

  const handleInvite = async (teamId: string) => {
    if (!inviteUserId) {
      toast.error("User ID required");
      return;
    }
    try {
      await teamsApi.addMember(teamId, { userId: inviteUserId, role: "member" });
      toast.success("Member added");
      setInviteUserId("");
    } catch (e) {
      toast.error("Failed to add member");
    }
  };

  const handleUpdateTeam = (teamId: string) => {
    toast.success("Team settings updated");
    setEditingTeam(null);
  };

  const handleLogoChange = (teamId: string, logo: string) => {
    setTeams(teams.map((t) => (t.id === teamId ? { ...t, logo } : t)));
    setShowLogoSelector(null);
    toast.success("Team logo updated");
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="cyber-border">
          <CardContent className="py-12 text-center text-muted-foreground">Loading teams...</CardContent>
        </Card>
      ) : teams.length === 0 ? (
        <Card className="cyber-border">
          <CardContent className="py-12 text-center space-y-4">
            <Users className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
              <p className="text-muted-foreground mb-4">
                Join or create a team to collaborate with others
              </p>
              <Button onClick={() => navigate("/teams")} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Browse Teams
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        teams.map((team) => (
          <Card key={team.id} className="cyber-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={team.logo} />
                    <AvatarFallback>{team.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {team.name}
                      {team.role === "Leader" && (
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          <Crown className="h-3 w-3 mr-1" />
                          Leader
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{team.membersCount ?? team.members?.length ?? 0} members</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTeam(editingTeam === team.id ? null : team.id)}
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {editingTeam === team.id ? (
                <div className="space-y-4 p-4 bg-card/50 rounded-lg border">
                  {team.role === "Leader" && (
                    <>
                      <div className="space-y-2">
                        <Label>Team Logo</Label>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={team.logo} />
                            <AvatarFallback>{team.name[0]}</AvatarFallback>
                          </Avatar>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setShowLogoSelector(showLogoSelector === team.id ? null : team.id)
                            }
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Change Logo
                          </Button>
                        </div>

                        {showLogoSelector === team.id && (
                          <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-4 bg-card/50 rounded-lg border">
                            {TEAM_LOGO_OPTIONS.map((logo, index) => (
                              <button
                                key={index}
                                onClick={() => handleLogoChange(team.id, logo)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                  team.logo === logo
                                    ? "border-primary ring-2 ring-primary"
                                    : "border-border"
                                }`}
                              >
                                <img
                                  src={logo}
                                  alt={`Logo ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`team-name-${team.id}`}>Team Name</Label>
                        <Input
                          id={`team-name-${team.id}`}
                          defaultValue={team.name}
                          onChange={(e) =>
                            setTeamData({ ...teamData, [team.id]: { name: e.target.value } })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`team-desc-${team.id}`}>Description</Label>
                        <Textarea
                          id={`team-desc-${team.id}`}
                          defaultValue={team.description}
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    {team.role === "Leader" ? (
                      <>
                        <Button onClick={() => handleUpdateTeam(team.id)} size="sm">
                          Save Changes
                        </Button>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Invite user ID"
                            value={inviteUserId}
                            onChange={(e) => setInviteUserId(e.target.value)}
                            className="h-9"
                          />
                          <Button variant="outline" size="sm" onClick={() => handleInvite(team.id)}>
                            Add Member
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            setSelectedTeam(team.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Team
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setSelectedTeam(team.id);
                          setShowLeaveDialog(true);
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        Leave Team
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{team.description}</p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Delete Team Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="cyber-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team and remove all
              members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive">
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Team Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="cyber-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Team?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this team? You&apos;ll need to be invited again to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveTeam}>Leave Team</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Team */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Create a Team</CardTitle>
          <CardDescription>Start collaborating by creating a new team.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder="Team name"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
          />
          <Textarea
            rows={2}
            placeholder="Description"
            value={newTeam.description}
            onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
          />
          <Button onClick={handleCreateTeam} disabled={!newTeam.name}>
            Create Team
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

