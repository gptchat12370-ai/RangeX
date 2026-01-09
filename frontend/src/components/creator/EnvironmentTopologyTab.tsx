import React, { useState } from "react";
import { Plus, Trash2, Network, Server, Settings, Circle, Layers } from "lucide-react";
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
import { toast } from "sonner";
import { MachineConfigPanel } from "./MachineConfigPanel-New";
import { DockerConnectionSettings } from "./DockerConnectionSettings";

interface Machine {
  id: string;
  name: string;
  role: "attacker" | "internal" | "service";
  
  // Image Configuration (matches backend)
  imageSourceType: 'platform_library' | 'custom_image';
  imageRef: string;
  imageVariantId?: string;
  registryCredentialId?: string;
  
  // Network & Resource Configuration
  networkGroup: string;
  networkEgressPolicy: 'none' | 'session-only' | 'internet';
  resourceProfile: 'micro' | 'small' | 'medium' | 'large';
  
  // Access Control
  allowSolverEntry: boolean;
  allowFromAttacker: boolean;
  allowInternalConnections: boolean;
  isPivotHost: boolean;
  
  // Optional Configuration
  startupCommands?: string;
  entrypoints?: Array<{
    protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
  purposeTags?: string[];
  
  // UI-only fields
  position?: { x: number; y: number };
  imageName?: string; // Display name only
}

interface EnvironmentTopologyTabProps {
  data: any;
  onChange: (updates: any) => void;
  errors: string[];
}

export function EnvironmentTopologyTab({ data, onChange, errors }: EnvironmentTopologyTabProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<string | null>(null);

  const MAX_MACHINES = 4; // Admin configurable limit
  const machines: Machine[] = data.machines || [];

  const handleAddMachine = () => {
    if (machines.length >= MAX_MACHINES) {
      toast.error(`Maximum ${MAX_MACHINES} machines allowed per scenario`);
      return;
    }
    
    const newMachine: Machine = {
      id: `machine-${Date.now()}`,
      name: `Machine ${machines.length + 1}`,
      role: "internal",
      imageSourceType: 'platform_library',
      imageRef: '',
      networkGroup: 'default',
      networkEgressPolicy: 'session-only',
      resourceProfile: 'small',
      allowSolverEntry: false,
      allowFromAttacker: true,
      allowInternalConnections: true,
      isPivotHost: false,
      purposeTags: [],
      position: { x: 150 + machines.length * 100, y: 150 },
    };
    onChange({ machines: [...machines, newMachine] });
    setSelectedMachine(newMachine);
  };

  const handleUpdateMachine = (updatedMachine: Machine) => {
    const updated = machines.map(m => m.id === updatedMachine.id ? updatedMachine : m);
    onChange({ machines: updated });
    setSelectedMachine(updatedMachine);
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

  const applyTemplate = (template: string) => {
    let templateMachines: Machine[] = [];
    
    switch (template) {
      case "single-web":
        templateMachines = [
          {
            id: "attacker-1",
            name: "Attacker Workstation",
            role: "attacker",
            imageSourceType: 'custom_image',
            imageRef: "kalilinux/kali-rolling:latest",
            networkGroup: 'attacker',
            networkEgressPolicy: 'internet',
            resourceProfile: 'small',
            allowSolverEntry: true,
            allowFromAttacker: false,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["attacker"],
            position: { x: 100, y: 150 },
          },
          {
            id: "web-1",
            name: "Web Server",
            role: "internal",
            imageSourceType: 'custom_image',
            imageRef: "vulnerables/web-dvwa:latest",
            networkGroup: 'internal',
            networkEgressPolicy: 'session-only',
            resourceProfile: 'small',
            allowSolverEntry: false,
            allowFromAttacker: true,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["web"],
            position: { x: 400, y: 150 },
          },
        ];
        break;
      case "web-db":
        templateMachines = [
          {
            id: "attacker-1",
            name: "Attacker Workstation",
            role: "attacker",
            imageSourceType: 'custom_image',
            imageRef: "kalilinux/kali-rolling:latest",
            networkGroup: 'attacker',
            networkEgressPolicy: 'internet',
            resourceProfile: 'small',
            allowSolverEntry: true,
            allowFromAttacker: false,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["attacker"],
            position: { x: 100, y: 150 },
          },
          {
            id: "web-1",
            name: "Web Server",
            role: "internal",
            imageSourceType: 'custom_image',
            imageRef: "ubuntu:latest",
            networkGroup: 'internal',
            networkEgressPolicy: 'session-only',
            resourceProfile: 'small',
            allowSolverEntry: false,
            allowFromAttacker: true,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["web"],
            position: { x: 400, y: 100 },
          },
          {
            id: "db-1",
            name: "Database",
            role: "internal",
            imageSourceType: 'custom_image',
            imageRef: "mysql:latest",
            networkGroup: 'internal',
            networkEgressPolicy: 'none',
            resourceProfile: 'small',
            allowSolverEntry: false,
            allowFromAttacker: false,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["database"],
            position: { x: 400, y: 250 },
          },
        ];
        break;
      case "pivot":
        templateMachines = [
          {
            id: "attacker-1",
            name: "Attacker Workstation",
            role: "attacker",
            imageSourceType: 'custom_image',
            imageRef: "kalilinux/kali-rolling:latest",
            networkGroup: 'attacker',
            networkEgressPolicy: 'internet',
            resourceProfile: 'small',
            allowSolverEntry: true,
            allowFromAttacker: false,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["attacker"],
            position: { x: 100, y: 150 },
          },
          {
            id: "jump-1",
            name: "Jump Host",
            role: "internal",
            imageSourceType: 'custom_image',
            imageRef: "ubuntu:latest",
            networkGroup: 'dmz',
            networkEgressPolicy: 'session-only',
            resourceProfile: 'small',
            allowSolverEntry: false,
            allowFromAttacker: true,
            allowInternalConnections: true,
            isPivotHost: true,
            purposeTags: ["pivot"],
            position: { x: 300, y: 150 },
          },
          {
            id: "internal-1",
            name: "Internal Service",
            role: "internal",
            imageSourceType: 'custom_image',
            imageRef: "ubuntu:latest",
            networkGroup: 'internal',
            networkEgressPolicy: 'none',
            resourceProfile: 'small',
            allowSolverEntry: false,
            allowFromAttacker: false,
            allowInternalConnections: true,
            isPivotHost: false,
            purposeTags: ["web"],
            position: { x: 500, y: 150 },
          },
        ];
        break;
    }
    
    onChange({ machines: templateMachines });
    setShowTemplates(false);
  };

  const getMachineRoleBadge = (role: string) => {
    switch (role) {
      case "attacker":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Attacker</Badge>;
      case "internal":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Internal</Badge>;
      case "service":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Service</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const attackerCount = machines.filter(m => m.role === "attacker").length;
  const internalCount = machines.filter(m => m.role === "internal").length;
  const serviceCount = machines.filter(m => m.role === "service").length;

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Docker Connection Settings */}
      <DockerConnectionSettings
        formData={data}
        onChange={onChange}
      />

      {/* Info Card */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-3">
            Define the environment for this scenario. An environment is a set of machines (attacker and internal nodes) 
            and their network topology. Each solver gets their own isolated copy of this environment when they start the challenge.
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            <strong>Note:</strong> Use Docker images (local, public from Docker Hub, or private registries). 
            Test containers before deployment to install tools and configure services.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-xs">
              Limit: {machines.length}/{MAX_MACHINES} machines
            </Badge>
            <span className="text-muted-foreground">• Admin configurable</span>
          </div>
        </CardContent>
      </Card>

      {/* Environment Templates */}
      {machines.length === 0 && (
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Start from a Template</CardTitle>
            <CardDescription>
              Choose a pre-configured environment or start from scratch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => applyTemplate("single-web")}
                className="p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Single Web Lab</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Attacker + Single Web Server
                </p>
              </button>

              <button
                onClick={() => applyTemplate("web-db")}
                className="p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Web + Database</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Attacker + Web Server + Database
                </p>
              </button>

              <button
                onClick={() => applyTemplate("pivot")}
                className="p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Network className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Pivot Lab</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Attacker → Jump Host → Internal Service
                </p>
              </button>
            </div>

            <div className="mt-4 text-center">
              <Button variant="outline" onClick={handleAddMachine}>
                <Plus className="mr-2 h-4 w-4" />
                Start with Blank Environment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment Canvas & Configuration */}
      {machines.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Canvas & Machine List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Canvas */}
            <Card className="cyber-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Environment Topology</CardTitle>
                    <CardDescription>
                      Visual representation of your machines ({machines.length}/{MAX_MACHINES})
                    </CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleAddMachine}
                    disabled={machines.length >= MAX_MACHINES}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Machine
                    {machines.length >= MAX_MACHINES && " (Limit Reached)"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative h-96 bg-muted/20 rounded-lg border-2 border-dashed border-border overflow-hidden">
                  {/* Grid Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f1a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f1a_1px,transparent_1px)] bg-[size:24px_24px]" />
                  
                  {/* Machines */}
                  {machines.map((machine) => (
                    <div
                      key={machine.id}
                      className={`absolute cursor-pointer transition-all ${
                        selectedMachine?.id === machine.id
                          ? "ring-2 ring-primary"
                          : "hover:ring-2 hover:ring-primary/50"
                      }`}
                      style={{
                        left: machine.position?.x || 0,
                        top: machine.position?.y || 0,
                        transform: "translate(-50%, -50%)",
                      }}
                      onClick={() => setSelectedMachine(machine)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`flex items-center justify-center size-16 rounded-xl shadow-lg ${
                            machine.role === "attacker"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                              : machine.role === "service"
                              ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                              : "bg-gradient-to-br from-green-500 to-green-600 text-white"
                          }`}
                        >
                          <Server className="h-7 w-7" />
                        </div>
                        <div className="bg-background/95 px-2 py-1 rounded text-xs font-semibold border shadow-sm">
                          {machine.name}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Connection lines would go here in a real implementation */}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded bg-blue-500" />
                      <span className="text-muted-foreground">Attacker</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded bg-green-500" />
                      <span className="text-muted-foreground">Internal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded bg-purple-500" />
                      <span className="text-muted-foreground">Service</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    Click a machine to configure
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Machine List */}
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle>Machines</CardTitle>
                <CardDescription>
                  {machines.length} machine{machines.length !== 1 ? "s" : ""} 
                  {attackerCount > 0 && ` • ${attackerCount} Attacker`}
                  {internalCount > 0 && ` • ${internalCount} Internal`}
                  {serviceCount > 0 && ` • ${serviceCount} Service`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines.map((machine) => (
                      <TableRow
                        key={machine.id}
                        className={`cursor-pointer ${
                          selectedMachine?.id === machine.id ? "bg-primary/5" : ""
                        }`}
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <TableCell className="font-medium">{machine.name}</TableCell>
                        <TableCell>{getMachineRoleBadge(machine.role)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {machine.imageSourceType === 'platform_library' ? "Platform" : "Custom"}
                            </Badge>
                            {machine.imageRef && (
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={machine.imageRef}>
                                {machine.imageRef.split(':')[0]}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {machine.allowSolverEntry ? "Entry Point" : "Internal Only"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteMachine(machine.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
              <Card className="cyber-border">
                <CardContent className="pt-6 text-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Select a machine to configure its settings
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {machines.length > 0 && (
        <Card className="cyber-border bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold mb-1">Environment Summary</p>
                <p className="text-muted-foreground">
                  Machines: {machines.length}/{MAX_MACHINES} (Attacker: {attackerCount}, Internal: {internalCount}, Service: {serviceCount})
                </p>
              </div>
              <Badge variant="outline">
                Estimated Profile: {machines.length <= 2 ? "Light" : machines.length <= 4 ? "Medium" : "Heavy"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this machine? This action cannot be undone.
              All configuration for this machine will be permanently lost.
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
