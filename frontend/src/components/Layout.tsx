import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, User, LogOut, Settings, Command, X, Inbox, Trophy } from "lucide-react";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { getRoleColor } from "../lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  hideNavigation?: boolean;
}

export function Layout({ children, hideNavigation = false }: LayoutProps) {
  const navigate = useNavigate();
  const { currentUser, sidebarOpen, setSidebarOpen, setCommandPaletteOpen, logout } = useStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Get user role label from boolean flags
  const getUserRoleLabel = () => {
    if (currentUser?.roleAdmin) return "admin";
    if (currentUser?.roleCreator) return "creator";
    return "solver";
  };

  if (hideNavigation) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen flex">
      <CommandPalette />
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <header
          className={`sticky top-0 z-40 border-b transition-all duration-200 ${
            scrolled ? "bg-card/80 backdrop-blur-lg shadow-lg" : "bg-card"
          }`}
        >
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              {/* Logo - visible on mobile when sidebar is closed */}
              <div className="flex items-center gap-2 lg:hidden">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl" />
                  <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-lg">
                    <span className="text-xl font-bold text-white">X</span>
                  </div>
                </div>
                <span className="font-bold">Range<span className="text-primary">X</span></span>
              </div>

              {/* Global Search */}
              <Button
                variant="outline"
                className="hidden md:flex items-center gap-2 w-64 justify-start text-muted-foreground hover:text-foreground"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <Search className="h-4 w-4" />
                <span>Search...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium opacity-100">
                  <Command className="h-3 w-3" />K
                </kbd>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => navigate("/notifications")}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAssetUrl(currentUser?.avatarUrl)} alt={currentUser?.username} />
                      <AvatarFallback>
                        {(currentUser?.firstName || "U")[0]}
                        {(currentUser?.lastName || "N")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="text-sm">{currentUser?.displayName || currentUser?.username || "User"}</span>
                      <span className={`text-xs px-1.5 rounded ${getRoleColor(getUserRoleLabel())}`}>
                        {getUserRoleLabel()}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{currentUser?.username || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser?.email || ""}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/badges/progress")}>
                    <Trophy className="mr-2 h-4 w-4" />
                    <span>Badges</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/requests")}>
                    <Inbox className="mr-2 h-4 w-4" />
                    <span>Requests</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
