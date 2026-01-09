import React, { useEffect, useMemo, useState } from "react";
import {
  FileText, Search, Filter, Download, Calendar, User,
  Shield, Settings, Lock, AlertCircle, CheckCircle, XCircle,
  FileEdit, Trash2, Plus, Eye
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { adminApi } from "../../api/adminApi";
import { useStore } from "../../lib/store";

type AuditRow = {
  id: string;
  timestamp: string;
  userId?: string | null;
  actionType: string;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, successfulActions: 0, failedActions: 0, uniqueUsers: 0 });
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs();
      const rows: AuditRow[] = res ?? [];
      setLogs(rows);
      // derive basic stats (success/fail not stored; treat all as success for now)
      const userCount = new Set(rows.map((r) => r.userId || "unknown")).size;
      setStats({
        total: rows.length,
        uniqueUsers: userCount,
        successfulActions: rows.length,
        failedActions: 0,
      });
    } catch (e) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("approve") || action.includes("success"))
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (action.includes("reject") || action.includes("delete") || action.includes("disable"))
      return <XCircle className="h-4 w-4 text-red-400" />;
    if (action.includes("update") || action.includes("edit"))
      return <FileEdit className="h-4 w-4 text-blue-400" />;
    if (action.includes("add") || action.includes("create"))
      return <Plus className="h-4 w-4 text-green-400" />;
    if (action.includes("view") || action.includes("read"))
      return <Eye className="h-4 w-4 text-purple-400" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, string> = {
      scenario: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      user: "bg-green-500/20 text-green-400 border-green-500/30",
      session: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      settings: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      image: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      auth: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    return (
      <Badge className={styles[category] || "bg-gray-500/20 text-gray-400"}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === "success") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="mr-1 h-3 w-3" />
          Success
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleExport = () => {
    toast.success("Audit logs export triggered (not implemented)");
  };

  const derivedLogs = useMemo(() => {
    return logs.map((log) => {
      const action = log.actionType || "unknown";
      const detailsText =
        typeof log.details === "string"
          ? log.details
          : log.details
          ? JSON.stringify(log.details)
          : "";
      // derive category from action prefix
      const category = action.includes("SCENARIO")
        ? "scenario"
        : action.includes("USER")
        ? "user"
        : action.includes("SESSION")
        ? "session"
        : action.includes("SETTINGS")
        ? "settings"
        : "misc";
      return {
        ...log,
        action,
        category,
        resource: log.details?.resource || log.details?.scenarioId || "",
        detailsText,
        status: "success",
      };
    });
  }, [logs]);

  const filteredLogs = derivedLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.detailsText || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    return matchesSearch && matchesAction && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cyber-border border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Audit entries</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.successfulActions}</div>
            <p className="text-xs text-muted-foreground mt-1">Actions completed</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.failedActions}</div>
            <p className="text-xs text-muted-foreground mt-1">Actions failed</p>
          </CardContent>
        </Card>

        <Card className="cyber-border border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Unique Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Active admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>Complete history of administrative actions</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs by user, action, resource..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="scenario">Scenario</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="session">Session</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg cyber-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.userId ? (
                          <User className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-medium">{log.userId || 'System'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.actionType)}
                        <span className="font-mono text-sm">
                          {log.actionType.replace(/_/g, " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {JSON.stringify(log.details)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
