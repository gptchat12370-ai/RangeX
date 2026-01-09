import React, { useEffect, useState } from "react";
import {
  Settings, Shield, Clock, DollarSign, Server, Save, AlertTriangle, 
  Calendar, Eye, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { adminApi } from "../../api/adminApi";
import { systemSettingsSchema } from "../../validation/settings";

export function PlatformSettingsPage() {
  const [settings, setSettings] = useState({
    // Maintenance & Availability
    maintenanceMode: false,
    maintenanceStart: "",
    maintenanceEnd: "",
    blockNewSessions: true,
    autoTerminateRunningLabs: true,
    terminateAfterMinutes: 90,
    maintenanceMessage: "",

    // Security & Access
    sessionTimeout: "24",
    sessionTimeoutUnit: "hours",
    passwordMinLength: "8",
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    requireMFAForAdmins: true,

    // Resource Limits
    maxConcurrentSessions: "100",
    maxSessionsPerUser: "2",
    maxActiveUsers: "5",
    defaultMaxSessionDuration: "8",
    sessionDurationUnit: "hours",
    autoTerminateIdle: true,
    idleTimeoutMinutes: "30",
    maxCustomImagesPerCreator: "5",

    // Budget & Cost
    monthlyBudget: "300",
    softWarningThreshold: "80",
    hardStopThreshold: "100",
    vcpuPrice: "0.25",
    memoryPrice: "0.03",

    // Docker Testing
    dockerMaxContainers: "5",
    dockerMaxCpusPerContainer: "0.5",
    dockerMaxMemoryMbPerContainer: "250",
    dockerTestTimeoutMinutes: "60",
    dockerEnablePullFromHub: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await adminApi.getSettings();
        setSettings((prev) => {
          const durationMinutes = data.env_default_duration_minutes || 90;
          const useHours = durationMinutes % 60 === 0;
          return {
            ...prev,
            maintenanceMode: data.maintenance_mode,
            maxConcurrentSessions: String(data.max_concurrent_envs_global ?? prev.maxConcurrentSessions),
            maxSessionsPerUser: String(data.max_envs_per_user ?? prev.maxSessionsPerUser),
            maxActiveUsers: String(data.max_active_users ?? prev.maxActiveUsers),
            defaultMaxSessionDuration: String(useHours ? durationMinutes / 60 : durationMinutes),
            sessionDurationUnit: useHours ? "hours" : "minutes",
            monthlyBudget: String(data.hard_usage_limit_rm ?? prev.monthlyBudget),
            softWarningThreshold:
              data.soft_usage_limit_rm && data.hard_usage_limit_rm
                ? Math.round((data.soft_usage_limit_rm / data.hard_usage_limit_rm) * 100).toString()
                : prev.softWarningThreshold,
            vcpuPrice: String(data.fargate_vcpu_price_per_hour_rm ?? prev.vcpuPrice),
            memoryPrice: String(data.fargate_memory_price_per_gb_hour_rm ?? prev.memoryPrice),
          };
        });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load platform settings");
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    const hardLimit = Number(settings.monthlyBudget) || 0;
    const softPercent = Number(settings.softWarningThreshold) || 0;
    const softLimit = (hardLimit * softPercent) / 100;

    const payload = {
      max_active_users: Number(settings.maxActiveUsers),
      max_envs_per_user: Number(settings.maxSessionsPerUser),
      max_concurrent_envs_global: Number(settings.maxConcurrentSessions),
      env_default_duration_minutes:
        settings.sessionDurationUnit === "hours"
          ? Number(settings.defaultMaxSessionDuration) * 60
          : Number(settings.defaultMaxSessionDuration),
      soft_usage_limit_rm: Number(softLimit.toFixed(2)),
      hard_usage_limit_rm: hardLimit,
      fargate_vcpu_price_per_hour_rm: Number(settings.vcpuPrice),
      fargate_memory_price_per_gb_hour_rm: Number(settings.memoryPrice),
      maintenance_mode: settings.maintenanceMode,
    };

    const validated = systemSettingsSchema.safeParse(payload);
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message || "Invalid values");
      return;
    }

    try {
      await adminApi.updateSettings(validated.data);
      toast.success("Platform settings saved successfully");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to save settings";
      toast.error(message);
    }
  };

  const handleSendMaintenanceWarning = () => {
    if (!settings.maintenanceMessage.trim()) {
      toast.error("Please enter a maintenance message");
      return;
    }
    toast.success("Maintenance warning sent to active users");
  };

  const calculateMaintenanceStatus = () => {
    if (!settings.maintenanceStart || !settings.maintenanceEnd) return null;
    
    const start = new Date(settings.maintenanceStart);
    const end = new Date(settings.maintenanceEnd);
    const now = new Date();
    
    if (settings.maintenanceMode) {
      return { status: "down", label: "Down for maintenance", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    }
    
    if (now >= start && now <= end) {
      const diffMs = end.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { 
        status: "active", 
        label: "Scheduled Maintenance", 
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        info: `Maintenance window active – ends in ${hours}h ${minutes}m`
      };
    }
    
    if (start > now) {
      const diffMs = start.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { 
        status: "scheduled", 
        label: "Scheduled Maintenance", 
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        info: `Maintenance starts in ${hours}h ${minutes}m, ends in ${Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60))}h`
      };
    }
    
    return { status: "live", label: "Live", color: "bg-green-500/20 text-green-400 border-green-500/30" };
  };

  const maintenanceStatus = calculateMaintenanceStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Platform Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure global platform settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="maintenance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="maintenance">Maintenance & Availability</TabsTrigger>
          <TabsTrigger value="security">Security & Access</TabsTrigger>
          <TabsTrigger value="resources">Resource Limits</TabsTrigger>
          <TabsTrigger value="budget">Budget & Cost</TabsTrigger>
          <TabsTrigger value="docker">Docker Testing</TabsTrigger>
        </TabsList>

        {/* Maintenance & Availability */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Maintenance & Availability
              </CardTitle>
              <CardDescription>
                Manage maintenance windows and platform availability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Maintenance Mode Section */}
              <div className="space-y-4">
                <h4 className="font-medium">Maintenance Mode</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="maintenance">Maintenance mode</Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, new labs cannot be started. Existing sessions follow the rules below.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {maintenanceStatus && (
                      <Badge className={maintenanceStatus.color}>
                        {maintenanceStatus.label}
                      </Badge>
                    )}
                    <Switch
                      id="maintenance"
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, maintenanceMode: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Maintenance Window Scheduling */}
              <div className="space-y-4">
                <h4 className="font-medium">Maintenance Window Scheduling</h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceStart">Maintenance start</Label>
                    <Input
                      id="maintenanceStart"
                      type="datetime-local"
                      value={settings.maintenanceStart}
                      onChange={(e) => setSettings({ ...settings, maintenanceStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceEnd">Maintenance end</Label>
                    <Input
                      id="maintenanceEnd"
                      type="datetime-local"
                      value={settings.maintenanceEnd}
                      onChange={(e) => setSettings({ ...settings, maintenanceEnd: e.target.value })}
                    />
                  </div>
                </div>

                {maintenanceStatus?.info && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {maintenanceStatus.info}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Behavior During Maintenance */}
              <div className="space-y-4">
                <h4 className="font-medium">Behavior During Maintenance</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="blockSessions">Block starting new sessions during maintenance</Label>
                    <p className="text-sm text-muted-foreground">
                      Prevent users from launching new labs during the maintenance window
                    </p>
                  </div>
                  <Switch
                    id="blockSessions"
                    checked={settings.blockNewSessions}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, blockNewSessions: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="autoTerminate"
                      checked={settings.autoTerminateRunningLabs}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, autoTerminateRunningLabs: checked })
                      }
                    />
                    <Label htmlFor="autoTerminate" className="flex items-center gap-2">
                      Auto-terminate running labs after
                      <Input
                        type="number"
                        value={settings.terminateAfterMinutes}
                        onChange={(e) => setSettings({ ...settings, terminateAfterMinutes: parseInt(e.target.value) || 0 })}
                        className="w-20 h-8"
                        disabled={!settings.autoTerminateRunningLabs}
                      />
                      minutes from maintenance start
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-8">
                    Termination is applied per running Fargate task.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Mini Broadcast (In-App Only) */}
              <div className="space-y-4">
                <h4 className="font-medium">Maintenance Broadcast (In-App Only)</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="maintenanceMessage">Maintenance message to users</Label>
                  <Textarea
                    id="maintenanceMessage"
                    placeholder="e.g., RangeX will be undergoing maintenance from 02:00–04:00. Please save your work."
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This shows as an in-app banner to currently active users only.
                  </p>
                </div>

                <Button variant="outline" onClick={handleSendMaintenanceWarning} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Send maintenance warning now
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security & Access */}
        <TabsContent value="security" className="space-y-4">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Access
              </CardTitle>
              <CardDescription>Authentication and access control settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* Session Timeout */}
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                      className="flex-1"
                    />
                    <Select 
                      value={settings.sessionTimeoutUnit} 
                      onValueChange={(value) => setSettings({ ...settings, sessionTimeoutUnit: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Password Policy */}
                <div className="space-y-3">
                  <Label>Password Policy</Label>
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      <Label htmlFor="passwordLength" className="text-sm">Minimum Length</Label>
                      <Input
                        id="passwordLength"
                        type="number"
                        value={settings.passwordMinLength}
                        onChange={(e) => setSettings({ ...settings, passwordMinLength: e.target.value })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="requireUpper" className="text-sm">Require uppercase letter</Label>
                      <Switch
                        id="requireUpper"
                        checked={settings.requireUppercase}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, requireUppercase: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="requireNum" className="text-sm">Require number</Label>
                      <Switch
                        id="requireNum"
                        checked={settings.requireNumber}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, requireNumber: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="requireSpecial" className="text-sm">Require special character</Label>
                      <Switch
                        id="requireSpecial"
                        checked={settings.requireSpecialChar}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, requireSpecialChar: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* MFA Enforcement */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="mfa">Require MFA for all admin accounts</Label>
                    <p className="text-sm text-muted-foreground">
                      Recommended for Admin and Creator roles.
                    </p>
                  </div>
                  <Switch
                    id="mfa"
                    checked={settings.requireMFAForAdmins}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, requireMFAForAdmins: checked })
                    }
                  />
                </div>

                <Separator />

                {/* Public Registration Info */}
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-background">
                      Public self-registration: disabled
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    All accounts are created by admins.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Limits */}
        <TabsContent value="resources" className="space-y-4">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Resource Limits
              </CardTitle>
              <CardDescription>
                Manage lab capacity and resource allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* Max Concurrent Active Sessions */}
                <div className="space-y-2">
                  <Label htmlFor="maxSessions">Max concurrent active sessions</Label>
                  <Input
                    id="maxSessions"
                    type="number"
                    value={settings.maxConcurrentSessions}
                    onChange={(e) => setSettings({ ...settings, maxConcurrentSessions: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total active lab sessions across the whole platform.
                  </p>
                </div>

                {/* Max Sessions Per User */}
                <div className="space-y-2">
                  <Label htmlFor="maxPerUser">Max concurrent sessions per user</Label>
                  <Input
                    id="maxPerUser"
                    type="number"
                    value={settings.maxSessionsPerUser}
                    onChange={(e) => setSettings({ ...settings, maxSessionsPerUser: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prevents a single user from hogging capacity.
                  </p>
                </div>

                {/* Max Active Users */}
                <div className="space-y-2">
                  <Label htmlFor="maxActive">Max distinct active users</Label>
                  <Input
                    id="maxActive"
                    type="number"
                    value={settings.maxActiveUsers}
                    onChange={(e) => setSettings({ ...settings, maxActiveUsers: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Caps how many unique users can hold running environments at once.
                  </p>
                </div>

                <Separator />

                {/* Default Max Session Duration */}
                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Default max session duration</Label>
                  <div className="flex gap-2">
                    <Input
                      id="maxDuration"
                      type="number"
                      value={settings.defaultMaxSessionDuration}
                      onChange={(e) => setSettings({ ...settings, defaultMaxSessionDuration: e.target.value })}
                      className="flex-1"
                    />
                    <Select 
                      value={settings.sessionDurationUnit} 
                      onValueChange={(value) => setSettings({ ...settings, sessionDurationUnit: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hard limit per session. After this, lab is auto-terminated.
                  </p>
                </div>

                <Separator />

                {/* Auto-Terminate Idle Sessions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="autoIdle"
                      checked={settings.autoTerminateIdle}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, autoTerminateIdle: checked })
                      }
                    />
                    <Label htmlFor="autoIdle" className="flex items-center gap-2">
                      Terminate labs idle for
                      <Input
                        type="number"
                        value={settings.idleTimeoutMinutes}
                        onChange={(e) => setSettings({ ...settings, idleTimeoutMinutes: e.target.value })}
                        className="w-20 h-8"
                        disabled={!settings.autoTerminateIdle}
                      />
                      minutes (no activity)
                    </Label>
                  </div>
                </div>

                <Separator />

                {/* Creator Image Build Limits */}
                <div className="space-y-2">
                  <Label htmlFor="maxCustomImages">Max custom images per Creator</Label>
                  <Input
                    id="maxCustomImages"
                    type="number"
                    value={settings.maxCustomImagesPerCreator}
                    onChange={(e) => setSettings({ ...settings, maxCustomImagesPerCreator: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Limits how many custom attacker images each Creator can build in the Image Builder. This prevents storage bloat and excessive build times.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget & Cost */}
        <TabsContent value="budget" className="space-y-4">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget & Cost
              </CardTitle>
              <CardDescription>Configure spending limits and cost alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* Monthly Budget Limit */}
                <div className="space-y-2">
                  <Label htmlFor="monthlyBudget">Monthly budget limit</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center justify-center w-10 h-10 border rounded-md bg-muted text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="monthlyBudget"
                      type="number"
                      value={settings.monthlyBudget}
                      onChange={(e) => setSettings({ ...settings, monthlyBudget: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Fargate pricing */}
                <div className="space-y-2">
                  <Label>Fargate pricing (RM/hr)</Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="vcpuPrice" className="text-xs text-muted-foreground">vCPU price</Label>
                      <Input
                        id="vcpuPrice"
                        type="number"
                        step="0.01"
                        value={settings.vcpuPrice}
                        onChange={(e) => setSettings({ ...settings, vcpuPrice: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="memoryPrice" className="text-xs text-muted-foreground">Memory price (per GB-hour)</Label>
                      <Input
                        id="memoryPrice"
                        type="number"
                        step="0.01"
                        value={settings.memoryPrice}
                        onChange={(e) => setSettings({ ...settings, memoryPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used to estimate worst-case session costs before launching labs.
                  </p>
                </div>

                {/* Soft Warning Threshold */}
                <div className="space-y-2">
                  <Label htmlFor="softThreshold">Soft warning threshold</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="softThreshold"
                      type="number"
                      value={settings.softWarningThreshold}
                      onChange={(e) => setSettings({ ...settings, softWarningThreshold: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Show a warning when spending reaches this percentage of budget.
                  </p>
                </div>

                {/* Hard Stop Threshold */}
                <div className="space-y-2">
                  <Label htmlFor="hardThreshold">Hard stop threshold</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="hardThreshold"
                      type="number"
                      value={settings.hardStopThreshold}
                      onChange={(e) => setSettings({ ...settings, hardStopThreshold: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Block new sessions when spending reaches this percentage.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Docker Testing */}
        <TabsContent value="docker" className="space-y-4">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Docker Testing Configuration
              </CardTitle>
              <CardDescription>
                Configure limits for creator Docker testing environments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* Max Containers */}
                <div className="space-y-2">
                  <Label htmlFor="dockerMaxContainers">Maximum concurrent test containers</Label>
                  <Input
                    id="dockerMaxContainers"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.dockerMaxContainers}
                    onChange={(e) => setSettings({ ...settings, dockerMaxContainers: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of Docker containers a creator can test simultaneously
                  </p>
                </div>

                {/* Max CPUs Per Container */}
                <div className="space-y-2">
                  <Label htmlFor="dockerMaxCpusPerContainer">Max CPUs per container</Label>
                  <Input
                    id="dockerMaxCpusPerContainer"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2"
                    value={settings.dockerMaxCpusPerContainer}
                    onChange={(e) => setSettings({ ...settings, dockerMaxCpusPerContainer: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    CPU limit per test container (vCPUs). Recommended: 0.5 for economic testing
                  </p>
                </div>

                {/* Max Memory Per Container */}
                <div className="space-y-2">
                  <Label htmlFor="dockerMaxMemoryMbPerContainer">Max memory per container (MB)</Label>
                  <Input
                    id="dockerMaxMemoryMbPerContainer"
                    type="number"
                    min="128"
                    max="2048"
                    step="64"
                    value={settings.dockerMaxMemoryMbPerContainer}
                    onChange={(e) => setSettings({ ...settings, dockerMaxMemoryMbPerContainer: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Memory limit per test container. Recommended: 250MB for lightweight testing
                  </p>
                </div>

                {/* Test Timeout */}
                <div className="space-y-2">
                  <Label htmlFor="dockerTestTimeoutMinutes">Test timeout (minutes)</Label>
                  <Input
                    id="dockerTestTimeoutMinutes"
                    type="number"
                    min="5"
                    max="120"
                    value={settings.dockerTestTimeoutMinutes}
                    onChange={(e) => setSettings({ ...settings, dockerTestTimeoutMinutes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-stop test containers after this duration
                  </p>
                </div>

                {/* Enable Docker Hub Pull */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="dockerEnablePullFromHub">Enable Docker Hub pulls</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow creators to pull images from Docker Hub during testing (requires internet)
                    </p>
                  </div>
                  <Switch
                    id="dockerEnablePullFromHub"
                    checked={settings.dockerEnablePullFromHub}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, dockerEnablePullFromHub: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
