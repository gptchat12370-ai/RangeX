import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Compass,
  ListMusic,
  Target,
  Calendar,
  Users,
  Trophy,
  HelpCircle,
  Plus,
  FileText,
  Shield,
  Image as ImageIcon,
  ChevronRight,
  Cloud,
  FlaskConical,
} from "lucide-react";
import { useStore } from "../lib/store";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { adminApi } from "../api/adminApi";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: Array<"solver" | "creator" | "admin">;
  badge?: string | number;
  badgeVariant?: "default" | "destructive" | "outline" | "secondary";
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, path: "/" },
  { label: "Career Paths", icon: Compass, path: "/career-paths" },
  { label: "Playlists", icon: ListMusic, path: "/playlists" },
  { label: "Challenges", icon: Target, path: "/challenges" },
  { label: "Events", icon: Calendar, path: "/events" },
  { label: "Teams", icon: Users, path: "/teams" },
  { label: "Leaderboards", icon: Trophy, path: "/leaderboards" },
  { label: "Help", icon: HelpCircle, path: "/help" },
];

const creatorItems: NavItem[] = [
  { label: "Create Scenario", icon: Plus, path: "/creator/new", roles: ["creator", "admin"] },
  { label: "My Scenarios", icon: FileText, path: "/creator/scenarios", roles: ["creator", "admin"] },
];

export function Sidebar({}: SidebarProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, sidebarOpen, setSidebarOpen } = useStore();
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Load pending approvals count for admins
  useEffect(() => {
    if (currentUser?.roleAdmin) {
      const loadPendingCount = async () => {
        try {
          const list = await adminApi.listPendingScenarios();
          setPendingCount(list?.length || 0);
        } catch {
          // Silent fail - not critical
        }
      };
      loadPendingCount();
      // Refresh every 30 seconds
      const interval = setInterval(loadPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.roleAdmin]);

  // Dynamic admin items with pending count
  const adminItems: NavItem[] = [
    { label: "Admin Console", icon: Shield, path: "/admin", roles: ["admin"] },
    { 
      label: "Approvals", 
      icon: FileText, 
      path: "/admin/approvals", 
      roles: ["admin"],
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeVariant: "destructive"
    },
    { label: "Testing", icon: FlaskConical, path: "/admin/testing", roles: ["admin"] },
    { label: "Scenarios", icon: Target, path: "/admin/scenarios", roles: ["admin"] },
    { label: "Deployments", icon: Cloud, path: "/admin/deployments", roles: ["admin"] },
  ];

  const canAccess = (roles?: Array<"solver" | "creator" | "admin">) => {
    if (!roles) return true;
    // Check role flags: roleAdmin, roleCreator, roleSolver
    return roles.some(role => {
      if (role === "admin") return currentUser?.roleAdmin;
      if (role === "creator") return currentUser?.roleCreator;
      if (role === "solver") return currentUser?.roleSolver;
      return false;
    });
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // On mobile, close sidebar after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 h-16 px-6 border-b">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
              <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-lg cyber-glow">
                <span className="text-2xl font-bold text-white">X</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">
                Range<span className="text-primary">X</span>
              </h1>
              <p className="text-xs text-muted-foreground">Cyber Training Platform</p>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <div className="space-y-1">
              {navItems.map((item) =>
                canAccess(item.roles) ? (
                  <Button
                    key={item.path}
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive(item.path) ? "bg-primary/10 text-primary border-l-2 border-primary" : ""
                    }`}
                    onClick={() => handleNavigation(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge 
                        variant={item.badgeVariant || "secondary"}
                        className="ml-auto h-5 px-1.5 min-w-[20px] flex items-center justify-center"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                ) : null
              )}
            </div>

            {/* Creator Section */}
            {(currentUser?.roleCreator || currentUser?.roleAdmin) && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <div className="px-3 py-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Creator Tools</h3>
                  </div>
                  {creatorItems.map((item) =>
                    canAccess(item.roles) ? (
                      <Button
                        key={item.path}
                        variant={isActive(item.path) ? "secondary" : "ghost"}
                        className={`w-full justify-start gap-3 ${
                          isActive(item.path) ? "bg-primary/10 text-primary border-l-2 border-primary" : ""
                        }`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.badge && (
                          <Badge 
                            variant={item.badgeVariant || "secondary"}
                            className="ml-auto h-5 px-1.5 min-w-[20px] flex items-center justify-center"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Button>
                    ) : null
                  )}
                </div>
              </>
            )}

            {/* Admin Section */}
            {currentUser?.roleAdmin && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <div className="px-3 py-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Administration</h3>
                  </div>
                  {adminItems.map((item) =>
                    canAccess(item.roles) ? (
                      <Button
                        key={item.path}
                        variant={isActive(item.path) ? "secondary" : "ghost"}
                        className={`w-full justify-start gap-3 ${
                          isActive(item.path) ? "bg-primary/10 text-primary border-l-2 border-primary" : ""
                        }`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.badge && (
                          <Badge 
                            variant={item.badgeVariant || "secondary"}
                            className="ml-auto h-5 px-1.5 min-w-[20px] flex items-center justify-center"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Button>
                    ) : null
                  )}
                </div>
              </>
            )}
          </ScrollArea>

          {/* User Stats Footer */}
          <div className="p-4 border-t bg-card/50">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Total Points</p>
                <p className="text-lg font-bold text-primary">{currentUser.pointsTotal || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Badges</p>
                <p className="text-lg font-bold text-accent">{currentUser.badges?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
