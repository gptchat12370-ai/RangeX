import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Server, 
  Network, 
  Wifi, 
  Shield,
  Key,
  Loader2,
  PlayCircle,
  RefreshCw,
  ExternalLink,
  Terminal,
  Monitor,
  StopCircle
} from "lucide-react";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";

interface AdminTestResult {
  test: {
    id: string;
    scenarioVersionId: string;
    status: 'pending' | 'running' | 'pass' | 'fail' | 'error';
    mode: string;
    startedAt: string;
    finishedAt?: string;
    duration?: number;
    summary?: string;
    errorMessage?: string;
    gatewayIp?: string;
    testSessionId?: string;
  } | null;
  validations: Array<{
    id: string;
    machineId: string;
    machineName: string;
    checkType: 'task_running' | 'private_ip' | 'entrypoint_reachable' | 'segmentation' | 'credentials';
    checkTarget: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    details?: any;
    checkedAt: string;
  }>;
  session?: {
    id: string;
    status: string;
    gatewayIp?: string;
    scenarioVersion: {
      machines: Array<{
        id: string;
        name: string;
        entrypoints?: Array<{
          protocol: string;
          containerPort: number;
          exposedToSolver: boolean;
          description?: string;
        }>;
      }>;
    };
    environmentMachines: Array<{
      id: string;
      machineId: string;
      privateIp?: string;
      status: string;
    }>;
  } | null;
}

interface AdminTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  scenarioTitle: string;
}

const checkTypeIcons: Record<string, any> = {
  task_running: Server,
  private_ip: Network,
  entrypoint_reachable: Wifi,
  segmentation: Shield,
  credentials: Key,
};

const checkTypeLabels: Record<string, string> = {
  task_running: "Task Running",
  private_ip: "Private IP Assigned",
  entrypoint_reachable: "Entrypoint Reachable",
  segmentation: "Network Segmentation",
  credentials: "Credentials Valid",
};

