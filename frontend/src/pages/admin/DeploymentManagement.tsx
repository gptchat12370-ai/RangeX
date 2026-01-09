import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Cloud,
  CloudOff,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { httpClient } from '@/api/httpClient';

interface Deployment {
  id: number;
  versionId: number;
  scenarioId?: string;
  scenarioName: string;
  scenarioSlug?: string;
  status: 'deploying' | 'active' | 'parked' | 'failed' | 'teardown_in_progress';
  buildStatus?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  buildLogs?: string;
  gatewayEndpoint?: string;
  gatewayTaskArn?: string;
  machineTaskArns?: string[];
  ecrRepoName?: string;
  networkingSetup?: {
    vpcId?: string;
    subnetIds?: string[];
    securityGroupId?: string;
    vpcEndpointIds?: string[];
  };
  connectionStrings?: Record<string, string>;
  deployedAt?: string;
  approvedAt?: string;
  parkedAt?: string;
  errorMessage?: string;
  versionNumber?: number;
  // Enhanced metadata
  cloudFormationStack?: string;
  ecrRepositories?: string[];
  awsRegion?: string;
  awsAccount?: string;
  ecsCluster?: string;
  machines?: Array<{
    id: string;
    name: string;
    role: string;
    imageRef?: string;
    sanitizedName?: string;
    ecrRepo?: string;
  }>;
  machineCount?: number;
  ecrImagesPushed?: boolean;
}

