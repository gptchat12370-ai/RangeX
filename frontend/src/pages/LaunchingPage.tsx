import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, Shield } from "lucide-react";
import { Scenario } from "../types";
import { solverApi } from "../api/solverApi";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { useScenarioDetail } from "../hooks/useScenarioDetail";
import { useStore } from "../lib/store";

interface LaunchingPageProps {
  progress: number;
  onComplete: (sessionId: string, scenarioId: string) => void;
  onCancel: () => void;
}

export function LaunchingPage({
  progress,
  onComplete,
  onCancel,
}: LaunchingPageProps) {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const existingSessionId = searchParams.get('sessionId'); // For existing sessions
  const isAdminTest = searchParams.get('adminTest') === 'true'; // For admin testing
  const versionIdParam = searchParams.get('versionId'); // Version ID for admin testing
  const isEventMode = eventId !== null;
  // For admin tests, don't fetch via solver API (only works for PUBLISHED scenarios)
  const { data: detail, loading: detailLoading, refetch } = useScenarioDetail(isAdminTest ? undefined : scenarioId);
  const { setCurrentSession, currentUser, setCurrentUser } = useStore();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
  const [startError, setStartError] = useState<string | null>(null);
  const [showActiveSessionDialog, setShowActiveSessionDialog] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [internalProgress, setInternalProgress] = useState(0);
  const [loadingSteps, setLoadingSteps] = useState([
    { id: 1, label: isEventMode ? "Validating event registration" : "Provisioning containers", status: "loading" as "loading" | "complete" | "pending" },
    { id: 2, label: "Configuring network topology", status: "pending" as "loading" | "complete" | "pending" },
    { id: 3, label: "Starting environment", status: "pending" as "loading" | "complete" | "pending" },
    { id: 4, label: isEventMode ? "Initializing event session" : "Preparing challenge environment", status: "pending" as "loading" | "complete" | "pending" },
  ]);

  useEffect(() => {
    if (!detail) return;
    setScenario({
      id: detail.id,
      title: detail.title || detail.name || "Untitled",
      shortDesc: detail.shortDescription || "",
      author: detail.author || "Unknown",
      tags: detail.tags || [],
      mode: detail.mode || "Single Player",
      type: detail.scenarioType || "Cyber Challenge",
      difficulty: detail.difficulty || "Medium",
      durationMinutes: detail.durationMinutes || detail.estimatedMinutes || 60,
      category: detail.category || "Other",
      rating: detail.rating || 0,
      followers: detail.followers || 0,
      mission: detail.mission || [],
      rules: detail.rules || { codeOfEthics: "" },
      machines: detail.machines || [],
      questions: detail.questions || [],
      assets: detail.assets || [],
      validationPolicy: detail.validationPolicy || "OnSubmit",
      scoringPolicy: detail.scoringPolicy || "AllOrNothing",
      hintPolicy: detail.hintPolicy || "Disabled",
    });
  }, [detail]);

  // Fetch scenario details for admin test mode
  useEffect(() => {
    if (isAdminTest && versionIdParam && !scenario) {
      const fetchAdminScenario = async () => {
        try {
          const adminApi = await import('../api/adminApi');
          const versionDetails = await adminApi.adminApi.getScenarioVersionDetails(versionIdParam);
          
          setScenario({
            id: versionDetails.id,
            title: versionDetails.title || "Untitled",
            shortDesc: versionDetails.shortDescription || "",
            author: versionDetails.creatorName || "Unknown",
            tags: versionDetails.tags || [],
            mode: "Single Player",
            type: versionDetails.scenarioType || "challenge",
            difficulty: versionDetails.difficulty || "Medium",
            durationMinutes: versionDetails.estimatedMinutes || 60,
            category: versionDetails.category || "Other",
            rating: 0,
            followers: 0,
            mission: versionDetails.missionText ? [{ type: 'html', content: versionDetails.missionText }] : [],
            rules: { codeOfEthics: versionDetails.codeOfEthics || "" },
            machines: versionDetails.machines || [],
            questions: versionDetails.questions || [],
            assets: [],
            validationPolicy: versionDetails.validationMode || "instant",
            scoringPolicy: versionDetails.scoringMode || "allOrNothing",
            hintPolicy: versionDetails.hintMode || "disabled",
          });
        } catch (error) {
          console.error('Failed to fetch admin scenario details:', error);
          setStartError('Failed to load scenario details');
        }
      };
      fetchAdminScenario();
    }
  }, [isAdminTest, versionIdParam, scenario]);

  useEffect(() => {
    const startEnvironment = async () => {
      if (!scenarioId) return;
      
      // If we already have a sessionId (from query param), skip session creation
      if (existingSessionId) {
        try {
          const session = await solverApi.getSession(existingSessionId);
          setCurrentSession(session);
          
          // Reload user data from API to get fresh history
          const accountApi = await import('../api/accountApi');
          const updatedUser = await accountApi.accountApi.me();
          setCurrentUser(updatedUser);
        } catch (err: any) {
          setStartError('Failed to load test session');
        }
        refetch();
        return;
      }

      // If admin test mode, call admin API to start test
      if (isAdminTest && versionIdParam) {
        try {
          const adminApi = await import('../api/adminApi');
          const result = await adminApi.adminApi.startAdminTest(versionIdParam);
          setSessionId(result.sessionId);
          
          try {
            const session = await solverApi.getSession(result.sessionId);
            setCurrentSession(session);
            
            // Reload user data
            const accountApi = await import('../api/accountApi');
            const updatedUser = await accountApi.accountApi.me();
            setCurrentUser(updatedUser);
          } catch {
            // Continue even if session fetch fails
          }
        } catch (err: any) {
          const message = err?.response?.data?.message || err?.message || '';
          setStartError(message || 'Failed to start test session');
        }
        refetch();
        return;
      }
      
      // Normal flow: create new session for solver
      try {
        const options: any = {};
        if (eventId) {
          options.eventId = eventId;
        }
        const res = await solverApi.startScenario(scenarioId, options);
        setSessionId(res.sessionId);
        try {
          const session = await solverApi.getSession(res.sessionId);
          setCurrentSession(session);
          
          // Reload user data from API to get fresh history
          const accountApi = await import('../api/accountApi');
          const updatedUser = await accountApi.accountApi.me();
          setCurrentUser(updatedUser);
        } catch {
          // if session fetch fails, continue with sessionId only
        }
        refetch();
      } catch (err: any) {
        const code = err?.code || err?.response?.data?.code;
        const message = err?.response?.data?.message || err?.message || '';
        
        // Check if it's a duplicate session error
        if (message.includes('already have an active session')) {
          setShowActiveSessionDialog(true);
          setStartError(message);
        } else if (message.includes('must be registered') || message.includes('Not registered')) {
          // Event registration error
          setStartError('You must be registered for this event to compete. Please register first.');
        } else if (code === "BUDGET_EXCEEDED") {
          setStartError("Budget exceeded. Please contact admin.");
        } else {
          setStartError(message || 'Unable to start environment.');
        }
      }
    };
    startEnvironment();
  }, [scenarioId]); // Fixed: removed refetch and scenario from dependencies to prevent duplicate API calls

  // Simulate progress when sessionId is set (for event mode and admin test mode)
  useEffect(() => {
    if (!sessionId) return;
    
    setInternalProgress(0);
    let localProgress = 0;
    const interval = setInterval(() => {
      localProgress += Math.random() * 15;
      if (localProgress >= 100) {
        localProgress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setInternalProgress(100);
        }, 500);
      } else {
        setInternalProgress(localProgress);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [sessionId]);

  // Use internal progress when in event mode or admin test mode, otherwise use prop progress
  const effectiveProgress = (eventId || isAdminTest) ? internalProgress : progress;

  useEffect(() => {
    // Update loading steps based on effective progress
    if (effectiveProgress < 25) {
      setLoadingSteps((prev) => [
        { ...prev[0], status: "loading" },
        { ...prev[1], status: "pending" },
        { ...prev[2], status: "pending" },
        { ...prev[3], status: "pending" },
      ]);
    } else if (effectiveProgress < 50) {
      setLoadingSteps((prev) => [
        { ...prev[0], status: "complete" },
        { ...prev[1], status: "loading" },
        { ...prev[2], status: "pending" },
        { ...prev[3], status: "pending" },
      ]);
    } else if (effectiveProgress < 75) {
      setLoadingSteps((prev) => [
        { ...prev[0], status: "complete" },
        { ...prev[1], status: "complete" },
        { ...prev[2], status: "loading" },
        { ...prev[3], status: "pending" },
      ]);
    } else if (effectiveProgress < 100) {
      setLoadingSteps((prev) => [
        { ...prev[0], status: "complete" },
        { ...prev[1], status: "complete" },
        { ...prev[2], status: "complete" },
        { ...prev[3], status: "loading" },
      ]);
    } else if (effectiveProgress === 100) {
      setLoadingSteps((prev) => [
        { ...prev[0], status: "complete" },
        { ...prev[1], status: "complete" },
        { ...prev[2], status: "complete" },
        { ...prev[3], status: "complete" },
      ]);
      // Show ready modal after a short delay
      setTimeout(() => {
        setShowReadyModal(true);
      }, 500);
    }
  }, [effectiveProgress]);

  const renderMissionContent = () => {
    if (!scenario) return null;

    // Handle mission as string (HTML content)
    if (typeof scenario.mission === 'string') {
      return (
        <div 
          className="text-muted-foreground mission-content"
          style={{ 
            lineHeight: '1.6',
          }}
          dangerouslySetInnerHTML={{ __html: scenario.mission }}
        />
      );
    }

    // Legacy: Handle mission as array of blocks
    return (
      <div className="space-y-6">
        {scenario.mission.map((block, index) => {
          switch (block.kind) {
            case "heading":
              return React.createElement(`h${block.level || 1}`, { key: index }, block.text);
            case "paragraph":
              return (
                <p key={index} className="text-muted-foreground">
                  {block.text}
                </p>
              );
            case "image":
              return (
                <div key={index} className="space-y-2">
                  <img
                    src={block.url}
                    alt={block.caption || "Mission image"}
                    className="w-full rounded-lg border"
                  />
                  {block.caption && (
                    <p className="text-sm text-muted-foreground text-center">{block.caption}</p>
                  )}
                </div>
              );
            case "table":
              return (
                <div key={index} className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {block.table?.headers.map((header, i) => (
                          <th key={i} className="text-left p-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.table?.rows.map((row, i) => (
                        <tr key={i} className="border-b">
                          {row.map((cell, j) => (
                            <td key={j} className="p-2 text-muted-foreground">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  if (startError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{startError}</p>
          <Button onClick={onCancel} variant="outline">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress Bar */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold">
              {effectiveProgress < 100 ? "Loading Environment..." : "Environment Ready"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {Math.round(effectiveProgress)}% · {effectiveProgress < 100 ? `${Math.round((100 - effectiveProgress) / 10)}s remaining` : "Complete"}
            </span>
          </div>
          <Progress value={effectiveProgress} className="h-2" />

          {/* Loading Steps */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {loadingSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-sm">
                {step.status === "loading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {step.status === "complete" && (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                )}
                {step.status === "pending" && (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={step.status === "complete" ? "text-muted-foreground" : ""}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Show loading skeleton if scenario not yet loaded */}
      {!scenario ? (
        <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : (
        <>
      {/* Content Tabs */}
      <div className="container mx-auto px-6 py-8">
        {startError && (
          <div className="mb-4 p-4 rounded border border-red-400/50 bg-red-500/10 text-red-200">
            {startError}
          </div>
        )}
        <Tabs defaultValue="mission" className="space-y-6">
          <TabsList className="grid w-full md:w-96 grid-cols-3">
            <TabsTrigger value="mission">Mission</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="mission" className="space-y-6">
            <Card className="cyber-border">
              <CardContent className="p-6">
                {renderMissionContent()}
              </CardContent>
            </Card>
            
            {/* Code of Ethics */}
            {scenario?.rules?.codeOfEthics && (
              <Card className="cyber-border border-yellow-600/30 bg-yellow-600/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-yellow-600 mt-1 flex-shrink-0" />
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">Code of Ethics</h3>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">
                        {scenario.rules.codeOfEthics}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Learning Outcomes */}
            {scenario?.rules?.learningOutcomes && (
              <Card className="cyber-border border-blue-600/30 bg-blue-600/5">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">🎯 What You Will Learn</h3>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">
                      {scenario.rules.learningOutcomes}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            <Card className="cyber-border">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-bold mb-2">Code of Ethics</h3>
                  <p className="text-muted-foreground">{scenario.rules.codeOfEthics}</p>
                </div>
                {scenario.rules.extraGuidance && (
                  <div>
                    <h3 className="font-bold mb-2">Additional Guidance</h3>
                    <p className="text-muted-foreground">{scenario.rules.extraGuidance}</p>
                  </div>
                )}
                {scenario.labCredentials && (
                  <div className="p-4 bg-card/50 rounded-lg border">
                    <h3 className="font-bold mb-2">Lab Credentials</h3>
                    <div className="space-y-1 text-sm">
                      {scenario.labCredentials.username && (
                        <p>
                          <span className="text-muted-foreground">Username:</span>{" "}
                          <code className="bg-muted px-2 py-0.5 rounded">
                            {scenario.labCredentials.username}
                          </code>
                        </p>
                      )}
                      {scenario.labCredentials.password && (
                        <p>
                          <span className="text-muted-foreground">Password:</span>{" "}
                          <code className="bg-muted px-2 py-0.5 rounded">
                            {scenario.labCredentials.password}
                          </code>
                        </p>
                      )}
                      {scenario.labCredentials.notes && (
                        <p className="text-muted-foreground">{scenario.labCredentials.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <Card className="cyber-border">
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground py-8">
                  Leaderboard will be available once you start the challenge
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {effectiveProgress === 100 && sessionId && (
            <Button
              size="lg"
              className="ml-4 gap-2"
              onClick={async () => {
                // Skip refetch for admin test mode (scenario already loaded from admin API)
                if (!isAdminTest) {
                  await refetch();
                }
                // Use versionId for admin tests, scenarioId for normal flow
                const targetId = isAdminTest ? versionIdParam : scenarioId;
                onComplete(sessionId, targetId!);
              }}
            >
              Start Challenge
            </Button>
          )}
        </div>
      </div>

      {/* Ready Modal */}
      <Dialog open={showReadyModal} onOpenChange={setShowReadyModal}>
        <DialogContent className="cyber-border">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Environment Ready!</DialogTitle>
            <DialogDescription className="text-center">
              Your challenge environment has been successfully provisioned and is ready to use.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={async () => {
                if (!sessionId) return;
                // Skip refetch for admin test mode (scenario already loaded from admin API)
                if (!isAdminTest) {
                  await refetch();
                }
                // Use versionId for admin tests, scenarioId for normal flow
                const targetId = isAdminTest ? versionIdParam : scenarioId;
                onComplete(sessionId, targetId!);
              }}
              disabled={!sessionId}
            >
              Start Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Session Dialog */}
      <Dialog open={showActiveSessionDialog} onOpenChange={setShowActiveSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Active Session Detected</DialogTitle>
            <DialogDescription>
              {startError || 'You already have an active session for this scenario. Please terminate the existing session before starting a new one.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowActiveSessionDialog(false);
              onCancel();
            }}>
              Go Back
            </Button>
            <Button onClick={() => {
              setShowActiveSessionDialog(false);
              // Navigate to the active session
              if (scenarioId) {
                window.location.href = `/challenges/${scenarioId}`;
              }
            }}>
              View Active Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
