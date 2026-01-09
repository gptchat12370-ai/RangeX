import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Library } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { creatorApi } from "../api/creatorApi";
import { solverApi } from "../api/solverApi";

interface ChallengeOption {
  id: string;
  versionId: string;
  title: string;
  difficulty?: string;
  category?: string;
}

export function CreatePlaylistPage() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        // Load approved scenarios from solver API
        const scenarios = await solverApi.listScenarios();
        console.log('[CreatePlaylist] Loaded scenarios:', scenarios.length);
        const flattened: ChallengeOption[] = (scenarios || []).map((s: any) => {
          // s.id is the VERSION ID (what we need for playlist_item.scenarioVersionId)
          // s.scenarioId is the PARENT scenario ID
          console.log('[CreatePlaylist] Scenario:', s.title, 'VERSION ID (s.id):', s.id, 'Parent ID (s.scenarioId):', s.scenarioId);
          return {
            id: s.id, // Use for selection UI
            versionId: s.id, // Use VERSION ID for playlist items (FK to scenario_version.id)
            title: s.title || "Untitled scenario",
            difficulty: s.difficulty,
            category: s.category,
          };
        });
        setChallenges(flattened);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load scenarios");
      }
    };
    load();
  }, []);

  const toggleChallenge = (challengeId: string) => {
    setSelected((prev) =>
      prev.includes(challengeId) ? prev.filter((id) => id !== challengeId) : [...prev, challengeId]
    );
  };

  const handleCreate = async () => {
    if (!formData.title) {
      toast.error("Please enter a playlist title");
      return;
    }
    const items = challenges
      .filter((c) => selected.includes(c.id))
      .map((c, idx) => ({ scenarioVersionId: c.versionId, sortOrder: idx }));
    if (items.length === 0) {
      toast.error("Please select at least one scenario");
      return;
    }
    try {
      setLoading(true);
      await creatorApi.createPlaylist({
        title: formData.title,
        description: formData.description,
        isPublic: formData.isPublic,
        items,
      });
      toast.success("Playlist created successfully!");
      navigate("/playlists", { state: { refetch: true } });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to create playlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/playlists")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Playlists
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Library className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl">Create New Playlist</h1>
          <p className="text-muted-foreground">Organize your favorite challenges into a custom playlist</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Playlist Details</CardTitle>
            <CardDescription>Basic information about your playlist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Web Security Fundamentals"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your playlist and what users will learn"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="public">Public Playlist</Label>
                <p className="text-sm text-muted-foreground">Allow others to view and use this playlist</p>
              </div>
              <Switch
                id="public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Select Challenges</CardTitle>
            <CardDescription>Choose challenges to include in your playlist ({selected.length} selected)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors ${
                      selected.includes(challenge.id) ? "bg-muted border-primary" : ""
                    }`}
                  >
                    <Checkbox
                      id={`challenge-${challenge.id}`}
                      checked={selected.includes(challenge.id)}
                      onCheckedChange={() => toggleChallenge(challenge.id)}
                    />
                    <Label htmlFor={`challenge-${challenge.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-medium">{challenge.title}</span>
                          <span className="text-xs text-muted-foreground">{challenge.category}</span>
                        </div>
                        {challenge.difficulty && (
                          <Badge
                            variant={
                              challenge.difficulty === "Easy"
                                ? "default"
                                : challenge.difficulty === "Medium"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {challenge.difficulty}
                          </Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
                {challenges.length === 0 && (
                  <div className="text-sm text-muted-foreground p-3 border rounded-lg">
                    No scenarios found. Create a scenario first.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/playlists")}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!formData.title || loading} className="gap-2">
            <Plus className="h-4 w-4" />
            {loading ? "Saving..." : "Create Playlist"}
          </Button>
        </div>
      </div>
    </div>
  );
}
