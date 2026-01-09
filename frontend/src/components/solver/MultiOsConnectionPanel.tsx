import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Terminal, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface GuiSessionInfo {
  sessionId: string;
  osType: 'linux' | 'windows' | 'macos';
  protocol: 'vnc' | 'rdp';
  proxyUrl: string;
  credentials: {
    vncPassword?: string;
    rdpUsername?: string;
    rdpPassword?: string;
  };
  containerPrivateIp: string;
  health: 'healthy' | 'unhealthy';
}

interface MultiOsConnectionPanelProps {
  challengeSessionId: string;
  osType: 'linux' | 'windows' | 'macos';
}

export function MultiOsConnectionPanel({ challengeSessionId, osType }: MultiOsConnectionPanelProps) {
  const [guiSession, setGuiSession] = useState<GuiSessionInfo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadGuiSession();
  }, [challengeSessionId]);

  const loadGuiSession = async () => {
    try {
      const response = await httpClient.get(`/solver/sessions/${challengeSessionId}/gui`);
      if (response.data.exists) {
        setGuiSession(response.data);
      }
    } catch (error) {
      console.error('Failed to load GUI session:', error);
    }
  };

  const createGuiSession = async () => {
    setIsCreating(true);
    try {
      // SECURITY: osType sent in body, containerIp derived by backend from session
      const response = await httpClient.post(`/solver/sessions/${challengeSessionId}/gui`, {
        osType, // Send OS type from props
      });
      setGuiSession(response.data);
    } catch (error: any) {
      alert(`❌ Failed to create GUI session: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const closeGuiSession = async () => {
    if (!confirm('Are you sure you want to close the GUI session?')) {
      return;
    }

    setIsClosing(true);
    try {
      await httpClient.delete(`/solver/sessions/${challengeSessionId}/gui`);
      setGuiSession(null);
      alert('✅ GUI session closed');
    } catch (error: any) {
      alert(`❌ Failed to close GUI session: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getOsIcon = () => {
    switch (osType) {
      case 'linux':
        return '🐧';
      case 'windows':
        return '🪟';
      case 'macos':
        return '🍎';
      default:
        return '💻';
    }
  };

  const getProtocolInfo = () => {
    if (!guiSession) return null;

    switch (guiSession.protocol) {
      case 'vnc':
        return {
          name: 'VNC (Virtual Network Computing)',
          description: 'Browser-based desktop access using noVNC',
          port: 5900,
        };
      case 'rdp':
        return {
          name: 'RDP (Remote Desktop Protocol)',
          description: 'Browser-based Windows desktop using Guacamole',
          port: 3389,
        };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* OS Type Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{getOsIcon()}</span>
            <span>{osType.charAt(0).toUpperCase() + osType.slice(1)} Challenge Environment</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guiSession ? (
            <Alert className="border-green-500">
              <AlertDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>GUI session is active and ready to connect</span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                Click "Connect to Desktop" below to access the graphical interface for this {osType} challenge.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Connection Interface */}
      {!guiSession ? (
        <Card>
          <CardHeader>
            <CardTitle>Access Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={createGuiSession}
                disabled={isCreating}
                size="lg"
                className="h-24 flex-col"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Monitor className="h-6 w-6 mb-2" />
                    <span>Connect to Desktop</span>
                  </>
                )}
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-24 flex-col"
              >
                <Terminal className="h-6 w-6 mb-2" />
                <span>Terminal Only</span>
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Desktop Access:</strong> Full graphical interface with mouse and keyboard control<br />
                <strong>Terminal Only:</strong> Command-line interface only (faster, lower resource usage)
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active GUI Session */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>GUI Session Active</span>
                <Badge variant={guiSession.health === 'healthy' ? 'default' : 'destructive'}>
                  {guiSession.health}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="connect">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="connect">Connect</TabsTrigger>
                  <TabsTrigger value="credentials">Credentials</TabsTrigger>
                </TabsList>

                <TabsContent value="connect" className="space-y-4">
                  {/* noVNC/Guacamole Iframe */}
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      src={guiSession.proxyUrl}
                      className="w-full h-[600px]"
                      title={`${osType} Desktop`}
                    />
                  </div>

                  <Alert>
                    <AlertDescription className="text-sm">
                      {getProtocolInfo()?.description}
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                <TabsContent value="credentials" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Use these credentials if the GUI asks for authentication
                    </AlertDescription>
                  </Alert>

                  {guiSession.protocol === 'vnc' && guiSession.credentials.vncPassword && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">VNC Password</p>
                            <code className="text-lg font-mono">{guiSession.credentials.vncPassword}</code>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(guiSession.credentials.vncPassword!, 'vncPassword')}
                          >
                            {copiedField === 'vncPassword' ? (
                              <><CheckCircle className="h-4 w-4 mr-1" /> Copied</>
                            ) : (
                              <><Copy className="h-4 w-4 mr-1" /> Copy</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {guiSession.protocol === 'rdp' && (
                    <>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">RDP Username</p>
                              <code className="text-lg font-mono">{guiSession.credentials.rdpUsername}</code>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(guiSession.credentials.rdpUsername!, 'rdpUsername')}
                            >
                              {copiedField === 'rdpUsername' ? (
                                <><CheckCircle className="h-4 w-4 mr-1" /> Copied</>
                              ) : (
                                <><Copy className="h-4 w-4 mr-1" /> Copy</>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">RDP Password</p>
                              <code className="text-lg font-mono">{guiSession.credentials.rdpPassword}</code>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(guiSession.credentials.rdpPassword!, 'rdpPassword')}
                            >
                              {copiedField === 'rdpPassword' ? (
                                <><CheckCircle className="h-4 w-4 mr-1" /> Copied</>
                              ) : (
                                <><Copy className="h-4 w-4 mr-1" /> Copy</>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Container Private IP</p>
                      <code className="text-sm font-mono">{guiSession.containerPrivateIp}</code>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Button
                onClick={closeGuiSession}
                disabled={isClosing}
                variant="destructive"
                className="w-full"
              >
                {isClosing ? 'Closing...' : 'Close GUI Session'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click "Connect to Desktop" to start the GUI session</li>
            <li>Wait for the container to provision (30-60 seconds)</li>
            <li>The desktop environment will load in your browser</li>
            <li>Use your mouse and keyboard to interact with the {osType} system</li>
            <li>If prompted for credentials, switch to the "Credentials" tab</li>
            <li>Complete the challenge objectives</li>
            <li>Close the GUI session when finished to save resources</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
