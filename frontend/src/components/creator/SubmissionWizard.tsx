import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Stepper, Step, StepLabel } from '@/components/ui/stepper';
import { Upload, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface PipelineStatus {
  currentStage: 'local' | 'draft' | 'local_test' | 'submitted' | 'review' | 'bundled' | 'deployed';
  localTestStatus?: 'NONE' | 'RUNNING' | 'PASS' | 'FAIL' | 'STOPPED';
  bundleStatus?: 'NONE' | 'CREATING' | 'READY' | 'FAILED';
  stagingSubmittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  scanResults?: {
    vulnerabilities: { critical: number; high: number; medium: number; low: number };
    passed: boolean;
  };
}

interface SubmissionWizardProps {
  scenarioId: string;
  dockerCompose: string;
}

export function SubmissionWizard({ scenarioId, dockerCompose }: SubmissionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const steps = [
    { label: 'Design', description: 'Configure machines & assets' },
    { label: 'Local Test', description: 'Test with Docker locally' },
    { label: 'Submit', description: 'Submit for review' },
    { label: 'Admin Review', description: 'Security & approval' },
    { label: 'Bundled', description: 'Ready for deployment' },
    { label: 'Deployed', description: 'Live on AWS' },
  ];

  useEffect(() => {
    loadPipelineStatus();
    const interval = setInterval(loadPipelineStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [scenarioId]);

  const loadPipelineStatus = async () => {
    try {
      const response = await httpClient.get(`/pipeline/status/${scenarioId}`);
      setPipelineStatus(response.data);
      updateCurrentStepFromStatus(response.data);
    } catch (error) {
      console.error('Failed to load pipeline status:', error);
    }
  };

  const updateCurrentStepFromStatus = (status: PipelineStatus) => {
    const stageIndex = {
      draft: 0,
      local_test: 1,
      submitted: 2,
      review: 3,
      bundled: 4,
      deployed: 5,
    };
    setCurrentStep(stageIndex[status.currentStage] || 0);
  };

  const submitToStaging = async () => {
    // Check local test status
    if (pipelineStatus?.localTestStatus !== 'PASS') {
      alert(`Cannot submit: Local test status is ${pipelineStatus?.localTestStatus || 'NONE'}. Must be PASS.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // NEW: No body required - backend derives image name
      const response = await httpClient.post(`/pipeline/submit/${scenarioId}`);

      setSubmissionResult(response.data);
      await loadPipelineStatus();
    } catch (error: any) {
      setSubmissionResult({ success: false, error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageIcon = (stageIndex: number) => {
    if (!pipelineStatus) return <Clock className="h-4 w-4" />;

    const currentIndex = steps.findIndex((s) => s.label.toLowerCase().includes(pipelineStatus.currentStage));

    if (stageIndex < currentIndex) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (stageIndex === currentIndex) {
      if (pipelineStatus.rejectedAt) {
        return <XCircle className="h-4 w-4 text-red-500" />;
      }
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    } else {
      return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStageVariant = (stageIndex: number) => {
    if (!pipelineStatus) return 'secondary';

    const currentIndex = steps.findIndex((s) => s.label.toLowerCase().includes(pipelineStatus.currentStage));

    if (stageIndex < currentIndex) {
      return 'default'; // Completed
    } else if (stageIndex === currentIndex) {
      if (pipelineStatus.rejectedAt) {
        return 'destructive';
      }
      return 'default'; // Current
    } else {
      return 'secondary'; // Pending
    }
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Image Deployment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Visual Stepper */}
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= index ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-background'
                  }`}>
                    {getStageIcon(index)}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 w-full mt-5 ${
                      currentStep > index ? 'bg-primary' : 'bg-muted'
                    }`} style={{ position: 'absolute', left: '50%', width: '100%', marginTop: '-1.25rem' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Status Messages */}
            {pipelineStatus && (
              <div className="space-y-2">
                {/* Local Test Status */}
                {pipelineStatus.localTestStatus && (
                  <Alert className={
                    pipelineStatus.localTestStatus === 'PASS' ? 'border-green-500' :
                    pipelineStatus.localTestStatus === 'FAIL' ? 'border-red-500' :
                    pipelineStatus.localTestStatus === 'RUNNING' ? 'border-blue-500' :
                    'border-gray-500'
                  }>
                    <AlertDescription className="flex items-center gap-2">
                      {pipelineStatus.localTestStatus === 'PASS' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {pipelineStatus.localTestStatus === 'FAIL' && <XCircle className="h-4 w-4 text-red-500" />}
                      {pipelineStatus.localTestStatus === 'RUNNING' && <Clock className="h-4 w-4 text-blue-500 animate-pulse" />}
                      <span className="font-semibold">Local Test: {pipelineStatus.localTestStatus}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Bundle Status */}
                {pipelineStatus.bundleStatus && pipelineStatus.bundleStatus !== 'NONE' && (
                  <Alert className={
                    pipelineStatus.bundleStatus === 'READY' ? 'border-green-500' :
                    pipelineStatus.bundleStatus === 'FAILED' ? 'border-red-500' :
                    'border-blue-500'
                  }>
                    <AlertDescription className="flex items-center gap-2">
                      {pipelineStatus.bundleStatus === 'READY' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {pipelineStatus.bundleStatus === 'FAILED' && <XCircle className="h-4 w-4 text-red-500" />}
                      {pipelineStatus.bundleStatus === 'CREATING' && <Clock className="h-4 w-4 text-blue-500 animate-pulse" />}
                      <span className="font-semibold">Bundle: {pipelineStatus.bundleStatus}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {pipelineStatus.currentStage === 'submitted' && !pipelineStatus.reviewedAt && (
                  <Alert className="border-blue-500">
                    <AlertDescription className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
                      <span>Submitted for review. Waiting for admin approval...</span>
                    </AlertDescription>
                  </Alert>
                )}

                {pipelineStatus.currentStage === 'review' && (
                  <Alert className="border-yellow-500">
                    <AlertDescription className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span>Under admin review. Security scan in progress...</span>
                    </AlertDescription>
                  </Alert>
                )}

                {pipelineStatus.rejectedAt && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          <span className="font-semibold">Rejected by admin</span>
                        </div>
                        <p className="text-sm">Reason: {pipelineStatus.rejectionReason || 'No reason provided'}</p>
                        <p className="text-xs mt-2">Please fix the issues and resubmit.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {pipelineStatus.approvedAt && pipelineStatus.currentStage === 'bundled' && (
                  <Alert className="border-green-500">
                    <AlertDescription className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Approved! Bundle created and ready for deployment.</span>
                    </AlertDescription>
                  </Alert>
                )}

                {pipelineStatus.currentStage === 'deployed' && (
                  <Alert className="border-green-500">
                    <AlertDescription className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-semibold">✅ Deployed to AWS!</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Security Scan Results */}
            {pipelineStatus?.scanResults && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">Security Scan Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">
                        {pipelineStatus.scanResults.vulnerabilities.critical}
                      </p>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-500">
                        {pipelineStatus.scanResults.vulnerabilities.high}
                      </p>
                      <p className="text-xs text-muted-foreground">High</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-500">
                        {pipelineStatus.scanResults.vulnerabilities.medium}
                      </p>
                      <p className="text-xs text-muted-foreground">Medium</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-500">
                        {pipelineStatus.scanResults.vulnerabilities.low}
                      </p>
                      <p className="text-xs text-muted-foreground">Low</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Badge variant={pipelineStatus.scanResults.passed ? 'default' : 'destructive'}>
                      {pipelineStatus.scanResults.passed ? 'Scan Passed' : 'Scan Failed'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submission Button */}
      {(!pipelineStatus || pipelineStatus.currentStage === 'local_test' || pipelineStatus.rejectedAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Submit?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Your scenario must pass local testing before submission. Once submitted, an admin will review your scenario.
              </AlertDescription>
            </Alert>

            <Button
              onClick={submitToStaging}
              disabled={isSubmitting || pipelineStatus?.localTestStatus !== 'PASS'}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>

            {submissionResult && (
              <Alert className={submissionResult.success ? 'border-green-500' : 'border-red-500'}>
                <AlertDescription>
                  {submissionResult.success ? (
                    <>✅ Submitted successfully! Your scenario is now pending admin review.</>
                  ) : (
                    <>❌ Submission failed: {submissionResult.error}</>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
