import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Clock, Shield } from 'lucide-react';
import { httpClient } from '@/services/http-client';

interface ReviewDetails {
  scenarioId: string;
  scenarioTitle: string;
  creatorName: string;
  submittedAt: string;
  dockerCompose: string;
  imageSizeBytes: number;
  scanResults: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: boolean;
    details: string[];
  };
  currentStage: string;
}

interface ImageReviewPanelProps {
  scenarioId: string;
  onReviewComplete: () => void;
}

export function ImageReviewPanel({ scenarioId, onReviewComplete }: ImageReviewPanelProps) {
  const [reviewDetails, setReviewDetails] = useState<ReviewDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    loadReviewDetails();
  }, [scenarioId]);

  const loadReviewDetails = async () => {
    setIsLoading(true);
    try {
      const response = await httpClient.get(`/pipeline/review/${scenarioId}`);
      setReviewDetails(response.data);
    } catch (error) {
      console.error('Failed to load review details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveScenario = async () => {
    if (!confirm('Are you sure you want to approve this scenario? It will be pushed to AWS ECR and become available for challenges.')) {
      return;
    }

    setIsProcessing(true);
    try {
      await httpClient.post(`/pipeline/approve/${scenarioId}`);
      alert('✅ Scenario approved successfully! Pushing to ECR...');
      onReviewComplete();
    } catch (error: any) {
      alert(`❌ Approval failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectScenario = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    if (!confirm('Are you sure you want to reject this scenario?')) {
      return;
    }

    setIsProcessing(true);
    try {
      await httpClient.post(`/pipeline/reject/${scenarioId}`, {
        reason: rejectionReason,
      });
      alert('✅ Scenario rejected. Creator will be notified.');
      onReviewComplete();
    } catch (error: any) {
      alert(`❌ Rejection failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading review details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!reviewDetails) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-muted-foreground">No review details available</p>
        </CardContent>
      </Card>
    );
  }

  const { scanResults } = reviewDetails;
  const totalVulnerabilities = scanResults.critical + scanResults.high + scanResults.medium + scanResults.low;

  return (
    <div className="space-y-4">
      {/* Scenario Information */}
      <Card>
        <CardHeader>
          <CardTitle>Scenario Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Scenario Title</p>
              <p className="font-semibold">{reviewDetails.scenarioTitle}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Creator</p>
              <p className="font-semibold">{reviewDetails.creatorName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
              <p className="font-semibold">{new Date(reviewDetails.submittedAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Image Size</p>
              <p className="font-semibold">{(reviewDetails.imageSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Stage</p>
              <Badge>{reviewDetails.currentStage}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Scan Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Scan Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status */}
          <Alert className={scanResults.passed ? 'border-green-500' : 'border-red-500'}>
            <AlertDescription className="flex items-center gap-2">
              {scanResults.passed ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-semibold">Security scan passed</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-semibold">Security scan failed - manual review required</span>
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Vulnerability Breakdown */}
          <div className="grid grid-cols-4 gap-4">
            <Card className={scanResults.critical > 0 ? 'border-red-500' : ''}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-500">{scanResults.critical}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </CardContent>
            </Card>
            <Card className={scanResults.high > 0 ? 'border-orange-500' : ''}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-orange-500">{scanResults.high}</p>
                <p className="text-sm text-muted-foreground">High</p>
              </CardContent>
            </Card>
            <Card className={scanResults.medium > 0 ? 'border-yellow-500' : ''}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-yellow-500">{scanResults.medium}</p>
                <p className="text-sm text-muted-foreground">Medium</p>
              </CardContent>
            </Card>
            <Card className={scanResults.low > 0 ? 'border-blue-500' : ''}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-blue-500">{scanResults.low}</p>
                <p className="text-sm text-muted-foreground">Low</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Issues */}
          {scanResults.details.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Vulnerability Details</h4>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {scanResults.details.map((detail, idx) => (
                  <Alert key={idx} variant="default" className="text-sm">
                    <AlertDescription>{detail}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {totalVulnerabilities === 0 && (
            <Alert className="border-green-500">
              <AlertDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No vulnerabilities detected! This image is clean.</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Docker Compose */}
      <Card>
        <CardHeader>
          <CardTitle>docker-compose.yml</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-[300px] font-mono">
            {reviewDetails.dockerCompose}
          </pre>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {!showRejectForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={approveScenario}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Push to ECR
                </>
              )}
            </Button>

            <Button
              onClick={() => setShowRejectForm(true)}
              disabled={isProcessing}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reject Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Rejection Reason (will be sent to creator)
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Image contains critical vulnerabilities (CVE-2023-1234)&#10;Please update base image to ubuntu:22.04 and resubmit."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={rejectScenario}
                disabled={isProcessing || !rejectionReason.trim()}
                variant="destructive"
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirm Rejection
                  </>
                )}
              </Button>

              <Button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
