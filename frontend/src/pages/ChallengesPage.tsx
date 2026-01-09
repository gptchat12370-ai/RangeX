import React, { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Scenario, Difficulty, Mode } from "../types";
import { solverApi } from "../api/solverApi";
import { useStore } from "../lib/store";
import { ScenarioCard } from "../components/ScenarioCard";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardContent } from "../components/ui/card";

interface ChallengesPageProps {
  onStartScenario: (scenarioId: string) => void;
  onViewScenario: (scenarioId: string) => void;
}

export function ChallengesPage({ onStartScenario, onViewScenario }: ChallengesPageProps) {
  const { currentUser, currentSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Helper to check if scenario has running session (excludes event sessions)
  const hasRunningSession = (scenarioId: string) => {
    if (!currentUser?.history) return false;
    
    // Check if there's a running session for this scenario that is NOT an event session
    const runningSession = currentUser.history.find(
      h => h.scenarioId === scenarioId && h.status === "In Progress"
    );
    
    if (!runningSession) return false;
    
    // Exclude event sessions (check both currentSession and history.eventId)
    const isEventSession = (runningSession as any).eventId || 
      (currentSession?.eventId && currentSession.scenarioId === scenarioId);
    
    if (isEventSession) {
      console.log("[ChallengesPage] Hiding Continue for event session", { 
        scenarioId, 
        eventId: (runningSession as any).eventId || currentSession?.eventId 
      });
      return false;
    }
    
    console.log("[ChallengesPage] hasRunningSession check", { 
      scenarioId, 
      hasSession: true, 
      isEventSession: false 
    });
    return true;
  };

  useEffect(() => {
    const loadScenarios = async () => {
      setLoading(true);
      try {
        const data = await solverApi.listScenarios();
        // Map backend payload to existing type shape, best-effort
        const mapped: Scenario[] = data.map((s: any) => ({
          id: s.id,
          scenarioId: s.scenarioId, // Base scenario ID for ratings/favorites
          title: s.title || s.name || "Untitled",
          shortDesc: s.shortDescription || s.description || "",
          coverImageUrl: s.coverImageUrl,
          author: s.author || "Unknown",
          tags: s.tags || [],
          mode: s.mode || "Single Player",
          type: s.scenarioType || s.type || "Cyber Challenge",
          difficulty: (s.difficulty as Difficulty) || "Medium",
          durationMinutes: s.estimatedMinutes || s.durationMinutes || 60,
          category: s.category || "Other",
          rating: s.rating || 0,
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
    loadScenarios();
  }, []);

  const categories = Array.from(new Set(scenarios.map((s) => s.category)));

  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesSearch =
      scenario.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.shortDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDifficulty =
      difficultyFilter === "all" || scenario.difficulty === difficultyFilter;

    const matchesMode = modeFilter === "all" || scenario.mode === modeFilter;

    const matchesCategory =
      categoryFilter === "all" || scenario.category === categoryFilter;

    return matchesSearch && matchesDifficulty && matchesMode && matchesCategory;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Challenges</h1>
        <p className="text-muted-foreground">
          Explore and practice with {scenarios.length} cybersecurity challenges
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search challenges, tags, or authors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Difficulty Filter */}
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
            <SelectItem value="Impossible">Impossible</SelectItem>
          </SelectContent>
        </Select>

        {/* Mode Filter */}
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="Single Player">Single Player</SelectItem>
            <SelectItem value="Multi Player">Multi Player</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredScenarios.length} of {scenarios.length} challenges
        </p>
      </div>

      {/* Scenarios Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      ) : filteredScenarios.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No challenges found matching your filters.</p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setSearchTerm("");
              setDifficultyFilter("all");
              setModeFilter("all");
              setCategoryFilter("all");
            }}
          >
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onStart={onStartScenario}
              onView={onViewScenario}
              hasRunningSession={hasRunningSession(scenario.id)}
              onFavoritesChange={() => {/* No need to reload here */}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
