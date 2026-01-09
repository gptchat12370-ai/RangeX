import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CloudDownload, CheckCircle, AlertTriangle, XCircle, RefreshCw, Code } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { creatorApi } from '../../api/creatorApi';

interface EnvironmentComposeSyncProps {
  scenarioVersionId: string;
  currentDockerCompose?: string;
  onComposeGenerated: (dockerCompose: string) => void;
  autoGenerateOnMount?: boolean;
}

export interface EnvironmentComposeSyncRef {
  generateCompose: () => Promise<void>;
  validateCompose: () => Promise<void>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const EnvironmentComposeSync = forwardRef<EnvironmentComposeSyncRef, EnvironmentComposeSyncProps>(({
  scenarioVersionId,
  currentDockerCompose,
  onComposeGenerated,
  autoGenerateOnMount = true,
}, ref) => {
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'out-of-sync' | 'unknown'>('unknown');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [machineCount, setMachineCount] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Auto-generate on mount if enabled
  useEffect(() => {
    if (autoGenerateOnMount && scenarioVersionId) {
      handleAutoGenerate();
    }
  }, [scenarioVersionId, autoGenerateOnMount]);

  // Auto-validate when compose changes
  useEffect(() => {
    if (currentDockerCompose && currentDockerCompose.trim()) {
      handleValidateSync();
    }
  }, [currentDockerCompose]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    generateCompose: handleAutoGenerate,
    validateCompose: handleValidateSync,
  }));

  const handleAutoGenerate = async () => {
    try {
      setGenerating(true);

      const data = await creatorApi.generateDockerCompose(scenarioVersionId);

      // Backend returns: { finalComposeYAML, normalizedEnvironmentSnapshot, estimatedCost, warnings, corrections }
      const compose = data.finalComposeYAML || '';
      const count = data.normalizedEnvironmentSnapshot?.machines?.length || 0;
      const costPerHour = data.estimatedCost?.hourlyRM || 0;

      setMachineCount(count);
      setEstimatedCost(costPerHour);
      onComposeGenerated(compose);
      setSyncStatus('synced');

      // Show success message with warnings if any
      setValidation({
        valid: true,
        errors: [],
        warnings: data.warnings || [],
      });

      toast.success(`✅ Generated docker-compose with ${count} services`);
    } catch (err: any) {
      console.error('Failed to generate docker-compose:', err);
      setValidation({
        valid: false,
        errors: [err.response?.data?.message || 'Failed to generate docker-compose'],
        warnings: [],
      });
      setSyncStatus('out-of-sync');
      toast.error('Failed to generate docker-compose');
    } finally {
      setGenerating(false);
    }
  };

  const handleValidateSync = async () => {
    if (!currentDockerCompose) {
      toast.error('No docker-compose file to validate');
      return;
    }

    try {
      setValidating(true);

      const result: ValidationResult = await creatorApi.validateDockerComposeSync(
        scenarioVersionId,
        currentDockerCompose
      );

      setValidation(result);
      setSyncStatus(result.valid && result.warnings.length === 0 ? 'synced' : 'out-of-sync');

      if (result.valid && result.warnings.length === 0) {
        toast.success('✅ Environment and compose are synchronized');
      } else if (result.errors.length > 0) {
        toast.error(`❌ Validation failed with ${result.errors.length} errors`);
      } else {
        toast.warning(`⚠️ ${result.warnings.length} warnings found`);
      }
    } catch (err: any) {
      console.error('Failed to validate sync:', err);
      setValidation({
        valid: false,
        errors: [err.response?.data?.message || 'Failed to validate synchronization'],
        warnings: [],
      });
      setSyncStatus('out-of-sync');
      toast.error('Failed to validate synchronization');
    } finally {
      setValidating(false);
    }
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'synced':
        return 'bg-green-500/20 border-green-500/30';
      case 'out-of-sync':
        return 'bg-red-500/20 border-red-500/30';
      default:
        return 'bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'out-of-sync':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'synced':
        return 'Environment and Docker-Compose are synchronized';
      case 'out-of-sync':
        return 'Environment and Docker-Compose are out of sync';
      default:
        return 'Synchronization status unknown';
    }
  };

  return (
    <div className="space-y-4">
      {/* Sync Status Indicator */}
      <div className={`p-3 rounded-lg border-2 ${getSyncStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSyncStatusIcon()}
            <span className="text-sm font-semibold">{getSyncStatusText()}</span>
          </div>
          <Badge 
            variant={syncStatus === 'synced' ? 'default' : syncStatus === 'out-of-sync' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {syncStatus === 'synced' ? 'SYNCED' : syncStatus === 'out-of-sync' ? 'OUT OF SYNC' : 'AUTO-GENERATING'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Docker-compose is automatically generated and validated when you save machines
        </p>
      </div>

      {/* Machine and Cost Info */}
      {machineCount > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Code className="h-3 w-3" />
            {machineCount} Services
          </Badge>
          <Badge variant="outline" className="bg-green-500/10 text-green-400">
            RM {estimatedCost.toFixed(4)}/hour
          </Badge>
          <Badge variant="outline" className="bg-green-500/10 text-green-400">
            RM {(estimatedCost * 24).toFixed(2)}/day
          </Badge>
        </div>
      )}

      {/* Validation Results */}
      {validation && (
        <div className="space-y-2">
          {validation.valid && validation.warnings.length === 0 && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                ✅ Your environment and docker-compose file are perfectly synchronized!
              </AlertDescription>
            </Alert>
          )}

          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Errors ({validation.errors.length}):</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && validation.errors.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Warnings ({validation.warnings.length}):</div>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-600">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Info Alert */}
      {!currentDockerCompose && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <AlertDescription className="text-sm text-blue-300">
            <strong>No Docker-Compose file yet</strong>
            <br />
            Click "Auto-Generate" to create a docker-compose.yml from your environment machines.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

EnvironmentComposeSync.displayName = 'EnvironmentComposeSync';

export default EnvironmentComposeSync;
