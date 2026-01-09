import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAssetUrl } from "../../utils/assetUrl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { 
  Search, 
  ExternalLink, 
  Edit, 
  TrendingUp, 
  Users, 
  Clock, 
  Star,
  Target,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Copy,
  ArrowLeft,
  PlayCircle
} from "lucide-react";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/skeleton";

interface ApprovedScenario {
  id: string;
  scenarioId: string;
  title: string;
  shortDescription: string;
  coverImageUrl?: string;
  difficulty: string;
  category: string;
  tags: string[];
  estimatedMinutes: number;
  scenarioType: string;
  versionNumber: number;
  status: string;
  isArchived: boolean;
  creator?: string;
  completions?: number;
  activeUsers?: number;
  averageRating?: number;
  successRate?: number;
  publishingBlocked?: boolean;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-600 border-green-500/20",
  easy: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  hard: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  expert: "bg-red-500/10 text-red-600 border-red-500/20",
};

const categoryColors: Record<string, string> = {
  "web-security": "bg-blue-500/10 text-blue-600",
  "network": "bg-purple-500/10 text-purple-600",
  "forensics": "bg-pink-500/10 text-pink-600",
  "cryptography": "bg-indigo-500/10 text-indigo-600",
  "reverse-engineering": "bg-cyan-500/10 text-cyan-600",
  "osint": "bg-teal-500/10 text-teal-600",
  "cloud": "bg-sky-500/10 text-sky-600",
  "default": "bg-gray-500/10 text-gray-600",
};

