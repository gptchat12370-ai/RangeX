import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Trash2, Crown, Settings as SettingsIcon } from "lucide-react";
import { getAssetUrl } from "../utils/assetUrl";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { teamsApi } from "../api/teamsApi";
import { useStore } from "../lib/store";
import { Team } from "../types";

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

export function TeamSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    motto: "",
    description: "",
    country: "",
    avatarUrl: "",
    openTeam: true,
    registrationsOpen: true,
  });

  useEffect(() => {
    loadTeam();
  }, [id]);

  const loadTeam = async () => {
    if (!id) return;
    setLoading(true);
    const data = await teamsApi.getById(id);
    if (data) {
      setTeam(data);
      setFormData({
        name: data.name,
        motto: data.motto || "",
        description: data.description || "",
        country: data.country || "",
        avatarUrl: data.avatarUrl || TEAM_LOGO_OPTIONS[0],
        openTeam: data.isOpen ?? true,
        registrationsOpen: data.registrationsOpen ?? true,
      });
    } else {
      setTeam(null);
    }
    setLoading(false);
  };

  const isLeader = team && currentUser && (team.leader === currentUser.id || team.owner === currentUser.id);

  const handleSave = async () => {
    if (!id || !isLeader) return;
    try {
      const updated = await teamsApi.update(id, {
        name: formData.name,
        motto: formData.motto,
        description: formData.description,
        country: formData.country,
        avatarUrl: formData.avatarUrl,
        isOpen: formData.openTeam,
        registrationsOpen: formData.registrationsOpen,
      });
      setTeam(updated);
      toast.success("Team settings updated successfully");
      navigate(`/teams/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update team");
    }
  };

  const handleDelete = async () => {
    if (!id || !isLeader) return;
    try {
      await teamsApi.deleteTeam(id);
      toast.success("Team deleted successfully");
      navigate("/teams");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete team");
    }
  };

  const handleLogoChange = async (logoOrFile: string | File) => {
    if (typeof logoOrFile === 'string') {
      setFormData({ ...formData, avatarUrl: logoOrFile });
      setShowLogoSelector(false);
      toast.success("Team logo updated");
    } else {
      if (!id) return;
      try {
        const updatedTeam = await teamsApi.uploadTeamLogo(id, logoOrFile);
        setTeam(updatedTeam);
        setFormData({ ...formData, avatarUrl: updatedTeam.avatarUrl || '' });
        toast.success("Team logo uploaded successfully");
      } catch (error) {
        toast.error("Failed to upload team logo");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading team settings...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Team not found</p>
          <Button variant="link" onClick={() => navigate("/teams")} className="mt-4">
            Go back to teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teams/${id}`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl">Team Settings</h1>
          <p className="text-muted-foreground">
            {isLeader ? "Manage your team settings" : "View team information"}
          </p>
        </div>
      </div>

      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={getAssetUrl(formData.avatarUrl)} />
              <AvatarFallback>{formData.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center gap-2">
                {team.name}
                {isLeader && (
                  <Badge className="bg-yellow-500/20 text-yellow-400">
                    <Crown className="h-3 w-3 mr-1" />
                    Leader
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{team.members.length} members</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLeader && (
            <>
              <div className="space-y-2">
                <Label>Team Logo</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={getAssetUrl(formData.avatarUrl)} />
                    <AvatarFallback>{formData.name[0]}</AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Upload Logo
                  </Button>
                  <input
                    type="file"
                    id="logo-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleLogoChange(e.target.files[0])}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowLogoSelector(!showLogoSelector)}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Choose Avatar
                  </Button>
                </div>

                {showLogoSelector && (
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-4 bg-card/50 rounded-lg border">
                    {TEAM_LOGO_OPTIONS.map((logo, index) => (
                      <button
                        key={index}
                        onClick={() => handleLogoChange(logo)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                          formData.avatarUrl === logo
                            ? "border-primary ring-2 ring-primary"
                                                        : "border-border"
                        }`}
                      >
                        <img src={logo} alt={`Logo ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isLeader}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-motto">Team Motto</Label>
                <Input
                  id="team-motto"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="Enter a team motto"
                  disabled={!isLeader}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  disabled={!isLeader}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-country">Country</Label>
                <Input
                  id="team-country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter team country"
                  disabled={!isLeader}
                />
              </div>

              <div className="space-y-4">
                <Label>Team Access</Label>
                <div className="space-y-2">
                  <div
                    className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                    onClick={() => setFormData({ ...formData, openTeam: true, registrationsOpen: false })}
                  >
                    <input
                      type="radio"
                      name="teamAccess"
                      checked={formData.openTeam}
                      onChange={() => setFormData({ ...formData, openTeam: true, registrationsOpen: false })}
                      className="h-4 w-4"
                      disabled={!isLeader}
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Open Team</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow anyone to join without approval (auto-accept)
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                    onClick={() => setFormData({ ...formData, openTeam: false, registrationsOpen: true })}
                  >
                    <input
                      type="radio"
                      name="teamAccess"
                      checked={!formData.openTeam && formData.registrationsOpen}
                      onChange={() => setFormData({ ...formData, openTeam: false, registrationsOpen: true })}
                      className="h-4 w-4"
                      disabled={!isLeader}
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Approval Required</Label>
                      <p className="text-sm text-muted-foreground">
                        Members must request to join and wait for approval
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                    onClick={() => setFormData({ ...formData, openTeam: false, registrationsOpen: false })}
                  >
                    <input
                      type="radio"
                      name="teamAccess"
                      checked={!formData.openTeam && !formData.registrationsOpen}
                      onChange={() => setFormData({ ...formData, openTeam: false, registrationsOpen: false })}
                      className="h-4 w-4"
                      disabled={!isLeader}
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Closed Team</Label>
                      <p className="text-sm text-muted-foreground">
                        Team is closed - no new members can join
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="registrations-open"
                      checked={formData.registrationsOpen}
                      onChange={(e) => setFormData({ ...formData, registrationsOpen: e.target.checked })}
                      disabled={!isLeader}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </>
          )}

          {!isLeader && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Only the team leader can modify team settings. Contact {team.leader} to make changes.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            {isLeader && (
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Team
              </Button>
            )}
            {isLeader ? (
              <div className="flex gap-3 ml-auto">
                <Button variant="outline" onClick={() => navigate(`/teams/${id}`)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            ) : (
              <Button onClick={() => navigate(`/teams/${id}`)} className="ml-auto">
                Back to Team
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Team Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="cyber-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team and remove all members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
