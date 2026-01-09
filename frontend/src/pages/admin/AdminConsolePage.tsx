import React, { useEffect, useState } from "react";
import { Shield, LayoutDashboard, Activity, Users, Image, Wrench, Settings, FileText, Award, Layout } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { AdminDashboard } from "./AdminDashboard";
import { SessionsMonitoringPage } from "./SessionsMonitoringPage";
import { UsersManagementPage } from "./UsersManagementPage";
import { ImagesToolsPage } from "./ImagesToolsPage";
import AdminSystemSettings from "./AdminSystemSettings";
import { AuditLogsPage } from "./AuditLogsPage";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";
import { BadgesPage } from "./BadgesPage";
import BadgeManagementPageComponent from "../BadgeManagementPage";

export function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground">
              Platform management and administration
            </p>
          </div>
        </div>
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-3 py-1">
          Admin Access
        </Badge>
      </div>

      {/* Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-border pb-2 overflow-x-auto">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-lg">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Activity className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Image className="h-4 w-4" />
              Images & Tools
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Award className="h-4 w-4" />
              Badges
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <AdminDashboard onNavigateToTab={setActiveTab} />
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6 mt-0">
          <SessionsMonitoringPage />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6 mt-0">
          <UsersManagementPage />
        </TabsContent>

        {/* Images & Tools Tab */}
        <TabsContent value="images" className="space-y-6 mt-0">
          <ImagesToolsPage />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-0">
          <AdminSystemSettings />
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="logs" className="space-y-6 mt-0">
          <AuditLogsPage />
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-6 mt-0">
          <BadgeManagementPageComponent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