export function AdminTestDialog({ open, onOpenChange, versionId, scenarioTitle }: AdminTestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<AdminTestResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    if (open) {
      loadLatestTest();
    }
  }, [open, versionId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && testResult?.test && (testResult.test.status === 'pending' || testResult.test.status === 'running')) {
      interval = setInterval(() => {
        loadTestResult(testResult.test!.id);
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, testResult]);

  const loadLatestTest = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getLatestAdminTest(versionId);
      setTestResult(data);
      
      if (data.test && (data.test.status === 'pending' || data.test.status === 'running')) {
        setPolling(true);
      } else {
        setPolling(false);
      }
    } catch (err: any) {
      console.error('Failed to load test:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTestResult = async (testId: string) => {
    try {
      const data = await adminApi.getAdminTestResult(testId);
      setTestResult(data);
      
      if (data.test.status !== 'pending' && data.test.status !== 'running') {
        setPolling(false);
      }
    } catch (err: any) {
      console.error('Failed to load test result:', err);
      setPolling(false);
    }
  };

  const startTest = async () => {
    setLoading(true);
    try {
      const response = await adminApi.startAdminTest(versionId);
      toast.success(response.message || 'Admin test started');
      
      // Start polling for results
      setTimeout(() => {
        loadLatestTest();
        setPolling(true);
      }, 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start test');
    } finally {
      setLoading(false);
    

  const terminateSession = async () => {
    if (!testResult?.test?.id) return;
    
    setTerminating(true);
    try {
      await adminApi.terminateAdminTestSession(testResult.test.id);
      toast.success('Test session terminated');
      await loadLatestTest(); // Refresh to show terminated status
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to terminate session');
    } finally {
      setTerminating(false);
    }
  };

  const getConnectionUrl = (machine: any, entrypoint: any) => {
    if (!testResult?.session?.gatewayIp || !testResult.session.id) return null;
    
    const sanitizedMachineName = machine.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sanitizedEntrypointName = (entrypoint.description || entrypoint.protocol).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const entrypointSlug = `${sanitizedEntrypointName}-${entrypoint.containerPort}`;
    
    return `http://${testResult.session.gatewayIp}:3000/proxy/${testResult.session.id}/${sanitizedMachineName}/${entrypointSlug}`;
  };}
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">✓ Passed</Badge>;
      case 'fail':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">✗ Failed</Badge>;
      case 'error':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">⚠ Error</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case 'pending':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const groupedValidations = testResult?.validations?.reduce((acc, val) => {
    if (!acc[val.machineName]) {
      acc[val.machineName] = [];
    }
    acc[val.machineName].push(val);
    return acc;
  }, {} as Record<string, typeof testResult.validations>) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-600" />
            AWS Cloud Test - {scenarioTitle}
          </DialogTitle>
          <DialogDescription>
            Run comprehensive validation checks on AWS infrastructure before publishing
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {loading && !testResult ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !testResult?.test ? (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">No test results yet</p>
                <p className="text-sm text-muted-foreground">
                  Run an admin cloud test to validate this scenario on AWS before publishing
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Test validates:</p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>All Fargate tasks start successfully</li>
                    <li>Private IPs are assigned correctly</li>
                    <li>Entrypoints are reachable via gateway</li>
                    <li>Network segmentation is working</li>
                    <li>Credentials are valid (if applicable)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                {/* Test Summary */}
                <div className="bg-card border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Test Status</h3>
                    {getStatusBadge(testResult.test.status)}
                  </div>
                  
                  {testResult.test.summary && (
                    <p className="text-sm text-muted-foreground">{testResult.test.summary}</p>
                  )}

                  {testResult.test.errorMessage && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium">Error:</p>
                      <p className="text-sm text-red-700 dark:text-red-300">{testResult.test.errorMessage}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <span className="ml-2 font-medium">
                        {new Date(testResult.test.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {testResult.test.duration !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="ml-2 font-medium">{testResult.test.duration}s</span>
                      </div>
                    )}
                    {testResult.test.gatewayIp && (
                      <div>
                        <span className="text-muted-foreground">Gateway IP:</span>
                        <span className="ml-2 font-mono text-xs">{testResult.test.gatewayIp}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation Results by Machine */}
                {groupedValidations && Object.keys(groupedValidations).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Validation Results</h3>
                    {Object.entries(groupedValidations).map(([machineName, validations]) => (
                      <div key={machineName} className="bg-card border rounded-lg p-4 space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          {machineName}
                        </h4>
                        <div className="space-y-2 pl-6">
                          {validations.map((validation) => {
                            const Icon = checkTypeIcons[validation.checkType];
                            return (
                              <div 
                                key={validation.id} 
                                className="flex items-start justify-between py-2 border-b last:border-0"
                              >
                                <div className="flex items-start gap-2">
                                  {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                                  <div>
                                    <p className="text-sm font-medium">
                                      {checkTypeLabels[validation.checkType] || validation.checkType}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {validation.message}
                                    </p>
                                    {validation.checkTarget && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Target: {validation.checkTarget}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  {validation.status === 'pass' && (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  )}
                                  {validation.status === 'fail' && (
                                    <XCircle className="h-5 w-5 text-red-600" />
                                  )}
                                  {validation.status === 'skip' && (
                                    <AlertCircle className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Interactive Access - Full Solver Experience */}
                {testResult.session && testResult.session.status !== 'terminated' && testResult.session.gatewayIp && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-blue-600" />
                        Test As Solver - Interactive Access
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={terminateSession}
                        disabled={terminating}
                      >
                        {terminating ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Terminating...</>
                        ) : (
                          <><StopCircle className="h-3 w-3 mr-1" />Terminate Session</>
                        )}
                      </Button>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">
                        ✨ <strong>Live Test Environment</strong> - Experience this scenario exactly as solvers will. Session auto-terminates in 30 minutes.
                      </p>
                      
                      {testResult.session.scenarioVersion.machines.map((machine) => {
                        const envMachine = testResult.session!.environmentMachines.find(em => em.machineId === machine.id);
                        const hasEntrypoints = machine.entrypoints && machine.entrypoints.some(e => e.exposedToSolver);

                        return (
                          <div key={machine.id} className="bg-white dark:bg-gray-900 border rounded-lg p-3 mb-2 last:mb-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-gray-600" />
                                <span className="font-medium">{machine.name}</span>
                                {envMachine?.status === 'running' ? (
                                  <span className="text-xs text-green-600">● Running</span>
                                ) : (
                                  <span className="text-xs text-gray-400">● {envMachine?.status || 'Unknown'}</span>
                                )}
                              </div>
                              {envMachine?.privateIp && (
                                <span className="text-xs text-muted-foreground font-mono">{envMachine.privateIp}</span>
                              )}
                            </div>

                            {hasEntrypoints ? (
                              <div className="space-y-1 pl-6">
                                {machine.entrypoints!.filter(e => e.exposedToSolver).map((entrypoint, idx) => {
                                  const url = getConnectionUrl(machine, entrypoint);
                                  const isWebProtocol = entrypoint.protocol === 'http' || entrypoint.protocol === 'https' || entrypoint.protocol === 'vnc';
                                  
                                  return (
                                    <div key={idx} className="flex items-center justify-between py-1">
                                      <div className="flex items-center gap-2 text-sm">
                                        {entrypoint.protocol === 'vnc' && <Monitor className="h-3 w-3 text-purple-600" />}
                                        {(entrypoint.protocol === 'http' || entrypoint.protocol === 'https') && <ExternalLink className="h-3 w-3 text-blue-600" />}
                                        {entrypoint.protocol === 'ssh' && <Terminal className="h-3 w-3 text-green-600" />}
                                        <span className="text-muted-foreground">
                                          {entrypoint.description || entrypoint.protocol.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-400">:{entrypoint.containerPort}</span>
                                      </div>
                                      {url && isWebProtocol && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() => window.open(url, '_blank')}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Open
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground pl-6">No exposed entrypoints</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Publishing Status */}
                {testResult.test.status === 'pass' && (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-100">Ready to Publish</p>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          All validation checks passed. This scenario is ready to be published to AWS.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {testResult.test.status === 'fail' && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900 dark:text-red-100">Publishing Blocked</p>
                        <p className="text-sm text-red-800 dark:text-red-200">
                          Some validation checks failed. Please fix the issues and run the test again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {testResult?.test && (testResult.test.status === 'pending' || testResult.test.status === 'running') ? (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Test Running...
            </Button>
          ) : (
            <Button onClick={startTest} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {testResult?.test ? <RefreshCw className="h-4 w-4 mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                  {testResult?.test ? 'Run Again' : 'Start Test'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
