import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { BasicInfoTab } from "../../components/creator/BasicInfoTab";
import { EnvironmentTopologyTab } from "../../components/creator/EnvironmentTopologyTab-Improved";
import { AssetsTab } from "../../components/creator/AssetsTab";
import { QuestionsTab } from "../../components/creator/QuestionsTab";
import { MissionSolutionTab } from "../../components/creator/MissionSolutionTab";
import { ReviewTestTab } from "../../components/creator/ReviewTestTab";
import { CreatorDockerTestTab } from "../../components/creator/CreatorDockerTestTab";
import { toast } from "sonner";
import { creatorApi } from "../../api/creatorApi";

export interface ScenarioFormData {
  // Basic Info
  title: string;
  shortDesc: string;
  difficulty: string;
  category: string;
  tags: string[];
  estimatedTime: number;
  scenarioType: string;
  coverImage?: string;
  creatorName?: string;
  requiresMachines?: boolean;
  codeOfEthics?: string;
  learningOutcomes?: string;
  
  // Environment
  machines: any[];
  
  // Assets
  assets?: any[];
  
  // Questions
  questions: any[];
  
  // Mission
  missionTitle: string;
  missionBody: string;
  hints: any[];
  solutionWriteup: string;
  
  // Validation & Scoring
  validationMode?: string;
  scoringMode?: string;
  hintMode?: string;
  
  // Meta
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "validation_failed";
  version: number;
}

