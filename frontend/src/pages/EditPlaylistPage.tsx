import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, GripVertical, Library } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { playlistApi } from "../api/playlistApi";
import { solverApi } from "../api/solverApi";
import { Playlist, Scenario } from "../types";

export function EditPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [allScenarios, setAllScenarios] = useState<Scenario[]>([]); // All available scenarios
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const loadPlaylist = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [playlistData, allScenarios] = await Promise.all([
        playlistApi.get(id),
        solverApi.listScenarios(),
      ]);

      if (!playlistData) {
        toast.error("Playlist not found");
        navigate("/playlists");
        return;
      }

      setPlaylist(playlistData);
      
      // Store all available scenarios
      setAllScenarios(allScenarios || []);
      
      console.log('[EditPlaylist] Playlist items:', playlistData.items);
      console.log('[EditPlaylist] All scenarios count:', allScenarios?.length);
      
      // Get scenarios in order
      const orderedScenarios = (playlistData.items || [])
        .map((item: any) => {
          const found = allScenarios.find((s: any) => s.id === item.scenarioVersionId);
          if (!found) {
            console.warn('[EditPlaylist] Scenario not found for item:', item.scenarioVersionId);
          }
          return found;
        })
        .filter(Boolean);
      
      console.log('[EditPlaylist] Ordered scenarios count:', orderedScenarios.length);
      setScenarios(orderedScenarios as any);
      
      setFormData({
        title: playlistData.title,
        description: playlistData.description || "",
        isPublic: playlistData.isPublic || false,
      });
    } catch (error) {
      console.error("Failed to load playlist:", error);
      toast.error("Failed to load playlist");
    } finally {
      setLoading(false);
    }
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId)
        ? prev.filter((id) => id !== challengeId)
        : [...prev, challengeId]
    );
  };

  const handleAddScenarios = async () => {
    if (selectedChallenges.length === 0) {
      toast.error("Please select at least one scenario");
      return;
    }

    if (!id) return;
    
    try {
      const existing = scenarios.map((s) => s.id);
      const combined = [...existing, ...selectedChallenges];
      await playlistApi.replaceItems(id, combined.map((sid, idx) => ({ scenarioVersionId: sid, sortOrder: idx })));
      toast.success(`Added ${selectedChallenges.length} scenario(s) to playlist`);
      setShowAddDialog(false);
      setSelectedChallenges([]);
      // Small delay to ensure backend has committed changes
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadPlaylist();
    } catch (error) {
      console.error('Failed to add scenarios:', error);
      toast.error('Failed to add scenarios to playlist');
    }
  };

  const handleRemoveScenario = async (scenarioId: string) => {
    if (!id) return;
    
    try {
      const remaining = scenarios.filter((s) => s.id !== scenarioId).map((s, idx) => ({
        scenarioVersionId: s.id,
        sortOrder: idx,
      }));
      await playlistApi.replaceItems(id, remaining);
      toast.success("Scenario removed from playlist");
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
    } catch (error) {
      console.error('Failed to remove scenario:', error);
      toast.error('Failed to remove scenario');
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast.error("Please enter a playlist title");
      return;
    }

    if (!id) return;
    await playlistApi.update(id, {
      title: formData.title,
      description: formData.description,
      isPublic: formData.isPublic,
      scenarioVersionIds: scenarios.map((s) => s.id),
    });
    toast.success("Playlist updated successfully!");
    await loadPlaylist();
    navigate(`/playlists/${id}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) return;
    await playlistApi.remove(id);
    toast.success("Playlist deleted");
    navigate("/playlists");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return null;
  }

  const availableChallenges = allScenarios.filter(
    (c) => !scenarios.find((s) => s.id === c.id)
  );

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/playlists/${id}`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Playlist
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Library className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl">Edit Playlist</h1>
          <p className="text-muted-foreground">
            Update your playlist details and manage scenarios
          </p>
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
                <p className="text-sm text-muted-foreground">
                  Allow others to view and use this playlist
                </p>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scenarios</CardTitle>
                <CardDescription>
                  Manage scenarios in your playlist ({scenarios.length} total)
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Scenarios
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scenarios.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No scenarios in this playlist yet</p>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Scenario
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario, index) => (
                  <div
                    key={scenario.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scenario.title}</span>
                        <Badge
                          variant={
                            scenario.difficulty === "Easy"
                              ? "default"
                              : scenario.difficulty === "Medium"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {scenario.difficulty}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {scenario.type} • {scenario.durationMinutes}m
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveScenario(scenario.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Playlist
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(`/playlists/${id}`)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.title}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Add Scenarios Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="cyber-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Scenarios to Playlist</DialogTitle>
            <DialogDescription>
              Select scenarios to add to &quot;{playlist.title}&quot; ({selectedChallenges.length} selected)
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {availableChallenges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>All available scenarios are already in this playlist</p>
                </div>
              ) : (
                availableChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors cursor-pointer ${
                      selectedChallenges.includes(challenge.id) ? "bg-muted border-primary" : ""
                    }`}
                    onClick={() => toggleChallenge(challenge.id)}
                  >
                    <Checkbox
                      id={`challenge-${challenge.id}`}
                      checked={selectedChallenges.includes(challenge.id)}
                      onCheckedChange={() => toggleChallenge(challenge.id)}
                    />
                    <Label
                      htmlFor={`challenge-${challenge.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-medium">{challenge.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {challenge.category}
                          </span>
                        </div>
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
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              setSelectedChallenges([]);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddScenarios}
              disabled={selectedChallenges.length === 0}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add {selectedChallenges.length > 0 ? selectedChallenges.length : ""} Scenario
              {selectedChallenges.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
