import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../../api/adminApi";
import { creatorApi } from "../../api/creatorApi";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Server, 
  HelpCircle,
  Clock,
  Tag,
  Image as ImageIcon,
  Package,
  Code,
  FileCode,
  Search,
  User,
  Calendar,
  Circle,
  ArrowRight,
  Trash2,
  Download
} from "lucide-react";

interface PendingVersion {
  id: string;
  scenarioId: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  category: string;
  tags: string[];
  versionNumber: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  buildStatus?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  submittedAt?: string;
  rejectReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdByUserEmail?: string;
  creatorName?: string;
  coverImageUrl?: string;
  estimatedMinutes?: number;
  missionText?: string;
  solutionWriteup?: string;
  machines?: any[];
  questions?: any[];
  assets?: any[];
  dockerComposeUrl?: string;
  requiresMachines?: boolean;
  hints?: any[];
}

export default function ApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("view");
  
  const [versions, setVersions] = useState<PendingVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PendingVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listPendingScenarios();
      setVersions(data || []);
    } catch (error) {
      toast.error("Failed to load pending scenarios");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (scenarioId: string, versionId: string) => {
    setDetailLoading(true);
    try {
      const data = await creatorApi.getScenarioVersion(scenarioId, versionId);
      setSelectedVersion(data);
    } catch (error) {
      toast.error("Failed to load scenario details");
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedId && versions.length > 0) {
      const found = versions.find(v => v.id === selectedId);
      if (found) {
        loadDetail(found.scenarioId, found.id);
        setSearchParams({ view: selectedId });
      }
    } else if (!selectedId) {
      setSelectedVersion(null);
    }
  }, [selectedId, versions]);

  const handleViewScenario = (v: PendingVersion) => {
    setSearchParams({ view: v.id });
  };

  const handleBackToList = () => {
    setSearchParams({});
    setSelectedVersion(null);
    setActiveTab("info");
  };

  const approve = async (id: string) => {
    if (!window.confirm("Approve this scenario version? It will become available to solvers.")) return;
    try {
      await adminApi.approveScenario(id);
      toast.success("Scenario approved successfully!");
      handleBackToList();
      await load();
    } catch {
      toast.error("Approval failed");
    }
  };

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingVersionId, setApprovingVersionId] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishingVersionId, setPublishingVersionId] = useState<string | null>(null);

  const openApproveDialog = (id: string) => {
    setApprovingVersionId(id);
    setApproveDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!approvingVersionId) return;
    
    const version = versions.find(v => v.id === approvingVersionId) || selectedVersion;
    const requiresMachines = version?.machines && version.machines.length > 0;
    
    try {
      await adminApi.approveScenario(approvingVersionId);
      
      if (requiresMachines) {
        toast.success("Scenario approved! Build process started. Check Deployments page for build status.");
      } else {
        toast.success("Scenario approved and published! Available to solvers now.");
      }
      
      setApproveDialogOpen(false);
      setApprovingVersionId(null);
      handleBackToList();
      await load();
    } catch {
      toast.error("Approval failed");
    }
  };

  const confirmPublish = async () => {
    if (!publishingVersionId) return;
    
    try {
      await adminApi.publishScenario(publishingVersionId);
      toast.success("Scenario published! Now available to all users.");
      setPublishDialogOpen(false);
      setPublishingVersionId(null);
      handleBackToList();
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Publish failed");
    }
  };

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingVersionId, setRejectingVersionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const openRejectDialog = (id: string) => {
    setRejectingVersionId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectingVersionId || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    
    try {
      await adminApi.rejectScenario(rejectingVersionId, rejectReason);
      toast.success("Scenario rejected and returned to draft");
      setRejectDialogOpen(false);
      setRejectingVersionId(null);
      setRejectReason("");
      handleBackToList();
      await load();
    } catch {
      toast.error("Rejection failed");
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [unapproveDialogOpen, setUnapproveDialogOpen] = useState(false);
  const [unapprovingVersionId, setUnapprovingVersionId] = useState<string | null>(null);

  const openUnapproveDialog = (id: string) => {
    setUnapprovingVersionId(id);
    setUnapproveDialogOpen(true);
  };

  const confirmUnapprove = async () => {
    if (!unapprovingVersionId) return;
    
    try {
      await adminApi.unapproveScenario(unapprovingVersionId);
      toast.success("Scenario reverted to DRAFT. Creator can now edit and resubmit. AWS resources cleaned up.");
      setUnapproveDialogOpen(false);
      setUnapprovingVersionId(null);
      handleBackToList();
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Revert to draft failed");
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingVersionId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingVersionId) return;
    
    try {
      const response = await adminApi.deleteScenarioVersion(deletingVersionId);
      
      if (response.deletedScenario) {
        toast.success("Entire scenario deleted (was the only version)");
      } else {
        toast.success("Version deleted successfully");
      }
      
      setDeleteDialogOpen(false);
      setDeletingVersionId(null);
      handleBackToList();
      await load();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || "Delete failed";
      toast.error(errorMsg);
    }
  };

  // Get unique categories from versions
  const categories = Array.from(new Set(versions.map((v) => v.category)));

  // Filter versions
  const filteredVersions = versions.filter((version) => {
    const matchesSearch =
      version.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      version.shortDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      version.tags?.some((tag) => tag?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      version.createdByUserEmail?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDifficulty =
      difficultyFilter === "all" || version.difficulty === difficultyFilter;

    const matchesCategory =
      categoryFilter === "all" || version.category === categoryFilter;

    return matchesSearch && matchesDifficulty && matchesCategory;
  });

  // List View
  if (!selectedVersion) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Scenario Approvals & Publishing</h1>
          <p className="text-muted-foreground">
            Review {versions.filter(v => v.status === 'SUBMITTED').length} submission{versions.filter(v => v.status === 'SUBMITTED').length !== 1 ? 's' : ''} • 
            Publish {versions.filter(v => v.status === 'APPROVED').length} approved scenario{versions.filter(v => v.status === 'APPROVED').length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scenarios, tags, or authors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Difficulty Filter */}
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="all" value="all">All Difficulties</SelectItem>
              <SelectItem key="Easy" value="Easy">Easy</SelectItem>
              <SelectItem key="Intermediate" value="Intermediate">Intermediate</SelectItem>
              <SelectItem key="Hard" value="Hard">Hard</SelectItem>
              <SelectItem key="Impossible" value="Impossible">Impossible</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="all" value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredVersions.length} of {versions.length} scenarios
          </p>
        </div>

        {/* Scenarios Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {versions.length === 0 
                ? "No pending scenarios to review."
                : "No scenarios found matching your filters."}
            </p>
            {versions.length > 0 && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => {
                  setSearchTerm("");
                  setDifficultyFilter("all");
                  setCategoryFilter("all");
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVersions.map((version) => (
              <Card 
                key={version.id} 
                className="cyber-border overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => handleViewScenario(version)}
              >
                {/* Cover Image */}
                <div className="relative h-48 bg-gradient-to-br from-cyber-primary/20 to-cyber-secondary/20 overflow-hidden">
                  {version.coverImageUrl ? (
                    <img
                      src={getAssetUrl(version.coverImageUrl)}
                      alt={version.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Difficulty Badge */}
                  <div className="absolute top-3 right-3">
                    <Badge 
                      variant={
                        version.difficulty === "Easy" ? "default" :
                        version.difficulty === "Intermediate" ? "secondary" :
                        version.difficulty === "Hard" ? "destructive" :
                        "outline"
                      }
                      className="bg-background/90 backdrop-blur-sm"
                    >
                      {version.difficulty}
                    </Badge>
                  </div>
                </div>

                {/* Card Content */}
                <CardContent className="p-4 space-y-3">
                  {/* Title */}
                  <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-cyber-primary transition-colors">
                    {version.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {version.shortDescription || "No description provided"}
                  </p>

                  {/* Meta Information */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="line-clamp-1">{version.creatorName || version.createdByUserEmail || "Unknown"}</span>
                    </div>
                    {version.submittedAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(version.submittedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {version.tags && version.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {version.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {version.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{version.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Category */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {version.category}
                    </Badge>
                    {version.estimatedMinutes && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{version.estimatedMinutes}m</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleBackToList}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedVersion.title}</h2>
            <p className="text-sm text-muted-foreground">Version {selectedVersion.versionNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedVersion.status === 'SUBMITTED' && (
            <>
              <Button 
                onClick={() => openApproveDialog(selectedVersion.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve & Build
              </Button>
              <Button 
                variant="destructive"
                onClick={() => openRejectDialog(selectedVersion.id)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {(selectedVersion.status === 'APPROVED' || selectedVersion.status === 'PUBLISHED') && (
            <>
              {selectedVersion.status === 'APPROVED' && selectedVersion.buildStatus === 'SUCCESS' && (
                <Button 
                  onClick={() => {setPublishingVersionId(selectedVersion.id); setPublishDialogOpen(true);}}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Publish to Users
                </Button>
              )}
              {(selectedVersion.buildStatus === 'PENDING' || selectedVersion.buildStatus === 'RUNNING') && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="animate-pulse">
                    Build {selectedVersion.buildStatus}
                  </Badge>
                  <Button variant="outline" onClick={() => load()}>Refresh Status</Button>
                </div>
              )}
              {selectedVersion.buildStatus === 'FAILED' && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Build Failed</Badge>
                  <Button variant="outline" onClick={() => window.open('/admin/deployments', '_blank')}>View Build Logs</Button>
                  <Button 
                    variant="outline" 
                    onClick={() => openUnapproveDialog(selectedVersion.id)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Revert to Draft
                  </Button>
                </div>
              )}
              {(selectedVersion.buildStatus === 'SUCCESS' || selectedVersion.buildStatus === 'CANCELLED') && (
                <Button 
                  variant="outline" 
                  onClick={() => openUnapproveDialog(selectedVersion.id)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Revert to Draft
                </Button>
              )}
            </>
          )}
          {selectedVersion.status === 'PUBLISHED' && (
            <Button 
              variant="outline" 
              onClick={() => openUnapproveDialog(selectedVersion.id)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Unpublish & Revert to Draft
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="info">Basic Info</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="mission">Mission</TabsTrigger>
          <TabsTrigger value="docker">
            <Server className="h-4 w-4 mr-2" />
            Test Environment
          </TabsTrigger>
          <TabsTrigger value="writeup">
            <FileText className="h-4 w-4 mr-2" />
            Solution Writeup
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="info" className="space-y-6">
          {selectedVersion.coverImageUrl && (
            <Card className="cyber-border">
              <CardContent className="pt-6">
                <img 
                  src={getAssetUrl(selectedVersion.coverImageUrl)} 
                  alt="Cover" 
                  className="w-full h-64 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}

          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Scenario Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Description</label>
                <p className="mt-1">{selectedVersion.shortDescription}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Category</label>
                  <div className="mt-1">
                    <Badge>{selectedVersion.category}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Difficulty</label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedVersion.difficulty}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Est. Time</label>
                  <p className="mt-1">{selectedVersion.estimatedMinutes || 60} minutes</p>
                </div>
              </div>

              {selectedVersion.tags && selectedVersion.tags.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedVersion.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Creator Name */}
              {selectedVersion.creatorName && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Creator</label>
                  <p className="mt-1 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedVersion.creatorName}
                  </p>
                </div>
              )}

              {/* Assets Section with detailed information */}
              {selectedVersion.assets && selectedVersion.assets.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground">Scenario Assets</label>
                    <p className="text-xs text-muted-foreground mt-1">Files uploaded for this challenge</p>
                  </div>

                  {/* Machine-Embedded Assets */}
                  {selectedVersion.assets.filter((a: any) => a.assetLocation === 'machine-embedded').length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-blue-500" />
                        <h4 className="font-semibold text-sm">Machine-Embedded Assets ({selectedVersion.assets.filter((a: any) => a.assetLocation === 'machine-embedded').length})</h4>
                      </div>
                      <div className="space-y-2 ml-6">
                        {selectedVersion.assets
                          .filter((asset: any) => asset.assetLocation === 'machine-embedded')
                          .map((asset: any, idx: number) => {
                            const machine = selectedVersion.machines?.find((m: any) => m.id === asset.machineId);
                            return (
                              <Card key={idx} className="border-l-4 border-l-blue-500">
                                <CardContent className="pt-4 space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      {asset.assetType === 'script' && <Code className="h-4 w-4" />}
                                      {asset.assetType === 'tool' && <Package className="h-4 w-4" />}
                                      {asset.assetType === 'file' && <FileCode className="h-4 w-4" />}
                                      <span className="font-semibold text-sm">{asset.fileName}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <Badge variant="outline" className="text-xs capitalize">{asset.assetType}</Badge>
                                      <Badge variant="secondary" className="text-xs">{asset.permissions || '0644'}</Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>
                                      <span className="font-semibold">Machine:</span>{' '}
                                      <Badge variant="outline" className="text-xs">
                                        {machine?.name || 'Unknown'}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Target Path:</span>{' '}
                                      <code className="bg-muted px-1 rounded">{asset.targetPath || 'N/A'}</code>
                                    </div>
                                  </div>
                                  {asset.description && (
                                    <p className="text-xs text-muted-foreground italic">{asset.description}</p>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-semibold">Lifecycle:</span> Embedded into Docker image → Deployed to ECR → Deleted from MinIO
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Downloadable Assets */}
                  {selectedVersion.assets.filter((a: any) => a.assetLocation === 'downloadable').length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-green-500" />
                        <h4 className="font-semibold text-sm">Downloadable Assets ({selectedVersion.assets.filter((a: any) => a.assetLocation === 'downloadable').length})</h4>
                      </div>
                      <div className="space-y-2 ml-6">
                        {selectedVersion.assets
                          .filter((asset: any) => asset.assetLocation === 'downloadable')
                          .map((asset: any, idx: number) => (
                            <Card key={idx} className="border-l-4 border-l-green-500">
                              <CardContent className="pt-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    {asset.assetType === 'script' && <Code className="h-4 w-4" />}
                                    {asset.assetType === 'tool' && <Package className="h-4 w-4" />}
                                    {asset.assetType === 'file' && <FileCode className="h-4 w-4" />}
                                    <span className="font-semibold text-sm">{asset.fileName}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Badge variant="outline" className="text-xs capitalize">{asset.assetType || 'file'}</Badge>
                                    {asset.fileSize && (
                                      <Badge variant="secondary" className="text-xs">
                                        {(asset.fileSize / 1024).toFixed(1)} KB
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {asset.description && (
                                  <p className="text-xs text-muted-foreground italic">{asset.description}</p>
                                )}
                                {asset.fileUrl && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => {
                                        try {
                                          // Allow relative URLs starting with /api/ (our secure proxy)
                                          if (asset.fileUrl.startsWith('/api/')) {
                                            window.open(asset.fileUrl, '_blank', 'noopener,noreferrer');
                                            return;
                                          }

                                          // For absolute URLs, validate against allowed hosts
                                          const url = new URL(asset.fileUrl);
                                          const allowedHosts = ['localhost', '127.0.0.1', 's3.amazonaws.com', 'minio'];
                                          const isAllowed = allowedHosts.some(host => 
                                            url.hostname === host || url.hostname.endsWith(`.${host}`)
                                          );
                                          if (isAllowed) {
                                            window.open(asset.fileUrl, '_blank', 'noopener,noreferrer');
                                          } else {
                                            toast.error('Invalid download URL');
                                          }
                                        } catch (error) {
                                          toast.error('Invalid file URL');
                                        }
                                      }}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download File
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                      {asset.uploadedAt && `Uploaded ${new Date(asset.uploadedAt).toLocaleDateString()}`}
                                    </span>
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Lifecycle:</span> Stays in MinIO → Solvers download during challenge
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Environment Tab */}
        <TabsContent value="environment" className="space-y-6">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>
                <Server className="inline h-5 w-5 mr-2" />
                Environment Machines
              </CardTitle>
              <CardDescription>
                Machines configured for this scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedVersion.machines || selectedVersion.machines.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No machines configured</p>
              ) : (
                <div className="space-y-3">
                  {selectedVersion.machines.map((machine: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{machine.name}</h4>
                        <Badge>{machine.role}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>Image: {machine.imageRef}</div>
                        <div>Profile: {machine.resourceProfile}</div>
                        <div>Network: {machine.networkGroup}</div>
                        {machine.allowSolverEntry && <Badge variant="outline">Solver Access</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-6">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>
                <HelpCircle className="inline h-5 w-5 mr-2" />
                Challenge Questions
              </CardTitle>
              <CardDescription>
                Questions solvers must answer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedVersion.questions || selectedVersion.questions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No questions configured</p>
              ) : (
                <div className="space-y-4">
                  {selectedVersion.questions.map((q: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{q.type}</Badge>
                            <span className="text-xs text-muted-foreground">Points: {q.points}</span>
                          </div>
                          <h4 className="font-semibold text-base">Q{idx + 1}: {q.text}</h4>
                        </div>
                      </div>
                      
                      {/* Single Choice / Multiple Choice */}
                      {(q.type === 'single' || q.type === 'multiple') && q.options && (
                        <div className="space-y-2 ml-4">
                          {q.options.map((opt: any, oidx: number) => (
                            <div key={oidx} className="flex items-start gap-2">
                              {opt.isCorrect ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              )}
                              <span className={opt.isCorrect ? "text-green-400 font-medium" : "text-muted-foreground"}>
                                {opt.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* True/False */}
                      {q.type === 'trueFalse' && (
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <span className={q.correctAnswer === true ? "text-green-400 font-medium" : "text-muted-foreground"}>
                              {q.correctAnswer === true && "✓ "}True
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className={q.correctAnswer === false ? "text-green-400 font-medium" : "text-muted-foreground"}>
                              {q.correctAnswer === false && "✓ "}False
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Short Answer */}
                      {q.type === 'shortAnswer' && q.acceptedAnswers && (
                        <div className="ml-4 space-y-1">
                          <p className="text-xs text-muted-foreground">Accepted answers:</p>
                          {q.acceptedAnswers.map((ans: string, aidx: number) => (
                            <div key={aidx} className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <code className="text-sm text-green-400">{ans}</code>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Matching */}
                      {q.type === 'matching' && q.matchingPairs && (
                        <div className="ml-4 space-y-2">
                          {q.matchingPairs.map((pair: any, pidx: number) => (
                            <div key={pidx} className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">{pair.left}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-green-400">{pair.right}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Ordering */}
                      {q.type === 'ordering' && q.orderingItems && (
                        <div className="ml-4 space-y-1">
                          <p className="text-xs text-muted-foreground mb-2">Correct order:</p>
                          {q.orderingItems.map((item: any, iidx: number) => (
                            <div key={iidx} className="flex items-center gap-2">
                              <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                                {item.correctOrder || iidx + 1}
                              </Badge>
                              <span className="text-sm">{item.text || item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mission Tab */}
        <TabsContent value="mission" className="space-y-6">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Mission Brief</CardTitle>
              <CardDescription>
                The challenge description shown to solvers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedVersion.missionText ? (
                <div 
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedVersion.missionText }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">No mission text provided</p>
              )}
            </CardContent>
          </Card>

          {/* Scenario Hints */}
          {selectedVersion.hints && selectedVersion.hints.length > 0 && (
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Scenario Hints ({selectedVersion.hints.length})
                </CardTitle>
                <CardDescription>
                  Hints that will be available to solvers during the challenge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedVersion.hints.map((hint: any, index: number) => (
                  <div key={hint.id || index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Hint {index + 1}</Badge>
                        <span className="font-semibold">{hint.title || "Untitled Hint"}</span>
                      </div>
                      {hint.unlockAfter > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Unlocks after {hint.unlockAfter} min
                        </Badge>
                      )}
                    </div>
                    {hint.body && (
                      <div 
                        className="prose prose-sm prose-invert max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: hint.body }}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Docker Compose Test Environment Tab */}
        <TabsContent value="docker" className="space-y-6">
          <Alert className="border-primary/50 bg-primary/5">
            <Server className="h-4 w-4" />
            <AlertDescription>
              <strong>Test Environment:</strong> Preview the Docker Compose configuration that will be used to deploy this scenario. You can download it to test locally before approval.
            </AlertDescription>
          </Alert>

          <Card className="cyber-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Docker Compose Configuration</CardTitle>
                  <CardDescription>
                    Generated from {selectedVersion.machines?.length || 0} machine(s) with {selectedVersion.assets?.filter(a => a.assetLocation === 'machine-embedded').length || 0} embedded asset(s)
                  </CardDescription>
                </div>
                {selectedVersion.dockerComposeUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        // Allow relative URLs starting with /api/ (our secure proxy)
                        if (selectedVersion.dockerComposeUrl!.startsWith('/api/')) {
                          window.open(selectedVersion.dockerComposeUrl, '_blank', 'noopener,noreferrer');
                          return;
                        }

                        // For absolute URLs, validate against allowed hosts
                        const url = new URL(selectedVersion.dockerComposeUrl!);
                        const allowedHosts = ['localhost', '127.0.0.1', 's3.amazonaws.com', 'minio'];
                        const isAllowed = allowedHosts.some(host => 
                          url.hostname === host || url.hostname.endsWith(`.${host}`)
                        );
                        if (isAllowed) {
                          window.open(selectedVersion.dockerComposeUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          toast.error('Invalid download URL');
                        }
                      } catch (error) {
                        toast.error('Invalid file URL');
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download YAML
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedVersion.dockerComposeUrl ? (
                <div className="space-y-4">
                  {/* Docker Compose File URL */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-2">MinIO File URL</p>
                    <code className="text-xs text-green-400 break-all">{selectedVersion.dockerComposeUrl}</code>
                  </div>

                  {/* Machine Summary */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Machines in Environment</h4>
                    <div className="grid gap-3">
                      {selectedVersion.machines?.map((machine: any) => (
                        <div key={machine.id} className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{machine.name}</span>
                            <Badge variant="secondary">{machine.role}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p><strong>Image:</strong> {machine.imageRef}</p>
                            <p><strong>Network:</strong> {machine.networkGroup}</p>
                            <p><strong>Resources:</strong> {machine.resourceProfile}</p>
                            {machine.startupCommands && (
                              <p><strong>Startup:</strong> {machine.startupCommands}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Testing Instructions</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      <li>Download the docker-compose.yml file using the button above</li>
                      <li>Run <code className="text-xs bg-muted px-1 py-0.5 rounded">docker-compose up -d</code> in the same directory</li>
                      <li>Verify all services start successfully</li>
                      <li>Test the scenario objectives and verify embedded assets are present</li>
                      <li>Run <code className="text-xs bg-muted px-1 py-0.5 rounded">docker-compose down</code> when done</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No Docker Compose file generated yet. This scenario may not have been submitted for approval yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Writeup Tab - Admin Only */}
        <TabsContent value="writeup" className="space-y-6">
          <Alert className="border-primary/50 bg-primary/5">
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Admin Only:</strong> This solution writeup is only visible to admins during review. 
              Use this to verify the challenge is solvable and well-designed.
            </AlertDescription>
          </Alert>

          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Solution Writeup</CardTitle>
              <CardDescription>
                Creator's solution and walkthrough
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedVersion.solutionWriteup ? (
                <div 
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedVersion.solutionWriteup }}
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No solution writeup provided</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Consider requesting a writeup from the creator
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons at Bottom */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-semibold">Ready to make a decision?</p>
              <p className="text-muted-foreground">Approve to publish or reject with feedback</p>
            </div>
            <div className="flex gap-2">
              {selectedVersion.status === 'SUBMITTED' && (
                <>
                  <Button 
                    onClick={() => openApproveDialog(selectedVersion.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve & Build
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => openRejectDialog(selectedVersion.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject with Feedback
                  </Button>
                </>
              )}
              {selectedVersion.status === 'APPROVED' && (
                <>
                  {selectedVersion.buildStatus === 'SUCCESS' && (
                    <Button 
                      onClick={() => {setPublishingVersionId(selectedVersion.id); setPublishDialogOpen(true);}}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Publish to Users
                    </Button>
                  )}
                  {(selectedVersion.buildStatus === 'PENDING' || selectedVersion.buildStatus === 'RUNNING') && (
                    <Button variant="outline" onClick={() => load()}>Check Build Status</Button>
                  )}
                  {selectedVersion.buildStatus === 'FAILED' && (
                    <Button variant="outline" onClick={() => window.open('/admin/deployments', '_blank')}>View Build Logs</Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => openUnapproveDialog(selectedVersion.id)}
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Revert to Draft
                  </Button>
                </>
              )}
              <Button 
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => openDeleteDialog(selectedVersion.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Version
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Approve Scenario
            </DialogTitle>
            <DialogDescription className="pt-2">
              You're about to approve and publish this scenario. Users will be able to access it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                <span className="text-lg">✓</span>
                <span>This scenario will be published and visible to all users</span>
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2 mt-2">
                <span className="text-lg">✓</span>
                <span>Users can immediately start new sessions</span>
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2 mt-2">
                <span className="text-lg">✓</span>
                <span>The creator will be notified of approval</span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={confirmApprove}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Reject Scenario
            </DialogTitle>
            <DialogDescription className="pt-2">
              Provide feedback to the creator explaining why this scenario is being rejected.
              The scenario will be returned to draft status.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="E.g., Missing detailed mission description, incomplete machine configurations, or unclear learning objectives..."
              className="min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground mt-2">
              {rejectReason.length} / 500 characters
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim()}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unapprove (Revert to Draft) Confirmation Dialog */}
      <Dialog open={unapproveDialogOpen} onOpenChange={setUnapproveDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-yellow-500">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <ArrowLeft className="h-5 w-5" />
              Revert Scenario to Draft
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will revert the scenario back to DRAFT status for editing by the creator.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong className="block mb-2">The following actions will be performed:</strong>
                <ul className="list-disc list-inside space-y-1">
                  <li>Scenario status will change to DRAFT</li>
                  <li>Creator can edit machines, questions, and configuration</li>
                  <li><strong>AWS resources will be deleted:</strong> ECS task definitions, ECR images</li>
                  <li>Creator must resubmit for approval after making changes</li>
                  <li>If published, scenario will be removed from user catalog</li>
                </ul>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Use this when:<br/>
              • Build failed due to creator's configuration<br/>
              • Scenario needs major changes before deployment<br/>
              • Need to clean up AWS resources for cost savings
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUnapproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmUnapprove}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Revert to Draft
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
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertDescription className="text-sm">
                <ul className="list-disc list-inside space-y-1">
                  <li>This version will be permanently deleted</li>
                  <li>Cover images and files will be removed from storage</li>
                  <li>If this is the only version, the entire scenario will be deleted</li>
                  <li>Cannot delete if there are active user sessions</li>
                </ul>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to proceed with deleting this version?
            </p>
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

      {/* Publish Confirmation Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
              Publish Scenario
            </DialogTitle>
            <DialogDescription className="pt-2">
              This scenario has been successfully built. Publish it to make it available to all users.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                <span className="text-lg">✓</span>
                <span>All Docker images have been built and pushed to ECR</span>
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2 mt-2">
                <span className="text-lg">✓</span>
                <span>ECS task definitions are ready for deployment</span>
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2 mt-2">
                <span className="text-lg">✓</span>
                <span>Users will be able to start this scenario immediately</span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPublishDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={confirmPublish}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Publish Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
