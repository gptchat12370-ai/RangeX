import React, { useEffect, useState } from "react";
import { Settings, Key, Lock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { toast } from "sonner";
import { httpClient } from "../../api/httpClient";

export function CreatorSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    registryUrl: "",
    username: "",
    password: "",
  });

  const handleSaveDockerCredentials = async () => {
    if (!credentials.registryUrl || !credentials.username || !credentials.password) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      await httpClient.post("/creator/settings/docker-credentials", credentials);
      toast.success("Docker credentials saved successfully");
      // Clear password after saving
      setCredentials({ ...credentials, password: "" });
    } catch (error: any) {
      console.error("Failed to save Docker credentials", error);
      toast.error(error.response?.data?.message || "Failed to save credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold cyber-glow">Creator Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your creator account preferences and Docker credentials
          </p>
        </div>
        <Settings className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-6">
        {/* Docker Credentials Section */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Docker Registry Credentials
            </CardTitle>
            <CardDescription>
              Configure credentials for private Docker registries. Used when pulling images for scenario testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registryUrl">Registry URL</Label>
              <Input
                id="registryUrl"
                type="text"
                placeholder="https://registry.example.com"
                value={credentials.registryUrl}
                onChange={(e) => setCredentials({ ...credentials, registryUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The URL of your private Docker registry (e.g., Docker Hub, GitHub Container Registry, private registry)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dockerUsername">Username</Label>
              <Input
                id="dockerUsername"
                type="text"
                placeholder="your-username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dockerPassword">Password / Access Token</Label>
              <Input
                id="dockerPassword"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                For Docker Hub, use an access token instead of your password. For GitHub Container Registry, use a Personal Access Token (PAT).
              </p>
            </div>

            <Separator />

            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Lock className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-blue-300">
                Your credentials are encrypted before storage and never exposed in logs or API responses.
              </p>
            </div>

            <Button onClick={handleSaveDockerCredentials} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save Credentials"}
            </Button>
          </CardContent>
        </Card>

        {/* Future Settings Sections */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Account Preferences</CardTitle>
            <CardDescription>
              Additional creator settings (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              More settings will be available here, such as notification preferences, default scenario settings, etc.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
