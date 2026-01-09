import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { Loader2, DollarSign, AlertTriangle, TrendingUp, Users, Activity } from 'lucide-react';
import { httpClient } from '../../api/httpClient';

interface CostDashboard {
  monthToDateCost: number;
  budgetHardCap: number;
  budgetPercentage: number;
  runningSessions: number;
  runningCost: number;
  topUsers: Array<{
    userId: string;
    userEmail: string;
    totalCost: number;
    sessionCount: number;
  }>;
  alerts: Array<{
    level: 'warning' | 'critical';
    message: string;
  }>;
}

export default function AdminCostDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<CostDashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser?.roleAdmin) {
      navigate('/');
      return;
    }
    loadDashboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [currentUser, navigate]);

  const loadDashboard = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await httpClient.get('/admin/costs/dashboard');
      setDashboard(res.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load cost dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getAlertVariant = (percentage: number) => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 80) return 'warning';
    return 'default';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Failed to load cost dashboard'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="w-8 h-8" />
            Cost Dashboard
          </h1>
          <p className="text-muted-foreground">Real-time cost monitoring and budget tracking</p>
        </div>
        <Button 
          onClick={() => loadDashboard(true)} 
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Budget Alerts */}
      {dashboard.alerts && dashboard.alerts.length > 0 && (
        <div className="space-y-2">
          {dashboard.alerts.map((alert, idx) => (
            <Alert 
              key={idx} 
              variant={alert.level === 'critical' ? 'destructive' : 'default'}
              className={alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' : ''}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className={alert.level === 'warning' ? 'text-yellow-800' : ''}>
                {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Monthly Budget */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Monthly Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  RM {dashboard.monthToDateCost.toFixed(2)}
                </span>
                <span className="text-muted-foreground">
                  / RM {dashboard.budgetHardCap.toFixed(2)}
                </span>
              </div>
              <Progress 
                value={dashboard.budgetPercentage} 
                className="h-3"
                indicatorClassName={getProgressColor(dashboard.budgetPercentage)}
              />
              <p className="text-sm text-muted-foreground">
                {dashboard.budgetPercentage.toFixed(1)}% of monthly budget used
              </p>
            </div>

            {dashboard.budgetPercentage >= 80 && (
              <Alert variant={dashboard.budgetPercentage >= 90 ? 'destructive' : 'default'}
                className={dashboard.budgetPercentage >= 90 ? '' : 'bg-yellow-50 border-yellow-200'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className={dashboard.budgetPercentage >= 90 ? '' : 'text-yellow-800'}>
                  {dashboard.budgetPercentage >= 90 
                    ? '🚨 CRITICAL: Budget at 90%+ - Approaching hard cap!'
                    : '⚠️ WARNING: Budget at 80%+ - Monitor usage closely'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4 border-t grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  RM {(dashboard.budgetHardCap - dashboard.monthToDateCost).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Remaining Budget</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  RM {dashboard.runningCost.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Running Sessions Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <p className="text-5xl font-bold text-primary">
                {dashboard.runningSessions}
              </p>
              <p className="text-sm text-muted-foreground">
                Currently Running
              </p>
              <div className="pt-4 border-t">
                <p className="text-lg font-semibold">
                  RM {dashboard.runningCost.toFixed(2)}/session
                </p>
                <p className="text-xs text-muted-foreground">
                  Average running cost
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Users by Cost */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Users by Cost (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.topUsers && dashboard.topUsers.length > 0 ? (
            <div className="space-y-3">
              {dashboard.topUsers.map((user, idx) => (
                <div 
                  key={user.userId} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-medium">{user.userEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.sessionCount} session{user.sessionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">RM {user.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      RM {(user.totalCost / user.sessionCount).toFixed(2)}/session
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No session data available for this month
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cost Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Cost Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Session Limits:</strong> Users are limited to 3 sessions/hour and 10/day to prevent cost spikes.
            </p>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              ✅ <strong>Idle Termination:</strong> Sessions idle for 30+ minutes are automatically terminated.
            </p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              📊 <strong>Budget Tracking:</strong> Alerts trigger at 80% (warning) and 90% (critical) of monthly budget.
            </p>
          </div>
          {dashboard.budgetPercentage < 50 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                🎉 <strong>Great Job!</strong> You're at {dashboard.budgetPercentage.toFixed(1)}% of budget - well below the warning threshold.
              </p>
            </div>
          )}
          {dashboard.budgetPercentage >= 80 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Action Needed:</strong> Consider reducing max concurrent sessions or scenario access to control costs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshing every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
}
