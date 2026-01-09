import React, { useState } from "react";
import { Plus, X, Eye, EyeOff, BookOpen, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Alert, AlertDescription } from "../ui/alert";
import { TiptapEditor } from "../ui/tiptap-editor";
import "../ui/tiptap-editor.css";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Textarea } from "../ui/textarea";

interface MissionSolutionTabProps {
  data: any;
  onChange: (updates: any) => void;
  errors: string[];
  scenarioId?: string; // Pass scenario ID for MinIO uploads
}

export function MissionSolutionTab({ data, onChange, errors, scenarioId }: MissionSolutionTabProps) {
  const [showMission, setShowMission] = useState(true);

  const hints = data.hints || [];

  const handleAddHint = () => {
    const newHint = {
      id: `hint-${Date.now()}`,
      title: "",
      body: "",
      unlockAfter: 0,
      penaltyPoints: 0,
    };
    onChange({ hints: [...hints, newHint] });
  };

  const handleUpdateHint = (index: number, updates: any) => {
    const updated = [...hints];
    updated[index] = { ...updated[index], ...updates };
    onChange({ hints: updated });
  };

  const handleRemoveHint = (index: number) => {
    onChange({ hints: hints.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Card */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Use rich formatting to create comprehensive Mission briefings and Solution write-ups. 
            Add headings, images, code blocks, tables, and more to make your content clear and professional.
          </p>
        </CardContent>
      </Card>

      {/* Mission Section */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Mission (For Solvers)</CardTitle>
                <CardDescription>
                  The story and objectives that solvers will see
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showMission}
                onCheckedChange={setShowMission}
              />
              <Label className="text-sm">Show Mission tab to solvers</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mission-title" className="text-sm font-semibold">
              Mission Title
            </Label>
            <Input
              id="mission-title"
              value={data.missionTitle || ""}
              onChange={(e) => onChange({ missionTitle: e.target.value })}
              placeholder="e.g., Breach the Corporate Network"
            />
          </div>

          <TiptapEditor
            label="Mission Description"
            value={data.missionBody || ""}
            onChange={(value) => onChange({ missionBody: value })}
            placeholder="Provide the narrative, context, and objectives for this scenario. Use headings, images, and formatting to make it engaging..."
            minHeight="500px"
            scenarioId={scenarioId}
            helperText="Create a compelling mission briefing with full rich text formatting. Include screenshots, diagrams, and detailed context."
          />

          {/* Suggested Structure Helper */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm font-semibold mb-2">Suggested Structure:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Scenario Background:</strong> Story and context</li>
              <li>• <strong>Your Role:</strong> Who the solver is playing as</li>
              <li>• <strong>Environment Overview:</strong> What systems are in scope</li>
              <li>• <strong>Objectives:</strong> Clear goals and success criteria</li>
              <li>• <strong>Rules & Constraints:</strong> Any limitations or guidelines</li>
              <li>• <strong>Visual Aids:</strong> Network diagrams, screenshots, or topology images</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Hints Section */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hints (Optional)</CardTitle>
              <CardDescription>
                Optional hints to help solvers if they get stuck
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddHint}>
              <Plus className="mr-2 h-3 w-3" />
              Add Hint
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hints added. Hints are optional but can improve the solver experience.
            </div>
          ) : (
            hints.map((hint: any, index: number) => (
              <Collapsible key={hint.id} defaultOpen>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Badge variant="outline">Hint {index + 1}</Badge>
                      <span className="font-semibold text-sm">
                        {hint.title || "Untitled Hint"}
                      </span>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveHint(index)}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <CollapsibleContent className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Hint Title</Label>
                      <Input
                        value={hint.title}
                        onChange={(e) =>
                          handleUpdateHint(index, { title: e.target.value })
                        }
                        placeholder="e.g., Getting Started"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Hint Content</Label>
                      <TiptapEditor
                        value={hint.body || ""}
                        onChange={(html) => handleUpdateHint(index, { body: html })}
                        placeholder="Provide helpful guidance with rich formatting..."
                        scenarioId={scenarioId}
                        minHeight="150px"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Show only after (minutes, 0 = always available)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={hint.unlockAfter || 0}
                        onChange={(e) =>
                          handleUpdateHint(index, {
                            unlockAfter: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Penalty Points (deducted when hint is viewed)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={hint.penaltyPoints || 0}
                        onChange={(e) =>
                          handleUpdateHint(index, {
                            penaltyPoints: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0 = no penalty"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>

      {/* Solution Write-up Section */}
      <Card className="cyber-border bg-amber-500/5 border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10">
              <EyeOff className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle>Solution Write-up (For Admins/Internal Use)</CardTitle>
              <CardDescription>
                Step-by-step solution. Visible in Admin approval screens, not to solvers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <TiptapEditor
            label={
              <>
                Solution Write-up <span className="text-red-500">*</span>
              </>
            }
            value={data.solutionWriteup || ""}
            onChange={(value) => onChange({ solutionWriteup: value })}
            placeholder="Provide a detailed walkthrough of the intended solution path. Include commands, screenshots, explanations, and expected outputs..."
            minHeight="600px"
            scenarioId={scenarioId}
            helperText="Include all steps, commands, expected outputs, screenshots, and any alternative solution paths. This is for admin review and internal documentation."
          />

          {/* Solution Guidelines */}
          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-sm font-semibold mb-2 text-amber-400">
              Solution Write-up Guidelines:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Step-by-step walkthrough:</strong> Document every major step from start to finish</li>
              <li>• <strong>Commands & Output:</strong> Show actual commands with expected results</li>
              <li>• <strong>Screenshots:</strong> Include screenshots of key moments (terminals, exploits, flags)</li>
              <li>• <strong>Explanations:</strong> Explain the "why" behind each step and technique</li>
              <li>• <strong>Tools Used:</strong> List and describe all tools utilized</li>
              <li>• <strong>Alternative Paths:</strong> Note any other valid solution approaches</li>
              <li>• <strong>Troubleshooting:</strong> Common issues and how to resolve them</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
