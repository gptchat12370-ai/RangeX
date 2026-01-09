import React, { useState } from "react";
import { Server, CheckCircle2, XCircle, Loader2, Shield, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";
import { httpClient } from "../../api/httpClient";

interface DockerConnectionSettingsProps {
  formData?: any;
  onChange: (updates: any) => void;
}

export function DockerConnectionSettings({ formData, onChange }: DockerConnectionSettingsProps) {
  const dockerConnection = formData?.dockerConnection;
  
  // Auto-detect platform and set default Docker host
  const getDefaultDockerHost = () => {
    if (dockerConnection?.dockerHost) return dockerConnection.dockerHost;
    
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isWindows = userAgent.includes('win');
    
    if (isWindows) {
      return 'npipe:////./pipe/docker_engine'; // Windows Docker Desktop
    }
    return 'unix:///var/run/docker.sock'; // Linux/Mac
  };

  const [dockerHost, setDockerHost] = useState(getDefaultDockerHost());
  const [useTLS, setUseTLS] = useState(dockerConnection?.useTLS || false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>(
    dockerConnection?.isConnected ? 'success' : 'unknown'
  );
  const [dockerVersion, setDockerVersion] = useState(dockerConnection?.dockerVersion || "");

  const testConnection = async () => {
    if (!dockerHost.trim()) {
      toast.error("Please enter a Docker host URL");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('unknown');

    try {
      // Test connection to creator's Docker daemon
      const response = await httpClient.post("/creator/environment/docker/test-connection", {
        dockerHost: dockerHost.trim(),
        useTLS,
      });

      if (response.data.success) {
        setConnectionStatus('success');
        setDockerVersion(response.data.version || "Unknown");
        
        // Save connection settings to formData
        onChange({
          dockerConnection: {
            dockerHost: dockerHost.trim(),
            useTLS,
            isConnected: true,
            dockerVersion: response.data.version,
          }
        });

        toast.success(`✅ Connected to Docker ${response.data.version}`);
      } else {
        setConnectionStatus('failed');
        toast.error(`❌ ${response.data.error || 'Connection failed'}`);
      }
    } catch (error: any) {
      setConnectionStatus('failed');
      const errorMsg = error.response?.data?.message || error.message || 'Failed to connect to Docker';
      toast.error(`❌ ${errorMsg}`);
      console.error("Docker connection error:", error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">Not Tested</Badge>;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Docker Connection</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Connect to your local Docker to test scenarios before submission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Scenarios are tested on <strong>YOUR Docker daemon</strong>, not on our servers. 
            This allows you to verify everything works before submitting for review. When approved by admins, the scenario 
            will be deployed to AWS Fargate for production use.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="dockerHost" className="flex items-center gap-2">
              Docker Host URL
              <Shield className="w-3 h-3 text-gray-400" />
            </Label>
            <Input
              id="dockerHost"
              placeholder="unix:///var/run/docker.sock or tcp://192.168.1.100:2376"
              value={dockerHost}
              onChange={(e) => setDockerHost(e.target.value)}
              className="font-mono text-sm mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              • Local Docker (Linux/Mac): <code className="bg-gray-200 px-1 rounded">unix:///var/run/docker.sock</code><br />
              • Local Docker (Windows): <code className="bg-gray-200 px-1 rounded">npipe:////./pipe/docker_engine</code><br />
              • Remote: <code className="bg-gray-200 px-1 rounded">tcp://IP:2376</code> (requires TLS)
            </p>
          </div>

          {dockerHost.startsWith('tcp://') && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <Shield className="w-4 h-4 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">TLS Required for Remote Docker</p>
                <p className="text-yellow-700 text-xs">
                  Remote Docker connections require TLS certificates for security. 
                  Place <code>ca.pem</code>, <code>cert.pem</code>, <code>key.pem</code> in your Docker config directory.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button 
              onClick={testConnection} 
              disabled={isTestingConnection || !dockerHost.trim()}
              variant="outline"
              className="w-full"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Server className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>

          {connectionStatus === 'success' && dockerVersion && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Connected to Docker Engine</strong><br />
                Version: <code className="bg-green-100 px-2 py-0.5 rounded">{dockerVersion}</code>
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === 'failed' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Connection Failed</strong><br />
                • Ensure Docker is running on your machine<br />
                • Check firewall settings for remote connections<br />
                • Verify Docker socket/port permissions
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>How it works:</strong> Your docker-compose.yml will be tested on your local/remote Docker daemon. 
            Once verified, the compose file is saved to MinIO with your scenario. When an admin approves your scenario, 
            it will be deployed to AWS Fargate for production use by solvers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
