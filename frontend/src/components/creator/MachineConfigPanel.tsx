import React, { useState } from "react";
import { X, Server, Network, AlertCircle } from "lucide-react@0.263.1";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

interface Machine {
  id: string;
  name: string;
  role: "attacker" | "internal" | "service";
  imageSource: "platform" | "my";
  imageName?: string;
  access: "entry" | "internal";
  purposeTags: string[];
  networkGroup?: string;
  allowAttackerConnections?: boolean;
  allowInternalConnections?: boolean;
  isPivot?: boolean;
  sshEnabled?: boolean;
  rdpEnabled?: boolean;
  webEnabled?: boolean;
  sshUsername?: string;
  sshPassword?: string;
}

interface MachineConfigPanelProps {
  machine: Machine;
  onUpdate: (machine: Machine) => void;
  onClose: () => void;
}

export function MachineConfigPanel({ machine, onUpdate, onClose }: MachineConfigPanelProps) {
  const [localMachine, setLocalMachine] = useState(machine);

  const handleUpdate = (updates: Partial<Machine>) => {
    const updated = { ...localMachine, ...updates };
    setLocalMachine(updated);
    onUpdate(updated);
  };

  const togglePurposeTag = (tag: string) => {
    const tags = localMachine.purposeTags || [];
    const updated = tags.includes(tag)
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    handleUpdate({ purposeTags: updated });
  };

  // Mock images - in real app, would filter based on owner
  const platformImages = [
    { value: "kali-lite", label: "Kali Lite Attacker", role: "Attacker", tags: "Web, Recon" },
    { value: "dvwa", label: "DVWA Web Server", role: "Victim", tags: "Web" },
    { value: "ubuntu-web", label: "Ubuntu Web Server", role: "Victim", tags: "Web, Linux" },
    { value: "mysql", label: "MySQL Database", role: "Victim", tags: "Database" },
    { value: "windows-ad", label: "Windows AD Controller", role: "Victim", tags: "Windows, AD" },
  ];

  const myImages = [
    { value: "custom-web-1", label: "My Custom Web App", role: "Victim", tags: "Web, Custom" },
    { value: "custom-attack", label: "My Attack Box", role: "Attacker", tags: "Custom" },
  ];

  const currentImages = localMachine.imageSource === "platform" ? platformImages : myImages;

  return (
    <Card className="cyber-border sticky top-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Machine Configuration</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Server className="h-4 w-4" />
            Basic Info
          </h3>

          <div className="space-y-2">
            <Label htmlFor="machine-name" className="text-xs font-semibold">
              Machine Name
            </Label>
            <Input
              id="machine-name"
              value={localMachine.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              placeholder="e.g., Web Server"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="machine-role" className="text-xs font-semibold">
              Role
            </Label>
            <Select
              value={localMachine.role}
              onValueChange={(value: any) => handleUpdate({ role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attacker">Attacker</SelectItem>
                <SelectItem value="internal">Internal (Victim/Pivot/DB)</SelectItem>
                <SelectItem value="service">Service (Logging/API/Supporting)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Purpose Tags</Label>
            <div className="flex flex-wrap gap-2">
              {["Web", "API", "Database", "AD", "Internal Service", "Logging"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => togglePurposeTag(tag)}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    localMachine.purposeTags?.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="solver-access" className="text-xs font-semibold">
                Solver can directly access
              </Label>
              <p className="text-xs text-muted-foreground">
                Entry point for solver connection
              </p>
            </div>
            <Switch
              id="solver-access"
              checked={localMachine.access === "entry"}
              onCheckedChange={(checked) =>
                handleUpdate({ access: checked ? "entry" : "internal" })
              }
            />
          </div>
        </div>

        <Separator />

        {/* Info Note */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-300 mb-1">Docker Container</p>
            <p className="text-xs text-blue-300">
              This machine runs as a Docker container on AWS Fargate.
            </p>
          </div>
        </div>

        <Separator />

        {/* Image Selection Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Server className="h-4 w-4" />
            Image Selection
          </h3>

          <div className="space-y-3">
            {/* Source Selector */}
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={localMachine.imageSource === "platform" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleUpdate({ imageSource: "platform", imageName: undefined })}
              >
                Platform Library
              </Button>
              <Button
                variant={localMachine.imageSource === "my" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleUpdate({ imageSource: "my", imageName: undefined })}
              >
                My Images
              </Button>
            </div>

            {/* Image Dropdown */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Select {localMachine.imageSource === "platform" ? "Platform" : "Custom"} Image
              </Label>
              <Select
                value={localMachine.imageName}
                onValueChange={(value) => handleUpdate({ imageName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an image..." />
                </SelectTrigger>
                <SelectContent>
                  {currentImages.map((img) => (
                    <SelectItem key={img.value} value={img.value}>
                      <div className="flex items-center gap-2">
                        <span>{img.label}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {img.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {img.tags}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {localMachine.imageName && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Resource profile: <span className="font-semibold">Light</span>
                    <br />
                    Typical usage: 1 CPU / 2 GB RAM (approx.)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Access Methods Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Access Methods</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="ssh-access" className="text-xs font-semibold">
                  SSH Access
                </Label>
                <p className="text-xs text-muted-foreground">
                  Terminal access via SSH
                </p>
              </div>
              <Switch
                id="ssh-access"
                checked={localMachine.sshEnabled || false}
                onCheckedChange={(checked) => handleUpdate({ sshEnabled: checked })}
              />
            </div>

            {localMachine.sshEnabled && (
              <div className="pl-4 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input
                    value={localMachine.sshUsername || ""}
                    onChange={(e) => handleUpdate({ sshUsername: e.target.value })}
                    placeholder="e.g., ubuntu"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    type="password"
                    value={localMachine.sshPassword || ""}
                    onChange={(e) => handleUpdate({ sshPassword: e.target.value })}
                    placeholder="••••••••"
                    className="h-8"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="rdp-access" className="text-xs font-semibold">
                  RDP Access
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remote desktop (Windows)
                </p>
              </div>
              <Switch
                id="rdp-access"
                checked={localMachine.rdpEnabled || false}
                onCheckedChange={(checked) => handleUpdate({ rdpEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="web-access" className="text-xs font-semibold">
                  Web Access
                </Label>
                <p className="text-xs text-muted-foreground">
                  HTTP/HTTPS browser access
                </p>
              </div>
              <Switch
                id="web-access"
                checked={localMachine.webEnabled || false}
                onCheckedChange={(checked) => handleUpdate({ webEnabled: checked })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Networking Section */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <h3 className="font-semibold text-sm flex items-center gap-2 hover:text-primary transition-colors">
              <Network className="h-4 w-4" />
              Networking (Optional)
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Network Group <span className="text-red-500">*</span></Label>
              <Select
                value={localMachine.networkGroup || ""}
                onValueChange={(value) => handleUpdate({ networkGroup: value })}
              >
                <SelectTrigger className={!localMachine.networkGroup ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select network group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="netA">Net A</SelectItem>
                  <SelectItem value="netB">Net B</SelectItem>
                  <SelectItem value="dmz">DMZ</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Nodes in the same group are on the same subnet
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="is-pivot" className="text-xs font-semibold">
                  Pivot point
                </Label>
                <p className="text-xs text-muted-foreground">
                  Can route to other networks
                </p>
              </div>
              <Switch
                id="is-pivot"
                checked={localMachine.isPivot || false}
                onCheckedChange={(checked) => handleUpdate({ isPivot: checked })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="pt-4">
          <p className="text-xs text-muted-foreground italic">
            Tools, assets, and startup scripts are configured in the Image Builder, not here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
