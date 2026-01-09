import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Edit, Trash2, Eye, Copy, MoreVertical, TrendingUp, 
  Search, Filter, FileText, Send, Archive, Clock, CheckCircle2,
  XCircle, Layers
} from "lucide-react";
import { creatorApi } from "../../api/creatorApi";
import { useStore } from "../../lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatDate } from "../../lib/utils";
import { toast } from "sonner";

type ScenarioStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
type ScenarioType = "challenge" | "openLab" | "eventLab";

interface ScenarioRow {
  id: string; // Parent scenario ID
  versionId: string; // Latest version ID for preview
  title: string;
  status: ScenarioStatus;
  difficulty?: string;
  category?: string;
  updatedAt?: string;
  createdAt?: string;
  version?: number;
  shortDesc?: string;
  creatorName?: string; // For admin view
  createdByUserId?: string; // For admin permission checks
}

  export function MyScenariosPage() {
    const navigate = useNavigate();
    const { currentUser } = useStore();
    const [loading, setLoading] = useState(true);
    const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
    const [showAll, setShowAll] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scenarioToDelete, setScenarioToDelete] = useState<ScenarioRow | null>(null);

    const loadScenarios = async () => {
      setLoading(true);
      try {
        const all = await creatorApi.listScenarios(currentUser?.roleAdmin ? { all: showAll } : undefined);
        // Flatten all versions into separate rows
        const allVersions: ScenarioRow[] = [];
        (all || []).forEach((s: any) => {
          if (s.versions && s.versions.length > 0) {
            s.versions.forEach((v: any) => {
              allVersions.push({
                id: s.id, // Parent scenario ID
                versionId: v.id, // Version ID
                title: v.title || s.slug,
                status: v.status as ScenarioStatus,
                difficulty: v.difficulty,
                category: v.category,
                updatedAt: v.updatedAt,
                createdAt: v.createdAt,
                version: v.versionNumber,
                shortDesc: v.shortDescription,
                creatorName: s.creatorName,
                createdByUserId: s.createdByUserId,
              });
            });
          }
        });
        setScenarios(allVersions);
      } catch (error: any) {
        console.error("Failed to load scenarios:", error);
        const errorMessage = error.response?.data?.message || "Failed to load scenarios";
        toast.error(errorMessage);
        setScenarios([]);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadScenarios();
    }, [currentUser, showAll]);

    // listen for navigation back from builder with refresh flag
    useEffect(() => {
      const handleVisibility = () => {
        // if page became visible, refetch to ensure fresh data
        if (document.visibilityState === "visible") {
          if (sessionStorage.getItem("rangex_refresh_scenarios") === "1") {
            sessionStorage.removeItem("rangex_refresh_scenarios");
            loadScenarios();
            return;
          }
          loadScenarios();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    const handleDelete = (scenario: ScenarioRow) => {
      setScenarioToDelete(scenario);
      setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
      if (!scenarioToDelete) return;
      
      try {
        // Delete only the specific version (versionId), not the entire scenario
        const result = await creatorApi.deleteScenarioVersion(
          scenarioToDelete.id,
          scenarioToDelete.versionId
        );
        
        if (result.deletedScenario) {
          // If this was the last version, remove all versions of this scenario
          setScenarios((prev) => prev.filter((s) => s.id !== scenarioToDelete.id));
          toast.success("Scenario and all versions deleted (last version removed)");
        } else {
          // Remove only this version from the list
          setScenarios((prev) => prev.filter((s) => s.versionId !== scenarioToDelete.versionId));
          toast.success(`Version ${scenarioToDelete.version} deleted successfully`);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || "Failed to delete scenario version";
        toast.error(errorMessage);
        console.error("Delete scenario version error:", error);
      } finally {
        setDeleteDialogOpen(false);
        setScenarioToDelete(null);
      }
    };

    // Used by child flows (save/submit) to refresh list
    const refreshList = async () => {
      try {
        await loadScenarios();
      } catch (error) {
        console.error("Failed to refresh scenarios:", error);
        toast.error("Failed to refresh scenarios list");
      }
    };

    const handleCreateNewVersion = async (scenario: ScenarioRow) => {
      if (!scenario.id) {
        toast.error("Invalid scenario ID");
        return;
      }
      
      // Check if a draft version already exists for this scenario
      const draftVersion = scenarios.find(
        s => s.id === scenario.id && s.status === 'DRAFT'
      );
      
      if (draftVersion) {
        toast.info("A draft version already exists. Redirecting to edit it...");
        navigate(`/creator/new?id=${scenario.id}&version=${draftVersion.versionId}`);
        return;
      }
      
      // Navigate to create new version based on approved scenario
      toast.info("Creating new version...");
      navigate(`/creator/new?baseScenario=${scenario.id}`);
    };

    // Filtering logic
    const filteredScenarios = scenarios.filter((scenario) => {
      const matchesSearch =
        searchQuery === "" ||
        scenario.title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || scenario.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || scenario.category === categoryFilter;
      const matchesDifficulty = difficultyFilter === "all" || scenario.difficulty === difficultyFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesDifficulty;
    });

    // Stats
    const draftCount = scenarios.filter((s) => s.status === "DRAFT").length;
    const pendingCount = scenarios.filter((s) => s.status === "SUBMITTED").length;
    const approvedCount = scenarios.filter((s) => s.status === "APPROVED" ).length;
    const publishedCount = scenarios.filter((s) => s.status === "PUBLISHED").length;
    const archivedCount = scenarios.filter((s) => s.status === "ARCHIVED").length;
    
    

    const getStatusBadge = (status: string) => {
      switch (status) {
        case "DRAFT":
          return <Badge className="bg-gray-600 text-white border-gray-600">Draft</Badge>;
        case "SUBMITTED":
          return <Badge className="bg-amber-500 text-white border-amber-500">Pending Approval</Badge>;
        case "APPROVED":
          return <Badge className="bg-green-600 text-white border-green-600">Approved</Badge>;
        case "PUBLISHED":
          return <Badge className="bg-blue-600 text-white border-blue-600 shadow-md">✓ Published</Badge>;
        case "ARCHIVED":
          return <Badge className="bg-purple-600 text-white border-purple-600">Archived</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    };

    const getTypeLabel = (scenario: ScenarioRow) => {
      // Type would come from backend scenarioType field
      return "Challenge";
    };

    const renderScenarioRow = (scenario: ScenarioRow) => {
      const isOwner = scenario.createdByUserId === currentUser?.id || !scenario.createdByUserId;
      // ⚠️ CRITICAL: Only allow editing DRAFT scenarios
      // SUBMITTED, APPROVED, PUBLISHED cannot be edited (must revert to draft via admin first)
      const canEdit = scenario.status === "DRAFT" && (isOwner || currentUser?.roleAdmin);
      const canSubmit = scenario.status === "DRAFT" && scenario.title && scenario.category && (isOwner || currentUser?.roleAdmin);
      const canCreateVersion = (scenario.status === "APPROVED" || scenario.status === "PUBLISHED") && (isOwner || currentUser?.roleAdmin);
      // ⚠️ DELETE PROTECTION: Only allow deleting DRAFT scenarios
      const canDelete = scenario.status === "DRAFT" && (isOwner || currentUser?.roleAdmin);

      return (
        <TableRow key={scenario.versionId} className="group hover:bg-primary/5">
          <TableCell>
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-2">
                {scenario.title}
                {scenario.version && (
                  <Badge variant="outline" className="text-xs">
                    v{scenario.version}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-1 max-w-md overflow-hidden text-ellipsis">
                {scenario.shortDesc}
              </div>
            </div>
          </TableCell>
          <TableCell>{getStatusBadge(scenario.status || "draft")}</TableCell>
          <TableCell>
            <Badge variant="outline">{getTypeLabel(scenario)}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{scenario.difficulty}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{scenario.category}</Badge>
          </TableCell>
          {showAll && currentUser?.roleAdmin && (
            <TableCell>
              <div className="text-sm text-muted-foreground">
                {scenario.creatorName || 'Unknown'}
              </div>
            </TableCell>
          )}
          <TableCell className="text-sm text-muted-foreground">
            {formatDate(scenario.updatedAt || scenario.createdAt || new Date().toISOString())}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => navigate(`/creator/new?id=${scenario.id}&version=${scenario.versionId}`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {canSubmit && (
                      <DropdownMenuItem>
                        <Send className="mr-2 h-4 w-4" />
                        Submit for Review
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                
                {!canEdit && (
                  <DropdownMenuItem onClick={() => navigate(`/challenges/${scenario.versionId}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                
                {canCreateVersion && (
                  <DropdownMenuItem onClick={() => handleCreateNewVersion(scenario)}>
                    <Layers className="mr-2 h-4 w-4" />
                    Create New Version
                  </DropdownMenuItem>
                )}

                {/* ⚠️ EDIT/DELETE PROTECTION: Only show for DRAFT scenarios */}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(scenario)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      );
    };

    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Scenarios</h1>
              <p className="text-muted-foreground">
                Build and maintain challenges and multi-machine environments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentUser?.roleAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                <span className="text-sm font-medium">Show all users</span>
                <Switch checked={showAll} onCheckedChange={setShowAll} />
              </div>
            )}
            <Button className="gap-2 h-11" onClick={() => navigate("/creator/new")}>
              <Plus className="h-4 w-4" />
              Create New Scenario
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="cyber-border overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{scenarios.length}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border overflow-hidden border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-400">{draftCount}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border overflow-hidden border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Send className="h-4 w-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-400">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border overflow-hidden border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{approvedCount}</div>
            </CardContent>
          </Card>

          <Card className="cyber-border overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{publishedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search scenarios or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Web">Web</SelectItem>
                  <SelectItem value="Network">Network</SelectItem>
                  <SelectItem value="Forensics">Forensics</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Misc">Misc</SelectItem>
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Intermediate">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                  <SelectItem value="Impossible">Insane</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scenarios Table */}
        <Card className="cyber-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredScenarios.length === 0 ? (
              <div className="text-center py-16">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all" || difficultyFilter !== "all" ? (
                  <>
                    <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">No scenarios found</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Try adjusting your filters
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setCategoryFilter("all");
                        setDifficultyFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </>
                ) : (
                  <>
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">No scenarios yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get started by creating your first scenario
                    </p>
                    <Button onClick={() => navigate("/creator/new")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Scenario
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Category</TableHead>
                    {showAll && currentUser?.roleAdmin && <TableHead>Creator</TableHead>}
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScenarios.map((scenario) => renderScenarioRow(scenario))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Results count */}
        {!loading && filteredScenarios.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredScenarios.length} of {scenarios.length} scenarios
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Scenario Version
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-foreground">
                    {scenarioToDelete?.title}
                  </span>
                  {scenarioToDelete?.version && (
                    <span className="text-muted-foreground"> (Version {scenarioToDelete.version})</span>
                  )}
                  ?
                </p>
                {scenarioToDelete?.status === 'DRAFT' ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ℹ️ Only this draft version will be deleted. Other versions will remain intact.
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    ⚠️ This action cannot be undone. All data for this version will be permanently deleted.
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Scenario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
