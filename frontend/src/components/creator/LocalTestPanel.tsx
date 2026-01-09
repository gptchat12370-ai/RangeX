import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface LocalTestPanelProps {
  scenarioId: string;
  dockerCompose: string;
}

export function LocalTestPanel({ scenarioId, dockerCompose }: LocalTestPanelProps) {
  const [dockerConnected, setDockerConnected] = useState(false);
  const [dockerVersion, setDockerVersion] = useState('');
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLogs, setTestLogs] = useState('');

  useEffect(() => {
    checkDockerConnection();
  }, []);

  const checkDockerConnection = async () => {
    try {
      const response = await httpClient.get('/creator/testing/docker/validate');
      setDockerConnected(response.data.connected);
      setDockerVersion(response.data.version || '');

      if (response.data.connected) {
        await loadLocalImages();
      }
    } catch (error) {
      console.error('Failed to check Docker connection:', error);
      setDockerConnected(false);
    }
  };

  const loadLocalImages = async () => {
    try {
      const response = await httpClient.get('/creator/testing/docker/images');
      setLocalImages(response.data.images || []);
    } catch (error) {
      console.error('Failed to load local images:', error);
    }
  };

  const startTest = async () => {
    if (!dockerCompose.trim()) {
      alert('Please write docker-compose.yml first');
      return;
    }

    setIsTestRunning(true);
    setTestResult(null);
    setTestLogs('Starting test containers...\n');

    try {
      const response = await httpClient.post(`/creator/testing/test/${scenarioId}`, {
        dockerCompose,
      });

      setTestResult(response.data);
      if (response.data.success) {
        setTestLogs(prev => prev + '\n✅ Containers started successfully!\n\n' + (response.data.logs || ''));
      } else {
        setTestLogs(prev => prev + '\n❌ Test failed:\n' + (response.data.error || ''));
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      setTestLogs(prev => prev + '\n❌ Error: ' + error.message);
    } finally {
      setIsTestRunning(false);
    }
  };

  const stopTest = async () => {
    try {
      await httpClient.delete(`/creator/testing/test/${scenarioId}`);
      setTestResult(null);
      setTestLogs(prev => prev + '\n\n🛑 Test containers stopped.\n');
      setIsTestRunning(false);
    } catch (error: any) {
      console.error('Failed to stop test:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Docker Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Local Docker Connection</span>
            <Badge variant={dockerConnected ? 'default' : 'destructive'}>
              {dockerConnected ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected {dockerVersion && `(v${dockerVersion})`}
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dockerConnected && (
            <Alert variant="destructive">
              <AlertDescription>
                Docker is not running or not accessible. Please start Docker Desktop and try again.
              </AlertDescription>
            </Alert>
          )}

          {dockerConnected && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Available Local Images ({localImages.length})
                </label>
                <Select value={selectedImage} onValueChange={setSelectedImage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an image to use..." />
                  </SelectTrigger>
                  <SelectContent>
                    {localImages.map((image) => (
                      <SelectItem key={image} value={image}>
                        {image}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={checkDockerConnection} variant="outline" className="w-full">
                Refresh Images
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Scenario Locally</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={startTest}
              disabled={!dockerConnected || isTestRunning || !dockerCompose.trim()}
              className="flex-1"
            >
              {isTestRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Test
                </>
              )}
            </Button>

            {testResult?.success && (
              <Button onClick={stopTest} variant="destructive" className="flex-1">
                <Square className="h-4 w-4 mr-2" />
                Stop Test
              </Button>
            )}
          </div>

          {testResult && (
            <Alert className={testResult.success ? 'border-green-500' : 'border-red-500'}>
              <AlertDescription>
                {testResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      Test successful! Container ID: <code className="bg-muted px-1 rounded">{testResult.containerId}</code>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Test failed: {testResult.error}</span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Logs */}
          {testLogs && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="h-4 w-4" />
                <span className="text-sm font-medium">Container Logs</span>
              </div>
              <pre className="bg-black text-green-400 p-4 rounded text-xs overflow-auto max-h-[300px] font-mono">
                {testLogs}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Ensure Docker Desktop is running on your machine</li>
            <li>Write or paste your docker-compose.yml configuration</li>
            <li>Click "Start Test" to run containers locally</li>
            <li>Check the logs to verify everything works correctly</li>
            <li>Once satisfied, proceed to submit your scenario for review</li>
            <li>Remember to stop test containers when done to free up resources</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
