import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { creatorApi } from "../api/creatorApi";
import { solverApi } from "../api/solverApi";
import { toast } from "sonner";

interface ChallengeOption {
  id: string;
  versionId: string;
  title: string;
  difficulty?: string;
  category?: string;
}

export function EditCareerPathPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const [scenarios, path] = await Promise.all([solverApi.listScenarios(), creatorApi.getCareerPath(id)]);
        const opts = (scenarios || []).map((s: any) => ({
          id: s.id,
          versionId: s.id, // solver API returns version IDs directly
          title: s.title || "Untitled scenario",
          difficulty: s.difficulty,
          category: s.category,
        }));
        setChallenges(opts);
        if (path) {
          setFormData({
            title: path.title || "",
            description: path.description || "",
            isPublic: !!path.isPublic,
          });
          const selectedIds = (path.items || []).map((it: any) => it.scenarioVersionId);
          setSelected(selectedIds);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load career path");
      }
    };
    load();
  }, [id]);

  const toggle = (sid: string) => {
    setSelected((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };

  const handleSave = async () => {
    if (!id) return;
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }
    setLoading(true);
    try {
      const items = challenges
        .filter((c) => selected.includes(c.id))
        .map((c, idx) => ({ scenarioVersionId: c.versionId, sortOrder: idx }));
      await creatorApi.updateCareerPath(id, {
        title: formData.title,
        description: formData.description,
        isPublic: formData.isPublic,
        items,
      });
      toast.success("Career path updated");
      navigate("/settings/career-path");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <Save className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl">Edit Career Path</h1>
          <p className="text-muted-foreground">Update details and reorder scenarios.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Basic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Public path</Label>
                <p className="text-sm text-muted-foreground">Allow others to view this path</p>
              </div>
              <Switch checked={formData.isPublic} onCheckedChange={(v) => setFormData({ ...formData, isPublic: v })} />
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Scenarios</CardTitle>
            <CardDescription>{selected.length} {selected.length === 1 ? 'scenario' : 'scenarios'} selected</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-2">
                {challenges.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors ${
                      selected.includes(c.id) ? "bg-muted border-primary" : ""
                    }`}
                  >
                    <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{c.title}</div>
                        <div className="flex items-center gap-2">
                          {c.category && <Badge variant="outline">{c.category}</Badge>}
                          {c.difficulty && <Badge variant="secondary">{c.difficulty}</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {challenges.length === 0 && <div className="text-sm text-muted-foreground p-3 border rounded-lg">No scenarios found.</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !formData.title || selected.length === 0} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
