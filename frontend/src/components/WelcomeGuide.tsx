import React from "react";
import { X, MousePointer, Bell, User, Menu } from "lucide-react@0.263.1";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useStore } from "../lib/store";

interface WelcomeGuideProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeGuide({ open, onClose }: WelcomeGuideProps) {
  const { currentUser } = useStore();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl cyber-border">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to RangeX! 🎯</DialogTitle>
          <DialogDescription>
            Quick guide to help you navigate the platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Navigation */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Menu className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Sidebar Navigation</h3>
                  <p className="text-sm text-muted-foreground">
                    Access all pages from the left sidebar. It auto-hides on mobile - tap the
                    menu icon (top-left) to open it.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Profile & Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Click your avatar (top-right) to access your account, settings, badges,
                    and challenge history.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the bell icon (top-right) to view achievements, event reminders,
                    and system updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Switcher */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <MousePointer className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Role Switcher (Dev Tool)</h3>
                  <p className="text-sm text-muted-foreground">
                    Find the floating button at the bottom-right corner to instantly switch
                    between Solver, Creator, and Admin roles.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-bold mb-3">Quick Actions to Try:</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>
                  <strong>Start a Challenge:</strong> Sidebar → Challenges → "Introduction to
                  Nmap" → Start
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">→</span>
                <span>
                  <strong>Create a Scenario:</strong> Switch to Creator role → "Create
                  Scenario"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">→</span>
                <span>
                  <strong>Admin Console:</strong> Switch to Admin role → "Admin Console"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">→</span>
                <span>
                  <strong>Search Anything:</strong> Press <kbd className="px-2 py-1 text-xs bg-muted rounded border">⌘K</kbd> to open global search
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Got it, thanks!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
