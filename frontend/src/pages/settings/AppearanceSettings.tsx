import React, { useEffect, useState } from "react";
import { Moon, Sun, Monitor, CheckCircle2, Trophy, Shield, Zap, Lock, Target, Play, Heart, Users, Clock, Rocket, Star, Award, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useStore } from "../../lib/store";
import { toast } from "sonner";
import { settingsApi } from "../../api/settingsApi";

export default function AppearanceSettings() {
  const { appearance, setAppearance } = useStore();
  const [, forceUpdate] = useState({});

  // Load saved settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await settingsApi.get();
        setAppearance(data);
      } catch (err) {
        // ignore load errors for now, keep local defaults
      }
    };
    loadSettings();
  }, [setAppearance]);

  // Apply theme changes immediately
  useEffect(() => {
    if (appearance.theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else if (appearance.theme === "light") {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }
    }
    // Force a visual update
    setTimeout(() => forceUpdate({}), 0);
  }, [appearance.theme]);

  // Apply accent color changes immediately
  useEffect(() => {
    const colors: Record<string, string> = {
      cyan: "189 100% 56%",
      blue: "221 83% 53%",
      purple: "271 81% 56%",
      green: "142 76% 36%",
      orange: "25 95% 53%",
      red: "0 72% 51%",
    };
    const colorValue = colors[appearance.accentColor];
    document.documentElement.style.setProperty("--primary", colorValue);
    document.documentElement.style.setProperty("--ring", colorValue);
    document.documentElement.style.setProperty("--sidebar-primary", colorValue);
    document.documentElement.style.setProperty("--sidebar-ring", colorValue);
    
    // Force a visual update
    setTimeout(() => forceUpdate({}), 0);
  }, [appearance.accentColor]);

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    setAppearance({ theme: newTheme });
    settingsApi.updateAppearance({ theme: newTheme }).catch(() => {});
    toast.success(`Theme changed to ${newTheme}`);
  };

  const applyAccentColor = (color: string) => {
    setAppearance({ accentColor: color });
    settingsApi.updateAppearance({ accentColor: color }).catch(() => {});
    toast.success(`Accent color changed to ${color}`);
  };

  const accentColors = [
    { value: "cyan", label: "Cyber Cyan", hsl: "189 100% 56%", from: "#06b6d4", to: "#0ea5e9" },
    { value: "blue", label: "Matrix Blue", hsl: "221 83% 53%", from: "#3b82f6", to: "#2563eb" },
    { value: "purple", label: "Hacker Purple", hsl: "271 81% 56%", from: "#a855f7", to: "#9333ea" },
    { value: "green", label: "Terminal Green", hsl: "142 76% 36%", from: "#10b981", to: "#059669" },
    { value: "orange", label: "Alert Orange", hsl: "25 95% 53%", from: "#f97316", to: "#ea580c" },
    { value: "red", label: "Critical Red", hsl: "0 72% 51%", from: "#ef4444", to: "#dc2626" },
  ];

  return (
    <div className="space-y-8">
      {/* Color Scheme Section */}
      <div className="space-y-4">
        <div>
          <h3>Color Scheme</h3>
          <p className="text-sm text-muted-foreground mt-1">Select your preferred theme</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => applyTheme("light")}
            className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-300 ${
              appearance.theme === "light"
                ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-lg shadow-cyan-500/20 dark:from-cyan-950/30 dark:to-blue-950/30"
                : "border-border bg-card hover:border-cyan-500/40 hover:shadow-md"
            }`}
          >
            {appearance.theme === "light" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-500" />
              </div>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 shadow-md">
              <Sun className="h-7 w-7 text-blue-600" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Light</div>
              <div className="text-xs text-muted-foreground">Bright theme</div>
            </div>
          </button>

          <button
            onClick={() => applyTheme("dark")}
            className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-300 ${
              appearance.theme === "dark"
                ? "border-cyan-500 bg-gradient-to-br from-slate-800 to-blue-900 shadow-lg shadow-cyan-500/20"
                : "border-border bg-card hover:border-cyan-500/40 hover:shadow-md"
            }`}
          >
            {appearance.theme === "dark" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
              </div>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-blue-900 shadow-md">
              <Moon className="h-7 w-7 text-cyan-300" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Dark</div>
              <div className="text-xs text-muted-foreground">Dark theme</div>
            </div>
          </button>

          <button
            onClick={() => applyTheme("system")}
            className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-300 ${
              appearance.theme === "system"
                ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-slate-100 shadow-lg shadow-cyan-500/20 dark:from-slate-800 dark:to-slate-700"
                : "border-border bg-card hover:border-cyan-500/40 hover:shadow-md"
            }`}
          >
            {appearance.theme === "system" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-500" />
              </div>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-slate-300 shadow-md">
              <Monitor className="h-7 w-7 text-blue-700" />
            </div>
            <div className="text-center">
              <div className="font-semibold">System</div>
              <div className="text-xs text-muted-foreground">Auto theme</div>
            </div>
          </button>
        </div>
      </div>

      {/* Accent Color Section */}
      <div className="space-y-4">
        <div>
          <h3>Accent Color</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Primary color for buttons and highlights
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => applyAccentColor(color.value)}
              className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 ${
                appearance.accentColor === color.value
                  ? "border-2 shadow-lg"
                  : "border-border bg-card hover:shadow-md hover:scale-[1.02]"
              }`}
              style={
                appearance.accentColor === color.value
                  ? {
                      borderColor: color.from,
                      background: `linear-gradient(135deg, ${color.from}15, ${color.to}15)`,
                      boxShadow: `0 10px 25px ${color.from}30`,
                    }
                  : {}
              }
            >
              {appearance.accentColor === color.value && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: color.from }} />
                </div>
              )}
              <div
                className="h-10 w-10 rounded-xl flex-shrink-0 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
                }}
              />
              <div className="text-left">
                <div className="text-sm font-semibold">{color.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
