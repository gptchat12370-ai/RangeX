import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Slider } from '../../components/ui/slider';
import { Loader2, Save, Shield, Users, Container, DollarSign, Database, Cloud, Activity, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { httpClient } from '../../api/httpClient';

interface SystemSettings {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  maxConcurrentUsers: number;
  maxTotalUsers: number;
  allowNewRegistrations: boolean;
  maxSessionsPerUser: number;
  maxSessionsPerHour: number;
  maxSessionsPerDay: number;
  idleTimeoutMinutes: number;
  maxSessionDurationMinutes: number;
  maxTotalContainers: number;
  maxAccessibleScenarios: number;
  allowAllScenarios: boolean;
  budgetHardCapUsd: number;
  budgetAlertPercentage: number;
  autoMaintenanceOnBudgetCap: boolean;
  maxStoragePerUserBytes: number;
  maxTotalStorageBytes: number;
  storageDriver: string;
  minioEndpoint: string | null;
  minioPort: number | null;
  minioUseSSL: boolean;
  minioAccessKey: string | null;
  minioSecretKey: string | null;
  minioBucket: string;
  awsRegion: string | null;
  awsEcsClusterName: string | null;
  awsEcsSubnetIds: string | null;
  awsEcsSecurityGroupIds: string | null;
  awsEcrRegistry: string | null;
  useLocalDocker: boolean;
  enablePrometheusMetrics: boolean;
  enableRequestLogging: boolean;
  logRetentionDays: number;
  sendErrorNotifications: boolean;
  adminEmails: string | null;
  slackWebhookUrl: string | null;
  updatedAt: string;
}

// Helper to create slider-friendly input component
const SliderInput = ({ label, value, onChange, min = 0, max, step = 1, unit = '', description, dangerous = false }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2">
        {label}
        {dangerous && <AlertTriangle className="w-3 h-3 text-orange-500" />}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          className="w-20 h-8 text-center"
          min={min}
          max={max}
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
    {description && (
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        {description}
      </p>
    )}
    {max > 0 && (
      <Slider
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    )}
  </div>
);

export default function AdminSystemSettings() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUser?.roleAdmin) {
      navigate('/');
      return;
    }
    loadSettings();
  }, [currentUser, navigate]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get('/admin/system-settings');
      setSettings(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (settings) {
      if (settings.maxSessionsPerUser < 1) errors.maxSessionsPerUser = 'Must be at least 1';
      if (settings.maxSessionsPerUser > 10) errors.maxSessionsPerUser = 'Maximum 10 recommended for performance';
      if (settings.idleTimeoutMinutes < 5) errors.idleTimeoutMinutes = 'Must be at least 5 minutes';
      if (settings.idleTimeoutMinutes > 240) errors.idleTimeoutMinutes = 'Maximum 240 minutes (4 hours) recommended';
      if (settings.maxSessionDurationMinutes < 30) errors.maxSessionDurationMinutes = 'Must be at least 30 minutes';
      if (settings.budgetHardCapUsd > 0 && settings.budgetHardCapUsd < 10) errors.budgetHardCapUsd = 'Minimum $10 recommended';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyPreset = (presetName: 'strict' | 'recommended' | 'relaxed') => {
    if (!settings) return;
    
    const presets = {
      strict: {
        maxSessionsPerUser: 1,
        maxSessionsPerHour: 3,
        maxSessionsPerDay: 10,
        idleTimeoutMinutes: 15,
        maxSessionDurationMinutes: 120,
        maxTotalContainers: 50,
        budgetHardCapUsd: 100,
        budgetAlertPercentage: 70,
        allowAllScenarios: false,
        maxAccessibleScenarios: 1,
      },
      recommended: {
        maxSessionsPerUser: 3,
        maxSessionsPerHour: 5,
        maxSessionsPerDay: 20,
        idleTimeoutMinutes: 30,
        maxSessionDurationMinutes: 180,
        maxTotalContainers: 100,
        budgetHardCapUsd: 500,
        budgetAlertPercentage: 80,
        allowAllScenarios: false,
        maxAccessibleScenarios: 3,
      },
      relaxed: {
        maxSessionsPerUser: 5,
        maxSessionsPerHour: 10,
        maxSessionsPerDay: 50,
        idleTimeoutMinutes: 60,
        maxSessionDurationMinutes: 360,
        maxTotalContainers: 200,
        budgetHardCapUsd: 1000,
        budgetAlertPercentage: 85,
        allowAllScenarios: false,
        maxAccessibleScenarios: 5,
      },
    };
    
    const preset = presets[presetName];
    setSettings({ ...settings, ...preset });
    setSuccess(`✅ Applied "${presetName}" preset configuration!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    if (!validateSettings()) {
      setError('Please fix validation errors before saving');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await httpClient.put('/admin/system-settings', settings);
      setSuccess('✅ Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = async () => {
    if (!settings) return;
    try {
      const newMode = !settings.maintenanceMode;
      await httpClient.post('/admin/system-settings/maintenance', {
        enabled: newMode,
        message: settings.maintenanceMessage,
      });
      setSettings({ ...settings, maintenanceMode: newMode });
      setSuccess(`Maintenance mode ${newMode ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle maintenance mode');
    }
  };

  const updateField = (field: keyof SystemSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load system settings</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Configure platform-wide settings and limits</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={toggleMaintenance}
            variant={settings.maintenanceMode ? 'destructive' : 'outline'}
            className="gap-2"
          >
            <Shield className="w-4 h-4" />
            {settings.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
          </Button>
          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Preset Configurations */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Quick Presets
          </CardTitle>
          <CardDescription>
            Apply recommended configurations for different security and performance profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button 
              onClick={() => applyPreset('strict')} 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
            >
              <Shield className="w-6 h-6 text-red-500" />
              <div>
                <div className="font-semibold">Strict Security</div>
                <div className="text-xs text-muted-foreground">Max security, limited access</div>
              </div>
            </Button>
            <Button 
              onClick={() => applyPreset('recommended')} 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4 border-green-500 dark:border-green-700"
            >
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <div className="font-semibold">Recommended</div>
                <div className="text-xs text-muted-foreground">Balanced security & usability</div>
              </div>
            </Button>
            <Button 
              onClick={() => applyPreset('relaxed')} 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
            >
              <Users className="w-6 h-6 text-blue-500" />
              <div>
                <div className="font-semibold">Relaxed</div>
                <div className="text-xs text-muted-foreground">More access, higher costs</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
        </Alert>
      )}

      {/* Maintenance Mode Banner */}
      {settings.maintenanceMode && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-semibold">
            ⚠️ MAINTENANCE MODE ACTIVE - New sessions are blocked
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Tabs defaultValue="access" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
          <TabsTrigger value="access" className="gap-2">
            <Users className="w-4 h-4" />
            Access
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Activity className="w-4 h-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="containers" className="gap-2">
            <Container className="w-4 h-4" />
            Containers
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <Database className="w-4 h-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="aws" className="gap-2">
            <Cloud className="w-4 h-4" />
            AWS
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <Shield className="w-4 h-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>        </div>
        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Access Control</CardTitle>
              <CardDescription>
                Control user access, registrations, and platform-wide limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Maintenance Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maintenanceMode" className="flex items-center gap-2">
                    Maintenance Mode
                    {settings.maintenanceMode && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                  </Label>
                  <Switch
                    id="maintenanceMode"
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => updateField('maintenanceMode', checked)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Block all new sessions (admins can still access)</p>
              </div>

              {/* Maintenance Message */}
              {settings.maintenanceMode && (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Active:</strong> Maintenance mode is enabled. Users cannot start new sessions.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={settings.maintenanceMessage || ''}
                      onChange={(e) => updateField('maintenanceMessage', e.target.value)}
                      placeholder="System is under maintenance. Please try again later."
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* Registration Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowNewRegistrations">Allow New Registrations</Label>
                  <Switch
                    id="allowNewRegistrations"
                    checked={settings.allowNewRegistrations}
                    onCheckedChange={(checked) => updateField('allowNewRegistrations', checked)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Allow new users to sign up</p>
              </div>

              {/* User Limits */}
              <div className="grid grid-cols-2 gap-6">
                <SliderInput
                  label="Max Concurrent Users"
                  value={settings.maxConcurrentUsers}
                  onChange={(val: number) => updateField('maxConcurrentUsers', val)}
                  min={0}
                  max={1000}
                  step={10}
                  unit="users"
                  description="0 = unlimited. Set based on server capacity."
                  dangerous={settings.maxConcurrentUsers === 0 || settings.maxConcurrentUsers > 500}
                />
                <SliderInput
                  label="Max Total Users"
                  value={settings.maxTotalUsers}
                  onChange={(val: number) => updateField('maxTotalUsers', val)}
                  min={0}
                  max={10000}
                  step={50}
                  unit="users"
                  description="0 = unlimited. Database-level user limit."
                  dangerous={settings.maxTotalUsers === 0 || settings.maxTotalUsers > 5000}
                />
              </div>
              
              {(settings.maxConcurrentUsers === 0 || settings.maxTotalUsers === 0) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Unlimited users may impact performance. Set reasonable limits.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Limits Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Session Limits & Timeouts</CardTitle>
              <CardDescription>
                Configure session limits for performance and security. Lower values = better security.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <SliderInput
                  label="Max Concurrent Sessions Per User"
                  value={settings.maxSessionsPerUser}
                  onChange={(val: number) => updateField('maxSessionsPerUser', val)}
                  min={1}
                  max={10}
                  unit="sessions"
                  description="Recommended: 3-5 sessions. Higher values increase server load."
                  dangerous={settings.maxSessionsPerUser > 5}
                />
                <SliderInput
                  label="Max Session Starts Per Hour"
                  value={settings.maxSessionsPerHour}
                  onChange={(val: number) => updateField('maxSessionsPerHour', val)}
                  min={1}
                  max={20}
                  unit="starts/hr"
                  description="Prevents session spam attacks. Recommended: 5-10."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <SliderInput
                  label="Max Session Starts Per Day"
                  value={settings.maxSessionsPerDay}
                  onChange={(val: number) => updateField('maxSessionsPerDay', val)}
                  min={5}
                  max={100}
                  unit="starts/day"
                  description="Daily limit per user. Recommended: 10-50."
                />
                <SliderInput
                  label="Idle Timeout"
                  value={settings.idleTimeoutMinutes}
                  onChange={(val: number) => updateField('idleTimeoutMinutes', val)}
                  min={5}
                  max={240}
                  unit="minutes"
                  description="Auto-terminate inactive sessions. OWASP recommends 15-30 minutes."
                  dangerous={settings.idleTimeoutMinutes > 60}
                />
              </div>

              <SliderInput
                label="Max Session Duration"
                value={settings.maxSessionDurationMinutes}
                onChange={(val: number) => updateField('maxSessionDurationMinutes', val)}
                min={30}
                max={480}
                unit="minutes"
                description="Maximum session lifetime. Recommended: 180 minutes (3 hours). Longer sessions may impact performance."
                dangerous={settings.maxSessionDurationMinutes > 300}
              />
              
              {validationErrors.idleTimeoutMinutes && (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription>{validationErrors.idleTimeoutMinutes}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Container Management Tab */}
        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Container & Scenario Access</CardTitle>
              <CardDescription>
                Control container limits and scenario access for cost management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SliderInput
                label="Max Total Running Containers"
                value={settings.maxTotalContainers}
                onChange={(val: number) => updateField('maxTotalContainers', val)}
                min={0}
                max={500}
                step={10}
                unit="containers"
                description="0 = unlimited (NOT recommended). Set to 50-200 for production."
                dangerous={settings.maxTotalContainers === 0 || settings.maxTotalContainers > 200}
              />
              
              {settings.maxTotalContainers === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Unlimited containers can lead to runaway costs. Set a specific limit.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Scenario Access Limits (Cost Control)
                </h4>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowAllScenarios">Allow Access to All Scenarios</Label>
                    <Switch
                      id="allowAllScenarios"
                      checked={settings.allowAllScenarios}
                      onCheckedChange={(checked) => updateField('allowAllScenarios', checked)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ WARNING: Enabling this allows unlimited scenario access and can increase costs significantly
                  </p>
                </div>

                {!settings.allowAllScenarios && (
                  <SliderInput
                    label="Max Accessible Scenarios Per User"
                    value={settings.maxAccessibleScenarios}
                    onChange={(val: number) => updateField('maxAccessibleScenarios', val)}
                    min={1}
                    max={20}
                    unit="scenarios"
                    description="Recommended: 1 scenario for free tier. Increase as budget allows."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget & Cost Control</CardTitle>
              <CardDescription>
                Set monthly budget limits to prevent unexpected costs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SliderInput
                label="Monthly Budget Hard Cap"
                value={settings.budgetHardCapUsd}
                onChange={(val: number) => updateField('budgetHardCapUsd', val)}
                min={0}
                max={10000}
                step={50}
                unit="USD"
                description="0 = disabled. Automatically stop containers when exceeded. Recommended: Set based on budget."
                dangerous={settings.budgetHardCapUsd === 0 || settings.budgetHardCapUsd > 5000}
              />

              <SliderInput
                label="Budget Alert Threshold"
                value={settings.budgetAlertPercentage}
                onChange={(val: number) => updateField('budgetAlertPercentage', val)}
                min={50}
                max={95}
                step={5}
                unit="%"
                description="Get alerts when reaching this percentage of the hard cap. Recommended: 70-80%."
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoMaintenanceOnBudgetCap">Auto-Enable Maintenance at Budget Cap</Label>
                  <Switch
                    id="autoMaintenanceOnBudgetCap"
                    checked={settings.autoMaintenanceOnBudgetCap}
                    onCheckedChange={(checked) => updateField('autoMaintenanceOnBudgetCap', checked)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically enable maintenance mode when budget cap is reached (highly recommended)
                </p>
              </div>
              
              {settings.budgetHardCapUsd === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> No budget cap set. You may incur unlimited costs. Set a hard cap.
                  </AlertDescription>
                </Alert>
              )}

              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  💡 <strong>Cost Protection:</strong> Budget alerts trigger at {settings.budgetAlertPercentage}% and 90%.
                  Idle sessions terminate after {settings.idleTimeoutMinutes} minutes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MinIO Storage Configuration</CardTitle>
              <CardDescription>
                Configure MinIO object storage settings and user quotas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minioEndpoint">MinIO Endpoint</Label>
                  <Input
                    id="minioEndpoint"
                    value={settings.minioEndpoint || ''}
                    onChange={(e) => updateField('minioEndpoint', e.target.value)}
                    placeholder="localhost or minio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minioPort">MinIO Port</Label>
                  <Input
                    id="minioPort"
                    type="number"
                    value={settings.minioPort || 9000}
                    onChange={(e) => updateField('minioPort', parseInt(e.target.value) || 9000)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minioUseSSL">Use SSL</Label>
                  <Switch
                    id="minioUseSSL"
                    checked={settings.minioUseSSL}
                    onCheckedChange={(checked) => updateField('minioUseSSL', checked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minioAccessKey">Access Key</Label>
                  <Input
                    id="minioAccessKey"
                    type="password"
                    value={settings.minioAccessKey || ''}
                    onChange={(e) => updateField('minioAccessKey', e.target.value)}
                    placeholder="minioadmin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minioSecretKey">Secret Key</Label>
                  <Input
                    id="minioSecretKey"
                    type="password"
                    value={settings.minioSecretKey || ''}
                    onChange={(e) => updateField('minioSecretKey', e.target.value)}
                    placeholder="minioadmin"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minioBucket">Default Bucket</Label>
                <Input
                  id="minioBucket"
                  value={settings.minioBucket}
                  onChange={(e) => updateField('minioBucket', e.target.value)}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Storage Quotas</h4>
                <SliderInput
                  label="Max Storage Per User"
                  value={Math.round(settings.maxStoragePerUserBytes / (1024 * 1024))} // Convert to MB
                  onChange={(val: number) => updateField('maxStoragePerUserBytes', val * 1024 * 1024)}
                  min={0}
                  max={10000}
                  step={100}
                  unit="MB"
                  description="0 = unlimited. Recommended: 100-500 MB per user."
                  dangerous={settings.maxStoragePerUserBytes === 0 || settings.maxStoragePerUserBytes > 1024 * 1024 * 1024}
                />

                <SliderInput
                  label="Max Total Storage"
                  value={Math.round(settings.maxTotalStorageBytes / (1024 * 1024 * 1024))} // Convert to GB
                  onChange={(val: number) => updateField('maxTotalStorageBytes', val * 1024 * 1024 * 1024)}
                  min={0}
                  max={1000}
                  step={10}
                  unit="GB"
                  description="0 = unlimited. Set based on MinIO capacity."
                  dangerous={settings.maxTotalStorageBytes === 0 || settings.maxTotalStorageBytes > 500 * 1024 * 1024 * 1024}
                />
              </div>
              
              {(settings.maxStoragePerUserBytes === 0 || settings.maxTotalStorageBytes === 0) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Unlimited storage can lead to high costs. Set specific limits.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AWS Tab */}
        <TabsContent value="aws" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AWS Fargate Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useLocalDocker">Use Local Docker (instead of Fargate)</Label>
                  <Switch
                    id="useLocalDocker"
                    checked={settings.useLocalDocker}
                    onCheckedChange={(checked) => updateField('useLocalDocker', checked)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Run containers locally instead of AWS Fargate</p>
              </div>

              {!settings.useLocalDocker && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="awsRegion">AWS Region</Label>
                      <Input
                        id="awsRegion"
                        value={settings.awsRegion || ''}
                        onChange={(e) => updateField('awsRegion', e.target.value)}
                        placeholder="ap-southeast-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsEcsClusterName">ECS Cluster Name</Label>
                      <Input
                        id="awsEcsClusterName"
                        value={settings.awsEcsClusterName || ''}
                        onChange={(e) => updateField('awsEcsClusterName', e.target.value)}
                        placeholder="rangex-labs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="awsEcsSubnetIds">Subnet IDs (comma-separated)</Label>
                    <Input
                      id="awsEcsSubnetIds"
                      value={settings.awsEcsSubnetIds || ''}
                      onChange={(e) => updateField('awsEcsSubnetIds', e.target.value)}
                      placeholder="subnet-xxxxx,subnet-yyyyy"
                    />
                    <p className="text-xs text-muted-foreground">Private subnets for container isolation</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="awsEcsSecurityGroupIds">Security Group IDs (comma-separated)</Label>
                    <Input
                      id="awsEcsSecurityGroupIds"
                      value={settings.awsEcsSecurityGroupIds || ''}
                      onChange={(e) => updateField('awsEcsSecurityGroupIds', e.target.value)}
                      placeholder="sg-xxxxx,sg-yyyyy"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="awsEcrRegistry">ECR Registry URL</Label>
                    <Input
                      id="awsEcrRegistry"
                      value={settings.awsEcrRegistry || ''}
                      onChange={(e) => updateField('awsEcrRegistry', e.target.value)}
                      placeholder="123456789012.dkr.ecr.ap-southeast-1.amazonaws.com"
                    />
                  </div>

                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">
                      💡 <strong>Free Tier:</strong> VPC, ECS, ECR free tier = $0/month. Fargate: 20 GB-hours/month free!
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring & Error Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enablePrometheusMetrics">Enable Prometheus Metrics</Label>
                    <Switch
                      id="enablePrometheusMetrics"
                      checked={settings.enablePrometheusMetrics}
                      onCheckedChange={(checked) => updateField('enablePrometheusMetrics', checked)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Expose /api/metrics endpoint</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableRequestLogging">Enable Request Logging</Label>
                    <Switch
                      id="enableRequestLogging"
                      checked={settings.enableRequestLogging}
                      onCheckedChange={(checked) => updateField('enableRequestLogging', checked)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Log all API requests to files</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logRetentionDays">Log Retention (days)</Label>
                  <Input
                    id="logRetentionDays"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.logRetentionDays}
                    onChange={(e) => updateField('logRetentionDays', parseInt(e.target.value) || 7)}
                  />
                  <p className="text-xs text-muted-foreground">How long to keep log files (default: 7 days)</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold">Error Notifications</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sendErrorNotifications">Send Error Notifications</Label>
                    <Switch
                      id="sendErrorNotifications"
                      checked={settings.sendErrorNotifications}
                      onCheckedChange={(checked) => updateField('sendErrorNotifications', checked)}
                    />
                  </div>
                </div>

                {settings.sendErrorNotifications && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmails">Admin Emails (comma-separated)</Label>
                      <Input
                        id="adminEmails"
                        value={settings.adminEmails || ''}
                        onChange={(e) => updateField('adminEmails', e.target.value)}
                        placeholder="admin@example.com, ops@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slackWebhookUrl">Slack Webhook URL (optional)</Label>
                      <Input
                        id="slackWebhookUrl"
                        value={settings.slackWebhookUrl || ''}
                        onChange={(e) => updateField('slackWebhookUrl', e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button at Bottom */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Changes
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(settings.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