export function AdminScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<ApprovedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [scenarioToToggle, setScenarioToToggle] = useState<ApprovedScenario | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<ApprovedScenario | null>(null);

  useEffect(() => {
    loadApprovedScenarios();
  }, []);

  const loadApprovedScenarios = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listApprovedScenarios();
      setScenarios(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load approved scenarios");
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = (scenario: ApprovedScenario) => {
    setScenarioToToggle(scenario);
    setHideDialogOpen(true);
  };

  const confirmToggleVisibility = async () => {
    if (!scenarioToToggle) return;
    
    const action = scenarioToToggle.isArchived ? 'show' : 'hide';
    const actionPast = scenarioToToggle.isArchived ? 'shown' : 'hidden';

    try {
      console.log('[AdminScenariosPage] Toggling visibility for scenario:', scenarioToToggle.id);
      const result = await adminApi.toggleScenarioVisibility(scenarioToToggle.id);
      console.log('[AdminScenariosPage] Toggle result:', result);
      
      toast.success(result.message || `Scenario ${actionPast} successfully`);
      
      // Update local state
      setScenarios(scenarios.map(s => 
        s.id === scenarioToToggle.id ? { ...s, isArchived: result.isArchived } : s
      ));
      
      setHideDialogOpen(false);
      setScenarioToToggle(null);
    } catch (err: any) {
      console.error('[AdminScenariosPage] Toggle visibility error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to toggle visibility';
      toast.error(`Error: ${errorMessage}`);
      
      // Log detailed error for debugging
      if (err?.response) {
        console.error('[AdminScenariosPage] Response status:', err.response.status);
        console.error('[AdminScenariosPage] Response data:', err.response.data);
      }
    }
  };

  const openDeleteDialog = (scenario: ApprovedScenario) => {
    setScenarioToDelete(scenario);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!scenarioToDelete) return;
    
    try {
      const response = await adminApi.deleteScenarioVersion(scenarioToDelete.id);
      
      if (response.deletedScenario) {
        toast.success("Entire scenario deleted (was the only version)");
      } else {
        toast.success(`Version ${scenarioToDelete.versionNumber} deleted successfully`);
      }
      
      // Remove from list
      setScenarios(scenarios.filter(s => s.id !== scenarioToDelete.id));
      setDeleteDialogOpen(false);
      setScenarioToDelete(null);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || "Delete failed";
      toast.error(errorMsg);
    }
  };

  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesSearch =
      searchQuery === "" ||
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.shortDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      scenario.creator?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDifficulty = !selectedDifficulty || scenario.difficulty === selectedDifficulty;
    const matchesCategory = !selectedCategory || scenario.category === selectedCategory;

    return matchesSearch && matchesDifficulty && matchesCategory;
  });

  const stats = {
    total: scenarios.length,
    totalCompletions: scenarios.reduce((sum, s) => sum + (s.completions || 0), 0),
    activeUsers: scenarios.reduce((sum, s) => sum + (s.activeUsers || 0), 0),
    averageRating: scenarios.length > 0
      ? (scenarios.reduce((sum, s) => sum + (s.averageRating || 0), 0) / scenarios.length).toFixed(1)
      : "0.0",
  };

  const difficulties = Array.from(new Set(scenarios.map((s) => s.difficulty)));
  const categories = Array.from(new Set(scenarios.map((s) => s.category)));

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.totalCompletions}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{stats.activeUsers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-orange-600 fill-orange-600" />
              <span className="text-2xl font-bold">{stats.averageRating}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Published Scenarios</CardTitle>
          <CardDescription>Manage and monitor scenarios available to users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, tags, creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Tags */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedDifficulty === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty(null)}
            >
              All Difficulties
            </Button>
            {difficulties.map((diff) => (
              <Button
                key={diff}
                variant={selectedDifficulty === diff ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDifficulty(diff === selectedDifficulty ? null : diff)}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Categories
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              >
                {cat.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenarios Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredScenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No scenarios found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 overflow-hidden"
            >
              {/* Cover Image */}
              {scenario.coverImageUrl && (
                <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
                  <img 
                    src={getAssetUrl(scenario.coverImageUrl)} 
                    alt={scenario.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    className={`${difficultyColors[scenario.difficulty] || difficultyColors.medium} border`}
                    variant="outline"
                  >
                    {scenario.difficulty.toUpperCase()}
                  </Badge>
                  <Badge className={categoryColors[scenario.category] || categoryColors.default}>
                    {scenario.category.replace(/-/g, " ")}
                  </Badge>
                </div>
                <CardTitle className="text-lg line-clamp-2">{scenario.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {scenario.shortDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tags */}
                {scenario.tags && scenario.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {scenario.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {scenario.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{scenario.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{scenario.estimatedMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Trophy className="h-3 w-3" />
                    <span>{scenario.completions || 0} completions</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{scenario.activeUsers || 0} active</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span>{scenario.averageRating?.toFixed(1) || "N/A"}</span>
                  </div>
                </div>

                {/* Creator */}
                {scenario.creator && (
                  <p className="text-xs text-muted-foreground">
                    By <span className="font-medium">{scenario.creator}</span> • v{scenario.versionNumber}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/challenges/${scenario.id}`)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/creator/new?baseScenario=${scenario.scenarioId}`)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Create v{scenario.versionNumber + 1}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {scenario.status === 'PUBLISHED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs border-blue-600 text-blue-600 hover:bg-blue-600/10"
                        onClick={async () => {
                          try {
                            await adminApi.unapproveScenario(scenario.id);
                            toast.success(`Scenario "${scenario.title}" reverted to draft`);
                            loadApprovedScenarios();
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message || 'Failed to unapprove');
                          }
                        }}
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Revert to Draft
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={scenario.isArchived ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => toggleVisibility(scenario)}
                    >
                      {scenario.isArchived ? '👁️ Show to Users' : '🚫 Hide from Users'}
                    </Button>
                  </div>
                  {/* Only show delete for non-approved/published scenarios */}
                  {scenario.status !== 'APPROVED' && scenario.status !== 'PUBLISHED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteDialog(scenario)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete Version
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Hiding/Showing Scenarios */}
      <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scenarioToToggle?.isArchived ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Show Scenario to Users?
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Hide Scenario from Users?
                </>
              )}
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-3">
              {scenarioToToggle?.isArchived ? (
                <>
                  <p className="text-base">
                    You're about to make <span className="font-semibold text-foreground">"{scenarioToToggle?.title}"</span> visible to all users.
                  </p>
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ This scenario will appear in the challenges list
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ Users will be able to start new sessions
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base">
                    You're about to hide <span className="font-semibold text-foreground">"{scenarioToToggle?.title}"</span> from all users.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <span>This scenario will be removed from the challenges list</span>
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <span className="text-lg">ℹ️</span>
                      <span>Users won't be able to start new sessions</span>
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <span className="text-lg">✓</span>
                      <span>Existing active sessions will continue unaffected</span>
                    </p>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setHideDialogOpen(false);
                setScenarioToToggle(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={scenarioToToggle?.isArchived ? "default" : "destructive"}
              onClick={confirmToggleVisibility}
            >
              {scenarioToToggle?.isArchived ? '✓ Show Scenario' : '⚠️ Hide Scenario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Version Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Scenario Version
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-base">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{scenarioToDelete?.title}"</span>
              {scenarioToDelete?.versionNumber && (
                <span className="text-muted-foreground"> (Version {scenarioToDelete.versionNumber})</span>
              )}?
            </p>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-sm text-destructive font-semibold mb-2">⚠️ This will permanently:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Delete this version from the database</li>
                <li>Remove cover images and files from storage</li>
                <li>If this is the only version, delete the entire scenario</li>
              </ul>
            </div>
            {scenarioToDelete?.activeUsers && scenarioToDelete.activeUsers > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Note: {scenarioToDelete.activeUsers} user(s) may have active sessions. Deletion will fail if sessions are running.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
