import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Search,
  Filter,
  MoreVertical,
  Power,
  RotateCcw,
  Clock,
  Server,
  User,
  AlertCircle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { adminApi } from "../../api/adminApi";

export function SessionsMonitoringPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.listSessions();
        setSessions(data || []);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to load sessions");
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const running = sessions.filter((s) => s.status === "running");
    const totalCost = 0; // cost not yet implemented
    return {
      totalActive: running.length,
      totalToday: sessions.length,
      avgDuration: "n/a",
      totalCost,
    };
  }, [sessions]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Activity className="mr-1 h-3 w-3" />
            Running
          </Badge>
        );
      case "starting":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            Starting
          </Badge>
        );
      case "terminated":
        return <Badge variant="outline">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleTerminate = (sessionId: string) => {
    setSelectedSession(sessionId);
    setTerminateDialogOpen(true);
  };

  const confirmTerminate = async () => {
    if (!selectedSession) return;
    try {
      await adminApi.terminateSession(selectedSession);
      toast.success(`Session ${selectedSession} terminated`);
      setSessions((prev) => prev.map((s) => (s.id === selectedSession ? { ...s, status: "terminated" } : s)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to terminate session");
    }
    setTerminateDialogOpen(false);
    setSelectedSession(null);
  };

  const handleRestart = (_sessionId: string) => {
    toast.error("Restart not implemented; terminate and re-launch instead.");
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      (session.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.scenarioVersionId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.id || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cyber-border border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.totalToday}</div>
            <p className="text-xs text-muted-foreground mt-1">All sessions</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg. Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.avgDuration}</div>
            <p className="text-xs text-muted-foreground mt-1">Session length</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">${stats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Today's usage</p>
          </CardContent>
        </Card>
      </div>

      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>Monitor and manage all environment sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, scenario, or email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="starting">Starting</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg cyber-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Scenario Version</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Machines</TableHead>
                  <TableHead>Resource Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{session.userEmail || session.userId}</div>
                          <div className="text-xs text-muted-foreground">{session.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{session.scenarioVersionId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(session.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="text-center">{session.machines?.length || 0}</TableCell>
                    <TableCell className="text-sm">{session.envProfile}</TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="cyber-border">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {session.status === "running" && (
                            <>
                              <DropdownMenuItem onClick={() => handleRestart(session.id)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restart Environment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTerminate(session.id)}
                                className="text-red-400"
                              >
                                <Power className="mr-2 h-4 w-4" />
                                Terminate Session
                              </DropdownMenuItem>
                            </>
                          )}
                          {session.status !== "running" && (
                            <DropdownMenuItem disabled>View Session</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSessions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sessions found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
        <AlertDialogContent className="cyber-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately terminate the environment and end the user's session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTerminate} className="bg-red-500 hover:bg-red-600">
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
