import { IsString, IsNumber, IsBoolean, IsOptional, IsIn, Min, Max, Matches, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTO for entrypoint validation (matches MachineEntrypoint interface)
export class EntrypointDto {
  @IsString()
  @IsIn(['http', 'https', 'ssh', 'rdp', 'vnc', 'tcp', 'udp'])
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';

  @IsNumber()
  @Min(1)
  @Max(65535)
  containerPort: number;

  @IsBoolean()
  exposedToSolver: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;
}

export class CreateImageVariantDto {
  @IsString()
  @IsIn(['kali', 'ubuntu', 'windows', 'debian', 'alpine', 'parrot', 'fedora', 'centos'])
  baseOs: string;

  @IsString()
  @IsIn(['lite', 'standard', 'full'])
  variantType: string;

  @IsString()
  @Matches(/^[a-z0-9\-\.\/]+:[a-z0-9\.\-_]+$/i, { 
    message: 'imageRef must be in format "repository:tag" (e.g., kalilinux/kali-rolling:2024.1 or ubuntu:22.04)' 
  })
  imageRef: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string; // Specific version tag (e.g., '2024.1', '22.04', 'v1.16.1')

  @IsOptional()
  @IsString()
  @IsIn(['attacker', 'library', 'service'])
  imageCategory?: string; // Categorize images

  @IsString()
  displayName: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0.25)
  @Max(8)
  cpuCores: number;

  @IsNumber()
  @Min(128)
  @Max(16384)
  memoryMb: number;

  @IsNumber()
  @Min(1)
  @Max(500)
  diskGb: number;

  @IsNumber()
  @Min(0)
  hourlyCostRm: number;

  @IsString()
  @IsIn(['attacker', 'internal', 'service', 'attacker,internal', 'internal,service'])
  suitableForRoles: string;

  @IsOptional()
  @IsString()
  includedTools?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsBoolean()
  requiresGpu?: boolean;

  @IsOptional()
  @IsBoolean()
  hasGui?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['ssh', 'rdp', 'vnc', 'http', 'https'])
  accessMethod?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntrypointDto)
  defaultEntrypoints?: EntrypointDto[];

  @IsOptional()
  @IsString()
  @IsIn(['attacker', 'dmz', 'internal', 'mgmt'])
  recommendedNetworkGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateImageVariantDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['lite', 'standard', 'full'])
  variantType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(8)
  cpuCores?: number;

  @IsOptional()
  @IsNumber()
  @Min(128)
  @Max(16384)
  memoryMb?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  diskGb?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCostRm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdminApproved?: boolean;

  @IsOptional()
  @IsString()
  includedTools?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  suitableForRoles?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  imageCategory?: string;

  @IsOptional()
  @IsString()
  imageRef?: string; // Allow updating image reference

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntrypointDto)
  defaultEntrypoints?: EntrypointDto[];

  @IsOptional()
  @IsBoolean()
  hasGui?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['attacker', 'dmz', 'internal', 'mgmt'])
  recommendedNetworkGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
