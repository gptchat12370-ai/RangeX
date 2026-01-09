import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Target,
  Award,
  Clock,
  ArrowRight,
  Play,
  Timer,
  XCircle,
  Trophy,
} from "lucide-react";
import { useStore } from "../lib/store";
import { getAssetUrl } from "../utils/assetUrl";
import { Scenario } from "../types";
import { solverApi } from "../api/solverApi";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { ScenarioCard } from "../components/ScenarioCard";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";

interface DashboardProps {
  onStartScenario: (scenarioId: string) => void;
  onViewScenario: (scenarioId: string) => void;
  onContinueScenario?: (scenarioId: string, sessionId: string) => void;
}

export function Dashboard({ onStartScenario, onViewScenario, onContinueScenario }: DashboardProps) {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, currentSession, setCurrentSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [, forceUpdate] = useState({});

  // Helper to check if scenario has running session (excludes event sessions AND test sessions)
  const hasRunningSession = (scenarioId: string) => {
    if (!currentUser?.history) return false;
    // Check for running session that is NOT an event session or test session
    return currentUser.history.some(h => 
      h.scenarioId === scenarioId && 
      h.status === "In Progress" &&
      !(h as any).eventId &&  // Exclude event sessions
      !(h as any).isTest      // Exclude admin test sessions
    );
  };

  // Calculate actual in-progress count (exclude event and test sessions)
  const inProgressCount = currentUser?.history?.filter(h => 
    h.status === "In Progress" && 
    !(h as any).eventId && 
    !(h as any).isTest
  ).length || 0;

  // Get user's primary role for display
  const getUserRole = () => {
    if (!currentUser) return null;
    if (currentUser.roleAdmin) return { label: 'Admin', color: 'text-red-400 border-red-500/30 bg-red-500/10' };
    if (currentUser.roleCreator) return { label: 'Creator', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
    if (currentUser.roleSolver) return { label: 'Solver', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
    return null;
  };

  // Reload user data to get fresh history on mount
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const accountApi = await import('../api/accountApi');
        const updatedUser = await accountApi.accountApi.me();
        setCurrentUser(updatedUser);
      } catch (err) {
        console.error('Failed to refresh user data:', err);
      }
    };
    if (currentUser) {
      refreshUserData();
    }
  }, [setCurrentUser]);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  // Force re-render every second to update timer display
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if no user
  if (!currentUser) {
    return null;
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await solverApi.listScenarios();
        const mapped: Scenario[] = (data || []).map((s: any) => ({
          id: s.id,
          scenarioId: s.scenarioId,
          title: s.title || s.name || "Untitled",
          shortDesc: s.shortDescription || s.description || "",
          coverImageUrl: s.coverImageUrl,
          author: s.author || "Unknown",
          tags: s.tags || [],
          mode: s.mode || "Single Player",
          type: s.scenarioType || s.type || "Cyber Challenge",
          difficulty: (s.difficulty as any) || "Easy",
          durationMinutes: s.estimatedMinutes || 60,
          category: s.category || "Other",
          rating: s.averageRating || 0,
          averageRating: s.averageRating,
          totalRatings: s.totalRatings,
          followers: s.followers || 0,
          mission: [],
          rules: { codeOfEthics: "" },
          machines: s.machines || [],
          questions: s.questions || [],
          validationPolicy: "OnSubmit",
          scoringPolicy: "AllOrNothing",
          hintPolicy: "Disabled",
        }));
        setScenarios(mapped);
      } catch (err) {
        console.error("Failed to load scenarios", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const recommendedScenarios = scenarios.slice(0, 3);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="text-primary">{currentUser.displayName || 'User'}</span>!
          </h1>
          {/* Show role based on priority: Admin > Creator > Solver */}
          {currentUser.roleAdmin && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold border text-red-400 border-red-500/30 bg-red-500/10">
              Admin
            </span>
          )}
          {!currentUser.roleAdmin && currentUser.roleCreator && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold border text-purple-400 border-purple-500/30 bg-purple-500/10">
              Creator
            </span>
          )}
          {!currentUser.roleAdmin && !currentUser.roleCreator && currentUser.roleSolver && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold border text-blue-400 border-blue-500/30 bg-blue-500/10">
              Solver
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          Continue your cybersecurity journey and level up your skills.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Points</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{currentUser.pointsTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">+120</span> this week
            </p>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Challenges</CardTitle>
            <Target className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser.history.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {inProgressCount > 0 ? (
                <><span className="text-accent">{inProgressCount}</span> in progress</>
              ) : (
                <span className="text-green-400">{currentUser.challengesCompleted || 0} completed</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Badges Earned</CardTitle>
            <Award className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser.badges.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentUser.badges.length > 0 && (
                <>Latest: {currentUser.badges[currentUser.badges.length - 1].name}</>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Event Sessions */}
      {currentUser.history.some((h: any) => h.status === "In Progress" && h.eventId) && (
        <Card className="cyber-border cyber-glow border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Active Event Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser.history
              .filter((h: any) => h.status === "In Progress" && h.eventId)
              .map((eventHistory: any) => (
                <div
                  key={eventHistory.sessionId}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{eventHistory.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Event Challenge · {eventHistory.score || 0} points earned
                    </p>
                    {eventHistory.remainingSeconds && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Time remaining: {Math.floor(eventHistory.remainingSeconds / 60)}m
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        // Navigate to event page to continue
                        navigate(`/events/${eventHistory.eventId}`);
                      }}
                    >
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await solverApi.stopSession(eventHistory.sessionId);
                          toast.success('Event session terminated');
                          // Refresh user data
                          const accountApi = await import('../api/accountApi');
                          const updatedUser = await accountApi.accountApi.me();
                          setCurrentUser(updatedUser);
                        } catch (error) {
                          toast.error('Failed to terminate session');
                        }
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Running Challenge */}
      {inProgressCount > 0 && (() => {
        // Check if any in-progress session is an event session
        // Now check history directly since it includes eventId from backend
        const inProgressHistory = currentUser.history.filter(h => 
          h.status === "In Progress" && 
          !(h as any).eventId && 
          !(h as any).isTest  // Also exclude test sessions
        );
        const hasEventSession = inProgressHistory.some((h: any) => h.eventId);
        
        console.log('[Dashboard] hasEventSession check:', { 
          hasEventSession, 
          inProgressHistory,
          currentSessionEventId: currentSession?.eventId 
        });
        
        return !hasEventSession;
      })() && (
        <Card className="cyber-border cyber-glow border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary animate-pulse" />
              Running Challenge{inProgressCount > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser.history
              .filter((h) => h.status === "In Progress")
              .filter((h: any) => !h.eventId && !h.isTest) // Filter out event and test sessions
              .slice(0, 1)
              .map((history) => {
                console.log("[Dashboard] Running challenge history:", history);
                console.log("[Dashboard] Current session:", currentSession);
                
                const timeLeft = currentSession?.scenarioId === history.scenarioId 
                  ? currentSession.remainingSeconds 
                  : null;
                
                console.log("Time left:", timeLeft);
                
                const formatTime = (seconds: number) => {
                  const hours = Math.floor(seconds / 3600);
                  const mins = Math.floor((seconds % 3600) / 60);
                  const secs = seconds % 60;
                  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
                };
                
                return (
                  <DashboardRunningChallenge 
                    key={history.scenarioId}
                    history={history}
                    timeLeft={timeLeft}
                    formatTime={formatTime}
                    onContinue={() => {
                      // Navigate directly to challenge if session exists
                      if (currentSession && currentSession.scenarioId === history.scenarioId) {
                        navigate(`/in-challenge/${currentSession.id}/${history.scenarioId}`);
                      } else {
                        onStartScenario(history.scenarioId);
                      }
                    }}
                  />
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Continue Session */}
      {currentUser.history.length > 0 && currentUser.history.filter((h) => h.status === "In Progress").length === 0 && (
        <Card className="cyber-border cyber-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Continue Where You Left Off
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser.history
              .filter((h) => h.status === "In Progress")
              .slice(0, 1)
              .map((history) => (
                <div
                  key={history.scenarioId}
                  className="flex items-center justify-between p-4 bg-card/50 rounded-lg border"
                >
                  <div className="flex-1 space-y-2">
                    <h3 className="font-bold">{history.title}</h3>
                    <p className="text-sm text-muted-foreground">by {history.owner}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-primary">{history.progressPct}%</span>
                      </div>
                      <Progress value={history.progressPct} className="h-2" />
                    </div>
                  </div>
                  <Button
                    className="ml-4 gap-2"
                    onClick={() => onStartScenario(history.scenarioId)}
                  >
                    <Play className="h-4 w-4" />
                    Continue
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Recommended Challenges */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Recommended for You</h2>
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/challenges")}>
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                onStart={onStartScenario}
                onView={onViewScenario}
                hasRunningSession={hasRunningSession(scenario.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Badges */}
      {currentUser.badges.length > 0 && (
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              Recent Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentUser.badges.slice(-2).map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-3 p-3 bg-card/50 rounded-lg border"
                >
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">{badge.name}</h4>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DashboardRunningChallengeProps {
  history: {
    scenarioId: string;
    title: string;
    owner: string;
    progressPct: number;
    status: string;
  };
  timeLeft: number | null;
  formatTime: (seconds: number) => string;
  onContinue: () => void;
}

function DashboardRunningChallenge({ history, timeLeft, formatTime, onContinue }: DashboardRunningChallengeProps) {
  const { currentUser, setCurrentUser, currentSession, setCurrentSession } = useStore();
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [scenario, setScenario] = useState<any>(null);

  // Load scenario details to get cover image
  useEffect(() => {
    const loadScenario = async () => {
      try {
        const data = await solverApi.listScenarios();
        const found = data.find((s: any) => s.id === history.scenarioId);
        if (found) {
          // Use coverImageUrl from API response directly
          setScenario({ ...found, coverImageUrl: found.coverImageUrl });
        }
      } catch (error) {
        console.error('Failed to load scenario:', error);
      }
    };
    loadScenario();
  }, [history.scenarioId]);

  const handleTerminate = async () => {
    try {
      // Find session ID from history - use sessionId if available, otherwise try matching currentSession
      const sessionId = history.sessionId || (currentSession?.scenarioId === history.scenarioId ? currentSession.id : null);
      
      if (!sessionId) {
        toast.error("Could not find session to terminate");
        return;
      }
      
      await solverApi.stopSession(sessionId);
      
      // Clear the session from store if it matches
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      
      // Reload user data from API to get updated history
      const accountApi = await import('../api/accountApi');
      const updatedUser = await accountApi.accountApi.me();
      setCurrentUser(updatedUser);
      
      toast.success("Session terminated successfully");
      setShowTerminateDialog(false);
    } catch (error) {
      console.error('Terminate error:', error);
      toast.error("Failed to terminate session");
    }
  };

  return (
    <>
      <div
        key={history.scenarioId}
        className="relative flex items-center justify-between p-6 rounded-lg border-2 border-primary/30 overflow-hidden min-h-[200px]"
      >
        {/* Background Cover Image */}
        {scenario?.coverImageUrl && (
          <div 
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `url(${getAssetUrl(scenario.coverImageUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(4px)'
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/98 to-background/90" />
        <div className="relative flex-1 space-y-3 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xl">{history.title}</h3>
              {/* Show Event Badge if this is an event challenge */}
              {currentSession?.eventId && currentSession.scenarioId === history.scenarioId && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 gap-1">
                  <Trophy className="h-3 w-3" />
                  Event
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">by {history.owner}</p>
            {history.score !== undefined && history.score !== null && history.score > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-primary">
                  Current Score: {history.score} pts
                </span>
              </div>
            )}
          </div>
          
          {/* Progress Bar with Line to 100% */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Progress to Completion</span>
              <span className="font-bold text-lg" style={{
                color: history.progressPct >= 75 ? 'rgb(34, 197, 94)' : 
                       history.progressPct >= 50 ? 'rgb(234, 179, 8)' : 
                       history.progressPct >= 25 ? 'rgb(59, 130, 246)' : 
                       'rgb(148, 163, 184)'
              }}>
                {history.progressPct}%
              </span>
            </div>
            <div className="relative">
              <div className="h-3 w-full bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 ease-out rounded-full"
                  style={{
                    width: `${history.progressPct}%`,
                    background: history.progressPct >= 75 
                      ? 'linear-gradient(to right, rgb(34, 197, 94), rgb(74, 222, 128))'
                      : history.progressPct >= 50
                      ? 'linear-gradient(to right, rgb(234, 179, 8), rgb(250, 204, 21))'
                      : history.progressPct >= 25
                      ? 'linear-gradient(to right, rgb(59, 130, 246), rgb(96, 165, 250))'
                      : 'linear-gradient(to right, rgb(148, 163, 184), rgb(203, 213, 225))'
                  }}
                />
              </div>
              {/* Goal marker at 100% */}
              <div className="absolute right-0 top-0 flex flex-col items-center -translate-y-7">
                <div className="text-xs font-bold text-green-400 mb-1 px-1.5 py-0.5 bg-background/80 rounded">Goal</div>
                <div className="w-0.5 h-10 bg-green-400/60" />
              </div>
            </div>
          </div>

          {timeLeft !== null && (
            <div className="flex items-center gap-2 bg-card/50 px-3 py-2 rounded-md border border-primary/30">
              <Timer className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Time Remaining:</span>
              <span className={`font-mono text-sm font-bold ${timeLeft < 300 ? "text-red-400" : "text-primary"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>
        <div className="relative flex flex-col gap-3 ml-6 z-10">
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
            onClick={onContinue}
          >
            <Play className="h-5 w-5" />
            Continue
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500"
            onClick={() => setShowTerminateDialog(true)}
          >
            <XCircle className="h-4 w-4" />
            Terminate
          </Button>
        </div>
      </div>

      {/* Terminate Confirmation Dialog */}
      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <AlertDialogContent className="border-2 border-red-500/50 bg-gradient-to-br from-card to-red-950/20 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-red-500 flex items-center gap-2">
              <XCircle className="h-6 w-6" />
              Terminate Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-2">
              <p>This will permanently end your challenge session.</p>
              <p className="text-red-400 font-semibold">⚠️ All progress and answers will be lost. This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleTerminate}
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            >
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
