import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAssetUrl } from "../utils/assetUrl";
import {
  ArrowLeft,
  Users,
  Trophy,
  Target,
  TrendingUp,
  UserPlus,
  Settings,
  LogOut,
  Crown,
  Shield,
  Award,
  RefreshCw,
  Camera,
  Trash2,
  Upload,
} from "lucide-react";
import { teamsApi } from "../api/teamsApi";
import { Team } from "../types";
import { useStore } from "../lib/store";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { formatDate } from "../lib/utils";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { ImageCropper } from "../components/ImageCropper";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";

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

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedNewLeader, setSelectedNewLeader] = useState<string>("");
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [teamActivity, setTeamActivity] = useState<any[]>([]);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [showLogoCropper, setShowLogoCropper] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const pendingLogoFileRef = React.useRef<File | null>(null); // Persist across re-renders

  // Debug: Track when pendingLogoFile changes
  React.useEffect(() => {
    console.log('[TeamDetailPage] STATE CHANGE - pendingLogoFile:', pendingLogoFile);
    if (pendingLogoFile) {
      console.log('[TeamDetailPage] File is SET:', { name: pendingLogoFile.name, size: pendingLogoFile.size });
    } else {
      console.log('[TeamDetailPage] File is NULL');
      console.trace('[TeamDetailPage] Stack trace for null file:');
    }
  }, [pendingLogoFile]);
  const [formData, setFormData] = useState({
    name: "",
    motto: "",
    description: "",
    country: "",
    avatarUrl: "",
    isOpen: true,
    registrationsOpen: true,
  });

  const membersList = ((team as any)?.members || []).map((m: any) =>
    typeof m === "string" ? { userId: m, role: "member" } : m
  );
  const eligibleForLeaderTransfer = membersList.filter((m: any) => m.userId !== currentUser?.id);

  // Calculate team stats by summing all members' stats
  const calculateTeamStats = () => {
    const totalPoints = membersList.reduce((sum: number, member: any) => {
      const memberUser = member.user;
      return sum + (memberUser?.pointsTotal || 0);
    }, 0);

    const totalChallenges = membersList.reduce((sum: number, member: any) => {
      const memberUser = member.user;
      return sum + (memberUser?.challengesCompleted || 0);
    }, 0);

    return { totalPoints, totalChallenges };
  };

  const teamStats = team ? calculateTeamStats() : { totalPoints: 0, totalChallenges: 0 };

  useEffect(() => {
    loadTeam();
    loadActivity();
  }, [id]);

  // Join requests are now managed centrally in the Requests page

  const loadTeam = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await teamsApi.getById(id);
      setTeam(data as any);
      if (data) {
        const members = ((data as any).members || []).map((m: any) => (typeof m === "string" ? { userId: m, role: "member" } : m));
        setIsMember(members.some((m: any) => m.userId === currentUser?.id));
        setIsLeader(members.some((m: any) => m.role === "owner" && m.userId === currentUser?.id));
        setFormData({
          name: (data as any).name,
          motto: (data as any).motto || "",
          description: (data as any).description,
          country: (data as any).country,
          avatarUrl: (data as any).avatarUrl || TEAM_LOGO_OPTIONS[0],
          isOpen: (data as any).isOpen ?? (data as any).openTeam,
          registrationsOpen: (data as any).registrationsOpen,
        });
      }
    } catch {
      setTeam(null);
      toast.error("Team not found");
    }
    setLoading(false);
  };

  const loadActivity = async () => {
    if (!id) return;
    try {
      const data = await teamsApi.getTeamActivity(id);
      setTeamActivity(data || []);
    } catch {
      setTeamActivity([]);
    }
  };

  const handleTeamLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Open cropper for preview
    setPendingLogoFile(file);
    setShowLogoCropper(true);
  };

  const handleLogoCropComplete = async (croppedBlob: Blob) => {
    console.log('[TeamDetailPage] handleLogoCropComplete called with blob:', croppedBlob);
    
    // Revoke old preview URL to prevent memory leak
    if (pendingLogoPreview) {
      console.log('[TeamDetailPage] Revoking old preview URL:', pendingLogoPreview);
      URL.revokeObjectURL(pendingLogoPreview);
    }
    
    // Create a preview URL from the cropped blob
    const previewUrl = URL.createObjectURL(croppedBlob);
    console.log('[TeamDetailPage] Created new preview URL:', previewUrl);
    setPendingLogoPreview(previewUrl);
    setFormData(prev => ({ ...prev, avatarUrl: previewUrl })); // Show preview immediately
    
    // Store the blob as File for upload on save
    const croppedFile = new File([croppedBlob], 'logo.jpg', { type: 'image/jpeg' });
    console.log('[TeamDetailPage] Created File object:', croppedFile, 'size:', croppedFile.size);
    setPendingLogoFile(croppedFile);
    pendingLogoFileRef.current = croppedFile; // Store in ref for persistence
    console.log('[TeamDetailPage] Set pendingLogoFile to:', croppedFile);
    console.log('[TeamDetailPage] Set pendingLogoFileRef.current to:', croppedFile);
  };

  // Cleanup object URLs on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
    };
  }, [pendingLogoPreview]);

  const handleJoinTeam = async () => {
    if (!team) return;
    
    try {
      const result = await teamsApi.join(team.id);
      
      if (result.joined) {
        toast.success("Successfully joined team!");
        loadTeam();
      } else {
        toast.success("Join request submitted! Waiting for team leader approval.");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to join team";
      toast.error(message);
    }
  };

  const handleLeaveTeam = async () => {
    if (!team) return;
    
    try {
      const result = await teamsApi.leave(team.id);
      
      if (isLeader && membersList.length > 1) {
        toast.success("Left the team. Leadership has been transferred to another member.");
      } else {
        toast.success("Left the team");
      }
      
      navigate("/teams");
    } catch (error: any) {
      console.error("Leave team error:", error);
      toast.error(error?.response?.data?.message || "Failed to leave team");
    }
  };

  const handleTransferLeadership = async () => {
    if (!team || !selectedNewLeader) return;

    try {
      await teamsApi.transferLeadership(team.id, selectedNewLeader);
      toast.success("Leadership transferred successfully!");
      setTransferDialogOpen(false);
      loadTeam();
    } catch (error) {
      toast.error("Failed to transfer leadership");
    }
  };

  const handleSaveSettings = async () => {
    if (!team) return;
    try {
      console.log('[TeamDetailPage] handleSaveSettings called - Current avatarUrl:', formData.avatarUrl);
      console.log('[TeamDetailPage] pendingLogoPreview:', pendingLogoPreview);
      console.log('[TeamDetailPage] pendingLogoFile:', pendingLogoFile);
      console.log('[TeamDetailPage] pendingLogoFileRef.current:', pendingLogoFileRef.current);
      
      let finalAvatarUrl = formData.avatarUrl;
      
      // Use the ref which persists across re-renders
      const fileToUpload = pendingLogoFileRef.current || pendingLogoFile;
      
      // If there's a pending cropped logo, upload it first
      if (pendingLogoPreview && fileToUpload) {
        console.log('[TeamDetailPage] Uploading pending logo file...');
        setUploadingLogo(true);
        
        try {
          const updatedTeam = await teamsApi.uploadTeamLogo(team.id, fileToUpload);
          console.log('[TeamDetailPage] Upload response:', updatedTeam);
          
          if (!updatedTeam.avatarUrl) {
            console.error('[TeamDetailPage] Upload succeeded but no avatarUrl in response');
            toast.error('Upload failed - no URL returned');
            setUploadingLogo(false);
            return;
          }
          
          finalAvatarUrl = updatedTeam.avatarUrl;
          console.log('[TeamDetailPage] Logo uploaded successfully:', finalAvatarUrl);
          
          // Clean up preview
          if (pendingLogoPreview) {
            URL.revokeObjectURL(pendingLogoPreview);
          }
          setPendingLogoFile(null);
          setPendingLogoPreview(null);
          setUploadingLogo(false);
        } catch (uploadErr) {
          console.error('[TeamDetailPage] Logo upload failed:', uploadErr);
          setUploadingLogo(false);
          toast.error('Failed to upload logo');
          return;
        }
      }
      
      console.log('[TeamDetailPage] Final avatarUrl before save:', finalAvatarUrl);
      
      // Prevent blob URLs from being saved (this means user cropped but upload didn't complete)
      // Allow DiceBear and other HTTP(S) URLs to be saved directly
      if (finalAvatarUrl && finalAvatarUrl.startsWith('blob:')) {
        console.error('[TeamDetailPage] Blob URL detected - logo was not uploaded properly');
        toast.error('Logo upload incomplete. Please try uploading again.');
        return;
      }

      // Update team details
      await teamsApi.update(team.id, {
        name: formData.name,
        motto: formData.motto,
        description: formData.description,
        country: formData.country,
        avatarUrl: finalAvatarUrl,
        isOpen: formData.isOpen,
        registrationsOpen: formData.registrationsOpen,
      });
      toast.success("Team settings updated successfully");
      loadTeam();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update team settings");
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    try {
      await teamsApi.deleteTeam(team.id);
      toast.success("Team deleted successfully");
      navigate("/teams");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete team");
    }
  };

  const handleLogoChange = (logo: string) => {
    setFormData({ ...formData, avatarUrl: logo });
    setShowLogoSelector(false);
    toast.success("Team logo updated");
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Team not found</p>
          <Button
            variant="link"
            onClick={() => navigate("/teams")}
            className="mt-4"
          >
            Go back to teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="gap-2"
        onClick={() => navigate("/teams")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Teams
      </Button>

      {/* Team Header */}
      <div className="cyber-border rounded-lg p-6 bg-gradient-to-br from-card to-card/50 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Team Avatar */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
              <Avatar className="h-20 w-20 border-2 border-primary relative">
                <AvatarImage src={getAssetUrl(team.avatarUrl)} alt={team.name} />
                <AvatarFallback className="text-2xl">
                  {team.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <ImageCropper
              open={showLogoCropper}
              onClose={() => {
                setShowLogoCropper(false);
                setPendingLogoFile(null);
              }}
              onCropComplete={handleLogoCropComplete}
              imageFile={pendingLogoFile}
              title="Crop Team Logo"
            />

            <div className="space-y-2 flex-1">
              <h1 className="text-4xl font-bold">{team.name}</h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                {team.description}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {membersList.length} members
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  {teamStats.totalPoints} points (Standard)
                </Badge>
                {team?.eventPoints !== undefined && team.eventPoints > 0 && (
                  <Badge variant="outline" className="gap-1 border-primary text-primary">
                    <Trophy className="h-3 w-3" />
                    {team.eventPoints} points (Events)
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <Target className="h-3 w-3" />
                  {teamStats.totalChallenges} challenges
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!isMember ? (
              <Button
                size="lg"
                className="gap-2"
                onClick={handleJoinTeam}
                disabled={membersList.length >= 50}
              >
                <UserPlus className="h-4 w-4" />
                Join Team
              </Button>
            ) : (
              <>
                {isLeader && eligibleForLeaderTransfer.length > 0 && (
                  <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Transfer Leadership
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transfer Leadership</DialogTitle>
                        <DialogDescription>
                          Select a team member to transfer leadership to. This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 py-4">
                        {eligibleForLeaderTransfer.map((member: any) => {
                          const memberUser = member.user;
                          const displayName = memberUser?.displayName || memberUser?.email || 'Unknown Member';
                          return (
                          <button
                            key={member.userId}
                            onClick={() => setSelectedNewLeader(member.userId)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                              selectedNewLeader === member.userId
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={getAssetUrl(memberUser?.avatarUrl)} />
                              <AvatarFallback>
                                {displayName && typeof displayName === 'string' && displayName.length >= 2 ? displayName.substring(0, 2).toUpperCase() : 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-left">
                              <p className="font-medium">{displayName}</p>
                              <p className="text-xs text-muted-foreground">{memberUser?.email || 'Team Member'}</p>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setTransferDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleTransferLeadership}
                          disabled={!selectedNewLeader}
                        >
                          Transfer Leadership
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Leave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave Team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to leave {team.name}? 
                        {isLeader && membersList.length > 1 && (
                          <span className="block mt-2 text-yellow-400">
                            As the team leader, leadership will be automatically transferred to another member.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeaveTeam}>
                        Leave Team
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Team Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Total Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {teamStats.totalPoints.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Challenges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.totalChallenges}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Global Rank
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">#{team.rank || "N/A"}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{membersList.length}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          {isLeader && <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members ({membersList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {membersList.map((member: any, index: number) => {
                  const memberId = member.userId || member.id || '';
                  const memberUser = member.user;
                  // Display name priority: user.displayName > user.email > userId (UUID fallback)
                  const displayName = memberUser?.displayName || memberUser?.email || (memberId && typeof memberId === 'string' && memberId.length >= 8 ? `User ${memberId.substring(0, 8)}` : 'Unknown User');
                  const isTeamLeader = member.role === "owner";
                  return (
                    <div
                      key={member.id || memberId}
                      className="flex items-center justify-between p-4 rounded-lg bg-card/50 border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAssetUrl(memberUser?.avatarUrl)} />
                          <AvatarFallback>
                            {displayName && typeof displayName === 'string' && displayName.length >= 2 ? displayName.substring(0, 2).toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{displayName}</p>
                            {isTeamLeader && (
                              <Badge
                                variant="outline"
                                className="gap-1 bg-yellow-500/10 text-yellow-400 border-yellow-500/50"
                              >
                                <Crown className="h-3 w-3" />
                                Leader
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {memberUser?.email || 'Member'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{memberUser?.pointsTotal || 0} pts</p>
                        <p className="text-xs text-muted-foreground">
                          {memberUser?.challengesCompleted || 0} challenges
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teamActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No recent activity. Start completing challenges to see activity here!
                      </p>
                    ) : (
                      teamActivity.map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-card/50 border"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {(activity.username || 'U').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm">
                                <span className="font-medium">{activity.username}</span>{" "}
                                {activity.action}{" "}
                                <span className="text-primary">
                                  challenge {activity.scenarioId?.substring(0, 8)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(activity.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {activity.points > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <Trophy className="h-3 w-3" />
                              +{activity.points}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-400" />
                Team Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    name: "Team Player",
                    description: "Created a team",
                    icon: Users,
                    earned: true,
                  },
                  {
                    name: "First Steps",
                    description: "Completed 10 challenges as a team",
                    icon: Target,
                    earned: (team?.challengesCompleted || 0) >= 10,
                  },
                  {
                    name: "Rising Stars",
                    description: "Reached top 100 in rankings",
                    icon: TrendingUp,
                    earned: (team?.rank || 999) <= 100,
                  },
                ].map((achievement, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      achievement.earned
                        ? "border-primary bg-primary/5"
                        : "border-border opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`p-2 rounded-lg ${
                          achievement.earned
                            ? "bg-primary/10"
                            : "bg-muted"
                        }`}
                      >
                        <achievement.icon
                          className={`h-5 w-5 ${
                            achievement.earned
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{achievement.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isLeader && (
          <TabsContent value="settings" className="space-y-6">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Team Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Logo */}
                <div className="space-y-2">
                  <Label>Team Logo</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-2 border-primary">
                      <AvatarImage src={getAssetUrl(formData.avatarUrl)} />
                      <AvatarFallback>{formData.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="team-logo-upload"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleTeamLogoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('team-logo-upload')?.click()}
                        className="gap-2"
                        disabled={uploadingLogo}
                      >
                        <Camera className="h-4 w-4" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowLogoSelector(!showLogoSelector)}
                        className="gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Choose Logo
                      </Button>
                    </div>
                  </div>

                  {pendingLogoPreview && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                      <p className="text-primary font-medium">Preview: Click "Save Changes" to apply this logo</p>
                    </div>
                  )}

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

                {/* Team Name */}
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Team Motto */}
                <div className="space-y-2">
                  <Label htmlFor="team-motto">Team Motto</Label>
                  <Input
                    id="team-motto"
                    value={formData.motto}
                    onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                    placeholder="Enter a team motto"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="team-description">Description</Label>
                  <Textarea
                    id="team-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="team-country">Country</Label>
                  <Input
                    id="team-country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>

                {/* Team Access Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <Label>Team Access</Label>
                  <div className="space-y-2">
                    <div
                      className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                      onClick={() => setFormData({ ...formData, isOpen: true, registrationsOpen: false })}
                    >
                      <input
                        type="radio"
                        name="teamAccess"
                        checked={formData.isOpen}
                        onChange={() => setFormData({ ...formData, isOpen: true, registrationsOpen: false })}
                        className="h-4 w-4"
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
                      onClick={() => setFormData({ ...formData, isOpen: false, registrationsOpen: true })}
                    >
                      <input
                        type="radio"
                        name="teamAccess"
                        checked={!formData.isOpen && formData.registrationsOpen}
                        onChange={() => setFormData({ ...formData, isOpen: false, registrationsOpen: true })}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <Label className="cursor-pointer font-medium">Approval Required</Label>
                        <p className="text-sm text-muted-foreground">
                          Members must request to join and wait for approval
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex-items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-accent"
                      onClick={() => setFormData({ ...formData, isOpen: false, registrationsOpen: false })}
                    >
                      <input
                        type="radio"
                        name="teamAccess"
                        checked={!formData.isOpen && !formData.registrationsOpen}
                        onChange={() => setFormData({ ...formData, isOpen: false, registrationsOpen: false })}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <Label className="cursor-pointer font-medium">Closed Team</Label>
                        <p className="text-sm text-muted-foreground">
                          Team is closed - no new members can join
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save & Delete */}
                <div className="flex justify-between pt-4 border-t">
                  <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete Team
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Team?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the team and remove all members.
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

                  <Button onClick={handleSaveSettings}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