export default function DeploymentManagement() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedDeployment, setExpandedDeployment] = useState<string | null>(null);

  const fetchDeployments = async () => {
    try {
      const response = await httpClient.get('/admin/deployments');
      setDeployments(response.data);
    } catch (error: any) {
      console.error('Failed to fetch deployments:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load deployments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
    // Poll every 10 seconds for status updates
    const interval = setInterval(fetchDeployments, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeploy = async (versionId: number, deploymentId: number) => {
    setActionLoading(deploymentId);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/deploy/${versionId}`);
      setActionMessage({ type: 'success', text: 'Deployment started! Provisioning AWS resources...' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Deploy failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Deployment failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePark = async (deploymentId: number) => {
    if (!confirm('Park this deployment? This will delete all AWS tasks, ECR images, and VPC endpoints (approaching $0 cost). Data remains in local MySQL/MinIO.')) {
      return;
    }
    setActionLoading(deploymentId);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/${deploymentId}/park`);
      setActionMessage({ type: 'success', text: 'Deployment parked successfully. AWS resources deleted.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Park failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Park operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpark = async (deploymentId: number) => {
    if (!confirm('Unpark this deployment? This will recreate AWS tasks from the stored bundle. New endpoint will be assigned.')) {
      return;
    }
    setActionLoading(deploymentId);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/${deploymentId}/unpark`);
      setActionMessage({ type: 'success', text: 'Unpark started! Recreating AWS tasks...' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Unpark failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Unpark operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFullTeardown = async (deploymentId: number) => {
    if (!confirm('FULL TEARDOWN: This will delete ALL AWS resources, ALL bundles, and ALL database records for this deployment. This action CANNOT be undone!')) {
      return;
    }
    setActionLoading(deploymentId);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/${deploymentId}/full-teardown`);
      setActionMessage({ type: 'success', text: 'Full teardown completed. All resources deleted.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Teardown failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Teardown operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryBuild = async (versionId: string) => {
    setActionLoading(versionId as any);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/builds/${versionId}/retry`);
      setActionMessage({ type: 'success', text: 'Build retry initiated. Check status in a few moments.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Retry failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Retry operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBuild = async (versionId: string) => {
    if (!confirm('Cancel this build? This will stop the build process permanently.')) {
      return;
    }
    setActionLoading(versionId as any);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/builds/${versionId}/cancel`);
      setActionMessage({ type: 'success', text: 'Build cancelled successfully.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Cancel failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Cancel operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkFailed = async (versionId: string) => {
    const reason = prompt('Reason for marking as failed (optional):');
    setActionLoading(versionId as any);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/deployments/builds/${versionId}/mark-failed`, { reason: reason || 'Manually marked by admin' });
      setActionMessage({ type: 'success', text: 'Build marked as failed.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Mark failed operation failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Mark failed operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (versionId: string) => {
    if (!confirm('Publish this scenario to make it available to solvers? This will mark it as PUBLISHED.')) {
      return;
    }
    setActionLoading(versionId as any);
    setActionMessage(null);
    try {
      await httpClient.post(`/admin/scenario-approvals/${versionId}/publish`);
      setActionMessage({ type: 'success', text: 'Scenario published successfully! Now available to solvers.' });
      await fetchDeployments();
    } catch (error: any) {
      console.error('Publish failed:', error);
      setActionMessage({ type: 'error', text: error.response?.data?.message || 'Publish operation failed' });
    } finally {
      setActionLoading(null);
    }
  };

  // Removed handleTestOnAWS - testing functionality moved to /admin/testing page
  // This keeps deployment management focused on build/deploy operations only

  const getBuildStatusBadge = (buildStatus?: string) => {
    if (!buildStatus) return null;
    
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary'; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Build Pending' },
      RUNNING: { variant: 'secondary', label: 'Building...' },
      SUCCESS: { variant: 'default', label: 'Build Success' },
      FAILED: { variant: 'destructive', label: 'Build Failed' },
      CANCELLED: { variant: 'secondary', label: 'Build Cancelled' },
    };
    
    const config = variants[buildStatus] || { variant: 'secondary', label: buildStatus };
    return <Badge variant={config.variant} className="ml-2">{config.label}</Badge>;
  };

  const getStatusBadge = (status: Deployment['status']) => {
    const variants: Record<Deployment['status'], { variant: 'default' | 'destructive' | 'secondary'; label: string; icon: any }> = {
      deploying: { variant: 'secondary', label: 'Deploying...', icon: Clock },
      active: { variant: 'default', label: 'Active', icon: CheckCircle },
      parked: { variant: 'secondary', label: 'Parked', icon: Pause },
      failed: { variant: 'destructive', label: 'Failed', icon: XCircle },
      teardown_in_progress: { variant: 'secondary', label: 'Tearing Down...', icon: Clock },
    };
    const config = variants[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading deployments...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AWS Deployment Management</h1>
        <Button onClick={fetchDeployments} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {actionMessage && (
        <Alert className={actionMessage.type === 'success' ? 'border-green-500' : 'border-red-500'}>
          <AlertDescription>
            {actionMessage.type === 'success' ? '✅' : '❌'} {actionMessage.text}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Deployments ({deployments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deployments found. Approve a scenario to enable deployment.
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((deployment) => (
                <Card key={deployment.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CardTitle className="text-xl">{deployment.scenarioName}</CardTitle>
                        {getStatusBadge(deployment.status)}
                        {getBuildStatusBadge(deployment.buildStatus)}
                      </div>
                      <Button
                        variant={expandedDeployment === deployment.versionId.toString() ? "default" : "outline"}
                        size="sm"
                        className={expandedDeployment === deployment.versionId.toString() ? "bg-blue-600 hover:bg-blue-700" : ""}
                        onClick={() => setExpandedDeployment(expandedDeployment === deployment.versionId.toString() ? null : deployment.versionId.toString())}
                      >
                        {expandedDeployment === deployment.versionId.toString() ? '🔽 Hide Details' : '🔼 Show Details'}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Version: {deployment.versionNumber} | ID: {deployment.versionId}</div>
                      {deployment.awsRegion && (
                        <div className="flex gap-4">
                          <span>Region: {deployment.awsRegion}</span>
                          <span>Cluster: {deployment.ecsCluster}</span>
                          <span>Machines: {deployment.machineCount}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                      {/* Testing moved to /admin/testing page for better UX */}
                      
                      {/* Publish Button - when build successful and images pushed */}
                      {deployment.buildStatus === 'SUCCESS' && deployment.ecrImagesPushed && deployment.status !== 'published' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handlePublish(deployment.versionId.toString())}
                          disabled={actionLoading === deployment.versionId}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Publish to Solvers
                        </Button>
                      )}

                      {/* Build Controls */}
                      {(deployment.buildStatus === 'FAILED' || deployment.buildStatus === 'SUCCESS') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryBuild(deployment.versionId.toString())}
                          disabled={actionLoading === deployment.versionId}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          {deployment.buildStatus === 'FAILED' ? 'Retry Build' : 'Rebuild'}
                        </Button>
                      )}
                      
                      {deployment.buildStatus === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancelBuild(deployment.versionId.toString())}
                          disabled={actionLoading === deployment.versionId}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel Build
                        </Button>
                      )}

                      {(deployment.buildStatus === 'PENDING' || deployment.buildStatus === 'RUNNING') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkFailed(deployment.versionId.toString())}
                          disabled={actionLoading === deployment.versionId}
                        >
                          Mark Failed
                        </Button>
                      )}

                      {/* Deployment Controls */}
                      {deployment.status === 'parked' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnpark(deployment.id)}
                          disabled={actionLoading === deployment.id}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Unpark
                        </Button>
                      )}

                      {deployment.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePark(deployment.id)}
                          disabled={actionLoading === deployment.id}
                        >
                          <CloudOff className="h-4 w-4 mr-1" />
                          Park
                        </Button>
                      )}

                      {(deployment.status === 'active' || deployment.status === 'parked') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleFullTeardown(deployment.id)}
                          disabled={actionLoading === deployment.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Full Teardown
                        </Button>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedDeployment === deployment.versionId.toString() && (
                      <div className="space-y-4 mt-4 pt-4 border-t">
                        {/* Machines */}
                        {deployment.machines && deployment.machines.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              Machines ({deployment.machines.length})
                              {deployment.buildStatus === 'SUCCESS' && (
                                <Badge variant="default" className="bg-green-600">Images Ready</Badge>
                              )}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {deployment.machines.map((machine) => (
                                <Card key={machine.id} className="p-3">
                                  <div className="space-y-1 text-sm">
                                    <div className="font-semibold flex items-center justify-between">
                                      <span>{machine.name}</span>
                                      {deployment.ecrImagesPushed && <Badge className="text-xs bg-blue-600">✓ ECR</Badge>}
                                    </div>
                                    <div className="text-muted-foreground">Role: {machine.role}</div>
                                    {machine.ecrRepo && (
                                      <div className="font-mono text-xs bg-black text-green-400 p-1 rounded">
                                        {machine.ecrRepo}
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AWS Resources */}
                        <div>
                          <h4 className="font-semibold mb-2">AWS Resources</h4>
                          <div className="space-y-2 text-sm">
                            {deployment.cloudFormationStack && (
                              <div className="flex justify-between p-2 bg-muted rounded">
                                <span className="text-muted-foreground">CloudFormation Stack:</span>
                                <span className="font-mono">{deployment.cloudFormationStack}</span>
                              </div>
                            )}
                            <div className="flex justify-between p-2 bg-muted rounded">
                              <span className="text-muted-foreground">ECS Cluster:</span>
                              <span className="font-mono">{deployment.ecsCluster || 'rangex-labs'}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted rounded">
                              <span className="text-muted-foreground">VPC Security:</span>
                              <span className="font-mono">Private subnets + VPC endpoints (no NAT)</span>
                            </div>
                            {deployment.ecrRepositories && deployment.ecrRepositories.length > 0 && (
                              <div className="p-2 bg-muted rounded">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-muted-foreground">ECR Repositories ({deployment.ecrRepositories.length}):</span>
                                  {deployment.ecrImagesPushed ? (
                                    <Badge variant="default" className="bg-green-600">✓ Images Pushed</Badge>
                                  ) : (
                                    <Badge variant="secondary">⚠ Not Pushed</Badge>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {deployment.ecrRepositories.map((repo) => (
                                    <div key={repo} className="font-mono text-xs pl-2 bg-black text-green-400 p-1 rounded">
                                      {deployment.awsAccount}.dkr.ecr.{deployment.awsRegion}.amazonaws.com/{repo}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {deployment.gatewayEndpoint && (
                              <div className="flex justify-between p-2 bg-muted rounded">
                                <span className="text-muted-foreground">Gateway Endpoint:</span>
                                <a
                                  href={`http://${deployment.gatewayEndpoint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-500 hover:underline font-mono"
                                >
                                  {deployment.gatewayEndpoint}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Build Logs */}
                        {deployment.buildLogs && (
                          <div>
                            <h4 className="font-semibold mb-2">Build Logs</h4>
                            <pre className="bg-black text-green-400 p-4 rounded text-xs overflow-x-auto max-h-96">
                              {deployment.buildLogs}
                            </pre>
                          </div>
                        )}

                        {/* Connection Strings */}
                        {deployment.connectionStrings && Object.keys(deployment.connectionStrings).length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Connection Strings</h4>
                            <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded">
                              {Object.entries(deployment.connectionStrings).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="font-semibold">{key}:</span>
                                  <span className="text-muted-foreground">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div>
                          <h4 className="font-semibold mb-2">Timeline</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {deployment.approvedAt && (
                              <div>Approved: {new Date(deployment.approvedAt).toLocaleString()}</div>
                            )}
                            {deployment.deployedAt && (
                              <div>Deployed: {new Date(deployment.deployedAt).toLocaleString()}</div>
                            )}
                            {deployment.parkedAt && (
                              <div>Parked: {new Date(deployment.parkedAt).toLocaleString()}</div>
                            )}
                          </div>
                        </div>

                        {deployment.errorMessage && (
                          <Alert className="border-red-500">
                            <AlertDescription>
                              ❌ {deployment.errorMessage}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Deployment Architecture Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* What's Built */}
            <div className="border-2 border-green-600 rounded-lg p-4">
              <h3 className="font-bold text-green-600 mb-3">✅ COMPLETED (Build Phase)</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  ECR Repositories (separate per machine)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Docker Images Built & Pushed
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Machine Metadata (roles, imageRef)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Build Logs & Validation
                </li>
              </ul>
            </div>

            {/* What's Needed */}
            <div className="border-2 border-orange-600 rounded-lg p-4">
              <h3 className="font-bold text-orange-600 mb-3">⚠️ PENDING (Deployment Phase)</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  ECS Task Definitions (container config)
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  ECS Services (keep tasks running)
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  Security Groups (network ACL)
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  VPC Configuration (private subnets)
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  Gateway Proxy (user access point)
                </li>
              </ul>
            </div>
          </div>

          <Alert className="border-blue-500">
            <AlertDescription>
              <strong>Next Step:</strong> Create "Deploy to AWS" button that triggers ECS task creation from ECR images. 
              Each machine becomes a Fargate task in the rangex-labs cluster.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* VPC Endpoints Info */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>LOCAL Control-Plane:</strong> MySQL + MinIO (persistent, always available)
          </p>
          <p>
            <strong>EPHEMERAL AWS Runtime:</strong> ECS Fargate Spot + ECR + VPC Endpoints (created on deploy, deleted on park)
          </p>
          <p>
            <strong>Cost When Active:</strong> Fargate Spot tasks (~$0.01-0.05/hour) + VPC endpoints ($7.20/month each × 6 = $43.20/month)
          </p>
          <p>
            <strong>Cost When Parked:</strong> Approaching $0/month (no NAT Gateway, no running tasks)
          </p>
          <p>
            <strong>VPC Endpoints Created:</strong> ecr.dkr, ecr.api, ecs, ecs-agent, ecs-telemetry, logs (no NAT Gateway required)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
