import React, { useEffect, useState } from 'react';
import { Check, Info, Cpu, HardDrive, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { creatorApi } from '../../api/creatorApi';

interface ImageVariant {
  id: string;
  baseOs: string;
  variantType: 'lite' | 'standard' | 'full';
  imageRef: string;
  displayName: string;
  description: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  hourlyCostRm: number;
  suitableForRoles: string[];
  includedTools: string[];
  isActive: boolean;
  isAdminApproved: boolean;
  tags: string[];
  defaultEntrypoints?: Array<{
    protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
}

interface ImageVariantSelectorProps {
  role: 'attacker' | 'internal' | 'service';
  selectedVariantId?: string;
  onChange: (variantId: string, variant: ImageVariant) => void;
  disabled?: boolean;
}

const ImageVariantSelector: React.FC<ImageVariantSelectorProps> = ({
  role,
  selectedVariantId,
  onChange,
  disabled = false,
}) => {
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ImageVariant | null>(null);

  useEffect(() => {
    loadVariants();
  }, [role]);

  useEffect(() => {
    // When selectedVariantId changes from parent, update the selected variant
    if (selectedVariantId && variants.length > 0) {
      const variant = variants.find((v: ImageVariant) => v.id === selectedVariantId);
      if (variant) {
        setSelectedVariant(variant);
      }
    }
  }, [selectedVariantId, variants]);

  const loadVariants = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await creatorApi.getImageVariantsByRole(role);

      setVariants(data);

      // Only update selected variant if one is already set (don't auto-select)
      // This prevents overriding custom images when user types in public/private image fields
      if (selectedVariantId) {
        const variant = data.find((v: ImageVariant) => v.id === selectedVariantId);
        setSelectedVariant(variant || null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load image variants');
      console.error('Failed to load variants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (variant) {
      setSelectedVariant(variant);
      onChange(variantId, variant);
    }
  };

  const getVariantColor = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'lite':
        return 'default';
      case 'standard':
        return 'secondary';
      case 'full':
        return 'outline';
      default:
        return 'default';
    }
  };

  const formatCost = (hourlyRm: number | string) => {
    const cost = typeof hourlyRm === 'string' ? parseFloat(hourlyRm) : hourlyRm;
    return {
      hourly: `RM ${cost.toFixed(4)}/hr`,
      daily: `RM ${(cost * 24).toFixed(2)}/day`,
      monthly: `RM ${(cost * 24 * 30).toFixed(2)}/mo`,
    };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (variants.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No image variants available for role: {role}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Image Variant (Platform Library)</Label>
        <Select
          value={selectedVariantId || ''}
          onValueChange={handleChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select image variant..." />
          </SelectTrigger>
          <SelectContent>
            {variants.map((variant) => (
              <SelectItem key={variant.id} value={variant.id}>
                <div className="flex items-center gap-2">
                  <span>{variant.displayName}</span>
                  <Badge variant={getVariantColor(variant.variantType)} className="ml-2">
                    {variant.variantType.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatCost(variant.hourlyCostRm).hourly}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedVariant && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{selectedVariant.displayName}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {selectedVariant.description}
                </CardDescription>
              </div>
              {selectedVariant.variantType === 'lite' && (
                <Badge variant="default" className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Recommended
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Resource Info */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{selectedVariant.cpuCores}</span>
                <span className="text-xs text-muted-foreground">CPU</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{selectedVariant.memoryMb} MB</span>
                <span className="text-xs text-muted-foreground">RAM</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{selectedVariant.diskGb} GB</span>
                <span className="text-xs text-muted-foreground">Disk</span>
              </div>
            </div>

            {/* Cost Info */}
            <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="font-mono">
                  {formatCost(selectedVariant.hourlyCostRm).hourly}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatCost(selectedVariant.hourlyCostRm).daily} • 
                  {formatCost(selectedVariant.hourlyCostRm).monthly}
                </span>
              </div>
            </div>

            {/* Included Tools */}
            {selectedVariant.includedTools && selectedVariant.includedTools.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>Included Tools:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedVariant.includedTools.slice(0, 8).map((tool) => (
                    <Badge key={tool} variant="secondary" className="text-xs py-0 px-2">
                      {tool}
                    </Badge>
                  ))}
                  {selectedVariant.includedTools.length > 8 && (
                    <Badge variant="secondary" className="text-xs py-0 px-2">
                      +{selectedVariant.includedTools.length - 8} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Cost Optimization Note */}
            {selectedVariant.variantType === 'lite' && (
              <Alert className="bg-blue-500/10 border-blue-500/20">
                <Check className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-xs text-blue-300">
                  <strong>Cost-Optimized:</strong> This lite variant provides significant cost savings 
                  while maintaining essential functionality.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageVariantSelector;
