import React from "react";
import { Play, Send, Save, AlertTriangle, CheckCircle2, Server, HelpCircle, FileText, FolderOpen } from "lucide-react@0.263.1";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Separator } from "../ui/separator";

interface ReviewTestTabProps {
  data: any;
  onSaveDraft: () => void;
  onSubmitForReview: () => void;
  validationErrors: Record<string, string[]>;
}

export function ReviewTestTab({
  data,
  onSaveDraft,
  onSubmitForReview,
  validationErrors,
}: ReviewTestTabProps) {
  const machines = data.machines || [];
  const questions = data.questions || [];
  const hints = data.hints || [];

  const hasErrors = Object.keys(validationErrors).length > 0;
  const totalErrors = Object.values(validationErrors).flat().length;

  const attackerMachines = machines.filter((m: any) => m.role === "attacker");
  const internalMachines = machines.filter((m: any) => m.role === "internal");
  const serviceMachines = machines.filter((m: any) => m.role === "service");

  const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0);

  const questionsByType = questions.reduce((acc: any, q: any) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {});

  const getEnvironmentProfile = () => {
    if (machines.length <= 2) return { label: "Light", color: "text-green-400" };
    if (machines.length <= 4) return { label: "Medium", color: "text-amber-400" };
    return { label: "Heavy", color: "text-red-400" };
  };

  const profile = getEnvironmentProfile();

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {hasErrors ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-3">
              Cannot submit: {totalErrors} validation error{totalErrors !== 1 ? "s" : ""} found
            </p>
            <div className="space-y-3">
              {Object.entries(validationErrors).map(([tab, errors]) => (
                <div key={tab} className="border-l-2 border-destructive pl-3">
                  <p className="font-semibold capitalize mb-1">
                    {tab === "basic" && "📝 Basic Info"}
                    {tab === "environment" && "🖥️ Environment"}
                    {tab === "questions" && "❓ Questions"}
                    {tab === "mission" && "🎯 Mission & Solution"}
                    {tab === "assets" && "📁 Assets"}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3 opacity-80">
              💡 Tip: Scenarios can have machines OR questions/assets (quiz/writeup-style challenges are supported)
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-green-500/10 border-green-500/50">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">
            ✅ All required fields are complete. Ready to submit for admin review!
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Basic Info Summary */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title:</span>
              <span className="font-semibold">{data.title || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creator:</span>
              <span className="font-semibold">{data.creatorName || "⚠️ Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difficulty:</span>
              <Badge variant="outline">{data.difficulty || "Not set"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category:</span>
              <Badge variant="secondary">{data.category || "Not set"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{data.scenarioType || "challenge"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Time:</span>
              <span>{data.estimatedTime || 60} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tags:</span>
              <span>{data.tags?.length || 0} tag{data.tags?.length !== 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>

        {/* Environment Summary */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Machines:</span>
              <span className="font-semibold">{machines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attacker:</span>
              <span>{attackerMachines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Internal:</span>
              <span>{internalMachines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service:</span>
              <span>{serviceMachines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profile:</span>
              <span className={`font-semibold ${profile.color}`}>{profile.label}</span>
            </div>
          </CardContent>
        </Card>

        {/* Questions Summary */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Questions:</span>
              <span className="font-semibold">{questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Points:</span>
              <span className="font-semibold text-primary">{totalPoints}</span>
            </div>
            {Object.entries(questionsByType).map(([type, count]) => (
              <div key={type} className="flex justify-between text-xs">
                <span className="text-muted-foreground capitalize">
                  {type.replace(/([A-Z])/g, " $1").trim()}:
                </span>
                <span>{count as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Assets Summary */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Assets:</span>
              <span className="font-semibold">{data.assets?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Downloads:</span>
              <span>{data.assets?.filter((a: any) => a.assetLocation === 'downloadable').length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedded:</span>
              <span>{data.assets?.filter((a: any) => a.assetLocation === 'machine-embedded').length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flags:</span>
              <span>{data.assets?.filter((a: any) => a.assetLocation === 'flag-file').length || 0}</span>
            </div>
            {data.assets?.some((a: any) => a.status === 'pending-upload') && (
              <div className="flex justify-between text-orange-400">
                <span>Pending Upload:</span>
                <span>{data.assets?.filter((a: any) => a.status === 'pending-upload').length}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Machines Detail */}
      {machines.length > 0 && (
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Machines</CardTitle>
            <CardDescription>
              Overview of all machines in your environment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Network Group</TableHead>
                  <TableHead>Entrypoint</TableHead>
                  <TableHead>Image Source</TableHead>
                  <TableHead>Purpose Tags</TableHead>
                  <TableHead>Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine: any) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {machine.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {machine.networkGroup || "default"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {machine.entrypoints && machine.entrypoints.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {machine.entrypoints.map((entry: any, idx: number) => (
                            <Badge key={idx} variant={entry.exposedToSolver ? "default" : "outline"} className="text-xs font-mono uppercase">
                              {entry.protocol}:{entry.containerPort}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {machine.imageVariantId ? "Platform Variant" : "Custom"}
                        </Badge>
                        {(machine.imageName || machine.imageRef) && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={machine.imageRef}>
                            {machine.imageName || machine.imageRef}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {machine.purposeTags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {machine.access === "entry" ? "Entry Point" : "Internal Only"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mission & Hints */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Mission & Hints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">Mission</p>
            {data.missionBody ? (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {data.missionBody}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No mission text provided</p>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-2">
              Hints ({hints.length})
            </p>
            {hints.length > 0 ? (
              <div className="space-y-2">
                {hints.map((hint: any, index: number) => (
                  <div key={hint.id || index} className="p-2 bg-muted/30 rounded text-sm">
                    <span className="font-medium">Hint {index + 1}:</span> {hint.title || "Untitled"}
                    {hint.unlockAfter > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (unlocks after {hint.unlockAfter} min)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hints added</p>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-2">Solution Write-up</p>
            <Badge variant={data.solutionWriteup ? "default" : "destructive"}>
              {data.solutionWriteup ? "Provided" : "Missing"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="cyber-border bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onSaveDraft}
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Draft
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex-1"
            >
              <Play className="mr-2 h-4 w-4" />
              Run Test Environment (Creator)
            </Button>

            <Button
              size="lg"
              className="flex-1"
              onClick={onSubmitForReview}
              disabled={hasErrors}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit for Admin Review
            </Button>
          </div>

          {hasErrors && (
            <p className="text-sm text-destructive text-center mt-4">
              Fix validation errors before submitting
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
