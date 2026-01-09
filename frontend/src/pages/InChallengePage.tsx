import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Timer,
  Trophy,
  HelpCircle,
  LogOut,
  Server,
  ListChecks,
  BookOpen,
  RotateCw,
  Power,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Lightbulb,
  Shield,
  Zap,
  Info,
  Network,
  Activity,
  Cpu,
  Download,
  FileText,
  ArrowRight,
  GripVertical,
  Clock,
  Lock,
  Monitor,
  ArrowLeft,
} from "lucide-react";
import { Scenario, Question, SessionState } from "../types";
import { solverApi } from "../api/solverApi";
import { useStore } from "../lib/store";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
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
import { Alert, AlertDescription } from "../components/ui/alert";
import { getDifficultyColor, formatDuration, copyToClipboard, cn } from "../lib/utils";
import { SshTerminal } from "../components/SshTerminal";

// Fisher-Yates shuffle algorithm to randomize question order
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface InChallengePageProps {
  onExit: () => void;
}

export function InChallengePage({ onExit }: InChallengePageProps) {
  const { sessionId, scenarioId } = useParams<{ sessionId: string; scenarioId: string }>();
  const { currentUser, setCurrentUser, currentSession, setCurrentSession } = useStore();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [machineConnections, setMachineConnections] = useState<Record<string, any>>({});
  const [sshTerminals, setSshTerminals] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [passwordsVisible, setPasswordsVisible] = useState<Record<string, boolean>>({});
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exitMode, setExitMode] = useState<"keep" | "terminate">("keep");
  const [viewedHints, setViewedHints] = useState<Set<string>>(new Set());
  const [hintPenaltyTotal, setHintPenaltyTotal] = useState(0);

  // Add styles for mission content images
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .mission-content img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
      }
      .mission-content p {
        margin: 0.75rem 0;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!scenarioId) return;
      
      // Check if we need to load session first to determine if it's a test
      let sessionData = session;
      if (!sessionData && sessionId) {
        try {
          sessionData = await solverApi.getSession(sessionId);
          setSession(sessionData);
          setCurrentSession(sessionData);
        } catch (err) {
          toast.error("Failed to load session");
          return;
        }
      }
      
      try {
        let scenarioData;
        
        // For admin test sessions, fetch from admin API
        if (sessionData?.isTest) {
          const adminApi = await import('../api/adminApi');
          const rawData = await adminApi.adminApi.getScenarioVersionDetails(scenarioId);
          
          // Transform machines to include expected frontend fields
          const transformedMachines = (rawData.machines || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            kind: m.role === 'attacker' ? 'Attacker' : m.role === 'internal' ? 'Internal Server' : 'Server',
            access: m.entrypoints?.map((e: any) => e.protocol.toUpperCase()) || [],
            solverCanAccess: m.allowSolverEntry || false,
            icon: m.role === 'attacker' ? 'laptop' : 'server',
          }));
          
          // Transform to match expected format
          scenarioData = {
            id: rawData.id,
            title: rawData.title || "Untitled",
            shortDesc: rawData.shortDescription || "",
            author: rawData.creatorName || "Unknown",
            tags: rawData.tags || [],
            mode: "Single Player",
            type: rawData.scenarioType || "challenge",
            difficulty: rawData.difficulty || "Medium",
            durationMinutes: rawData.estimatedMinutes || 60,
            category: rawData.category || "Other",
            rating: 0,
            followers: 0,
            mission: rawData.missionText ? [{ type: 'html', content: rawData.missionText }] : [],
            rules: { codeOfEthics: rawData.codeOfEthics || "" },
            machines: transformedMachines,
            questions: rawData.questions || [],
            hints: rawData.hints || [],
            assets: rawData.assets || [],
            validationPolicy: rawData.validationMode || "instant",
            scoringPolicy: rawData.scoringMode || "allOrNothing",
            hintPolicy: rawData.hintMode || "disabled",
          };
        } else {
          // Normal flow: fetch from solver API
          scenarioData = await solverApi.getScenarioDetail(scenarioId);
        }
        
        // Normalize matching questions: convert array format to dictionary format for backend
        if (scenarioData.questions && Array.isArray(scenarioData.questions)) {
          scenarioData.questions = scenarioData.questions.map((q: any) => {
            if (q.type === 'matching' && Array.isArray(q.matchingPairs)) {
              // Convert [{id, left, right}] to {left: right}
              const pairsDict: Record<string, string> = {};
              q.matchingPairs.forEach((pair: any) => {
                pairsDict[pair.left] = pair.right;
              });
              return { ...q, matchingPairs: pairsDict };
            }
            return q;
          });
        }
        
        setScenario(scenarioData);
      } catch (err) {
        toast.error("Failed to load scenario details");
        return;
      }

      // Check if there's an existing session to resume
      if (currentSession && currentSession.scenarioId === scenarioId) {
        setSession(currentSession);
        // Extract just the submittedAnswer values from the answer metadata
        const extractedAnswers: Record<string, any> = {};
        Object.entries(currentSession.answers || {}).forEach(([qId, answerData]: [string, any]) => {
          extractedAnswers[qId] = answerData.submittedAnswer;
        });
        setAnswers(extractedAnswers);
        return;
      }

      // If sessionId provided, fetch from backend
      if (sessionId) {
        try {
          const fetched = await solverApi.getSession(sessionId);
          setSession(fetched);
          setCurrentSession(fetched);
          // Extract just the submittedAnswer values
          const extractedAnswers: Record<string, any> = {};
          Object.entries(fetched.answers || {}).forEach(([qId, answerData]: [string, any]) => {
            extractedAnswers[qId] = answerData.submittedAnswer;
          });
          setAnswers(extractedAnswers);
        } catch (err) {
          toast.error("Failed to load session");
        }
      }
    };
    loadData();
  }, [scenarioId]); // Only depend on scenarioId, not sessionId

  // Sync session state from global store
  useEffect(() => {
    if (currentSession && currentSession.scenarioId === scenarioId) {
      setSession(currentSession);
    }
  }, [currentSession, scenarioId]);

  // Timer countdown - decrement remaining time every second
  useEffect(() => {
    if (!session || session.status !== 'In Progress') return;
    const interval = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.status !== 'In Progress') return prev;
        return { ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 1) };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.status]);

  // Fetch machine connection details when session is running
  useEffect(() => {
    const fetchConnectionDetails = async () => {
      if (!sessionId || session?.status !== 'In Progress') return;
      
      try {
        const connInfo = await solverApi.getSessionConnections(sessionId);
        const connections: Record<string, any> = {};
        
        for (const machine of connInfo.machines) {
          connections[machine.machineId] = machine;
        }
        
        setMachineConnections(connections);
      } catch (error) {
        console.error('Failed to fetch connection details:', error);
      }
    };

    fetchConnectionDetails();
    
    // Poll for connection details every 10 seconds
    const interval = setInterval(fetchConnectionDetails, 10000);
    return () => clearInterval(interval);
  }, [sessionId, session?.status]);

  // Local answer checking for test sessions (no backend recording)
  const checkAnswerLocally = (question: Question, answer: any): boolean => {
    const questionType = (question as any).type; // Dynamic type from API
    
    // For shortAnswer/text/flag types - check against acceptedAnswers array
    if (questionType === 'shortAnswer' || questionType === 'text' || questionType === 'flag') {
      const acceptedAnswers = (question as any).acceptedAnswers || [(question as any).correctAnswer];
      const userAnswer = String(answer).trim().toLowerCase();
      return acceptedAnswers.some((accepted: string) => 
        String(accepted).trim().toLowerCase() === userAnswer
      );
    }
    
    const correctAnswer = (question as any).correctAnswer;
    
    if (questionType === 'single' || questionType === 'multiple-choice') {
      // For single-choice questions, find the correct option
      const options = (question as any).options || [];
      const correctOption = options.find((opt: any) => opt.isCorrect);
      return answer === correctOption?.id;
    } else if (questionType === 'multiple' || questionType === 'multiple-answer') {
      // For multiple-choice questions, check all correct options
      const options = (question as any).options || [];
      const correctOptionIds = options.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.id);
      const userAnswers = new Set(Array.isArray(answer) ? answer : [answer]);
      const correctAnswers = new Set(correctOptionIds);
      return userAnswers.size === correctAnswers.size && [...userAnswers].every(a => correctAnswers.has(a));
    } else if (questionType === 'matching') {
      const userPairs = answer as Record<string, string>;
      const matchingPairs = (question as any).matchingPairs || [];
      
      // Handle both array and object format
      if (Array.isArray(matchingPairs)) {
        return matchingPairs.every((pair: any) => userPairs[pair.left] === pair.right);
      } else {
        return Object.keys(matchingPairs).every(key => userPairs[key] === matchingPairs[key]);
      }
    } else if (questionType === 'ordering') {
      const userOrder = Array.isArray(answer) ? answer : [];
      const orderingItems = (question as any).orderingItems || [];
      
      // Check if user's order matches the correct order
      const correctOrder = orderingItems
        .sort((a: any, b: any) => a.correctOrder - b.correctOrder)
        .map((item: any) => item.id);
      
      return JSON.stringify(userOrder) === JSON.stringify(correctOrder);
    } else if (questionType === 'trueFalse') {
      return answer === correctAnswer;
    }
    return false;
  };

  const handleSubmitAnswer = async (questionId: string, question: Question) => {
    const answer = answers[questionId];
    
    // Validate answer exists and has content
    if (!answer) {
      toast.error("Please provide an answer");
      return;
    }
    
    // Additional validation for specific question types
    if ((question as any).type === 'matching') {
      const answerObj = answer as Record<string, string>;
      const matchingPairsData = (question as any).matchingPairs || {};
      const requiredPairs = Object.keys(matchingPairsData).length;
      const providedPairs = Object.keys(answerObj || {}).length;
      const filledPairs = Object.values(answerObj || {}).filter(v => v).length;
      
      if (filledPairs < requiredPairs) {
        toast.error(`Please match all ${requiredPairs} pairs`);
        return;
      }
    } else if (Array.isArray(answer) && answer.length === 0) {
      toast.error("Please provide an answer");
      return;
    } else if (typeof answer === 'object' && !Array.isArray(answer) && Object.keys(answer).length === 0) {
      toast.error("Please provide an answer");
      return;
    }

    if (!sessionId) {
      toast.error("No active session");
      return;
    }

    // TEST MODE: If this is a test session, just show correct/incorrect locally without recording
    if (session?.isTest) {
      const isCorrect = checkAnswerLocally(question, answer);
      if (isCorrect) {
        toast.success(`✓ Correct! (Test mode - not recorded)`);
      } else {
        toast.error(`✗ Incorrect (Test mode - not recorded)`);
      }
      return;
    }

    try {
      const updated = await solverApi.answerQuestion(sessionId, questionId, { answer });
      setSession(updated);
      setCurrentSession(updated);

      const solvedQuestions = Object.values(updated.answers || {}).filter((a: any) => a.correct).length;
      const progressPct = scenario ? Math.round((solvedQuestions / scenario.questions.length) * 100) : updated.progressPct;
      
      // Show better feedback
      const answerResult = updated.answers?.[questionId];
      if (answerResult?.correct) {
        toast.success(`Correct! +${answerResult.earnedPoints || 0} points`);
      } else {
        const attemptsLeft = answerResult?.remainingAttempts ?? 0;
        if (attemptsLeft > 0) {
          toast.error(`Incorrect. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`);
        } else {
          toast.error("Incorrect. No attempts remaining.");
        }
      }

      if (currentUser) {
        const updatedHistory = currentUser.history.map((h) =>
          h.scenarioId === scenarioId && h.status === "In Progress"
            ? { ...h, score: updated.score, progressPct: progressPct ?? h.progressPct }
            : h
        );
        setCurrentUser({ ...currentUser, history: updatedHistory });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to submit answer");
    }
  };

  const handleResetMachine = async (machineId: string) => {
    toast.error("Machine reset is not available in this build.");
  };

  const handleRestartMachine = async (machineId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        machinesStatus: { ...prev.machinesStatus, [machineId]: "restarting" },
      };
    });

    toast.error("Machine restart is not available in this build.");
  };

  const handleDownloadAsset = (asset: any) => {
    if (!asset.fileUrl) {
      toast.error("Download URL not available");
      return;
    }

    // Security: Validate URL is from trusted source (API proxy or allowed hosts)
    try {
      // Allow relative URLs starting with /api/ (our secure proxy)
      if (asset.fileUrl.startsWith('/api/')) {
        window.open(asset.fileUrl, '_blank', 'noopener,noreferrer');
        toast.success(`Downloading ${asset.fileName}`);
        return;
      }

      // For absolute URLs, validate against allowed hosts
      const url = new URL(asset.fileUrl);
      const allowedHosts = [
        'localhost',
        '127.0.0.1',
        's3.amazonaws.com',
        'minio',
      ];
      
      const isAllowed = allowedHosts.some(host => 
        url.hostname === host || url.hostname.endsWith(`.${host}`)
      );

      if (!isAllowed) {
        toast.error("Invalid download source");
        console.error("Blocked download from untrusted source:", url.hostname);
        return;
      }

      // Safe to download
      window.open(asset.fileUrl, '_blank', 'noopener,noreferrer');
      toast.success(`Downloading ${asset.fileName}`);
    } catch (error) {
      toast.error("Invalid download URL");
      console.error("Invalid URL:", asset.fileUrl);
    }
  };

  const handleExit = async () => {
    try {
      if (exitMode === "terminate" && sessionId) {
        await solverApi.stopSession(sessionId);
        setCurrentSession(null);

        // Reload user data from API to get updated history
        const accountApi = await import('../api/accountApi');
        const updatedUser = await accountApi.accountApi.me();
        setCurrentUser(updatedUser);
        
        toast.success("Session terminated");
      } else {
        // Resume later - don't stop session, just reload user data
        const accountApi = await import('../api/accountApi');
        const updatedUser = await accountApi.accountApi.me();
        setCurrentUser(updatedUser);
        
        toast.success("Session paused - you can resume later");
      }
    } catch (err: any) {
      console.error('Exit error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to exit session";
      toast.error(errorMessage);
    } finally {
      onExit();
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const renderMissionContent = () => {
    if (!scenario || !scenario.mission) return null;
    
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
        {(scenario.mission || []).map((block, index) => {
          // Handle both 'kind' (old) and 'type' (new API format)
          const blockType = (block as any).kind || (block as any).type;
          switch (blockType) {
            case "text":
            case "html":
              // For text/html type, render HTML content
              return (
                <div 
                  key={index} 
                  className="text-muted-foreground mission-content"
                  style={{ 
                    lineHeight: '1.6',
                  }}
                  dangerouslySetInnerHTML={{ __html: (block as any).content || "" }}
                />
              );
          }
          switch (block.kind) {
            case "heading":
              return React.createElement(`h${block.level || 1}`, { key: index }, block.text);
            case "paragraph":
              return <p key={index} className="text-muted-foreground">{block.text}</p>;
            case "image":
              return (
                <div key={index} className="space-y-2">
                  <img src={block.url} alt={block.caption || ""} className="w-full rounded-lg border" />
                  {block.caption && <p className="text-sm text-muted-foreground text-center">{block.caption}</p>}
                </div>
              );
            case "table":
              return (
                <div key={index} className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {block.table?.headers.map((header, i) => (
                          <th key={i} className="text-left p-2 font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.table?.rows.map((row, i) => (
                        <tr key={i} className="border-b">
                          {row.map((cell, j) => (
                            <td key={j} className="p-2 text-muted-foreground">{cell}</td>
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

  const renderQuestion = (question: any, index: number) => {
    const isAnswered = session?.answers[question.id]?.correct;
    const attemptInfo = session?.answers[question.id];
    const attemptsMade = attemptInfo?.attemptsMade || 0;
    const maxAttempts = question.maxAttempts || 15;
    const remainingAttempts = attemptInfo?.remainingAttempts ?? maxAttempts;
    
    // Handle both API formats
    const questionTitle = (question as any).text || question.title || `Question ${index + 1}`;
    const questionOptions = question.options || question.mcq?.options || [];
    const questionTags = question.topicTags || [];

    return (
      <Card 
        key={question.id} 
        className={`overflow-hidden border-2 transition-all duration-300 ${
          isAnswered 
            ? "border-green-500/50 bg-gradient-to-br from-green-500/5 to-transparent shadow-lg shadow-green-500/10" 
            : "border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
        }`}
      >
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white font-bold text-lg shadow-lg">
                {index + 1}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {questionTitle}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="text-primary border-primary/40 bg-primary/10 font-semibold px-3 py-1"
                    >
                      {question.points} pts
                    </Badge>
                  </div>
                </div>
                {question.body && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{question.body}</p>
                )}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {questionTags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {!isAnswered && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        attemptsMade === 0
                          ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                          : remainingAttempts === 0 
                          ? "border-red-500/50 text-red-400 bg-red-500/10" 
                          : remainingAttempts <= 1
                          ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                          : "border-blue-500/50 text-blue-400 bg-blue-500/10"
                      }`}
                    >
                      {attemptsMade === 0 
                        ? `${maxAttempts} attempt${maxAttempts !== 1 ? 's' : ''}`
                        : remainingAttempts > 0 
                        ? `${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} left`
                        : "No attempts left"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {isAnswered && (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg">
                ✓ Solved
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {(question.type === "MCQ" || question.type === "single" || question.type === "trueFalse") && questionOptions.length > 0 && (
            <div className="space-y-3">
              <RadioGroup
                value={answers[question.id]}
                onValueChange={(value) => setAnswers({ ...answers, [question.id]: value })}
                disabled={isAnswered}
              >
                {questionOptions.map((option: any, optIndex: number) => {
                  const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D
                  const isSelected = answers[question.id] === option.id;
                  
                  // For True/False questions, display True/False instead of option text
                  let displayText = option.text;
                  if (question.type === "trueFalse") {
                    displayText = optIndex === 0 ? "True" : "False";
                  }
                  
                  return (
                    <div 
                      key={option.id} 
                      className={`group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-primary bg-gradient-to-r from-primary/10 to-transparent shadow-md shadow-primary/20"
                          : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
                      } ${isAnswered ? "opacity-70 cursor-not-allowed" : ""}`}
                      onClick={() => !isAnswered && setAnswers({ ...answers, [question.id]: option.id })}
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`${question.id}-${option.id}`}
                        className="mt-0.5"
                      />
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`flex items-center justify-center size-7 rounded-lg font-semibold text-sm transition-all shrink-0 ${
                          isSelected
                            ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg"
                            : "bg-slate-200 dark:bg-muted text-slate-900 dark:text-muted-foreground group-hover:bg-primary/20"
                        }`}>
                          {optionLetter}
                        </div>
                        <Label 
                          htmlFor={`${question.id}-${option.id}`} 
                          className="flex-1 cursor-pointer text-base leading-relaxed pt-0.5"
                        >
                          {displayText}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {question.type === "shortAnswer" && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-emerald-500">Your Answer</Label>
              <Input
                placeholder="Type your answer here..."
                value={answers[question.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                disabled={isAnswered}
                className="h-11 text-base"
              />
            </div>
          )}

          {/* Multiple Choice - Select multiple options */}
          {question.type === "multiple" && questionOptions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-amber-500">Select all that apply</Label>
              <div className="space-y-2">
                {questionOptions.map((option: any, optIndex: number) => {
                  const optionLetter = String.fromCharCode(65 + optIndex);
                  const selectedOptions = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                  const isSelected = selectedOptions.includes(option.id);
                  
                  return (
                    <div
                      key={option.id}
                      className={`group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-amber-500 bg-gradient-to-r from-amber-500/10 to-transparent shadow-md shadow-amber-500/20"
                          : "border-border/50 hover:border-amber-500/40 hover:bg-amber-500/5"
                      } ${isAnswered ? "opacity-70 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (isAnswered) return;
                        const newSelected = isSelected
                          ? selectedOptions.filter((id: string) => id !== option.id)
                          : [...selectedOptions, option.id];
                        setAnswers({ ...answers, [question.id]: newSelected });
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isAnswered}
                        className="mt-0.5"
                      />
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`flex items-center justify-center size-7 rounded-lg font-semibold text-sm transition-all shrink-0 ${
                          isSelected
                            ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg"
                            : "bg-slate-200 dark:bg-muted text-slate-900 dark:text-muted-foreground group-hover:bg-amber-500/20"
                        }`}>
                          {optionLetter}
                        </div>
                        <Label
                          className="flex-1 cursor-pointer text-base leading-relaxed pt-0.5"
                        >
                          {option.text}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching - Match pairs */}
          {question.type === "matching" && question.matchingPairs && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-purple-500">Match the pairs correctly</Label>
              <div className="space-y-2">
                {Object.entries(question.matchingPairs).map(([leftText, correctRight]: [string, any], idx: number) => {
                  const userMatch = (answers[question.id] || {})[leftText];
                  
                  // Collect all right values from all pairs for the dropdown
                  const allRightValues = Object.values(question.matchingPairs);
                  
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/5 to-transparent rounded-lg border border-purple-500/20">
                      <div className="flex-1 p-2 bg-background rounded border">
                        <p className="text-sm font-medium">{leftText}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-purple-500" />
                      <select
                        value={userMatch || ""}
                        onChange={(e) => {
                          const newMatches = { ...(answers[question.id] || {}), [leftText]: e.target.value };
                          setAnswers({ ...answers, [question.id]: newMatches });
                        }}
                        disabled={isAnswered}
                        className="flex-1 p-2 bg-background rounded border border-input"
                      >
                        <option value="">Select match...</option>
                        {allRightValues.map((rightVal: string, ridx: number) => (
                          <option key={ridx} value={rightVal}>{rightVal}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ordering - Arrange items in correct order */}
          {question.type === "ordering" && question.orderingItems && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-indigo-500">Arrange items in the correct order (drag to reorder)</Label>
              <div className="space-y-2">
                {(() => {
                  // Initialize with shuffled order if no answer exists yet
                  const currentOrder = Array.isArray(answers[question.id]) 
                    ? answers[question.id] 
                    : Array.isArray(question.orderingItems) 
                    ? shuffleArray([...question.orderingItems])
                    : [];
                  
                  // Set initial answer with shuffled items if not already set and not answered
                  if (!isAnswered && !answers[question.id] && Array.isArray(question.orderingItems) && question.orderingItems.length > 0) {
                    // Use setTimeout to avoid state update during render
                    setTimeout(() => {
                      setAnswers(prev => ({
                        ...prev,
                        [question.id]: currentOrder
                      }));
                    }, 0);
                  }
                  
                  return currentOrder.map((item: any, idx: number) => {
                    const itemText = typeof item === 'string' ? item : item.text;
                    const itemId = typeof item === 'string' ? item : item.id;
                    
                    return (
                      <div
                        key={idx}
                        draggable={!isAnswered}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", idx.toString());
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          if (isAnswered) return;
                          e.preventDefault();
                          const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
                          const toIdx = idx;
                          
                          const currentItems = Array.isArray(answers[question.id]) ? answers[question.id] : Array.isArray(question.orderingItems) ? question.orderingItems : [];
                          const items = [...currentItems];
                          const [moved] = items.splice(fromIdx, 1);
                          items.splice(toIdx, 0, moved);
                          setAnswers({ ...answers, [question.id]: items });
                        }}
                        className={`flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-500/5 to-transparent rounded-lg border border-indigo-500/20 ${
                          isAnswered ? "cursor-default" : "cursor-move hover:border-indigo-500/40 hover:bg-indigo-500/10"
                        }`}
                      >
                        <GripVertical className="h-5 w-5 text-indigo-500" />
                        <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-md">
                          {idx + 1}
                        </div>
                        <p className="flex-1 text-sm font-medium">{itemText}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {!isAnswered && (
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={() => handleSubmitAnswer(question.id, question)}
                size="lg"
                className="flex-1"
              >
                Submit Answer
              </Button>
              {question.hint && scenario?.hintPolicy !== "Disabled" && (
                <Button variant="outline" size="lg" className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Hint {question.hint.penaltyPoints && `(-${question.hint.penaltyPoints} pts)`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!scenario || !session) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Test Mode Banner */}
      {session?.isTest && currentUser?.roleAdmin && (
        <Alert className="rounded-none border-t-0 border-x-0 border-b-2 border-yellow-500 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-yellow-500/10">
          <Shield className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-yellow-600">
                🔧 ADMIN TEST MODE
              </span>
              <span className="text-sm text-muted-foreground">
                Session: {sessionId?.slice(0, 12)}...
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/testing')}
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Testing
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold">{scenario.title}</h1>
                {/* Show Event Badge if this is an event challenge */}
                {session.eventId && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 gap-1">
                    <Trophy className="h-3 w-3" />
                    Event Challenge
                  </Badge>
                )}
              </div>
              <Badge className={getDifficultyColor(scenario.difficulty)} variant="outline">
                {scenario.difficulty}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className={`font-mono ${session.remainingSeconds < 300 ? "text-red-400" : ""}`}>
                {formatTime(session.remainingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="font-bold">{session.score - hintPenaltyTotal}</span>
              {hintPenaltyTotal > 0 && (
                <span className="text-xs text-red-400">(-{hintPenaltyTotal} hints)</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowExitDialog(true)}>
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="overview" className="h-full">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-6">
            <TabsTrigger value="overview" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="servers" className="gap-2">
              <Server className="h-4 w-4" />
              Environment
            </TabsTrigger>
            <TabsTrigger value="downloads" className="gap-2">
              <Download className="h-4 w-4" />
              Downloads
            </TabsTrigger>
            <TabsTrigger value="score" className="gap-2">
              <Trophy className="h-4 w-4" />
              Score
            </TabsTrigger>
            <TabsTrigger value="help" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              Help
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="space-y-6">
              <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                <CardHeader className="border-b border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    Mission Briefing
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">{renderMissionContent()}</CardContent>
              </Card>

              <Card className="overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
                <CardHeader className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    Rules & Ethics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="p-5 bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl border border-amber-500/20">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Code of Ethics
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">{scenario.rules.codeOfEthics}</p>
                  </div>
                  {scenario.rules.extraGuidance && (
                    <div className="p-5 bg-gradient-to-r from-blue-500/10 to-transparent rounded-xl border border-blue-500/20">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <span className="inline-block size-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Additional Guidance
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">{scenario.rules.extraGuidance}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Downloadable assets removed from overview - see Downloads tab */}
            </TabsContent>

            <TabsContent value="questions" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold">Questions</h2>
                  <Badge variant="outline" className="text-sm">
                    {Object.values(session.answers).filter((a: any) => a.correct).length} / {scenario.questions.length} Solved
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <Progress
                    value={(Object.values(session.answers).filter((a: any) => a.correct).length / scenario.questions.length) * 100}
                    className="w-48 h-2"
                  />
                </div>
              </div>
              {scenario.questions.map((q, index) => renderQuestion(q, index))}
            </TabsContent>

            <TabsContent value="servers" className="space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                    <Network className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Challenge Environment</h2>
                    <p className="text-sm text-muted-foreground">Isolated multi-machine cyber range environment</p>
                  </div>
                </div>
              </div>

              {/* Environment Overview Card */}
              <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                <CardHeader className="border-b border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
                  <CardTitle className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-primary" />
                    Environment Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Machines */}
                    <div className="p-4 bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl border border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Machines</p>
                          <p className="text-3xl font-bold text-blue-400">{scenario.machines.length}</p>
                        </div>
                        <Server className="h-10 w-10 text-blue-400/50" />
                      </div>
                    </div>

                    {/* Ready Status */}
                    <div className="p-4 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-green-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Ready</p>
                          <p className="text-3xl font-bold text-green-400">
                            {Object.values(session.machinesStatus).filter(s => s === "running").length}
                          </p>
                        </div>
                        <div className="size-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <div className="size-4 rounded-full bg-green-500 animate-pulse" />
                        </div>
                      </div>
                    </div>

                    {/* Machine Roles */}
                    <div className="p-4 bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl border border-purple-500/20">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Machine Roles</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            {scenario.machines.filter(m => m.role === "attacker").length} Attacker
                          </Badge>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {scenario.machines.filter(m => m.role !== "attacker").length} Internal
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scenario.machines.map((machine) => {
                  // Use live connection data if available, otherwise fall back to session state
                  const connectionData = machineConnections[machine.id];
                  const machineStatus = connectionData?.status || session.machinesStatus?.[machine.id] || "provisioning";
                  const isReady = machineStatus === "running";
                  const isProvisioning = machineStatus === "provisioning";
                  
                  // Merge scenario machine data with live connection data
                  const canAccess = connectionData?.canAccess ?? machine.solverCanAccess;
                  const credentials = connectionData?.credentials;
                  
                  return (
                    <Card key={machine.id} className="cyber-border overflow-hidden">
                      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex items-center gap-4">
                          {/* Machine Avatar with Glow Effect */}
                          <div className="relative">
                            <div className={`absolute inset-0 rounded-xl blur-xl transition-all duration-500 ${
                              isReady 
                                ? "bg-green-500/50 animate-pulse" 
                                : isProvisioning
                                ? "bg-red-500/50 animate-pulse"
                                : "bg-amber-500/50 animate-pulse"
                            }`} />
                            <div className={`relative flex items-center justify-center size-16 rounded-xl border-2 transition-all duration-500 ${
                              isReady 
                                ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 shadow-lg shadow-green-500/50" 
                                : isProvisioning
                                ? "bg-gradient-to-br from-red-500 to-rose-600 border-red-400 shadow-lg shadow-red-500/50"
                                : "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 shadow-lg shadow-amber-500/50"
                            }`}>
                              <Server className="h-8 w-8 text-white" />
                            </div>
                            {/* Status Indicator Badge */}
                            <div className={`absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-background flex items-center justify-center ${
                              isReady 
                                ? "bg-green-500" 
                                : isProvisioning
                                ? "bg-red-500 animate-pulse"
                                : "bg-amber-500 animate-pulse"
                            }`}>
                              {isReady && <span className="size-2 rounded-full bg-white" />}
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <CardTitle className="flex items-center justify-between">
                              <span>{machine.name}</span>
                              <Badge className={machine.role === "attacker" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
                                {machine.role}
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`size-2 rounded-full ${
                                isReady ? "bg-green-500" : isProvisioning ? "bg-red-500" : "bg-amber-500"
                              } animate-pulse`} />
                              <span className={`text-sm font-semibold ${
                                isReady ? "text-green-400" : isProvisioning ? "text-red-400" : "text-amber-400"
                              }`}>
                                {isReady ? "Ready" : isProvisioning ? "Provisioning..." : "Starting..."}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{machine.kind}</Badge>
                        {machine.access.map((acc, idx) => (
                          <Badge key={`${acc}-${idx}`} variant="outline">{acc}</Badge>
                        ))}
                        {canAccess ? (
                          <Badge className="bg-green-500/20 text-green-400">Accessible</Badge>
                        ) : (
                          <Badge className="bg-gray-500/20 text-gray-400">Target Only</Badge>
                        )}
                      </div>

                      {credentials && canAccess && (
                        <div className="p-3 bg-card/50 rounded-lg border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Username:</span>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-0.5 rounded text-sm">
                                {credentials.username}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  copyToClipboard(credentials.username);
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Password:</span>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-0.5 rounded text-sm">
                                {passwordsVisible[machine.id]
                                  ? credentials.password
                                  : "•".repeat(credentials.password.length)}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  setPasswordsVisible({
                                    ...passwordsVisible,
                                    [machine.id]: !passwordsVisible[machine.id],
                                  })
                                }
                              >
                                {passwordsVisible[machine.id] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  copyToClipboard(credentials.password);
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {canAccess && isReady && connectionData && (
                        <div className="space-y-3 pt-3 border-t">
                          <div className="text-sm font-medium">Connection Details</div>
                          
                          {connectionData.entrypoints
                            .filter((ep: any) => ep.exposedToSolver)
                            .map((ep: any, idx: number) => (
                              <div key={idx} className="space-y-2">
                                {/* SSH Connection */}
                                {(ep.protocol === 'ssh' || ep.containerPort === 22) && (
                                  <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">SSH Access (Port {ep.containerPort})</div>
                                    <div className="flex gap-2">
                                      <Button
                                        className="flex-1"
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                          setSshTerminals({
                                            ...sshTerminals,
                                            [machine.id]: true,
                                          });
                                        }}
                                      >
                                        <Network className="h-4 w-4 mr-2" />
                                        Open SSH Terminal
                                      </Button>
                                      {ep.sshCommand && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            navigator.clipboard.writeText(ep.sshCommand);
                                            toast.success("SSH command copied!");
                                          }}
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* VNC Connection */}
                                {(ep.protocol === 'vnc' || ep.containerPort === 5900 || ep.containerPort === 5901 || ep.containerPort === 6901) && ep.connectionUrl && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Remote Desktop (VNC - Port {ep.containerPort})</div>
                                    <Button
                                      className="w-full"
                                      variant="default"
                                      size="sm"
                                      onClick={() => {
                                        // Ensure WebSocket URL uses correct protocol
                                        let wsUrl = ep.connectionUrl;
                                        // If the connection URL starts with ws:// and page is https, upgrade to wss://
                                        if (wsUrl.startsWith('ws://') && window.location.protocol === 'https:') {
                                          wsUrl = wsUrl.replace('ws://', 'wss://');
                                        }
                                        // Pass VNC password (default or from machine credentials)
                                        const vncPassword = credentials?.password || 'vncpassword';
                                        const vncUrl = `/vnc.html?url=${encodeURIComponent(wsUrl)}&password=${encodeURIComponent(vncPassword)}`;
                                        window.open(vncUrl, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <Monitor className="h-4 w-4 mr-2" />
                                      Connect to Desktop
                                    </Button>
                                  </div>
                                )}
                                
                                {/* Web Interface */}
                                {(ep.protocol === 'http' || ep.protocol === 'https') && ep.connectionUrl && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Web Interface</div>
                                    <Button
                                      className="w-full"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(ep.connectionUrl, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      {ep.description || 'Open Web Interface'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          
                          {/* Connection Status */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                            <Activity className="h-3 w-3" />
                            <span>Status: {machineConnections[machine.id].status}</span>
                          </div>
                        </div>
                      )}

                      {/* SSH Terminal Modal */}
                      {sshTerminals[machine.id] && sessionId && machineConnections[machine.id] && (
                        <div className="mt-4">
                          <SshTerminal
                            sessionId={sessionId}
                            machineId={machine.id}
                            machineName={machine.name}
                            username={machineConnections[machine.id].credentials?.username || 'root'}
                            password={machineConnections[machine.id].credentials?.password || 'changeme'}
                            onClose={() => {
                              setSshTerminals({
                                ...sshTerminals,
                                [machine.id]: false,
                              });
                            }}
                          />
                        </div>
                      )}

                      {machine.solverCanAccess && isReady && !machineConnections[machine.id] && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          Loading connection details...
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 flex-1"
                          onClick={() => handleRestartMachine(machine.id)}
                          disabled={session.machinesStatus[machine.id] === "restarting" || !isReady}
                        >
                          <Power className="h-4 w-4" />
                          {session.machinesStatus[machine.id] === "restarting" ? "Restarting..." : "Restart"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 flex-1"
                          onClick={() => handleResetMachine(machine.id)}
                          disabled={!isReady}
                        >
                          <RotateCw className="h-4 w-4" />
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="downloads" className="space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Downloadable Assets</h2>
                    <p className="text-sm text-muted-foreground">Files and resources provided for this challenge</p>
                  </div>
                </div>
              </div>

              {scenario.assets && scenario.assets.filter((a: any) => a.assetLocation === 'downloadable').length > 0 ? (
                <div className="grid gap-4">
                  {scenario.assets
                    .filter((asset: any) => asset.assetLocation === 'downloadable')
                    .map((asset: any, index: number) => (
                      <Card key={asset.id || index} className="cyber-border hover:border-primary/50 transition-colors">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center size-12 rounded-lg bg-green-500/10 text-green-500">
                                <FileText className="h-6 w-6" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{asset.fileName}</h3>
                                {asset.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{asset.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                  {asset.fileSize && (
                                    <Badge variant="outline" className="text-xs">
                                      {(asset.fileSize / 1024).toFixed(2)} KB
                                    </Badge>
                                  )}
                                  {asset.assetType && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {asset.assetType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleDownloadAsset(asset)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Download className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-lg font-semibold mb-2">No Downloadable Assets</h3>
                    <p className="text-sm text-muted-foreground">
                      This challenge does not include any downloadable files.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">About Downloads</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        These assets are provided by the challenge creator to help you solve this challenge. 
                        Files might include tools, scripts, wordlists, configuration files, or other resources.
                        Download them to your local machine and use them as part of your penetration testing workflow.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="score" className="space-y-6">
              <div className="space-y-8">
                {/* Total Score Display */}
                <div className="flex items-center justify-between p-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl border-2 border-primary/30">
                  <div>
                    <h2 className="text-3xl font-bold">Total Score:</h2>
                    {hintPenaltyTotal > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Base Score: {session.score} | Hint Penalties: -{hintPenaltyTotal}
                      </p>
                    )}
                  </div>
                  <div className="text-6xl font-bold text-primary">{session.score - hintPenaltyTotal}</div>
                </div>

                {/* Individual Question Breakdown */}
                <div className="space-y-3">
                  {scenario.questions.map((q, index) => {
                    const earnedPoints = session.answers[q.id]?.earnedPoints || 0;
                    const isSolved = session.answers[q.id]?.correct;
                    
                    return (
                      <div 
                        key={q.id} 
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          isSolved 
                            ? "bg-gradient-to-r from-green-500/10 to-transparent border-green-500/30" 
                            : "bg-card/50 border-border/30"
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`flex items-center justify-center size-10 rounded-lg font-bold text-lg ${
                            isSolved 
                              ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {index + 1}
                          </div>
                          <span className="text-base">{q.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-bold text-lg ${
                            earnedPoints > 0 ? "text-primary" : "text-muted-foreground"
                          }`}>
                            {earnedPoints} / {q.points}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hint Penalties */}
                {hintPenaltyTotal > 0 && (
                  <div className="p-4 rounded-xl border-2 border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lightbulb className="h-5 w-5 text-red-400" />
                        <span className="font-semibold">Hint Penalties</span>
                      </div>
                      <span className="font-bold text-lg text-red-400">-{hintPenaltyTotal} points</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {viewedHints.size} hint{viewedHints.size !== 1 ? 's' : ''} viewed
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="help" className="space-y-6">
              <Card className="overflow-hidden border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
                <CardHeader className="border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    Help & Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-muted-foreground text-base">
                    Need assistance? Here are some resources to help you succeed:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Quick Tips */}
                    <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center size-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shrink-0">
                          <Lightbulb className="h-6 w-6" />
                        </div>
                        <div className="space-y-2 flex-1">
                          <h3 className="font-bold text-lg">Quick Tips</h3>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-cyan-400 mt-0.5">→</span>
                              <span>Read mission briefing carefully in Overview tab</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-cyan-400 mt-0.5">→</span>
                              <span>Check attempt limits before submitting answers</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-cyan-400 mt-0.5">→</span>
                              <span>Use hints wisely - they may deduct points</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Server Access */}
                    <div className="p-5 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center size-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shrink-0">
                          <Server className="h-6 w-6" />
                        </div>
                        <div className="space-y-2 flex-1">
                          <h3 className="font-bold text-lg">Server Access</h3>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">→</span>
                              <span>Find credentials in Servers tab</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">→</span>
                              <span>Use Restart if server becomes unresponsive</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">→</span>
                              <span>Reset will restore to original state</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Best Practices */}
                    <div className="p-5 bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center size-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shrink-0">
                          <Shield className="h-6 w-6" />
                        </div>
                        <div className="space-y-2 flex-1">
                          <h3 className="font-bold text-lg">Best Practices</h3>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">→</span>
                              <span>Follow ethical guidelines at all times</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">→</span>
                              <span>Document your findings as you progress</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">→</span>
                              <span>Monitor timer to manage your time wisely</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Scoring Info */}
                    <div className="p-5 bg-gradient-to-br from-pink-500/10 to-transparent rounded-xl border border-pink-500/20 hover:border-pink-500/40 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center size-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shrink-0">
                          <Zap className="h-6 w-6" />
                        </div>
                        <div className="space-y-2 flex-1">
                          <h3 className="font-bold text-lg">Scoring Info</h3>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-pink-400 mt-0.5">→</span>
                              <span>Each question has a point value</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-pink-400 mt-0.5">→</span>
                              <span>Wrong attempts don't lose points</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-pink-400 mt-0.5">→</span>
                              <span>Track progress in Score tab</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Important Note */}
                  <div className="mt-6 p-5 bg-gradient-to-r from-primary/10 to-transparent rounded-xl border-2 border-primary/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-primary">Need More Help?</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          If you're stuck, review the mission briefing and rules in the Overview tab. Check your progress in the Score tab to see which questions still need answers. Remember: quality over speed!
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scenario Hints */}
              {scenario?.hints && scenario.hints.length > 0 && (
                <Card className="overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
                  <CardHeader className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
                    <CardTitle className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      Scenario Hints ({scenario.hints.length})
                    </CardTitle>
                    <CardDescription>
                      Helpful tips to guide you through this challenge
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {scenario.hints.map((hint: any, index: number) => {
                      // Check if hint should be unlocked based on elapsed time
                      const sessionStartTime = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
                      const currentTime = Date.now();
                      const elapsedMinutes = Math.floor((currentTime - sessionStartTime) / (1000 * 60));
                      const isUnlocked = hint.unlockAfter === 0 || elapsedMinutes >= hint.unlockAfter;
                      const isViewed = viewedHints.has(hint.id);

                      const handleViewHint = () => {
                        if (!isViewed && hint.penaltyPoints) {
                          setHintPenaltyTotal(prev => prev + (hint.penaltyPoints || 0));
                          toast.warning(`Hint revealed! -${hint.penaltyPoints} points deducted.`);
                        }
                        setViewedHints(prev => new Set(prev).add(hint.id));
                      };

                      return (
                        <div 
                          key={hint.id || index} 
                          className={cn(
                            "p-5 rounded-xl border transition-all",
                            isUnlocked 
                              ? "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30 hover:border-amber-500/50" 
                              : "bg-gray-500/5 border-gray-500/20 opacity-60"
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={isUnlocked ? "default" : "secondary"}>
                                Hint {index + 1}
                              </Badge>
                              <h4 className="font-semibold">{hint.title || "Untitled Hint"}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              {hint.penaltyPoints > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  -{hint.penaltyPoints} pts
                                </Badge>
                              )}
                              {hint.unlockAfter > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {isUnlocked 
                                    ? "Unlocked" 
                                    : `Unlocks in ${hint.unlockAfter - elapsedMinutes} min`
                                  }
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isUnlocked ? (
                            isViewed ? (
                              hint.body ? (
                                <div 
                                  className="prose prose-sm prose-invert max-w-none text-muted-foreground"
                                  dangerouslySetInnerHTML={{ __html: hint.body }}
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No content provided</p>
                              )
                            ) : (
                              <div className="flex flex-col items-center gap-3 py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <EyeOff className="h-4 w-4" />
                                  <span>Hint not yet revealed</span>
                                </div>
                                <Button
                                  onClick={handleViewHint}
                                  className="gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  View Hint
                                  {hint.penaltyPoints > 0 && ` (-${hint.penaltyPoints} points)`}
                                </Button>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Lock className="h-4 w-4" />
                              <span>This hint will unlock after {hint.unlockAfter} minutes</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="border-2 border-primary/30 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              {session?.isTest && currentUser?.roleAdmin ? 'End Admin Test?' : 'Exit Challenge?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {session?.isTest && currentUser?.roleAdmin ? (
                // Admin-specific exit message
                <>
                  As an admin tester, you have these options:
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li><strong>Terminate Session:</strong> End test immediately and free AWS resources</li>
                    <li><strong>Return to Testing:</strong> Go back to admin testing page (session continues)</li>
                  </ul>
                </>
              ) : (
                // Regular solver exit message
                'Choose how you want to exit:'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            {session?.isTest && currentUser?.roleAdmin ? (
              // Admin test options
              <>
                <button
                  className={`group w-full p-4 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden ${
                    exitMode === "keep"
                      ? "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 bg-[length:200%_100%] shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-[1.02]"
                      : "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%] shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                  }`}
                  onClick={() => setExitMode("keep")}
                >
                  <span className="relative z-10">Return to Testing Dashboard - Session keeps running</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </button>
                
                <button
                  className={`group w-full p-4 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden ${
                    exitMode === "terminate"
                      ? "bg-gradient-to-r from-red-500 via-red-600 to-red-500 bg-[length:200%_100%] shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-[1.02]"
                      : "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%] shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                  }`}
                  onClick={() => setExitMode("terminate")}
                >
                  <span className="relative z-10">Terminate Test Session - Free AWS resources now</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </button>
              </>
            ) : (
              // Regular solver options
              <>
                <button
                  className={`group w-full p-4 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden ${
                    exitMode === "keep"
                      ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 bg-[length:200%_100%] shadow-[0_0_30px_rgba(6,182,212,0.5)] scale-[1.02]"
                      : "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%] shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                  }`}
                  onClick={() => setExitMode("keep")}
                >
                  <span className="relative z-10">Exit and Keep Running - Resume later</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </button>
                
                <button
                  className={`group w-full p-4 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden ${
                    exitMode === "terminate"
                      ? "bg-gradient-to-r from-red-500 via-red-600 to-red-500 bg-[length:200%_100%] shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-[1.02]"
                      : "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%] shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                  }`}
                  onClick={() => setExitMode("terminate")}
                >
                  <span className="relative z-10">Exit and Terminate - End session</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </button>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowExitDialog(false);
                setShowConfirmDialog(true);
              }}
              className="rounded-xl"
            >
              Next
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="border-2 border-red-500/50 bg-gradient-to-br from-card to-red-950/20 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-red-500">
              {session?.isTest && currentUser?.roleAdmin ? (
                exitMode === "keep" ? "⚠️ Confirm Return to Testing" : "⚠️ Confirm Test Termination"
              ) : (
                exitMode === "keep" ? "⚠️ Confirm Resume Later" : "⚠️ Confirm Termination"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {session?.isTest && currentUser?.roleAdmin ? (
                exitMode === "keep" ? (
                  <>
                    You'll return to the admin testing dashboard.
                    <br />
                    <strong className="text-yellow-400">The test session will continue running on AWS.</strong>
                    <br />
                    <span className="text-sm text-muted-foreground">You can resume or terminate it from the testing page.</span>
                  </>
                ) : (
                  <>
                    This will permanently end the test session and free all AWS resources.
                    <br />
                    <strong className="text-red-400">This action cannot be undone.</strong>
                  </>
                )
              ) : (
                exitMode === "keep" ? (
                  <>
                    Your challenge session will be paused and you can resume later.
                    <br />
                    <strong className="text-primary">Timer will continue when you return.</strong>
                  </>
                ) : (
                  <>
                    This will permanently end your session and you'll lose all progress.
                    <br />
                    <strong className="text-red-400">This action cannot be undone.</strong>
                  </>
                )
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowConfirmDialog(false);
                setShowExitDialog(true);
              }}
              className="rounded-xl"
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExit}
              className={`rounded-xl ${
                exitMode === "terminate" 
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700" 
                  : ""
              }`}
            >
              {exitMode === "keep" ? "Resume Later" : "Terminate Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
