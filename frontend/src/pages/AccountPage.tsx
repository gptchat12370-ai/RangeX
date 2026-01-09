import React from "react";
import { User, Award, History, Settings, Shield, Users, Crown } from "lucide-react";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { formatDate } from "../lib/utils";
import { accountApi } from "../api/accountApi";
import { teamsApi } from "../api/teamsApi";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function AccountPage() {
  const { currentUser, setCurrentUser } = useStore();
  const navigate = useNavigate();
  const [badges, setBadges] = React.useState<any[]>([]);
  const [team, setTeam] = React.useState<any>(null);
  const [isTeamLeader, setIsTeamLeader] = React.useState(false);

  React.useEffect(() => {
    const fetchBadges = async () => {
      try {
        const userBadges = await accountApi.getMyBadges();
        setBadges(userBadges);
      } catch (error) {
        toast.error("Failed to load badges.");
      }
    };
    
    const fetchTeam = async () => {
      try {
        const userTeam = await teamsApi.getUserTeam(currentUser.id);
        setTeam(userTeam);
        if (userTeam) {
          const member = userTeam.members?.find((m: any) => m.userId === currentUser.id);
          setIsTeamLeader(member?.role === 'owner');
        }
      } catch (error) {
        // User is not in a team
        setTeam(null);
      }
    };
    
    fetchBadges();
    fetchTeam();
  }, [currentUser.id]);

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      setShowCropper(true);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', croppedBlob, 'avatar.jpg');
      
      const updatedUser = await accountApi.uploadAvatar(formData);
      setCurrentUser(updatedUser);
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
    }
  };

  const handleRemoveAvatar = async () => {
    // Reset to DiceBear avatar
    try {
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`;
      // Update with PUT request (you may need to add this endpoint)
      toast.info('Avatar reset to default');
    } catch (error) {
      toast.error('Failed to reset avatar');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-4 border-primary">
          <AvatarImage src={getAssetUrl(currentUser.avatarUrl)} />
          <AvatarFallback>
            {currentUser.firstName?.[0] || currentUser.username?.[0] || 'U'}
            {currentUser.lastName?.[0] || currentUser.username?.[1] || ''}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">{currentUser.username}</h1>
          <p className="text-muted-foreground">
            {currentUser.firstName || currentUser.username} {currentUser.lastName || ''} {currentUser.country ? `· ${currentUser.country}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {currentUser?.roleAdmin && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
            {currentUser?.roleCreator && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                <Settings className="h-3 w-3 mr-1" />
                Creator
              </Badge>
            )}
            {currentUser?.roleSolver && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                <User className="h-3 w-3 mr-1" />
                Solver
              </Badge>
            )}
            {team && (
              <Badge 
                variant="outline" 
                className="gap-1 cursor-pointer hover:bg-accent/50"
                onClick={() => navigate(`/teams/${team.id}`)}
              >
                <Users className="h-3 w-3" />
                {team.name}
                {isTeamLeader && <Crown className="h-3 w-3 text-yellow-400" />}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="progression" className="space-y-6">
        <TabsList>
          <TabsTrigger value="progression">Progression</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="progression">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="text-lg">Total Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary">
                  {currentUser.pointsTotal || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Keep solving challenges to earn more!
                </p>
              </CardContent>
            </Card>

            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="text-lg">Badges Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-yellow-400">
                  {badges.length}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Achievements unlocked
                </p>
              </CardContent>
            </Card>

            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="text-lg">Challenges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-accent">
                  {currentUser.history?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Total attempts
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="badges">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Your Badges</CardTitle>
              <CardDescription>Achievements you've unlocked</CardDescription>
            </CardHeader>
            <CardContent>
              {badges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {badges.map((userBadge) => (
                    <div
                      key={userBadge.id}
                      className="flex items-center gap-4 p-4 bg-card/50 rounded-lg border"
                    >
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Award className="h-8 w-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold">{userBadge.badge.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {userBadge.badge.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Earned {formatDate(userBadge.earnedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No badges earned yet. Complete challenges to earn your first
                  badge!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Challenge History</CardTitle>
              <CardDescription>Your recent activity</CardDescription>
            </CardHeader>
            <CardContent>
              {currentUser.history?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Challenge</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentUser.history?.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.mode}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.status === "Completed"
                                ? "bg-green-500/20 text-green-400"
                                : item.status === "In Progress"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-gray-500/20 text-gray-400"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.score}</TableCell>
                        <TableCell>{item.progressPct}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.startedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No challenge history yet. Start your first challenge!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}