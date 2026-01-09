import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
  IsArray,
  IsObject,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// Machine entrypoint (connection contract)
class MachineEntrypointDto {
  @IsString()
  @IsEnum(['http', 'https', 'ssh', 'rdp', 'vnc', 'tcp', 'udp'])
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';

  @IsNumber()
  @Min(1)
  @Max(65535)
  containerPort: number;

  @IsBoolean()
  exposedToSolver: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export type MachineRole = 'attacker' | 'internal' | 'service';
export type ResourceProfile = 'micro' | 'small' | 'medium' | 'large';

class HealthcheckDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  test: string[];

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(300)
  intervalSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  timeoutSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retries?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  startPeriodSec?: number;
}

class AttackerBootstrapDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  installPackages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  runCommands?: string[];

  @IsOptional()
  @IsBoolean()
  browserRequired?: boolean;
}

class ComposeExtensionsDto {
  @IsOptional()
  @IsString()
  shmSize?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  capAdd?: string[];

  @IsOptional()
  @IsObject()
  sysctls?: Record<string, string>;

  @IsOptional()
  @IsObject()
  ulimits?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  extraHosts?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  volumes?: string[];
}

export class CreateMachineDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Machine name must be lowercase alphanumeric with hyphens only',
  })
  name: string;

  @IsEnum(['attacker', 'internal', 'service'])
  role: MachineRole;

  @IsOptional()
  @IsUUID()
  imageVariantId?: string;

  @IsOptional()
  @IsString()
  customImageRef?: string;

  @IsString()
  networkGroup: string;

  @IsOptional()
  @IsEnum(['micro', 'small', 'medium', 'large'])
  resourceProfile?: ResourceProfile;

  @IsOptional()
  @IsBoolean()
  allowSolverEntry?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFromAttacker?: boolean;

  @IsOptional()
  @IsBoolean()
  allowInternalConnections?: boolean;

  @IsOptional()
  @IsBoolean()
  isPivotHost?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MachineEntrypointDto)
  @ArrayMaxSize(10)
  entrypoints?: MachineEntrypointDto[];

  @IsOptional()
  @IsString()
  startupCommands?: string;

  // Phase 2-3 Creator Configuration Fields

  @IsOptional()
  @IsObject()
  envVars?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  command?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  entrypoint?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  dependsOn?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => HealthcheckDto)
  healthcheck?: HealthcheckDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  networkAliases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  solverHints?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AttackerBootstrapDto)
  attackerBootstrap?: AttackerBootstrapDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComposeExtensionsDto)
  composeExtensions?: ComposeExtensionsDto;
}

