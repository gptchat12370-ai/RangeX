import React, { useState, useMemo } from "react";
import { Plus, Trash2, Network, Server, Settings, AlertTriangle, Layers, Copy, Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import { MachineConfigPanel } from "./MachineConfigPanel-New";
import { DockerConnectionSettings } from "./DockerConnectionSettings";

interface Machine {
  id: string;
  name: string;
  role: "attacker" | "internal" | "service";
  
  // Backend fields (matches API response)
  imageSourceType: 'platform_library' | 'custom_image';
  imageRef: string; // Full Docker image reference
  imageVariantId?: string; // Only for platform_library
  imageName?: string; // Display name
  
  // Access control
  allowSolverEntry?: boolean;
  access?: "entry" | "internal"; // Legacy field
  
  // UI helpers
  purposeTags?: string[];
  position?: { x: number; y: number };
  
  // Entrypoints
  entrypoints?: Array<{
    protocol: string;
    containerPort: number;
    exposedToSolver: boolean;
  }>;
}

interface EnvironmentTopologyTabProps {
  data: any;
  onChange: (updates: any) => void;
  errors: string[];
}

const MAX_MACHINES = 4;

const TEMPLATES = {
  "single-web": {
    name: "Single Web Lab",
    description: "Attacker + Web Server",
    icon: Server,
    machines: [
      {
        id: "attacker-1",
        name: "Attacker Workstation",
        role: "attacker" as const,
        imageSource: "public" as const,
        imageRepository: "kalilinux/kali-rolling",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "entry" as const,
        purposeTags: ["attacker"],
        position: { x: 120, y: 180 },
        sshEnabled: true,
      },
      {
        id: "web-1",
        name: "Web Server",
        role: "internal" as const,
        imageSource: "public" as const,
        imageRepository: "vulnerables/web-dvwa",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "internal" as const,
        purposeTags: ["web"],
        position: { x: 400, y: 180 },
        webEnabled: true,
      },
    ],
  },
  "web-db": {
    name: "Web + Database",
    description: "Attacker + Web + Database",
    icon: Layers,
    machines: [
      {
        id: "attacker-1",
        name: "Attacker Workstation",
        role: "attacker" as const,
        imageSource: "public" as const,
        imageRepository: "kalilinux/kali-rolling",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "entry" as const,
        purposeTags: ["attacker"],
        position: { x: 120, y: 180 },
        sshEnabled: true,
      },
      {
        id: "web-1",
        name: "Web Server",
        role: "internal" as const,
        imageSource: "public" as const,
        imageRepository: "ubuntu",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "internal" as const,
        purposeTags: ["web"],
        position: { x: 380, y: 120 },
        webEnabled: true,
      },
      {
        id: "db-1",
        name: "Database",
        role: "internal" as const,
        imageSource: "public" as const,
        imageRepository: "mysql",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "internal" as const,
        purposeTags: ["database"],
        position: { x: 380, y: 240 },
        sshEnabled: true,
      },
    ],
  },
  "pivot": {
    name: "Pivot Network",
    description: "Multi-hop attack scenario",
    icon: Network,
    machines: [
      {
        id: "attacker-1",
        name: "Attacker Workstation",
        role: "attacker" as const,
        imageSource: "public" as const,
        imageRepository: "kalilinux/kali-rolling",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "entry" as const,
        purposeTags: ["attacker"],
        position: { x: 100, y: 180 },
        sshEnabled: true,
      },
      {
        id: "jump-1",
        name: "Jump Host (DMZ)",
        role: "internal" as const,
        imageSource: "public" as const,
        imageRepository: "ubuntu",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "internal" as const,
        purposeTags: ["pivot"],
        position: { x: 280, y: 180 },
        sshEnabled: true,
      },
      {
        id: "internal-1",
        name: "Internal Service",
        role: "internal" as const,
        imageSource: "public" as const,
        imageRepository: "ubuntu",
        imageTag: "latest",
        registryUrl: "docker.io",
        access: "internal" as const,
        purposeTags: ["web"],
        position: { x: 460, y: 180 },
        webEnabled: true,
      },
    ],
  },
};

export function EnvironmentTopologyTab({ data, onChange, errors }: EnvironmentTopologyTabProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<string | null>(null);

  const machines: Machine[] = data.machines || [];

  // Memoized stats
  const stats = useMemo(() => {
    return {
      total: machines.length,
      attacker: machines.filter(m => m.role === "attacker").length,
      internal: machines.filter(m => m.role === "internal").length,
      service: machines.filter(m => m.role === "service").length,
      entry: machines.filter(m => m.access === "entry").length,
    };
  }, [machines]);

  const handleAddMachine = () => {
    if (machines.length >= MAX_MACHINES) {
      toast.error(`Maximum ${MAX_MACHINES} machines allowed per scenario`);
      return;
    }
    
    const newMachine: Machine = {
      id: `machine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Machine ${machines.length + 1}`,
      role: "internal",
      imageSource: "ready",
      access: "internal",
      purposeTags: [],
      position: { 
        x: 120 + (machines.length % 3) * 140, 
        y: 120 + Math.floor(machines.length / 3) * 120 
      },
      sshEnabled: false,
      rdpEnabled: false,
      webEnabled: false,
    };
    
    onChange({ machines: [...machines, newMachine] });
    setSelectedMachine(newMachine);
    toast.success("Machine added successfully");
  };

  const handleUpdateMachine = (updatedMachine: Machine) => {
    const updated = machines.map(m => m.id === updatedMachine.id ? updatedMachine : m);
    onChange({ machines: updated });
    setSelectedMachine(updatedMachine);
  };

  const handleDuplicateMachine = (machine: Machine) => {
    if (machines.length >= MAX_MACHINES) {
      toast.error(`Maximum ${MAX_MACHINES} machines allowed`);
      return;
    }

    const duplicated: Machine = {
      ...machine,
      id: `machine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${machine.name} (Copy)`,
      position: {
        x: (machine.position?.x || 0) + 40,
        y: (machine.position?.y || 0) + 40,
      },
    };

    onChange({ machines: [...machines, duplicated] });
    toast.success("Machine duplicated successfully");
  };

  const confirmDeleteMachine = (machineId: string) => {
    setMachineToDelete(machineId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteMachine = () => {
    if (!machineToDelete) return;
    
    onChange({ machines: machines.filter(m => m.id !== machineToDelete) });
    if (selectedMachine?.id === machineToDelete) {
      setSelectedMachine(null);
    }
    setShowDeleteConfirm(false);
    setMachineToDelete(null);
    toast.success("Machine deleted successfully");
  };

  const applyTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    onChange({ machines: template.machines });
    toast.success(`${template.name} template applied`);
  };

  const exportEnvironment = () => {
    const dataStr = JSON.stringify(machines, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "environment-export.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Environment exported");
  };

  const importEnvironment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          onChange({ machines: imported });
          toast.success("Environment imported successfully");
        } else {
          toast.error("Invalid environment file");
        }
      } catch (error) {
        toast.error("Failed to parse environment file");
      }
    };
    reader.readAsText(file);
  };

  const getMachineRoleBadge = (role: string) => {
    const variants = {
      attacker: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      internal: "bg-green-500/20 text-green-400 border-green-500/30",
      service: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return (
      <Badge className={variants[role as keyof typeof variants] || ""}>{role}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Docker Connection Settings */}
      <DockerConnectionSettings
        formData={data}
        onChange={onChange}
      />

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}/{MAX_MACHINES}</div>
            <p className="text-xs text-muted-foreground">Total Machines</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-400">{stats.attacker}</div>
            <p className="text-xs text-muted-foreground">Attackers</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-400">{stats.internal}</div>
            <p className="text-xs text-muted-foreground">Internal</p>
          </CardContent>
        </Card>
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-400">{stats.service}</div>
            <p className="text-xs text-muted-foreground">Services</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates (shown when no machines) */}
      {machines.length === 0 && (
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Quick Start Templates</CardTitle>
            <CardDescription>
              Choose a pre-configured environment or start from scratch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(TEMPLATES).map(([key, template]) => {
                const Icon = template.icon;
                return (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key as keyof typeof TEMPLATES)}
                    className="p-4 border-2 border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">{template.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {template.machines.length} machines
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="outline" onClick={handleAddMachine}>
                <Plus className="mr-2 h-4 w-4" />
                Start from Scratch
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={importEnvironment}
                />
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Environment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Environment Editor */}
      {machines.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Machine List & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Actions Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={handleAddMachine}
                  disabled={machines.length >= MAX_MACHINES}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Machine
                </Button>
                <Button variant="outline" size="sm" onClick={exportEnvironment}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
              <Badge variant="outline">
                {machines.length <= 2 ? "Light" : machines.length <= 4 ? "Medium" : "Heavy"} Load
              </Badge>
            </div>

            {/* Machine Table */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>Machines</CardTitle>
                <CardDescription>
                  Click a machine to configure • {stats.entry} entry point{stats.entry !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Protocols</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines.map((machine) => (
                      <TableRow
                        key={machine.id}
                        className={`cursor-pointer transition-colors ${
                          selectedMachine?.id === machine.id ? "bg-primary/10" : "hover:bg-accent/50"
                        }`}
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {machine.name}
                            {machine.access === "entry" && (
                              <Badge variant="secondary" className="text-xs">Entry</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getMachineRoleBadge(machine.role)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs w-fit">
                              {machine.imageVariantId ? "Platform Variant" : 
                               machine.imageSourceType === "platform_library" ? "Platform" : "Custom"}
                            </Badge>
                            {machine.imageRef && (
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={machine.imageRef}>
                                {machine.imageName || machine.imageRef}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {machine.entrypoints && machine.entrypoints.length > 0 ? (
                              machine.entrypoints.map((ep, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant={ep.exposedToSolver ? "default" : "outline"} 
                                  className="text-xs uppercase"
                                >
                                  {ep.protocol}:{ep.containerPort}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicateMachine(machine);
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplicate</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmDeleteMachine(machine.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right: Machine Configuration Panel */}
          <div className="lg:col-span-1">
            {selectedMachine ? (
              <MachineConfigPanel
                machine={selectedMachine}
                onUpdate={handleUpdateMachine}
                onClose={() => setSelectedMachine(null)}
              />
            ) : (
              <Card className="cyber-border sticky top-6">
                <CardContent className="pt-6 text-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a machine to configure
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click any machine from the table
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the machine and all its configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setMachineToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMachine}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Machine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
