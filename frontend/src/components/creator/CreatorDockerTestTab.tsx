import React, { useState, useEffect } from "react";
import { Play, Square, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, FileCode, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { httpClient } from "../../api/httpClient";
import EnvironmentComposeSync from "./EnvironmentComposeSync";

interface CreatorDockerTestTabProps {
  data: any;
  versionId?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: string[];
}

interface TestSession {
  success: boolean;
  testId?: string;
  status?: {
    versionId: string;
    userId: string;
    status: 'preparing' | 'validating' | 'starting' | 'running' | 'stopping' | 'completed' | 'failed';
    progress: number;
    currentStep: string;
    logs: string[];
    containerIds: string[];
    startedAt: string;
    error?: string;
  };
  error?: string;
}

interface ContainerLogs {
  containerId: string;
  logs?: string[];
  error?: string;
}

export function CreatorDockerTestTab({ data, versionId }: CreatorDockerTestTabProps) {
  const [dockerConnected, setDockerConnected] = useState<boolean | null>(null);
  const [dockerVersion, setDockerVersion] = useState<string>("");
  const [dockerCompose, setDockerCompose] = useState<string>("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [testLogs, setTestLogs] = useState<string>("");
  const [containerLogs, setContainerLogs] = useState<ContainerLogs[]>([]);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  // Auto-check Docker connection when Docker settings configured
  useEffect(() => {
    // Automatically check Docker connection if configured
    if (data.dockerConnection?.isConnected) {
      checkDockerConnection();
    }
    // Load docker-compose from scenario data or MinIO
    loadDockerComposeFromScenario();
  }, [data.dockerConnection]);

  // Auto-generate docker-compose if machines exist but compose is empty
  useEffect(() => {
    if (versionId && data.machines && data.machines.length > 0 && !dockerCompose) {
      // Trigger auto-generation
      setTimeout(() => {
        // The EnvironmentComposeSync component will handle this
      }, 500);
    }
  }, [versionId, data.machines]);

  // Auto-validate when docker-compose changes
  useEffect(() => {
    if (dockerCompose && dockerCompose.trim()) {
      // Debounce validation
      const timer = setTimeout(() => {
        validateDockerCompose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [dockerCompose]);

  // Auto-refresh logs when test is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefreshLogs && testSession?.status?.status === 'running') {
      interval = setInterval(() => {
        fetchTestLogs();
      }, 3000); // Refresh every 3 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshLogs, testSession]);

  const loadDockerComposeFromScenario = async () => {
    // If scenario has saved docker-compose in MinIO, load it
    if (data.dockerComposePath && versionId) {
      try {
        const response = await httpClient.get(`/creator/environment/scenario/${versionId}/docker-compose`);
        setDockerCompose(response.data.dockerCompose || "");
        toast.info("Loaded docker-compose from scenario");
      } catch (error) {
        console.error("Failed to load docker-compose from MinIO:", error);
      }
    }
  };

  const checkDockerConnection = async () => {
    if (!data.dockerConnection?.isConnected) {
      toast.warning("⚠️ Please configure Docker connection in Environment tab first");
      setDockerConnected(false);
      return;
    }

    try {
      const response = await httpClient.post("/creator/environment/docker/test-connection", {
        dockerHost: data.dockerConnection.dockerHost,
        useTLS: data.dockerConnection.useTLS,
      });

      setDockerConnected(response.data.success);
      setDockerVersion(response.data.version || "Unknown");
      
      if (response.data.success) {
        toast.success(`✅ Connected to your Docker ${response.data.version}`);
      } else {
        toast.error("❌ Docker connection failed. Check Environment tab settings.");
      }
    } catch (error: any) {
      setDockerConnected(false);
      toast.error("Failed to connect to your Docker daemon");
      console.error("Docker connection error:", error);
    }
  };

  const loadTemplateIfEmpty = async () => {
    // REMOVED: Don't load hardcoded templates
    // Creator should use Auto-Generate from Environment machines or write their own
  };

  const validateDockerCompose = async () => {
    if (!dockerCompose?.trim()) {
      toast.error("Please enter docker-compose.yml content");
      return;
    }

    setIsValidating(true);
    try {
      const response = await httpClient.post("/creator/testing/validate-compose", {
        dockerCompose,
      });
      
      setValidation(response.data.validation);
      
      if (response.data.validation.valid) {
        toast.success("✅ docker-compose.yml is valid!");
      } else {
        toast.error(`❌ Validation failed with ${response.data.validation.errors.length} errors`);
      }
      
      // Show corrected version if available
      if (response.data.correctedYaml) {
        console.log("Corrected YAML:", response.data.correctedYaml);
      }
    } catch (error: any) {
      toast.error("Failed to validate docker-compose.yml");
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  const startTest = async () => {
    if (!validation?.valid) {
      toast.error("Please validate docker-compose.yml first");
      return;
    }

    if (!versionId) {
      toast.error("Please save the scenario first before testing");
      return;
    }

    if (!data.dockerConnection?.isConnected) {
      toast.error("Please configure Docker connection in Environment tab first");
      return;
    }

    setIsTestRunning(true);
    setTestLogs("");
    setContainerLogs([]);
    
    try {
      // Start full-stack test with docker-compose
      const response = await httpClient.post(`/creator/testing/test/${versionId}`, {
        dockerCompose,
      });
      
      setTestSession(response.data);
      
      if (response.data.success) {
        toast.success("✅ Test containers starting...");
        setAutoRefreshLogs(true);
        
        if (response.data.status?.logs) {
          setTestLogs(response.data.status.logs.join('\n'));
        }
      } else {
        toast.error("❌ Test failed: " + response.data.error);
      }
    } catch (error: any) {
      toast.error("Failed to start test on your Docker");
      console.error(error);
    } finally {
      setIsTestRunning(false);
    }
  };

  const saveDockerComposeToMinIO = async () => {
    if (!dockerCompose?.trim()) {
      toast.error("No docker-compose.yml to save");
      return;
    }

    if (!versionId) {
      toast.error("Please save the scenario first");
      return;
    }

    try {
      const response = await httpClient.post(`/creator/environment/scenario/${versionId}/save-compose`, {
        dockerCompose,
      });

      if (response.data.success) {
        toast.success(`✅ Docker-compose saved to MinIO at: ${response.data.minioPath}`);
        // Update scenario data with MinIO path
        if (data.onChange) {
          data.onChange({ dockerComposePath: response.data.minioPath });
        }
      }
    } catch (error: any) {
      toast.error("Failed to save docker-compose to MinIO");
      console.error(error);
    }
  };

  const fetchTestLogs = async () => {
if (!versionId) return;

    try {
      const response = await httpClient.get(`/creator/testing/test/${versionId}/logs`);
      
      if (response.data.logs) {
        setTestLogs(response.data.logs.join('\n'));
      }
      
      if (response.data.containerLogs) {
        setContainerLogs(response.data.containerLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const fetchTestStatus = async () => {
if (!versionId) return;

    try {
      const response = await httpClient.get(`/creator/testing/test/${versionId}/status`);
      
      if (response.data && testSession) {
        setTestSession({
          ...testSession,
          status: response.data,
        });
        
        // Update logs
        if (response.data.logs) {
          setTestLogs(response.data.logs.join('\n'));
        }
        
        // Stop auto-refresh if test completed or failed
        if (response.data.status === 'completed' || response.data.status === 'failed') {
          setAutoRefreshLogs(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const stopTest = async () => {
    if (!versionId) return;

    setAutoRefreshLogs(false); // Stop auto-refresh
    setIsStopping(true);
    
    try {
      await httpClient.delete(`/creator/testing/test/${versionId}/stop`);
      
      // Fetch final status
      await fetchTestStatus();
      
      toast.success("Test containers stopped");
      
      setTimeout(() => {
        setTestSession(null);
        setTestLogs("");
        setContainerLogs([]);
      }, 2000);
    } catch (error: any) {
      toast.error("Failed to stop test containers");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Docker Connection Status */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Docker Environment</CardTitle>
              <CardDescription>
                Test your scenario locally before submission (connection auto-checked)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {dockerConnected === null ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Checking Docker connection...</span>
              </>
            ) : dockerConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Backend Docker Ready</p>
                  <p className="text-xs text-muted-foreground">Version: {dockerVersion}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests run on backend server (isolated environment)
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Backend Docker Unavailable</p>
                  <p className="text-xs text-muted-foreground">Contact system administrator</p>
                </div>
              </>
            )}
          </div>
          
          {/* Info Alert */}
          <Alert className="mt-4 bg-blue-500/10 border-blue-500/20">
            <AlertDescription className="text-sm">
              <strong>How it works:</strong> Your docker-compose.yml is sent to the backend server 
              where tests run in an isolated environment. This ensures consistency and works for all creators 
              regardless of their local setup.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Main Testing Interface - Always show, don't require Docker connection check */}
      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compose">
            <FileCode className="h-4 w-4 mr-2" />
            docker-compose.yml
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />
            Test Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
            {/* Environment-Compose Sync */}
            {versionId && (
              <Card className="cyber-border">
                <CardHeader>
                  <CardTitle className="text-lg">Environment Sync</CardTitle>
                  <CardDescription>
                    Auto-generate docker-compose.yml from your environment machines or validate synchronization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EnvironmentComposeSync
                    scenarioVersionId={versionId}
                    currentDockerCompose={dockerCompose}
                    onComposeGenerated={(generatedCompose) => {
                      setDockerCompose(generatedCompose);
                      toast.success('✅ Docker-compose generated from environment!');
                      // Auto-validate after generation
                      setTimeout(() => validateDockerCompose(), 500);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Validation Results */}
            {validation && (
              <div className="space-y-2">
                {validation.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">Validation Errors:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {validation.errors.map((error, i) => (
                          <li key={i} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">Warnings:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {validation.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-yellow-600">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.autoCorrections.length > 0 && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">Auto-Corrections Applied:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {validation.autoCorrections.map((correction, i) => (
                          <li key={i} className="text-sm">{correction}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.valid && validation.errors.length === 0 && (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-600 dark:text-green-400">
                      ✅ docker-compose.yml is valid and ready for testing!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Compose Editor */}
            <Card className="cyber-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">docker-compose.yml</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveDockerComposeToMinIO}
                      disabled={!dockerCompose?.trim() || !versionId}
                    >
                      Save to MinIO
                    </Button>
                    <Button
                      size="sm"
                      onClick={startTest}
                      disabled={!validation?.valid || isTestRunning || !versionId || !dockerConnected || !dockerCompose?.trim()}
                      title={!dockerConnected ? "Docker not connected" : !validation?.valid ? "Validation required" : !dockerCompose?.trim() ? "No compose file" : ""}
                    >
                      {isTestRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Test on Your Docker
                    </Button>
                    {testSession?.success && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={stopTest}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Test
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={dockerCompose}
                  onChange={(e) => setDockerCompose(e.target.value)}
                  placeholder="version: '3.8'

services:
  attacker:
    image: kalilinux/kali-rolling
    container_name: rangex-attacker
    ..."
                  className="font-mono text-sm min-h-[400px]"
                />
              </CardContent>
            </Card>

            {/* Resource Limits Info */}
            <Card className="cyber-border bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-sm space-y-2">
                  <p className="font-semibold">Platform Limits:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Max 5 containers per scenario</li>
                    <li>Max 2 vCPUs and 2GB RAM per container</li>
                    <li>Max 5 exposed ports per container</li>
                    <li>Allowed ports: 22, 80, 443, 3000, 5900, 8080, 8443, 9090</li>
                    <li>No Docker socket mounting (/var/run/docker.sock)</li>
                    <li>Required labels: rangex.scenario.name, rangex.scenario.creator</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {/* Progress Bar */}
            {testSession?.status && (
              <Card className="cyber-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Test Progress</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={
                          testSession.status.status === 'running' ? 'text-green-500 border-green-500/50' :
                          testSession.status.status === 'failed' ? 'text-red-500 border-red-500/50' :
                          testSession.status.status === 'completed' ? 'text-blue-500 border-blue-500/50' :
                          'text-yellow-500 border-yellow-500/50'
                        }
                      >
                        {testSession.status.status.toUpperCase()}
                      </Badge>
                      {testSession.status.status === 'running' && (
                        <Button size="sm" variant="outline" onClick={fetchTestStatus}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{testSession.status.currentStep}</span>
                      <span className="font-medium">{testSession.status.progress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          testSession.status.status === 'failed' ? 'bg-red-500' :
                          testSession.status.status === 'completed' ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${testSession.status.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {testSession.status.error && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        {testSession.status.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Container Count */}
                  {testSession.status.containerIds.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">
                        {testSession.status.containerIds.length} container(s) running
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* System Logs */}
            <Card className="cyber-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">System Logs</CardTitle>
                  <div className="flex items-center gap-2">
                    {testSession?.status?.status === 'running' && (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={autoRefreshLogs}
                            onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                            className="rounded"
                          />
                          Auto-refresh
                        </label>
                        <Button size="sm" variant="outline" onClick={fetchTestLogs}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Logs
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {testLogs ? (
                  <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-[400px] whitespace-pre-wrap">
                    {testLogs}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start a test to view logs</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Container-Specific Logs */}
            {containerLogs.length > 0 && (
              <div className="space-y-4">
                {containerLogs.map((container, index) => (
                  <Card key={index} className="cyber-border">
                    <CardHeader>
                      <CardTitle className="text-sm font-mono">
                        Container: {container.containerId}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {container.error ? (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>{container.error}</AlertDescription>
                        </Alert>
                      ) : container.logs ? (
                        <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-[200px] whitespace-pre-wrap">
                          {container.logs.join('\n')}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">No logs available</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
