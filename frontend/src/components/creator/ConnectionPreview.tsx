import React from 'react';
import { ExternalLink, Copy, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { toast } from 'sonner';

interface Entrypoint {
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
  containerPort: number;
  exposedToSolver: boolean;
  description?: string;
}

interface Machine {
  id: string;
  name: string;
  role: 'attacker' | 'internal' | 'service';
  allowSolverEntry: boolean;
  entrypoints?: Entrypoint[];
  imageRef?: string;
  imageName?: string;
}

interface ConnectionPreviewProps {
  machines: Machine[];
  gatewayProxyUrl?: string;
  sessionToken?: string;
  className?: string;
}

export function ConnectionPreview({
  machines,
  gatewayProxyUrl = 'https://proxy.rangex.app',
  sessionToken = '<session-token>',
  className = '',
}: ConnectionPreviewProps) {
  const attackerMachines = machines.filter((m) => m.role === 'attacker' && m.allowSolverEntry);
  const otherMachines = machines.filter((m) => m.role !== 'attacker' && m.allowSolverEntry);
  
  // Helper: Generate machine slug
  const generateMachineSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Helper: Generate entrypoint URL
  const generateEntrypointUrl = (machine: Machine, entrypoint: Entrypoint): string => {
    const machineSlug = generateMachineSlug(machine.name);
    const protocol = entrypoint.protocol === 'https' ? 'https' : 'http';
    
    // Format: https://proxy.rangex.app/<session-token>/<machine-slug>/<entrypoint-name>
    const entrypointName = `${entrypoint.protocol}-${entrypoint.containerPort}`;
    return `${protocol}://${gatewayProxyUrl.replace(/^https?:\/\//, '')}/${sessionToken}/${machineSlug}/${entrypointName}`;
  };

  // Helper: Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  // Get total accessible entrypoints
  const totalAccessibleEntrypoints = [...attackerMachines, ...otherMachines].reduce(
    (sum, m) => sum + (m.entrypoints?.filter((e) => e.exposedToSolver).length || 0),
    0
  );

  return (
    <Card className={`cyber-border ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Connection Preview</CardTitle>
            <CardDescription className="text-xs mt-1">
              How solvers will access this scenario
            </CardDescription>
          </div>
          <Badge variant={totalAccessibleEntrypoints > 0 ? 'default' : 'secondary'}>
            {totalAccessibleEntrypoints} Entrypoint{totalAccessibleEntrypoints !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attacker Machines (Primary Entry Points) */}
        {attackerMachines.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm">Primary Entry Points</h3>
            </div>
            
            <div className="space-y-2">
              {attackerMachines.map((machine) => {
                const exposedEntrypoints = machine.entrypoints?.filter((e) => e.exposedToSolver) || [];
                
                return (
                  <div key={machine.id} className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-green-400">{machine.name}</p>
                        <p className="text-xs text-green-300">{machine.imageName || machine.imageRef}</p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500">
                        Attacker
                      </Badge>
                    </div>
                    
                    {exposedEntrypoints.length === 0 ? (
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                        <p className="text-yellow-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          No entrypoints configured for solver access
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {exposedEntrypoints.map((entrypoint, index) => {
                          const url = generateEntrypointUrl(machine, entrypoint);
                          const isWebProtocol = ['http', 'https'].includes(entrypoint.protocol);
                          
                          return (
                            <div key={index} className="p-2 bg-background rounded border border-green-500/20">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs uppercase">
                                      {entrypoint.protocol}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Port {entrypoint.containerPort}
                                    </span>
                                  </div>
                                  {entrypoint.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {entrypoint.description}
                                    </p>
                                  )}
                                  {isWebProtocol && (
                                    <p className="text-xs text-green-400 mt-1 font-mono truncate">
                                      {url}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  {isWebProtocol && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleCopyUrl(url)}
                                      title="Copy URL"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Accessible Machines */}
        {otherMachines.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Other Accessible Machines</h3>
            </div>
            
            <div className="space-y-2">
              {otherMachines.map((machine) => {
                const exposedEntrypoints = machine.entrypoints?.filter((e) => e.exposedToSolver) || [];
                
                return (
                  <div key={machine.id} className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-blue-400">{machine.name}</p>
                        <p className="text-xs text-blue-300">{machine.imageName || machine.imageRef}</p>
                      </div>
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500 capitalize">
                        {machine.role}
                      </Badge>
                    </div>
                    
                    {exposedEntrypoints.length === 0 ? (
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                        <p className="text-yellow-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          No entrypoints configured for solver access
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {exposedEntrypoints.map((entrypoint, index) => {
                          const url = generateEntrypointUrl(machine, entrypoint);
                          const isWebProtocol = ['http', 'https'].includes(entrypoint.protocol);
                          
                          return (
                            <div key={index} className="p-2 bg-background rounded border border-blue-500/20">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs uppercase">
                                      {entrypoint.protocol}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Port {entrypoint.containerPort}
                                    </span>
                                  </div>
                                  {entrypoint.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {entrypoint.description}
                                    </p>
                                  )}
                                  {isWebProtocol && (
                                    <p className="text-xs text-blue-400 mt-1 font-mono truncate">
                                      {url}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  {isWebProtocol && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleCopyUrl(url)}
                                      title="Copy URL"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Accessible Machines Warning */}
        {attackerMachines.length === 0 && otherMachines.length === 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-xs text-yellow-400">
              <strong>No entry points configured</strong>
              <p className="mt-1">
                Solvers need at least one attacker machine with "Allow Solver Direct Entry" enabled 
                and configured entrypoints to access this scenario.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs text-blue-400">
            <strong>Connection Flow:</strong>
            <p className="mt-1">
              1. Solver starts scenario → receives session token
              <br />
              2. Gateway Proxy routes traffic to machines via session token
              <br />
              3. Only entrypoints marked "Exposed to Solver" are accessible
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
