import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Play, Server, Clock, AlertCircle, ExternalLink, Power, Activity, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { adminApi } from "../../api/adminApi";
import { toast } from "sonner";
import { getDifficultyColor } from "../../lib/utils";

interface TestScenario {
  id: string;
  scenarioId: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  category: string;
  tags: string[];
  estimatedMinutes: number;
  versionNumber: number;
  status: string;
  machines: any[];
}

interface ActiveTestSession {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  versionId: string;
  startedAt: string;
  status: string;
}

export function AdminTestingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [filteredScenarios, setFilteredScenarios] = useState<TestScenario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [testingScenarioId, setTestingScenarioId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveTestSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [existingTestSessions, setExistingTestSessions] = useState<Record<string, string>>({});

  useEffect(() => {
    loadScenarios();
    loadActiveSessions();
    
    // Refresh active sessions every 10 seconds
    const interval = setInterval(loadActiveSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterScenarios();
  }, [scenarios, searchTerm, difficultyFilter, categoryFilter]);

  const loadActiveSessions = async () => {
    setSessionsLoading(true);
    try {
      const sessions = await adminApi.getActiveTestSessions();
      setActiveSessions(sessions || []);
      
      // Build map of scenarioId -> sessionId for "Continue" buttons
      const sessionsMap: Record<string, string> = {};
      (sessions || []).forEach(s => {
        if (s.scenarioId) {
          sessionsMap[s.scenarioId] = s.id;
        }
      });
      setExistingTestSessions(sessionsMap);
    } catch (err: any) {
      console.error("Failed to load active sessions", err);
      // Don't show error toast for auto-refresh failures
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string, scenarioTitle: string) => {
    if (!confirm(`Terminate test session for "${scenarioTitle}"?\n\nThis will free AWS resources immediately.`)) {
      return;
    }
    
    try {
      await adminApi.terminateSession(sessionId);
      toast.success('Test session terminated');
      await loadActiveSessions();
      await loadScenarios();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to terminate session');
    }
  };

  const loadScenarios = async () => {
    setLoading(true);
    try {
      // Load APPROVED scenarios (ready for testing, not yet published)
      const approved = await adminApi.listTestingScenarios();
      // Filter to only show scenarios with machines (exclude questions-only scenarios)
      const withMachines = approved.filter((s: any) => s.machines && s.machines.length > 0);
      setScenarios(withMachines);
    } catch (err: any) {
      console.error("Failed to load scenarios", err);
      toast.error(err?.response?.data?.message || "Failed to load scenarios");
    } finally {
      setLoading(false);
    }
  };

  const filterScenarios = () => {
    let filtered = [...scenarios];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.shortDescription.toLowerCase().includes(term) ||
          s.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    // Difficulty filter
    if (difficultyFilter !== "all") {
      filtered = filtered.filter((s) => s.difficulty === difficultyFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    setFilteredScenarios(filtered);
  };

  const handleStartTest = async (scenario: TestScenario) => {
    // Prevent duplicate submissions
    if (testingScenarioId) {
      toast.warning('Please wait for the current test to start');
      return;
    }

    setTestingScenarioId(scenario.id);
    toast.info('Starting test session...');
    
    // Navigate immediately to launching page with version ID
    // The launching page will create the session using the versionId
    navigate(`/launching/${scenario.scenarioId}?adminTest=true&versionId=${scenario.id}`);
  };

  const handlePublish = async (scenarioId: string, title: string) => {
    if (!confirm(`Publish "${title}" to make it available to solvers?\n\nThis will mark it as PUBLISHED and allow users to play it.`)) {
      return;
    }

    try {
      await adminApi.publishScenario(scenarioId);
      toast.success(`Scenario "${title}" published successfully!`);
      await loadScenarios(); // Reload to update status
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to publish scenario');
    }
  };

  const categories = [...new Set(scenarios.map((s) => s.category))];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Admin Testing Lab
          </h1>
          <p className="text-muted-foreground">
            Test approved scenarios in isolated AWS environments before release
          </p>
        </div>
        <Button onClick={loadScenarios} variant="outline">
          <Server className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-500/10 border-blue-500/50">
        <AlertCircle className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-400">
          <strong>Admin Testing:</strong> Each test deploys the scenario to AWS (3-5 min), validates
          machines and networking, then provides SSH access for hands-on verification. Sessions
          auto-terminate after 30 minutes.
        </AlertDescription>
      </Alert>

      {/* Active Test Sessions Card */}
      {activeSessions.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-yellow-500" />
                  Active Test Sessions
                </CardTitle>
                <CardDescription>Your currently running test sessions</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                {activeSessions.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-semibold">{session.scenarioTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    Session: {session.id.slice(0, 8)}... | Started: {new Date(session.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/in-challenge/${session.id}/${session.versionId}`)}
                    className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Resume Test
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleTerminateSession(session.id, session.scenarioTitle)}
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Terminate
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search scenarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Difficulty Filter */}
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
                <SelectItem value="Insane">Insane</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredScenarios.length} of {scenarios.length} scenarios
      </div>

      {/* Scenarios Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="cyber-border">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredScenarios.length === 0 ? (
        <Card className="cyber-border">
          <CardContent className="py-16 text-center">
            <Server className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm || difficultyFilter !== "all" || categoryFilter !== "all"
                ? "No scenarios match your filters"
                : "No approved scenarios available for testing"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <Card key={scenario.id} className="cyber-border hover:border-primary/50 transition-all group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">
                      {scenario.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">v{scenario.versionNumber}</p>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 mt-2">
                  {scenario.shortDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={getDifficultyColor(scenario.difficulty)}>
                    {scenario.difficulty}
                  </Badge>
                  <Badge variant="secondary">{scenario.category}</Badge>
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {scenario.estimatedMinutes}m
                  </Badge>
                </div>

                {/* Machines */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Server className="h-4 w-4" />
                  <span>{scenario.machines?.length || 0} machine{scenario.machines?.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Tags */}
                {scenario.tags && scenario.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {scenario.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {scenario.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{scenario.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    {/* Test button */}
                    <Button
                      onClick={() => handleStartTest(scenario)}
                      className="flex-1 gap-2"
                      disabled={testingScenarioId !== null || !!existingTestSessions[scenario.scenarioId]}
                    >
                      <Play className="h-4 w-4" />
                      {testingScenarioId === scenario.id
                        ? 'Starting...'
                        : existingTestSessions[scenario.scenarioId]
                        ? 'Test Running'
                        : 'Test Scenario'}
                    </Button>
                    <Button
                      onClick={() => navigate(`/admin/scenario-approvals?selected=${scenario.id}`)}
                      variant="outline"
                    >
                      View
                    </Button>
                  </div>
                  {/* Publish button */}
                  <Button
                    onClick={() => handlePublish(scenario.id, scenario.title)}
                    variant="default"
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Publish to Solvers
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
