import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Play,
  Server,
  FileText,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Clock,
  CheckCircle,
  RotateCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";

interface PendingScenario {
  id: string;
  scenarioId: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  category: string;
  tags: string[];
  estimatedMinutes: number;
  scenarioType: string;
  missionText: string;
  solutionWriteup: string;
  versionNumber: number;
  status: string;
  submittedAt: string;
  creator?: string;
  machines: any[];
}

export function ScenarioApprovalsPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingScenario[]>([]);
  const [approved, setApproved] = useState<PendingScenario[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [disableReason, setDisableReason] = useState("");
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showTestDeployment, setShowTestDeployment] = useState(false);
  const [adminTest, setAdminTest] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testSession, setTestSession] = useState<any>(null);
  
  const scenarios = activeTab === "pending" ? pending : approved;
  const selectedScenario = useMemo(
    () => scenarios.find((p) => p.id === selectedId) || null,
    [scenarios, selectedId]
  );

  const loadPending = useCallback(async () => {
    try {
      const data = await adminApi.listPendingScenarios();
      setPending(data);
      if (activeTab === "pending") {
        setSelectedId((prev) => {
          if (prev && data.some((p: any) => p.id === prev)) return prev;
          return data[0]?.id ?? null;
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load pending scenarios");
    }
  }, [activeTab]);

  const loadApproved = useCallback(async () => {
    try {
      const data = await adminApi.listApprovedScenarios();
      setApproved(data);
      if (activeTab === "approved") {
        setSelectedId((prev) => {
          if (prev && data.some((p: any) => p.id === prev)) return prev;
          return data[0]?.id ?? null;
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load approved scenarios");
    }
  }, [activeTab]);

  const loadAdminTest = useCallback(async (versionId: string) => {
    try {
      const result = await adminApi.getLatestAdminTest(versionId);
      setAdminTest(result.test);
      setTestSession(result.session);
    } catch (err: any) {
      console.error('Failed to load admin test:', err);
    }
  }, []);

  const startAdminTest = async () => {
    if (!selectedScenario) return;
    setTestLoading(true);
    try {
      const result = await adminApi.startAdminTest(selectedScenario.id);
      toast.success('Admin test started! Deploying to AWS...');
      setAdminTest({ id: result.testId, status: 'pending' });
      // Poll for test completion
      const pollInterval = setInterval(async () => {
        const testResult = await adminApi.getLatestAdminTest(selectedScenario.id);
        setAdminTest(testResult.test);
        setTestSession(testResult.session);
        if (testResult.test?.status === 'pass' || testResult.test?.status === 'fail' || testResult.test?.status === 'error') {
          clearInterval(pollInterval);
          if (testResult.test.status === 'pass') {
            toast.success('Test passed! Environment is ready.');
          } else {
            toast.error('Test failed. Check validation results.');
          }
        }
      }, 5000);
      // Clear polling after 10 minutes
      setTimeout(() => clearInterval(pollInterval), 600000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start admin test');
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
    loadApproved();
  }, [loadPending, loadApproved]);

  useEffect(() => {
    if (selectedScenario?.id) {
      loadAdminTest(selectedScenario.id);
    }
  }, [selectedScenario?.id, loadAdminTest]);

  const handleApprove = async () => {
    if (!selectedScenario) return;
    try {
      await adminApi.approveScenario(selectedScenario.id, approvalNotes);
      toast.success(`Scenario "${selectedScenario.title}" approved`);
      await loadPending();
      setShowApprove(false);
      setApprovalNotes("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve scenario");
    }
  };

  const handleReject = async () => {
    if (!selectedScenario || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      await adminApi.rejectScenario(selectedScenario.id, rejectionReason);
      toast.success(`Scenario "${selectedScenario.title}" rejected`);
      await loadPending();
      setShowReject(false);
      setRejectionReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject scenario");
    }
  };

  const handleDisable = async () => {
    if (!selectedScenario || !disableReason.trim()) {
      toast.error("Please provide a reason for requesting revisions");
      return;
    }
    try {
      await adminApi.disableScenario(selectedScenario.id, disableReason);
      toast.success(`Revision requested for "${selectedScenario.title}"`);
      if (activeTab === "pending") {
        await loadPending();
      } else {
        await loadApproved();
      }
      setShowDisable(false);
      setDisableReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to request revisions");
    }
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenario) return;
    try {
      await adminApi.deleteScenario(selectedScenario.scenarioId);
      toast.success("Scenario deleted");
      await loadPending();
      setShowDelete(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete scenario");
    }
  };

  const totalMachines = selectedScenario?.machines?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Scenario Approvals</h1>
                <p className="text-sm text-muted-foreground">Review and test creator submissions</p>
              </div>
            </div>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              {pending.length} Pending
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            onClick={() => setActiveTab("pending")}
            className="gap-2"
          >
            <Clock className="h-4 w-4" />
            Pending ({pending.length})
          </Button>
          <Button
            variant={activeTab === "approved" ? "default" : "outline"}
            onClick={() => setActiveTab("approved")}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approved ({approved.length})
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>{activeTab === "pending" ? "Pending" : "Approved"} Scenarios</CardTitle>
                <CardDescription>Click to review details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenarios.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No {activeTab} scenarios.
                  </p>
                )}
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedId === scenario.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedId(scenario.id)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold line-clamp-2">{scenario.title}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          v{scenario.versionNumber || 1}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {scenario.shortDescription}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>by {scenario.creator || "creator"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{scenario.difficulty}</Badge>
                        <Badge variant="secondary">{scenario.category}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!selectedScenario ? (
              <Card className="cyber-border">
                <CardContent className="pt-6 text-center py-16">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a scenario from the list to review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="cyber-border bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-3">
                      {activeTab === "pending" && (
                        <>
                          <Button
                            className="flex-1"
                            onClick={() => setShowTestDeployment(true)}
                            disabled={testLoading}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            {testLoading ? 'Testing...' : (adminTest?.status === 'running' || adminTest?.status === 'pass') ? 'View Test' : 'Test Scenario'}
                          </Button>
                          <Button variant="outline" className="flex-1" onClick={() => setShowApprove(true)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve & Publish
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 border-yellow-600 text-yellow-600 hover:bg-yellow-600/10"
                            onClick={() => setShowDisable(true)}
                          >
                            Request Revisions
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 border-red-600 text-red-600 hover:bg-red-600/10"
                            onClick={() => setShowReject(true)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => setShowDelete(true)}
                          >
                            Delete Scenario
                          </Button>
                        </>
                      )}
                      {activeTab === "approved" && (
                        <Button
                          variant="outline"
                          className="flex-1 border-yellow-600 text-yellow-600 hover:bg-yellow-600/10"
                          onClick={() => setShowDisable(true)}
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Disable & Request Revisions
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {activeTab === "approved" && (
                  <Alert className="bg-blue-500/10 border-blue-500/50">
                    <Server className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-blue-400">
                      After approving, view build status and deployment progress in the{" "}
                      <Button 
                        variant="link" 
                        className="px-1 text-blue-400 h-auto underline" 
                        onClick={() => navigate('/admin/deployment')}
                      >
                        Deployment Management
                      </Button>{" "}
                      page.
                    </AlertDescription>
                  </Alert>
                )}

                {adminTest && (adminTest.status === 'running' || adminTest.status === 'pass') && testSession && (
                  <Alert className="bg-green-500/10 border-green-500/50">
                    <Play className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-400">
                      Test environment is {adminTest.status === 'pass' ? 'ready' : 'deploying'}. Session ID: {testSession.id}
                      {testSession.gatewayIp && (
                        <div className="mt-2">
                          <strong>Gateway IP:</strong> {testSession.gatewayIp}
                        </div>
                      )}
                      {adminTest.status === 'pass' && (
                        <Button 
                          variant="link" 
                          className="px-2 text-green-400 mt-2"
                          onClick={() => navigate(`/admin/test-session/${testSession.id}`)}
                        >
                          Open Test Environment <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {adminTest && adminTest.status === 'pending' && (
                  <Alert className="bg-blue-500/10 border-blue-500/50">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-blue-400">
                      Test deployment in progress... This may take 3-5 minutes.
                    </AlertDescription>
                  </Alert>
                )}

                {adminTest && (adminTest.status === 'fail' || adminTest.status === 'error') && (
                  <Alert className="bg-red-500/10 border-red-500/50">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-400">
                      Test failed: {adminTest.errorMessage || adminTest.summary || 'Unknown error'}
                    </AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="environment">Environment</TabsTrigger>
                    <TabsTrigger value="mission">Mission</TabsTrigger>
                    <TabsTrigger value="solution">Solution</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <Card className="cyber-border">
                      <CardHeader>
                        <CardTitle>Scenario Overview</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Title</Label>
                            <p className="font-semibold">{selectedScenario.title}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Creator</Label>
                            <p className="font-semibold">{selectedScenario.creator || "creator"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Difficulty</Label>
                            <Badge variant="outline">{selectedScenario.difficulty}</Badge>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Category</Label>
                            <Badge variant="secondary">{selectedScenario.category}</Badge>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Type</Label>
                            <p className="capitalize">{selectedScenario.scenarioType}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Est. Time</Label>
                            <p>{selectedScenario.estimatedMinutes} min</p>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <Label className="text-sm text-muted-foreground">Description</Label>
                          <p className="mt-1">{selectedScenario.shortDescription}</p>
                        </div>

                        <div>
                          <Label className="text-sm text-muted-foreground">Tags</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(selectedScenario.tags || []).map((tag: string) => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <Label className="text-xs text-muted-foreground">Machines</Label>
                            <p className="text-xl font-bold">{totalMachines}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <p className="text-xl font-bold capitalize">{selectedScenario.status}</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <Label className="text-xs text-muted-foreground">Submitted</Label>
                            <p className="text-sm">{new Date(selectedScenario.submittedAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="environment">
                    <Card className="cyber-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Server className="h-5 w-5" />
                          Environment Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(selectedScenario.machines || []).map((machine: any) => (
                          <div key={machine.id} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{machine.name}</div>
                              <div className="text-xs text-muted-foreground">Image: {machine.imageRef}</div>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {machine.role}
                            </Badge>
                          </div>
                        ))}
                        {totalMachines === 0 && (
                          <p className="text-sm text-muted-foreground">No machines defined.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="mission">
                    <Card className="cyber-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Mission Brief
                        </CardTitle>
                        <CardDescription>What solvers will see</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <p className="whitespace-pre-wrap">{selectedScenario.missionText}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="solution">
                    <Card className="cyber-border bg-amber-500/5 border-amber-500/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-400">
                          <AlertCircle className="h-5 w-5" />
                          Solution Write-up
                        </CardTitle>
                        <CardDescription>Creator's solution for admin review</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-muted/30 rounded-lg font-mono text-sm whitespace-pre-wrap">
                          {selectedScenario.solutionWriteup}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              Approve & Publish Scenario
            </DialogTitle>
            <DialogDescription className="text-base">
              Review the scenario details below before publishing. This will make it available to all users in the challenges section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedScenario && (
              <div className="space-y-3 p-4 border-2 border-green-500/30 rounded-lg bg-gradient-to-r from-green-500/10 to-transparent">
                <div>
                  <h3 className="font-semibold text-lg text-green-400">{selectedScenario.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedScenario.shortDescription}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Category:</span> <Badge variant="secondary">{selectedScenario.category}</Badge>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Difficulty:</span> <Badge variant="outline">{selectedScenario.difficulty}</Badge>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Machines:</span> <span className="font-semibold">{selectedScenario.machines?.length || 0}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Version:</span> <span className="font-semibold">v{selectedScenario.versionNumber}</span>
                  </div>
                </div>

                {selectedScenario.requiresMachines !== false && (!selectedScenario.machines || selectedScenario.machines.length === 0) && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This scenario requires machines but none are configured.
                      Consider rejecting and asking the creator to add machines.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="approval-notes" className="text-base">Notes to Creator (Optional)</Label>
              <Textarea
                id="approval-notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any feedback or notes for the creator..."
                rows={4}
                className="mt-2"
              />
            </div>

            <Alert className="border-green-500/30 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-sm">
                Upon approval, this scenario will be immediately published and accessible to all users.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApprove(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/30"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Scenario</DialogTitle>
            <DialogDescription>The creator will be notified and can resubmit after making changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">
                Reason for Rejection <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be fixed..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revisions</DialogTitle>
            <DialogDescription>
              Temporarily disable this scenario and notify the creator to make changes. 
              The scenario will be moved back to draft status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="disable-reason">
                Changes Needed <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="disable-reason"
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="Explain what improvements or changes are needed..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisable(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-yellow-600 hover:bg-yellow-700" 
              onClick={handleDisable} 
              disabled={!disableReason.trim()}
            >
              Request Revisions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete scenario?</DialogTitle>
            <DialogDescription>This will remove the scenario and its versions. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteScenario}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Deployment Dialog - Shows scenario as solver would see it */}
      <Dialog open={showTestDeployment} onOpenChange={setShowTestDeployment}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Scenario Deployment</DialogTitle>
            <DialogDescription>
              Deploy this scenario to AWS and test it as a solver would experience it.
            </DialogDescription>
          </DialogHeader>
          
          {selectedScenario && (
            <div className="space-y-6">
              {/* Scenario Preview Card */}
              <div className="border rounded-lg p-4 bg-card">
                <h3 className="text-lg font-semibold mb-4">Scenario Preview</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Title</Label>
                      <p className="font-semibold">{selectedScenario.title}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Difficulty</Label>
                      <Badge variant="outline">{selectedScenario.difficulty}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <Badge variant="secondary">{selectedScenario.category}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Estimated Time</Label>
                      <p>{selectedScenario.estimatedMinutes} minutes</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm">{selectedScenario.shortDescription}</p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Machines</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedScenario.machines?.map((machine: any) => (
                        <Badge key={machine.id} variant="outline" className="gap-2">
                          <Server className="h-3 w-3" />
                          {machine.name}
                        </Badge>
                      )) || <span className="text-sm text-muted-foreground">No machines configured</span>}
                    </div>
                  </div>

                  {selectedScenario.tags && selectedScenario.tags.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedScenario.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Test Status */}
              {adminTest && (
                <div className="border rounded-lg p-4 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Test Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={
                          adminTest.status === 'pass' ? 'default' :
                          adminTest.status === 'pending' || adminTest.status === 'running' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {adminTest.status}
                      </Badge>
                    </div>
                    
                    {adminTest.summary && (
                      <div>
                        <Label className="text-muted-foreground">Summary</Label>
                        <p className="text-sm mt-1">{adminTest.summary}</p>
                      </div>
                    )}

                    {testSession && (
                      <div className="space-y-2 mt-4 p-3 bg-muted/50 rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Session ID:</span>
                          <code className="text-xs bg-background px-2 py-1 rounded">{testSession.id}</code>
                        </div>
                        {testSession.gatewayIp && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Gateway IP:</span>
                            <code className="text-xs bg-background px-2 py-1 rounded">{testSession.gatewayIp}</code>
                          </div>
                        )}
                        {testSession.environmentMachines && testSession.environmentMachines.length > 0 && (
                          <div className="mt-3">
                            <Label className="text-sm">Deployed Machines:</Label>
                            <div className="space-y-1 mt-2">
                              {testSession.environmentMachines.map((em: any) => (
                                <div key={em.id} className="flex items-center gap-2 text-xs">
                                  <Server className="h-3 w-3" />
                                  <span>{em.machineName}</span>
                                  <span className="text-muted-foreground">({em.status})</span>
                                  {em.privateIp && (
                                    <code className="bg-background px-1 rounded">{em.privateIp}</code>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deployment Info */}
              <Alert className="bg-blue-500/10 border-blue-500/50">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-400">
                  <strong>Admin Testing Process:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Deploys scenario to AWS (3-5 minutes)</li>
                    <li>Starts all machines in isolated environment</li>
                    <li>Validates network connectivity and entrypoints</li>
                    <li>Provides SSH access to test functionality</li>
                    <li>Session auto-terminates after 30 minutes</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTestDeployment(false)}>
              Close
            </Button>
            
            {adminTest && (adminTest.status === 'pass' || adminTest.status === 'running') && testSession && (
              <Button
                onClick={() => {
                  setShowTestDeployment(false);
                  navigate(`/admin/test-session/${testSession.id}`);
                }}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Test Environment
              </Button>
            )}
            
            {adminTest && adminTest.status === 'error' && (
              <Button onClick={startAdminTest} disabled={testLoading} variant="destructive" className="gap-2">
                <RotateCw className="h-4 w-4" />
                Retry Test
              </Button>
            )}
            
            {(!adminTest || (adminTest.status !== 'pending' && adminTest.status !== 'running')) && (
              <Button onClick={startAdminTest} disabled={testLoading} className="gap-2">
                <Play className="h-4 w-4" />
                {testLoading ? 'Starting...' : 'Start Test Deployment'}
              </Button>
            )}

            {adminTest && testSession && (adminTest.status === 'running' || adminTest.status === 'pass') && (
              <Button
                onClick={async () => {
                  try {
                    await adminApi.terminateAdminTestSession(adminTest.id);
                    toast.success('Test session terminated');
                    setAdminTest(null);
                    setTestSession(null);
                  } catch (err: any) {
                    toast.error('Failed to terminate session');
                  }
                }}
                variant="destructive"
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Terminate Test
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
