import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Loader2, Container, XCircle, Clock, DollarSign, User, Activity, AlertTriangle } from 'lucide-react';
import { httpClient } from '../../api/httpClient';

interface RunningContainer {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  idleMinutes: number;
  costAccumulatedRm: number;
  scenarioVersionId: string;
  machines: any[];
}

export default function AdminContainers() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<RunningContainer[]>([]);
  const [error, setError] = useState('');
  const [terminatingIds, setTerminatingIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser?.roleAdmin) {
      navigate('/');
      return;
    }
    loadContainers();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadContainers, 10000);
    return () => clearInterval(interval);
  }, [currentUser, navigate]);

  const loadContainers = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else if (containers.length === 0) setLoading(true);
      
      const res = await httpClient.get('/admin/containers/running');
      setContainers(res.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load containers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const terminateContainer = async (sessionId: string, userEmail: string) => {
    if (!confirm(`Terminate session for ${userEmail}?`)) return;
    
    try {
      setTerminatingIds(prev => new Set(prev).add(sessionId));
      await httpClient.post(`/admin/containers/${sessionId}/terminate`, {
        reason: 'Terminated by admin'
      });
      
      // Remove from list
      setContainers(prev => prev.filter(c => c.id !== sessionId));
      
      // Show success message briefly
      setTimeout(() => {
        setTerminatingIds(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to terminate container');
      setTerminatingIds(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'starting': return 'bg-yellow-500';
      case 'stopping': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getIdleStatus = (idleMinutes: number) => {
    if (idleMinutes > 25) return { color: 'text-red-600', label: 'Critical - Will auto-terminate soon', icon: AlertTriangle };
    if (idleMinutes > 15) return { color: 'text-yellow-600', label: 'Warning - High idle time', icon: Clock };
    return { color: 'text-green-600', label: 'Active', icon: Activity };
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Container className="w-8 h-8" />
            Running Containers
          </h1>
          <p className="text-muted-foreground">Monitor and manage active sessions</p>
        </div>
        <Button 
          onClick={() => loadContainers(true)} 
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Running</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{containers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              RM {containers.reduce((sum, c) => sum + (c.costAccumulatedRm || 0), 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Idle Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {containers.filter(c => c.idleMinutes > 15).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">At Risk (25+ min)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {containers.filter(c => c.idleMinutes > 25).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Container List */}
      {containers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Container className="w-16 h-16 mx-auto text-muted-foreground" />
              <p className="text-xl font-semibold">No Running Containers</p>
              <p className="text-muted-foreground">All sessions are currently stopped</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {containers.map((container) => {
            const idleStatus = getIdleStatus(container.idleMinutes);
            const IdleIcon = idleStatus.icon;
            const isTerminating = terminatingIds.has(container.id);
            
            return (
              <Card key={container.id} className={`transition ${container.idleMinutes > 25 ? 'border-red-300 bg-red-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: User & Status Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className={`${getStatusColor(container.status)} text-white`}>
                          {container.status}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{container.userEmail}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Started</p>
                          <p className="font-medium">
                            {new Date(container.startedAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expires</p>
                          <p className="font-medium">
                            {new Date(container.expiresAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Idle Time</p>
                          <p className={`font-medium flex items-center gap-1 ${idleStatus.color}`}>
                            <IdleIcon className="w-4 h-4" />
                            {formatDuration(container.idleMinutes)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cost</p>
                          <p className="font-medium flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            RM {(container.costAccumulatedRm || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{container.id}</span> • 
                        <span className="ml-2">{container.machines?.length || 0} machine(s)</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => terminateContainer(container.id, container.userEmail)}
                        disabled={isTerminating}
                        variant="destructive"
                        size="sm"
                        className="gap-2 whitespace-nowrap"
                      >
                        {isTerminating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Terminating...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Terminate
                          </>
                        )}
                      </Button>
                      
                      {container.idleMinutes > 25 && (
                        <Badge variant="destructive" className="text-xs justify-center">
                          Auto-terminates soon
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Idle warning */}
                  {container.idleMinutes > 15 && (
                    <Alert 
                      variant={container.idleMinutes > 25 ? 'destructive' : 'default'} 
                      className={`mt-3 ${container.idleMinutes > 25 ? '' : 'bg-yellow-50 border-yellow-200'}`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className={container.idleMinutes > 25 ? '' : 'text-yellow-800'}>
                        {container.idleMinutes > 25 
                          ? `🚨 Critical: Idle for ${container.idleMinutes} minutes - Will auto-terminate at 30 minutes`
                          : `⚠️ Warning: Session has been idle for ${container.idleMinutes} minutes`
                        }
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cost Protection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost Protection Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-blue-600" />
            <p><strong>Idle Termination:</strong> Sessions idle for 30+ minutes are automatically terminated</p>
          </div>
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 mt-0.5 text-green-600" />
            <p><strong>Session Limits:</strong> Users limited to 3 sessions/hour, 10/day, max 3 hours duration</p>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 mt-0.5 text-purple-600" />
            <p><strong>Budget Cap:</strong> Maintenance mode auto-enables when budget cap is reached</p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshing every 10 seconds • Last updated: {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
}
