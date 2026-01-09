import React, { useState, useRef } from "react";
import { 
  Package, Plus, CheckCircle2, Clock, XCircle, Trash2, 
  RefreshCw, Download, Copy, Eye, AlertCircle, Info 
} from "lucide-react@0.263.1";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner@2.0.3";

interface BuiltImage {
  id: string;
  name: string;
  base: string;
  toolsCount: number;
  status: "ready" | "building" | "failed";
  lastBuilt: string;
  size?: string;
  usedInScenarios?: number;
}

interface ImagesAttackerTabProps {
  data: any;
  onChange: (updates: any) => void;
}

export function ImagesAttackerTab({ data, onChange }: ImagesAttackerTabProps) {
  const baseImageSelectRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [baseImage, setBaseImage] = useState("");
  const [imageName, setImageName] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [builtImages, setBuiltImages] = useState<BuiltImage[]>([]);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  // Mock admin settings - in real app, fetch from API/context
  const MAX_CUSTOM_IMAGES = 5; // Admin-configured limit
  
  // Count ALL images except failed ones (failed images can be retried but don't consume quota)
  const currentImageCount = builtImages.filter(img => img.status !== "failed").length;
  const canBuildMore = currentImageCount < MAX_CUSTOM_IMAGES;
  const quotaPercentage = (currentImageCount / MAX_CUSTOM_IMAGES) * 100;

  const tools = [
    { category: "Recon", items: ["nmap", "masscan", "rustscan", "dnsenum"] },
    { category: "Web", items: ["sqlmap", "gobuster", "wfuzz", "nikto"] },
    { category: "Exploit", items: ["metasploit", "pwntools", "exploitdb"] },
    { category: "Password", items: ["john", "hashcat", "hydra", "medusa"] },
    { category: "Misc", items: ["netcat", "tcpdump", "wireshark", "socat"] },
  ];

  const handleToolToggle = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleBuildImage = () => {
    if (!baseImage) {
      toast.error("Please select a base image");
      return;
    }

    if (!canBuildMore) {
      toast.error(`You've reached the maximum of ${MAX_CUSTOM_IMAGES} custom images`);
      return;
    }

    const newImage: BuiltImage = {
      id: `img-${Date.now()}`,
      name: imageName || `Custom ${baseImage} Image`,
      base: baseImage,
      toolsCount: selectedTools.length,
      status: "building",
      lastBuilt: new Date().toISOString(),
      size: "Calculating...",
      usedInScenarios: 0,
    };

    setBuiltImages(prev => [...prev, newImage]);
    toast.success("Image build started! This may take a few minutes.");
    
    // Reset form
    setBaseImage("");
    setImageName("");
    setSelectedTools([]);
    setExtraFiles([]);

    // Simulate build completion
    setTimeout(() => {
      setBuiltImages(prev =>
        prev.map(img =>
          img.id === newImage.id
            ? { ...img, status: "ready" as const, size: "1.9 GB" }
            : img
        )
      );
      toast.success(`${newImage.name} is now ready!`);
    }, 3000);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setExtraFiles(prev => [...prev, ...fileArray]);
    toast.success(`${fileArray.length} file(s) added`);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (!canBuildMore) return;
    handleFileSelect(event.dataTransfer.files);
  };

  const handleRebuild = (image: BuiltImage) => {
    // If rebuilding a failed image, check quota
    if (image.status === "failed" && !canBuildMore) {
      toast.error(`You've reached the maximum of ${MAX_CUSTOM_IMAGES} custom images`);
      return;
    }

    setBuiltImages(prev =>
      prev.map(img =>
        img.id === image.id ? { ...img, status: "building" as const } : img
      )
    );
    toast.info(`Rebuilding ${image.name}...`);

    // Simulate rebuild (could succeed or fail)
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate
      setBuiltImages(prev =>
        prev.map(img =>
          img.id === image.id
            ? { 
                ...img, 
                status: success ? ("ready" as const) : ("failed" as const),
                lastBuilt: new Date().toISOString(),
                size: success ? (img.size || "1.9 GB") : img.size
              }
            : img
        )
      );
      if (success) {
        toast.success(`${image.name} rebuilt successfully!`);
      } else {
        toast.error(`${image.name} rebuild failed. Check logs for details.`);
      }
    }, 3000);
  };

  const handleDuplicate = (image: BuiltImage) => {
    if (!canBuildMore) {
      toast.error(`You've reached the maximum of ${MAX_CUSTOM_IMAGES} custom images`);
      return;
    }

    // Duplicates are always created as "ready" (copying a working image)
    // Don't allow duplicating failed images
    if (image.status === "failed") {
      toast.error("Cannot duplicate a failed image. Try rebuilding it first.");
      return;
    }

    // Don't allow duplicating images that are still building
    if (image.status === "building") {
      toast.error("Cannot duplicate an image that is still building. Please wait for it to complete.");
      return;
    }

    const duplicate: BuiltImage = {
      ...image,
      id: `img-${Date.now()}`,
      name: `${image.name} (Copy)`,
      status: "ready", // Always ready when duplicating a ready image
      lastBuilt: new Date().toISOString(),
      usedInScenarios: 0, // New copy not used anywhere yet
    };

    setBuiltImages(prev => [...prev, duplicate]);
    toast.success(`${image.name} duplicated!`);
  };

  const handleDelete = (image: BuiltImage) => {
    // Prevent deleting images that are currently building
    if (image.status === "building") {
      toast.error("Cannot delete an image while it's building. Please wait for it to complete.");
      return;
    }

    // Warn if image is used in scenarios
    if (image.usedInScenarios && image.usedInScenarios > 0) {
      if (!window.confirm(`This image is used in ${image.usedInScenarios} scenario(s). Deleting it may break those scenarios. Are you sure you want to delete it?`)) {
        return;
      }
    }

    setBuiltImages(prev => prev.filter(img => img.id !== image.id));
    toast.success(`${image.name} deleted`);
  };

  const handleViewDetails = (image: BuiltImage) => {
    // In a real implementation, this would open a modal with full details
    const details = `
Image: ${image.name}
Base: ${image.base}
Status: ${image.status}
Tools: ${image.toolsCount}
Size: ${image.size || 'Unknown'}
Last Built: ${new Date(image.lastBuilt).toLocaleString()}
Used in: ${image.usedInScenarios || 0} scenario(s)
    `.trim();
    
    toast.info(details, { duration: 5000 });
  };

  const handleExportConfig = (image: BuiltImage) => {
    // In a real implementation, this would download a Dockerfile
    const dockerfile = `# Dockerfile for ${image.name}
FROM ${image.base}:latest

# Install tools
RUN apt-get update && apt-get install -y \\
    # Add your ${image.toolsCount} tools here

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /root
CMD ["/bin/bash"]
`;
    
    // Simulate download
    const blob = new Blob([dockerfile], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${image.name.replace(/\s+/g, '-').toLowerCase()}.Dockerfile`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Dockerfile downloaded!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Ready
          </Badge>
        );
      case "building":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Building
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const scrollToBuilder = () => {
    baseImageSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => baseImageSelectRef.current?.click(), 500);
  };

  return (
    <div className="space-y-6">
      {/* Quota Alert */}
      <Alert className={quotaPercentage >= 80 ? "border-amber-500/50 bg-amber-500/10" : "cyber-border bg-primary/5"}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">
              Custom Image Quota: <strong>{currentImageCount} / {MAX_CUSTOM_IMAGES}</strong> used
              {quotaPercentage >= 80 && quotaPercentage < 100 && " (nearing limit)"}
              {quotaPercentage >= 100 && " (quota reached)"}
            </span>
            <div className="w-48 h-2 bg-border rounded-full overflow-hidden flex-shrink-0">
              <div
                className={`h-full transition-all ${
                  quotaPercentage >= 100
                    ? "bg-red-500"
                    : quotaPercentage >= 80
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
              />
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Info Card */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Create a dedicated attacker image by starting from a base image, adding tools, and uploading extra files. 
            The platform will build and register this image so you can reuse it in your environments.
            {!canBuildMore && (
              <strong className="block mt-2 text-amber-400">
                Heads up: You've reached your custom image quota. Delete unused images to build new ones.
              </strong>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Build Custom Image */}
      <Card className={`cyber-border ${!canBuildMore ? "opacity-60" : ""}`}>
        <CardHeader>
          <CardTitle>Build a Custom Attacker Image</CardTitle>
          <CardDescription>
            Configure your custom image with pre-installed tools
            {!canBuildMore && " (Quota reached - delete images to continue)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Image */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Base Attacker Image</Label>
            <Select value={baseImage} onValueChange={setBaseImage} disabled={!canBuildMore}>
              <SelectTrigger ref={baseImageSelectRef}>
                <SelectValue placeholder="Select base image..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kali-lite">Kali Lite (1.2 GB)</SelectItem>
                <SelectItem value="kali-full">Kali Full (3.5 GB)</SelectItem>
                <SelectItem value="parrot">Parrot Security (2.1 GB)</SelectItem>
                <SelectItem value="ubuntu-attacker">Ubuntu Attacker Base (800 MB)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tools Checklist */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">
              Tools to Install ({selectedTools.length} selected)
            </Label>
            <div className="space-y-4">
              {tools.map((category) => (
                <div key={category.category}>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                    {category.category}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {category.items.map((tool) => (
                      <div key={tool} className="flex items-center space-x-2">
                        <Checkbox
                          id={tool}
                          checked={selectedTools.includes(tool)}
                          onCheckedChange={() => handleToolToggle(tool)}
                          disabled={!canBuildMore}
                        />
                        <label
                          htmlFor={tool}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {tool}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extra Files Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Extra Files (Optional)</Label>
            <div
              className={`border-2 border-dashed border-border rounded-lg p-6 transition-colors ${
                canBuildMore ? "hover:border-primary/50 cursor-pointer" : "cursor-not-allowed opacity-50"
              }`}
              onClick={() => canBuildMore && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Upload scripts, wordlists, or binaries</p>
                  <p className="text-xs text-muted-foreground">
                    Drag & drop or click to browse
                  </p>
                </div>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              {extraFiles.length > 0 && (
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground text-sm">Selected files</p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {extraFiles.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="cyber-border rounded-md px-3 py-2">
                        {file.name} <span className="text-muted-foreground">({Math.round(file.size / 1024)} KB)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Custom Image Name */}
          <div className="space-y-2">
            <Label htmlFor="image-name" className="text-sm font-semibold">
              Custom Image Label (Optional)
            </Label>
            <Input
              id="image-name"
              placeholder="e.g., My Web Pentest Image"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              disabled={!canBuildMore}
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this image in the UI
            </p>
          </div>

          {/* Build Button */}
          <Button 
            className="w-full" 
            onClick={handleBuildImage}
            disabled={!canBuildMore}
          >
            <Plus className="mr-2 h-4 w-4" />
            Build Image
          </Button>
        </CardContent>
      </Card>

      {/* Built Images Table */}
      <Card className="cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Built Images</CardTitle>
              <CardDescription>
                Manage your custom images ({builtImages.length} total)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {builtImages.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No custom images built yet
              </p>
              <Button variant="outline" onClick={scrollToBuilder}>
                <Plus className="mr-2 h-4 w-4" />
                Build Your First Image
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image Label</TableHead>
                  <TableHead>Base Image</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Built</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {builtImages.map((image) => (
                  <TableRow key={image.id}>
                    <TableCell className="font-medium">{image.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{image.base}</Badge>
                    </TableCell>
                    <TableCell>{image.toolsCount} tools</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {image.size || "Pending"}
                    </TableCell>
                    <TableCell>{getStatusBadge(image.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(image.lastBuilt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {image.usedInScenarios ? (
                        <Badge variant="secondary" className="text-xs">
                          {image.usedInScenarios} scenario{image.usedInScenarios > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unused</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(image)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleExportConfig(image)}
                            disabled={image.status === "failed"}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Export Dockerfile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleRebuild(image)}
                            disabled={image.status === "building"}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4 ${image.status === "building" ? "animate-spin" : ""}`} />
                            {image.status === "building" ? "Building..." : "Rebuild"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDuplicate(image)}
                            disabled={!canBuildMore || image.status !== "ready"}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(image)}
                            className="text-destructive"
                            disabled={image.status === "building"}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


