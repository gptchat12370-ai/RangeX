import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface OrphanedTask {
  taskArn: string;
  reason: string;
  runningSince: string;
  estimatedCost: number;
  scenarioTitle?: string;
}

interface OrphanedTasksStatistics {
  totalDetected: number;
  totalWastedCost: number;
  tasks: OrphanedTask[];
}

export function OrphanedTasksList() {
  const [statistics, setStatistics] = useState<OrphanedTasksStatistics | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  useEffect(() => {
    loadStatistics();
    const interval = setInterval(loadStatistics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await httpClient.get('/admin/orphaned-tasks/statistics');
      setStatistics(response.data);
      setLastScanTime(new Date().toISOString());
    } catch (error) {
      console.error('Failed to load orphaned tasks statistics:', error);
    }
  };

  const triggerManualScan = async () => {
    setIsScanning(true);
    try {
      await httpClient.post('/admin/orphaned-tasks/scan');
      alert('✅ Manual scan completed. Orphaned tasks terminated.');
      await loadStatistics();
    } catch (error: any) {
      alert(`❌ Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  if (!statistics) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Loading orphaned tasks data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Orphaned Tasks Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-orange-500">
                  {statistics.totalDetected}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Total Detected</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-500">
                  RM {statistics.totalWastedCost.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Wasted Cost</p>
              </CardContent>
            </Card>
          </div>

          {/* Alert if orphaned tasks found */}
          {statistics.totalDetected > 0 && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {statistics.totalDetected} orphaned task(s) detected! They will be terminated automatically.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {statistics.totalDetected === 0 && (
            <Alert className="border-green-500">
              <AlertDescription className="flex items-center gap-2">
                ✅ No orphaned tasks detected. All containers are properly tracked.
              </AlertDescription>
            </Alert>
          )}

          {/* Last Scan Time */}
          {lastScanTime && (
            <p className="text-xs text-muted-foreground text-center">
              Last scanned: {new Date(lastScanTime).toLocaleString()}
            </p>
          )}

          {/* Manual Scan Button */}
          <Button
            onClick={triggerManualScan}
            disabled={isScanning}
            variant="outline"
            className="w-full"
          >
            {isScanning ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Run Manual Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Orphaned Tasks List */}
      {statistics.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected Orphaned Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.tasks.map((task, idx) => (
                <Card key={idx} className="border-orange-500">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">
                            Task: <code className="bg-muted px-1 rounded text-xs">{task.taskArn.split('/').pop()}</code>
                          </p>
                          {task.scenarioTitle && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Scenario: {task.scenarioTitle}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive">{task.reason}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Running since: {new Date(task.runningSince).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-500 font-semibold">
                          <DollarSign className="h-3 w-3" />
                          <span>Wasted: RM {task.estimatedCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>How Orphaned Task Detection Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Automatic scan runs every 10 minutes</li>
            <li>Cross-checks ECS Fargate tasks against active challenge sessions in database</li>
            <li>Detects containers running without valid session (crashed backend, missing DB entry)</li>
            <li>Automatically terminates orphaned tasks to prevent cost waste</li>
            <li>Tracks total wasted cost for budget reporting</li>
            <li>Manual scan can be triggered for immediate cleanup</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
