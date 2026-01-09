import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { DollarSign, AlertTriangle, TrendingUp, Calendar, Shield } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface BudgetStatus {
  currentMonthSpend: number;
  monthlyLimit: number;
  percentageUsed: number;
  gracePeriodActive: boolean;
  gracePeriodEndsAt?: string;
  projectedMonthlySpend: number;
  canStartNewSessions: boolean;
}

export function BudgetMonitor() {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<any[]>([]);
  const [newLimit, setNewLimit] = useState('');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [showIncreaseLimitForm, setShowIncreaseLimitForm] = useState(false);

  useEffect(() => {
    loadBudgetStatus();
    loadCostBreakdown();
    const interval = setInterval(loadBudgetStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadBudgetStatus = async () => {
    try {
      const response = await httpClient.get('/admin/budget/status');
      setBudgetStatus(response.data);
    } catch (error) {
      console.error('Failed to load budget status:', error);
    }
  };

  const loadCostBreakdown = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(1); // First day of current month
      const endDate = new Date();

      const response = await httpClient.get('/admin/budget/breakdown', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      setCostBreakdown(response.data.breakdown || []);
    } catch (error) {
      console.error('Failed to load cost breakdown:', error);
    }
  };

  const increaseBudgetLimit = async () => {
    const amount = parseFloat(newLimit);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!budgetStatus) return;

    if (amount <= budgetStatus.monthlyLimit) {
      alert('New limit must be higher than current limit');
      return;
    }

    setIsUpdatingLimit(true);
    try {
      await httpClient.patch('/admin/budget/increase', {
        newLimit: amount,
      });

      alert(`✅ Budget limit increased to RM ${amount}`);
      setShowIncreaseLimitForm(false);
      setNewLimit('');
      await loadBudgetStatus();
    } catch (error: any) {
      alert(`❌ Failed to increase budget: ${error.message}`);
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  if (!budgetStatus) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Loading budget status...</p>
        </CardContent>
      </Card>
    );
  }

  const getGracePeriodTimeRemaining = () => {
    if (!budgetStatus.gracePeriodActive || !budgetStatus.gracePeriodEndsAt) {
      return null;
    }

    const now = new Date().getTime();
    const endsAt = new Date(budgetStatus.gracePeriodEndsAt).getTime();
    const remaining = Math.max(0, endsAt - now);

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-4">
      {/* Grace Period Alert */}
      {budgetStatus.gracePeriodActive && (
        <Alert variant="destructive" className="animate-pulse">
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="font-semibold">
                ⚠️ BUDGET EXCEEDED - GRACE PERIOD ACTIVE
              </span>
            </div>
            <Badge variant="destructive">
              {getGracePeriodTimeRemaining()} remaining
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Budget Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                RM {budgetStatus.currentMonthSpend.toFixed(2)} / RM {budgetStatus.monthlyLimit.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {budgetStatus.percentageUsed.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={budgetStatus.percentageUsed}
              className={`h-3 ${
                budgetStatus.percentageUsed >= 100
                  ? 'bg-red-500'
                  : budgetStatus.percentageUsed >= 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">This Month</p>
                </div>
                <p className="text-2xl font-bold mt-2">
                  RM {budgetStatus.currentMonthSpend.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Projected</p>
                </div>
                <p className="text-2xl font-bold mt-2">
                  RM {budgetStatus.projectedMonthlySpend.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          {budgetStatus.percentageUsed >= 80 && budgetStatus.percentageUsed < 100 && (
            <Alert className="border-yellow-500">
              <AlertDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>
                  Warning: You've used {budgetStatus.percentageUsed.toFixed(1)}% of your monthly budget.
                  Consider increasing the limit or reducing usage.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {!budgetStatus.canStartNewSessions && !budgetStatus.gracePeriodActive && (
            <Alert variant="destructive">
              <AlertDescription>
                ❌ Budget limit exceeded. New challenge sessions are blocked until next month or budget increase.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown by Scenario */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          {costBreakdown.length > 0 ? (
            <div className="space-y-2">
              {costBreakdown.slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <p className="font-medium">{item.scenarioTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.totalSessions} sessions · {item.totalMinutes} minutes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">RM {item.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {((item.totalCost / budgetStatus.currentMonthSpend) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No cost data available</p>
          )}
        </CardContent>
      </Card>

      {/* Increase Budget Limit */}
      {!showIncreaseLimitForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Budget Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowIncreaseLimitForm(true)} className="w-full">
              Increase Monthly Limit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Increase Monthly Budget Limit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                New Monthly Limit (RM)
              </label>
              <Input
                type="number"
                step="0.01"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder={`Current: RM ${budgetStatus.monthlyLimit.toFixed(2)}`}
              />
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Current limit: RM {budgetStatus.monthlyLimit.toFixed(2)}<br />
                New limit must be higher than the current limit.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                onClick={increaseBudgetLimit}
                disabled={isUpdatingLimit}
                className="flex-1"
              >
                {isUpdatingLimit ? 'Updating...' : 'Confirm Increase'}
              </Button>

              <Button
                onClick={() => {
                  setShowIncreaseLimitForm(false);
                  setNewLimit('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
