import React, { useState, useEffect, useRef } from "react";
import { X, Upload, ImageIcon, Loader2 } from "lucide-react@0.263.1";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";
import { creatorApi } from "../../api/creatorApi";
import { httpClient } from "../../api/httpClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface BasicInfoTabProps {
  data: any;
  onChange: (updates: any) => void;
  errors: string[];
  scenarioId?: string;
  versionId?: string;
}

export function BasicInfoTab({ data, onChange, errors, scenarioId, versionId }: BasicInfoTabProps) {
  const [tagInput, setTagInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCodeOfEthics = `Ethical Guidelines for This Challenge:

1. SCOPE: Only attack systems and services within this challenge environment. Do not attempt to access other users' sessions or environments.

2. RESPONSIBLE DISCLOSURE: If you discover any unintended vulnerabilities in the platform itself, report them to administrators immediately.

3. NO REAL-WORLD HARM: Do not use techniques learned here for malicious purposes outside this educational platform.

4. RESPECT RESOURCES: Be mindful of system resources. Do not launch denial-of-service attacks or resource exhaustion attempts.

5. LEARNING FIRST: The goal is education. Share knowledge, help others learn, but don't publicly post complete solutions.

6. PROFESSIONALISM: Maintain professional conduct in all interactions. Harassment or abuse will not be tolerated.

Violation of these rules may result in account suspension.`;

  const insertDefaultEthics = () => {
    onChange({ codeOfEthics: defaultCodeOfEthics });
    toast.success("Default code of ethics inserted");
  };

  // Enforce default scenario type (challenge) for now
  useEffect(() => {
    if (!data.scenarioType || data.scenarioType !== "challenge") {
      onChange({ scenarioType: "challenge" });
    }
  }, [data.scenarioType, onChange]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!data.tags.includes(tagInput.trim())) {
        onChange({ tags: [...data.tags, tagInput.trim()] });
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange({ tags: data.tags.filter((tag: string) => tag !== tagToRemove) });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPG, GIF, or WebP images only.');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    try {
      setIsUploading(true);
      
      if (scenarioId && versionId) {
        // Scenario already saved - upload directly
        const response = await creatorApi.uploadCoverImage(scenarioId, versionId, file);
        const imageUrl = response.coverImageUrl || response.url;
        const urlWithCacheBuster = imageUrl.includes('?') 
          ? `${imageUrl}&t=${Date.now()}` 
          : `${imageUrl}?t=${Date.now()}`;
        onChange({ coverImage: urlWithCacheBuster });
        toast.success('Cover image uploaded successfully!');
      } else {
        // New scenario - use generic upload endpoint, will associate on save
        const formData = new FormData();
        formData.append('file', file);
        
        const { data: uploadResult } = await httpClient.post('/assets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const imageUrl = uploadResult.url || uploadResult.path;
        onChange({ coverImage: imageUrl });
        toast.success('Cover image ready! Remember to save your scenario.');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload cover image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    if (!data.coverImage) {
      return;
    }

    try {
      // Extract the path from the API proxy URL and delete it
      const imageUrl = data.coverImage.split('?')[0]; // Remove cache-busting param
      
      let objectPath: string | null = null;
      if (imageUrl.includes('/api/assets/file/')) {
        // New format: /api/assets/file/scenarios/cover-images/...
        const parts = imageUrl.split('/api/assets/file/');
        objectPath = parts[1];
      } else if (imageUrl.includes('/rangex-assets/')) {
        // Legacy format: http://localhost:9000/rangex-assets/scenarios/...
        const parts = imageUrl.split('/rangex-assets/');
        objectPath = parts[1];
      }
      
      if (objectPath) {
        console.log('[BasicInfoTab] Deleting cover image from MinIO:', objectPath);
        
        await httpClient.delete(`/upload/image/${encodeURIComponent(objectPath)}`);
        console.log('[BasicInfoTab] Successfully deleted cover image from MinIO');
      }
      
      // Remove from form state
      onChange({ coverImage: undefined });
      toast.success('Cover image removed');
    } catch (error: any) {
      console.error('[BasicInfoTab] Failed to delete cover image:', error);
      
      // Don't clear from form if deletion failed
      toast.error(error.response?.data?.message || 'Failed to delete cover image from storage');
    }
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

      {/* Main Info Card */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Provide the core details about your scenario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold">
              Scenario Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., SQL Injection Challenge"
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="h-11"
            />
          </div>

          {/* Creator Name */}
          <div className="space-y-2">
            <Label htmlFor="creatorName" className="text-sm font-semibold">
              Creator Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="creatorName"
              placeholder="e.g., John Doe or your team name"
              value={data.creatorName || ""}
              onChange={(e) => onChange({ creatorName: e.target.value })}
              className="h-11"
              required
            />
            <p className="text-xs text-muted-foreground">
              Your name or team name for attribution. This is required for submission.
            </p>
          </div>

          {/* Short Description */}
          <div className="space-y-2">
            <Label htmlFor="shortDesc" className="text-sm font-semibold">
              Short Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="shortDesc"
              placeholder="Brief description that will appear in scenario listings..."
              value={data.shortDesc}
              onChange={(e) => onChange({ shortDesc: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {data.shortDesc.length} / 300 characters
            </p>
          </div>

          {/* Difficulty & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty" className="text-sm font-semibold">
                Difficulty <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {["Easy", "Medium", "Hard", "Insane"].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onChange({ difficulty: level })}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      data.difficulty === level
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-semibold">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={data.category} onValueChange={(value) => onChange({ category: value })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Web">Web</SelectItem>
                  <SelectItem value="Network">Network</SelectItem>
                  <SelectItem value="Forensics">Forensics</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Misc">Misc</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-semibold">
              Tags
            </Label>
            <div className="space-y-2">
              <Input
                id="tags"
                placeholder="Type a tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="h-11"
              />
              {data.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="px-3 py-1 text-sm gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estimated Time & Scenario Type Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedTime" className="text-sm font-semibold">
                Estimated Completion Time
              </Label>
              <div className="flex gap-2">
                <Input
                  id="estimatedTime"
                  type="number"
                  min="1"
                  value={data.estimatedTime}
                  onChange={(e) => onChange({ estimatedTime: parseInt(e.target.value) || 0 })}
                  className="h-11"
                />
                <Select defaultValue="minutes">
                  <SelectTrigger className="h-11 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Scenario Type
              </Label>
              <Badge variant="outline" className="bg-primary/5 text-primary">
                Challenge (default)
              </Badge>
              <p className="text-xs text-muted-foreground">
                Open labs and event labs are hidden for now; all scenarios are stored as “challenge”.
              </p>
            </div>
          </div>

          {/* Code of Ethics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="codeOfEthics" className="text-sm font-semibold">
                Code of Ethics (Optional)
              </Label>
              <div className="flex gap-2">
                {!data.codeOfEthics && (
                  <button
                    type="button"
                    onClick={insertDefaultEthics}
                    className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors font-medium"
                  >
                    Insert Template
                  </button>
                )}
                <details className="group">
                  <summary className="cursor-pointer px-4 py-2 text-sm border border-border hover:border-primary/50 rounded-lg transition-colors list-none font-medium">View Examples</summary>
                  <div className="mt-2 p-3 border rounded bg-muted/30 space-y-2 max-w-md">
                    <p className="font-medium">Common Ethics Rules:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Only attack systems within this challenge environment</li>
                      <li>Do not attempt to access other users' data or sessions</li>
                      <li>Report any unintended vulnerabilities to administrators</li>
                      <li>Do not use exploits for malicious purposes outside this platform</li>
                      <li>Respect system resources and other users' experience</li>
                      <li>Do not share solutions publicly before challenge ends</li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>
            <Textarea
              id="codeOfEthics"
              placeholder="Example: Only attack systems within this challenge. Do not attempt lateral movement to other users' environments. Report any security issues found to administrators..."
              value={data.codeOfEthics || ''}
              onChange={(e) => onChange({ codeOfEthics: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              📜 Ethical guidelines that users must follow. Click "Insert Template" for a ready-to-use example, or "View Examples" for ideas.
            </p>
          </div>

          {/* Learning Outcomes */}
          <div className="space-y-2">
            <Label htmlFor="learningOutcomes" className="text-sm font-semibold">
              Learning Outcomes (Optional)
            </Label>
            <Textarea
              id="learningOutcomes"
              placeholder="What will solvers learn from this challenge? Example:
• Understand SQL injection vulnerabilities
• Learn basic web application testing techniques
• Practice privilege escalation methods
• Gain experience with network reconnaissance tools"
              value={data.learningOutcomes || ''}
              onChange={(e) => onChange({ learningOutcomes: e.target.value })}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              🎯 Describe what solvers will learn from completing this challenge. This helps users understand the educational value.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cover Image Card */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Cover Image</CardTitle>
          <CardDescription>
            Upload a cover image for your scenario (PNG, JPG, GIF, WebP - max 5MB).
            {!scenarioId && !versionId && " You can upload before saving!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors">
            {data.coverImage ? (
              <div className="space-y-4">
                <img
                  key={data.coverImage}
                  src={data.coverImage}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-lg border border-border"
                  onError={(e) => {
                    console.error('Failed to load cover image:', data.coverImage);
                    // Clear the broken image and show upload UI instead
                    onChange({ coverImage: undefined });
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="inline-block mr-2 h-4 w-4" />
                        Replace Image
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isUploading}
                    className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className="flex items-center justify-center size-12 rounded-full bg-primary/10">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Upload cover image</p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, GIF, WebP up to 5MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="inline-block mr-2 h-4 w-4" />
                      Choose File
                    </>
                  )}
                </button>
                {!scenarioId || !versionId ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Save the scenario first to enable image upload
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Info Card */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Status</p>
              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                {data.status === "draft" ? "Draft" : data.status}
              </Badge>
            </div>
            {data.version > 1 && (
              <div>
                <p className="text-muted-foreground mb-1">Version</p>
                <p className="font-semibold">v{data.version}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
