import React, { useEffect, useMemo, useState } from "react";
import { Activity, Users, Shield, Clock, AlertTriangle, CheckCircle2, TrendingUp, Settings, DollarSign, Container, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function AdminDashboard({ onNavigateToTab }: { onNavigateToTab?: (tab: string) => void }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [usage, setUsage] = useState<{ date: string; totalEstimatedCostRm: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, s, u] = await Promise.all([
          adminApi.listPendingScenarios(),
          adminApi.listSessions(),
          adminApi.dailyUsage(),
        ]);
        setPending(p || []);
        setSessions(s || []);
        setUsage(u || []);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to load admin dashboard data");
      }
    };
    load();
  }, []);

  const metrics = useMemo(() => {
    const activeSessions = sessions.filter((s) => s.status === "running").length;
    const pendingCount = pending.length;
    const todayCost = usage.length > 0 ? Number(usage[0]?.totalEstimatedCostRm || 0) : 0;
    const monthCost = usage.reduce((acc, u) => Number(acc) + Number(u?.totalEstimatedCostRm || 0), 0);
    return { activeSessions, pendingCount, todayCost, monthCost };
  }, [sessions, pending, usage]);

  return (
    <div className="grid gap-6">
      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cyber-border hover:bg-accent/50 transition cursor-pointer" onClick={() => navigate('/admin/system-settings')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                System Settings
              </div>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Configure platform limits, session rules, MinIO, AWS, and monitoring</p>
          </CardContent>
        </Card>

        <Card className="cyber-border hover:bg-accent/50 transition cursor-pointer" onClick={() => navigate('/admin/costs')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Cost Dashboard
              </div>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Monitor budget, track monthly spend, view top users, get cost alerts</p>
          </CardContent>
        </Card>

        <Card className="cyber-border hover:bg-accent/50 transition cursor-pointer" onClick={() => navigate('/admin/containers')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Container className="h-5 w-5 text-purple-500" />
                Container Monitor
              </div>
              <ArrowRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View running containers, idle times, costs, manually terminate sessions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.activeSessions}</div>
            <p className="text-xs text-muted-foreground">Currently running environments</p>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting admin review</p>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Est. Cost Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">RM {metrics.todayCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Based on usage_daily</p>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Est. Cost (month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">RM {metrics.monthCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Sum of usage_daily</p>
          </CardContent>
        </Card>
      </div>

      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pending Scenarios
          </CardTitle>
          <CardDescription>Creator submissions awaiting approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending scenarios.</p>}
          {pending.slice(0, 5).map((s) => (
            <div key={s.id} className="p-3 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.difficulty} - {s.category}
                </div>
              </div>
              <Button variant="outline" size="sm">Review</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Running Sessions
          </CardTitle>
          <CardDescription>Active or starting environments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.filter((s) => s.status === "running").length === 0 && (
            <p className="text-sm text-muted-foreground">No running sessions.</p>
          )}
          {sessions
            .filter((s) => s.status === "running")
            .slice(0, 5)
            .map((s) => (
              <div key={s.id} className="p-3 border rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.userEmail || s.userId}</div>
                  <div className="text-xs text-muted-foreground">
                    Session {s.id.slice(0, 8)} - {s.envProfile}
                  </div>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {s.status}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
