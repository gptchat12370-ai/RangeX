import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Wrench } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface ConfigStatus {
  vpcHealth: 'healthy' | 'warning' | 'critical';
  ecrHealth: 'healthy' | 'warning' | 'critical';
  ecsHealth: 'healthy' | 'warning' | 'critical';
  vpcIssues: string[];
  ecrIssues: string[];
  ecsIssues: string[];
  lastChecked: string;
  canAutoHeal: boolean;
}

export function AwsHealthPanel() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isHealing, setIsHealing] = useState(false);

  useEffect(() => {
    loadConfigStatus();
    const interval = setInterval(loadConfigStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadConfigStatus = async () => {
    try {
      const response = await httpClient.get('/admin/aws-config/status');
      setConfigStatus(response.data);
    } catch (error) {
      console.error('Failed to load AWS config status:', error);
    }
  };

  const runManualCheck = async () => {
    setIsChecking(true);
    try {
      const response = await httpClient.post('/admin/aws-config/check');
      setConfigStatus(response.data);
      alert('✅ AWS configuration check completed');
    } catch (error: any) {
      alert(`❌ Check failed: ${error.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const runAutoHeal = async () => {
    if (!confirm('Are you sure you want to auto-heal AWS configuration issues? This may recreate missing resources.')) {
      return;
    }

    setIsHealing(true);
    try {
      await httpClient.post('/admin/aws-config/auto-heal');
      alert('✅ Auto-heal completed successfully');
      await loadConfigStatus();
    } catch (error: any) {
      alert(`❌ Auto-heal failed: ${error.message}`);
    } finally {
      setIsHealing(false);
    }
  };

  if (!configStatus) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Loading AWS health status...</p>
        </CardContent>
      </Card>
    );
  }

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" /> Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const allHealthy = configStatus.vpcHealth === 'healthy' && 
                     configStatus.ecrHealth === 'healthy' && 
                     configStatus.ecsHealth === 'healthy';

  const hasCritical = configStatus.vpcHealth === 'critical' || 
                      configStatus.ecrHealth === 'critical' || 
                      configStatus.ecsHealth === 'critical';

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>AWS Infrastructure Health</span>
            {allHealthy ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : hasCritical ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allHealthy ? (
            <Alert className="border-green-500">
              <AlertDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>All AWS resources are healthy and properly configured!</span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-2">
                {hasCritical ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span>
                  {hasCritical 
                    ? 'Critical issues detected! Immediate action required.'
                    : 'Configuration warnings detected. Review recommended.'}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Last checked: {new Date(configStatus.lastChecked).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* VPC Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>VPC Configuration</span>
            {getHealthBadge(configStatus.vpcHealth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configStatus.vpcIssues.length > 0 ? (
            <div className="space-y-1">
              {configStatus.vpcIssues.map((issue, idx) => (
                <Alert key={idx} variant={configStatus.vpcHealth === 'critical' ? 'destructive' : 'default'}>
                  <AlertDescription className="text-sm">{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Alert className="border-green-500">
              <AlertDescription className="text-sm flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                VPC configuration is correct
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ECR Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>ECR (Container Registry)</span>
            {getHealthBadge(configStatus.ecrHealth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configStatus.ecrIssues.length > 0 ? (
            <div className="space-y-1">
              {configStatus.ecrIssues.map((issue, idx) => (
                <Alert key={idx} variant={configStatus.ecrHealth === 'critical' ? 'destructive' : 'default'}>
                  <AlertDescription className="text-sm">{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Alert className="border-green-500">
              <AlertDescription className="text-sm flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                ECR repository is properly configured
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ECS Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>ECS Fargate (Container Platform)</span>
            {getHealthBadge(configStatus.ecsHealth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configStatus.ecsIssues.length > 0 ? (
            <div className="space-y-1">
              {configStatus.ecsIssues.map((issue, idx) => (
                <Alert key={idx} variant={configStatus.ecsHealth === 'critical' ? 'destructive' : 'default'}>
                  <AlertDescription className="text-sm">{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Alert className="border-green-500">
              <AlertDescription className="text-sm flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                ECS cluster and task definitions are valid
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Management Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={runManualCheck}
            disabled={isChecking}
            variant="outline"
            className="w-full"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Manual Check
              </>
            )}
          </Button>

          {!allHealthy && configStatus.canAutoHeal && (
            <Button
              onClick={runAutoHeal}
              disabled={isHealing}
              className="w-full"
            >
              {isHealing ? (
                <>
                  <Wrench className="h-4 w-4 mr-2 animate-spin" />
                  Auto-Healing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Auto-Heal Configuration
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>About AWS Configuration Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Automatic validation runs every hour</li>
            <li>Checks VPC subnets, security groups, and routing</li>
            <li>Verifies ECR repository exists and is accessible</li>
            <li>Validates ECS cluster and task definitions</li>
            <li>Detects configuration drift and missing resources</li>
            <li>Auto-heal attempts to fix common issues automatically</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