export function ScenarioBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // For editing existing: ?id={scenarioId}&version={versionId}
  // For creating new version: ?baseScenario={scenarioId}
  const urlScenarioId = searchParams.get("id");
  const urlVersionId = searchParams.get("version");
  const baseScenarioId = searchParams.get("baseScenario");
  
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(urlScenarioId);
  const [savedVersionId, setSavedVersionId] = useState<string | null>(urlVersionId);
  const [parentScenarioId, setParentScenarioId] = useState<string | null>(baseScenarioId);
  const [refreshingList, setRefreshingList] = useState(false);
  
  const [activeTab, setActiveTab] = useState("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  
  const [formData, setFormData] = useState<ScenarioFormData>({
    title: "",
    shortDesc: "",
    difficulty: "",
    category: "",
    tags: [],
    estimatedTime: 60,
    scenarioType: "challenge",
    creatorName: "",
    requiresMachines: true,
    codeOfEthics: "",
    learningOutcomes: "",
    machines: [],
    assets: [],
    questions: [],
    missionTitle: "",
    missionBody: "",
    hints: [],
    solutionWriteup: "",
    validationMode: "instant",
    scoringMode: "allOrNothing",
    hintMode: "disabled",
    status: "DRAFT",
    version: 1,
  });

  // Load existing scenario or create from template
  const mapDtoToForm = (dto: any): ScenarioFormData => {
    // Normalize questions to ensure all required fields exist while preserving all data
    const normalizedQuestions = (dto.questions || []).map((q: any) => {
      // Spread ALL original fields first, then apply defaults only for missing required fields
      return {
        ...q, // Preserve everything from database
        id: q.id || `q-${Date.now()}-${Math.random()}`,
        type: q.type || "single",
        text: q.text !== undefined && q.text !== null ? q.text : "",
        points: typeof q.points === 'number' ? q.points : 10,
        maxAttempts: typeof q.maxAttempts === 'number' ? q.maxAttempts : 3,
        validationMode: q.validationMode || "immediate",
      };
    });

    // Normalize machines to ensure frontend display fields are populated
    const normalizedMachines = (dto.machines || []).map((m: any) => ({
      ...m,
      // Preserve all backend fields
      id: m.id,
      name: m.name,
      role: m.role,
      imageSourceType: m.imageSourceType,
      imageRef: m.imageRef,
      imageVariantId: m.imageVariantId,
      registryCredentialId: m.registryCredentialId,
      networkGroup: m.networkGroup || 'default',
      resourceProfile: m.resourceProfile || 'small',
      allowSolverEntry: m.allowSolverEntry ?? false,
      allowFromAttacker: m.allowFromAttacker ?? false,
      allowInternalConnections: m.allowInternalConnections ?? false,
      isPivotHost: m.isPivotHost ?? false,
      startupCommands: m.startupCommands,
      // Add display-friendly fields for frontend
      imageName: m.imageRef?.split('/').pop() || m.imageRef,
    }));

    // Normalize hints to filter out corrupted data and ensure all required fields exist
    const normalizedHints = (dto.hints || [])
      .filter((h: any) => h && typeof h === 'object' && !Array.isArray(h)) // Filter out arrays and null/undefined
      .map((h: any) => ({
        id: h.id || `hint-${Date.now()}-${Math.random()}`,
        title: h.title || "",
        body: h.body || "",
        unlockAfter: typeof h.unlockAfter === 'number' ? h.unlockAfter : 0,
        penaltyPoints: typeof h.penaltyPoints === 'number' ? h.penaltyPoints : 0,
      }));

    return {
      title: dto.title || "",
      shortDesc: dto.shortDescription || "",
      difficulty: dto.difficulty || "",
      category: dto.category || "",
      tags: dto.tags || [],
      estimatedTime: dto.estimatedMinutes || 60,
      scenarioType: dto.scenarioType || "challenge",
      coverImage: dto.coverImageUrl,
      creatorName: dto.creatorName || "",
      requiresMachines: dto.requiresMachines !== false,
      codeOfEthics: dto.codeOfEthics || "",
      learningOutcomes: dto.learningOutcomes || "",
      machines: normalizedMachines,
      assets: dto.assets || [],
      questions: normalizedQuestions,
      missionTitle: "",
      missionBody: dto.missionText || "",
      hints: normalizedHints,
      solutionWriteup: dto.solutionWriteup || "",
      validationMode: dto.validationMode || "instant",
      scoringMode: dto.scoringMode || "allOrNothing",
      hintMode: dto.hintMode || "disabled",
      status: (dto.status || "DRAFT").toUpperCase() as any,
      version: dto.versionNumber || 1,
    };
  };

  useEffect(() => {
    const loadScenario = async () => {
      if (urlScenarioId && urlVersionId) {
        // Editing existing draft version
        try {
          toast.info("Loading scenario version...");
          const dto = await creatorApi.getScenarioVersion(urlScenarioId, urlVersionId);
          console.log('[ScenarioBuilder] Loaded from backend, dto.questions:', dto?.questions);
          
          if (dto) {
            const formData = mapDtoToForm(dto);
            console.log('[ScenarioBuilder] After mapDtoToForm, questions:', formData.questions);
            setFormData(formData);
            setHasUnsavedChanges(false);
            toast.success("Loaded scenario version successfully");
          }
        } catch (err: any) {
          console.error('[ScenarioBuilder] Failed to load:', err);
          toast.error(err?.response?.data?.message || "Failed to load scenario version");
        }
      } else if (baseScenarioId) {
        // Creating new version from existing scenario
        try {
          toast.info("Loading previous version data...");
          const scenarios = await creatorApi.listScenarios({ all: true });
          console.log('[ScenarioBuilder] All scenarios:', scenarios);
          console.log('[ScenarioBuilder] Looking for baseScenarioId:', baseScenarioId);
          
          const baseScenario = scenarios.find((s: any) => s.id === baseScenarioId || s.scenarioId === baseScenarioId);
          console.log('[ScenarioBuilder] Found baseScenario:', baseScenario);
          
          if (baseScenario) {
            // Store the parent scenario ID
            const parentId = baseScenario.id || baseScenarioId;
            setParentScenarioId(parentId);
            
            console.log('[ScenarioBuilder] baseScenario.versions:', baseScenario.versions);
            
            // Check if a draft version already exists
            const draftVersion = baseScenario.versions?.find((v: any) => v.status?.toUpperCase() === 'DRAFT');
            if (draftVersion) {
              toast.error("A draft version already exists for this scenario. Please edit or delete it first.");
              navigate('/creator/scenarios');
              return;
            }
            
            // Find the HIGHEST version number across ALL statuses (not just approved)
            const allVersions = baseScenario.versions || [];
            const highestVersionNumber = allVersions.reduce((max: number, v: any) => {
              const vNum = v.versionNumber || 0;
              return vNum > max ? vNum : max;
            }, 0);
            
            console.log('[ScenarioBuilder] All versions:', allVersions.map((v: any) => ({ vNum: v.versionNumber, status: v.status })));
            console.log('[ScenarioBuilder] Highest version number found:', highestVersionNumber);
            
            // Get the latest approved/published version to copy data from (not for version number)
            const approvedOrPublished = allVersions.filter((v: any) => 
              ['APPROVED', 'PUBLISHED'].includes(v.status?.toUpperCase())
            ).sort((a: any, b: any) => b.versionNumber - a.versionNumber);
            
            const latestApprovedOrPublished = approvedOrPublished[0];
            console.log('[ScenarioBuilder] Latest approved/published version:', latestApprovedOrPublished);
            
            if (latestApprovedOrPublished) {
              const dto = await creatorApi.getScenarioVersion(parentId, latestApprovedOrPublished.id);
              if (dto) {
                const formData = mapDtoToForm(dto);
                // Use highest version number + 1, NOT the approved version number
                formData.version = highestVersionNumber + 1;
                formData.status = "DRAFT";
                setFormData(formData);
                toast.success(`Creating v${formData.version} based on v${dto.versionNumber}. Make your changes and save.`);
              }
            } else {
              // No approved/published version - might be creating from archived
              const latestVersion = allVersions.sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];
              if (latestVersion) {
                const dto = await creatorApi.getScenarioVersion(parentId, latestVersion.id);
                if (dto) {
                  const formData = mapDtoToForm(dto);
                  formData.version = highestVersionNumber + 1;
                  formData.status = "DRAFT";
                  setFormData(formData);
                  toast.success(`Creating v${formData.version} based on archived v${dto.versionNumber}. Make your changes and save.`);
                }
              } else {
                toast.error("No version found to base new version on.");
                navigate('/creator/scenarios');
              }
            }
          }
        } catch (err: any) {
          console.warn("Could not load base scenario data:", err);
          toast.error(err?.response?.data?.message || "Failed to create new version");
          navigate('/creator/scenarios');
        }
      }
    };
    loadScenario();
  }, [urlScenarioId, urlVersionId, baseScenarioId]);

  // Auto-save functionality (only after initial save)
  useEffect(() => {
    if (!hasUnsavedChanges || !savedScenarioId || !savedVersionId) return;
    const timer = setTimeout(() => {
      handleAutoSave();
    }, 3000); // Increased to 3 seconds to reduce frequent saves
    return () => clearTimeout(timer);
  }, [formData, hasUnsavedChanges, savedScenarioId, savedVersionId]);

  const handleAutoSave = async () => {
    if (!savedScenarioId || !savedVersionId) return;
    try {
      setIsSaving(true);
      
      // Images are already uploaded to MinIO, just save the content
      await creatorApi.updateScenarioVersion(savedScenarioId, savedVersionId, mapFormToDto(formData));
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Auto-save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormData = (updates: Partial<ScenarioFormData>) => {
    if (updates.questions) {
      console.log('[ScenarioBuilder] Updating formData with questions:', updates.questions);
    }
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const validateTab = (tab: string): string[] => {
    const errors: string[] = [];
    
    switch (tab) {
      case "basic":
        if (!formData.title) errors.push("Title is required");
        if (!formData.creatorName || formData.creatorName.trim().length === 0) {
          errors.push("Creator name is required");
        }
        if (!formData.shortDesc) errors.push("Short description is required");
        if (!formData.difficulty) errors.push("Difficulty is required");
        if (!formData.category) errors.push("Category is required");
        break;
      case "environment":
        // Allow zero machines if scenario has questions or assets (quiz/writeup-style)
        const hasQuestions = formData.questions && formData.questions.length > 0;
        const hasAssets = formData.assets && formData.assets.length > 0;
        
        if (formData.machines.length === 0 && !hasQuestions && !hasAssets) {
          errors.push("Scenario must have at least one machine, question, or asset");
        }
        break;
      case "questions":
        if (formData.questions.length === 0) errors.push("At least one question is required");
        break;
      case "mission":
        if (!formData.missionBody) errors.push("Mission description is required");
        if (!formData.solutionWriteup) errors.push("Solution write-up is required");
        break;
    }
    
    return errors;
  };

  const validateAll = (): Record<string, string[]> => {
    const allErrors: Record<string, string[]> = {};
    const tabs = ["basic", "environment", "questions", "mission"];
    
    tabs.forEach(tab => {
      const errors = validateTab(tab);
      if (errors.length > 0) {
        allErrors[tab] = errors;
      }
    });
    
    return allErrors;
  };

  const handleSubmitForReview = async () => {
    const errors = validateAll();
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

    // First save the scenario to get IDs
    const saved = await handleSaveDraft(true);
    if (!saved) return;
    
    const { scenarioId, versionId } = saved;

    try {
      // Upload pending assets to MinIO before submission
      const pendingAssets = formData.assets?.filter((a: any) => a.status === 'pending-upload') || [];
      
      if (pendingAssets.length > 0) {
        toast.info(`Uploading ${pendingAssets.length} assets to MinIO...`);
        
        for (const asset of pendingAssets) {
          const formDataUpload = new FormData();
          formDataUpload.append('file', asset.file);
          formDataUpload.append('assetLocation', asset.assetLocation);
          
          if (asset.assetLocation === 'machine-embedded') {
            formDataUpload.append('machineId', asset.machineId);
            formDataUpload.append('targetPath', asset.targetPath);
            formDataUpload.append('permissions', asset.permissions);
          }
          
          if (asset.description) {
            formDataUpload.append('description', asset.description);
          }

          await creatorApi.uploadAsset(scenarioId, versionId, formDataUpload);
        }

        toast.success(`${pendingAssets.length} assets uploaded to MinIO`);
        
        // Update asset statuses in local state
        const updatedAssets = formData.assets?.map((a: any) => 
          a.status === 'pending-upload' ? { ...a, status: 'uploaded' } : a
        );
        updateFormData({ assets: updatedAssets });
      }

      // Now submit for admin review
      await creatorApi.submitScenarioVersion(parentScenarioId!, versionId);
      updateFormData({ status: "SUBMITTED" });
      toast.success("✅ Scenario & assets submitted for admin review");
      setRefreshingList(true);
      navigate("/creator/scenarios");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to submit for review";
      const errors = err?.response?.data?.errors;
      
      if (errors && Array.isArray(errors) && errors.length > 0) {
        // Show each validation error
        errors.forEach((error: string) => toast.error(error));
      } else {
        // Show generic message if no specific errors
        toast.error(errorMessage);
      }
    }
  };

  const handleSaveDraft = async (silent?: boolean) => {
    try {
      setIsSaving(true);
      let scenarioId = savedScenarioId;
      let versionId = savedVersionId;
      
      // Images are already uploaded to MinIO immediately on paste, just save
      const dto = mapFormToDto(formData);
      console.log('[ScenarioBuilder] Saving draft, questions in formData:', formData.questions);
      console.log('[ScenarioBuilder] Saving draft, hints in formData:', formData.hints);
      console.log('[ScenarioBuilder] FormData codeOfEthics:', formData.codeOfEthics);
      console.log('[ScenarioBuilder] FormData learningOutcomes:', formData.learningOutcomes);
      console.log('[ScenarioBuilder] DTO questions being sent to backend:', dto.questions);
      console.log('[ScenarioBuilder] DTO hints being sent to backend:', dto.hints);
      console.log('[ScenarioBuilder] DTO codeOfEthics:', dto.codeOfEthics);
      console.log('[ScenarioBuilder] DTO learningOutcomes:', dto.learningOutcomes);

      if (!scenarioId || !versionId) {
        const res = await creatorApi.createScenario(dto, parentScenarioId);
        scenarioId = res.scenarioId;
        versionId = res.versionId;
        setSavedScenarioId(scenarioId);
        setSavedVersionId(versionId);
        setParentScenarioId(null); // Clear after first save
        
        // ✅ Update formData with response (temp images moved to permanent locations)
        if (res.missionText) {
          console.log('🔄 [createScenario] Updating missionBody from backend response (temp → permanent URLs)');
          setFormData(prev => ({ ...prev, missionBody: res.missionText }));
        }
        if (res.solutionWriteup) {
          console.log('🔄 [createScenario] Updating solutionWriteup from backend response (temp → permanent URLs)');
          setFormData(prev => ({ ...prev, solutionWriteup: res.solutionWriteup }));
        }
      } else {
        const updatedVersion = await creatorApi.updateScenarioVersion(scenarioId, versionId, dto);
        console.log('📦 [saveDraft] Response from backend:', updatedVersion);
        console.log('📦 [saveDraft] Response has missionText?', !!updatedVersion?.missionText);
        console.log('📦 [saveDraft] Response missionText preview:', updatedVersion?.missionText?.substring(0, 150));
        
        // ✅ Update formData with response (backend moved temp images to permanent locations)
        if (updatedVersion?.missionText) {
          console.log('🔄 [updateVersion] Updating missionBody from backend response (temp → permanent URLs)');
          setFormData(prev => ({ ...prev, missionBody: updatedVersion.missionText }));
        }
        if (updatedVersion?.solutionWriteup) {
          console.log('🔄 [updateVersion] Updating solutionWriteup from backend response (temp → permanent URLs)');
          setFormData(prev => ({ ...prev, solutionWriteup: updatedVersion.solutionWriteup }));
        }
      }
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      sessionStorage.setItem("rangex_refresh_scenarios", "1");
      if (!silent) toast.success("Draft saved successfully");
      setRefreshingList(true);
      return { scenarioId, versionId };
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save draft");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const getTabErrors = (tab: string) => {
    return validationErrors[tab] || [];
  };

  const hasTabErrors = (tab: string) => {
    return getTabErrors(tab).length > 0;
  };

  const getTabErrorCount = (tab: string) => {
    return getTabErrors(tab).length;
  };

  const getTotalErrorCount = () => {
    return Object.values(validationErrors).flat().length;
  };

  const handleTabChange = (tab: string) => {
    // If navigating to Review tab, validate all tabs first
    if (tab === 'review') {
      const errors = validateAll();
      setValidationErrors(errors);
      
      const errorCount = Object.keys(errors).length;
      if (errorCount > 0) {
        const totalErrors = Object.values(errors).flat().length;
        toast.warning(
          `Found ${totalErrors} validation error${totalErrors !== 1 ? 's' : ''} in ${errorCount} tab${errorCount !== 1 ? 's' : ''}. Review tab will show details.`,
          { duration: 5000 }
        );
      }
    }
    
    setActiveTab(tab);
  };

  const mapFormToDto = (f: ScenarioFormData) => {
    // Clean questions by removing undefined fields to prevent serialization issues
    const cleanQuestions = (f.questions || []).map(q => {
      const cleaned: any = {
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        maxAttempts: q.maxAttempts,
        validationMode: q.validationMode,
      };
      
      // Only include fields that have values
      if (q.options && q.options.length > 0) cleaned.options = q.options;
      if (q.acceptedAnswers && q.acceptedAnswers.length > 0) cleaned.acceptedAnswers = q.acceptedAnswers;
      if (q.matchingPairs && q.matchingPairs.length > 0) cleaned.matchingPairs = q.matchingPairs;
      if (q.orderingItems && q.orderingItems.length > 0) cleaned.orderingItems = q.orderingItems;
      if (q.correctAnswer !== undefined && q.correctAnswer !== null) cleaned.correctAnswer = q.correctAnswer;
      
      // Map frontend property names to backend property names
      if ((q as any).useRegex !== undefined) cleaned.useRegexMatching = (q as any).useRegex;
      if ((q as any).caseSensitive !== undefined) cleaned.caseSensitiveMatching = (q as any).caseSensitive;
      
      return cleaned;
    });

    // Clean hints by removing undefined/null values and filtering invalid entries
    const cleanHints = (f.hints || [])
      .filter((h: any) => h && typeof h === 'object' && !Array.isArray(h))
      .map((h: any) => ({
        id: h.id,
        title: h.title || "",
        body: h.body || "",
        unlockAfter: typeof h.unlockAfter === 'number' ? h.unlockAfter : 0,
        penaltyPoints: typeof h.penaltyPoints === 'number' ? h.penaltyPoints : 0,
      }));

    // Best Practice: Transform machines to backend MachineInputDto format EXACTLY
    // ⚠️ DISABLED: Machines are now managed via dedicated PUT /creator/machines/:id endpoint
    // Sending machines here causes them to be deleted and recreated, losing updates
    // const cleanMachines = (f.machines || []).map((m: any) => {
    //   ... machine mapping logic ...
    // });
    
    return {
      title: f.title,
      shortDescription: f.shortDesc,
      difficulty: f.difficulty,
      category: f.category,
      tags: f.tags,
      estimatedMinutes: f.estimatedTime,
      scenarioType: f.scenarioType,
      coverImageUrl: f.coverImage, // Include cover image URL
      creatorName: f.creatorName, // Required for submission validation
      missionText: f.missionBody,
      solutionWriteup: f.solutionWriteup,
      // machines: Managed separately via PUT /creator/machines/:id - don't send here
      questions: cleanQuestions,
      hints: cleanHints,
      assets: f.assets || [], // CRITICAL: Include assets when saving
      codeOfEthics: f.codeOfEthics,
      learningOutcomes: f.learningOutcomes,
      // status is set by backend, don't send it
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/creator/scenarios")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">
                    {savedScenarioId ? "Edit Scenario" : "Create New Scenario"}
                  </h1>
                  <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                    {formData.status === "DRAFT" ? "Draft" : 
                     formData.status === "SUBMITTED" ? "Pending Review" :
                     formData.status === "APPROVED" ? "Approved" :
                     formData.status === "PUBLISHED" ? "Published" :
                     formData.status === "ARCHIVED" ? "Archived" :
                     formData.status}
                  </Badge>
                  {formData.version > 1 && (
                    <Badge variant="outline" className="text-xs">
                      v{formData.version}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.title || "Untitled Scenario"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Auto-save indicator */}
              <div className="flex items-center gap-2 text-sm">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-muted-foreground">Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="text-muted-foreground">
                      Saved {lastSaved.toLocaleTimeString()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Not saved</span>
                )}
              </div>

              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>

              {formData.status === "DRAFT" && (
                <Button onClick={handleSubmitForReview}>
                  Submit for Review
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Version Notice */}
      {formData.version > 1 && formData.status === "DRAFT" && (
        <div className="border-b bg-amber-500/10 border-amber-500/20">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>
                Editing v{formData.version}. v{formData.version - 1} is currently live until this version is approved.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="inline-flex h-10 items-center justify-start w-full overflow-x-auto gap-1 bg-background/50 p-1 rounded-lg border border-border/50">
            <TabsTrigger value="basic" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Basic Info</span>
              {hasTabErrors("basic") && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                  {getTabErrorCount("basic")}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="environment" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Environment</span>
              {hasTabErrors("environment") && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                  {getTabErrorCount("environment")}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assets" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Assets</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Questions</span>
              {hasTabErrors("questions") && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                  {getTabErrorCount("questions")}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mission" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Mission</span>
              {hasTabErrors("mission") && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                  {getTabErrorCount("mission")}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="docker-test" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Docker Test</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="relative px-4 py-2 text-sm whitespace-nowrap">
              <span>Review</span>
              {getTotalErrorCount() > 0 && (
                <Badge variant="outline" className="ml-2 h-5 min-w-5 px-1 text-xs border-amber-500/50 text-amber-500">
                  {getTotalErrorCount()}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <BasicInfoTab
              data={formData}
              onChange={updateFormData}
              errors={getTabErrors("basic")}
              scenarioId={savedScenarioId || undefined}
              versionId={savedVersionId || undefined}
            />
          </TabsContent>

          <TabsContent value="environment" className="space-y-6">
            <EnvironmentTopologyTab
              data={formData}
              onChange={updateFormData}
              errors={getTabErrors("environment")}
            />
          </TabsContent>

          <TabsContent value="assets" className="space-y-6">
            <AssetsTab
              data={formData}
              onChange={updateFormData}
              scenarioId={savedScenarioId || undefined}
              versionId={savedVersionId || undefined}
            />
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <QuestionsTab
              data={formData}
              onChange={updateFormData}
              errors={getTabErrors("questions")}
            />
          </TabsContent>

          <TabsContent value="mission" className="space-y-6">
            <MissionSolutionTab
              data={formData}
              onChange={updateFormData}
              errors={getTabErrors("mission")}
              scenarioId={savedScenarioId || undefined}
            />
          </TabsContent>

          <TabsContent value="docker-test" className="space-y-6">
            <CreatorDockerTestTab
              data={formData}
              versionId={savedVersionId || undefined}
            />
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <ReviewTestTab
              data={formData}
              onSaveDraft={handleSaveDraft}
              onSubmitForReview={handleSubmitForReview}
              validationErrors={validationErrors}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
