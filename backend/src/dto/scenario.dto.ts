import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IMAGE_SOURCE_TYPES, MACHINE_ROLES, RESOURCE_PROFILES, ImageSourceType, MachineRole, ResourceProfile } from '../entities/machine.entity';
import { ScenarioType } from '../entities/scenario-version.entity';

export class QuestionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  text: string;

  @IsInt()
  @Min(0)
  points: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @IsOptional()
  @IsString()
  validationMode?: string;

  @IsOptional()
  @IsBoolean()
  useRegexMatching?: boolean;

  @IsOptional()
  @IsBoolean()
  caseSensitiveMatching?: boolean;

  @IsOptional()
  options?: any;

  @IsOptional()
  acceptedAnswers?: any;

  @IsOptional()
  matchingPairs?: any;

  @IsOptional()
  orderingItems?: any;

  @IsOptional()
  correctAnswer?: any;
}

export class HintDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  body: string;

  @IsInt()
  @Min(0)
  unlockAfter: number;

  @IsInt()
  @Min(0)
  penaltyPoints: number;
}

export class MachineInputDto {
  @IsOptional()
  @IsString()
  id?: string; // Frontend machine ID for mapping assets

  @IsString()
  @Length(1, 120)
  name: string;

  @IsEnum(MACHINE_ROLES)
  role: MachineRole;

  @IsEnum(IMAGE_SOURCE_TYPES)
  imageSourceType: ImageSourceType;

  @IsString()
  @Length(1, 255)
  imageRef: string;

  @IsOptional()
  @IsString()
  imageVariantId?: string;

  @IsOptional()
  @IsString()
  registryCredentialId?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  networkGroup: string;

  @IsOptional()
  @IsEnum(['none', 'session-only', 'internet'])
  networkEgressPolicy?: 'none' | 'session-only' | 'internet';

  @IsEnum(RESOURCE_PROFILES)
  resourceProfile: ResourceProfile;

  @IsBoolean()
  allowSolverEntry: boolean;

  @IsBoolean()
  allowFromAttacker: boolean;

  @IsBoolean()
  allowInternalConnections: boolean;

  @IsBoolean()
  isPivotHost: boolean;

  @IsOptional()
  @IsString()
  startupCommands?: string;

  @IsOptional()
  @IsArray()
  entrypoints?: Array<{
    protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
}

export class CreateScenarioDto {
  @IsString()
  @Length(2, 160)
  title: string;

  @IsOptional()
  @IsString()
  @Length(0, 400)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  difficulty?: string;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsInt()
  @Min(5)
  @Max(480)
  estimatedMinutes: number;

  @IsEnum(['challenge', 'open_lab', 'event_lab'])
  scenarioType: ScenarioType;

  @IsOptional()
  @IsString()
  // Allow short drafts; final approval can still enforce richer content
  @Length(0, 5000)
  missionText?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  solutionWriteup?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => MachineInputDto)
  machines?: MachineInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HintDto)
  hints?: HintDto[];

  @IsOptional()
  @IsString()
  @Length(0, 100)
  creatorName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  codeOfEthics?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  learningOutcomes?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

export class ApproveScenarioDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectScenarioDto {
  @IsString()
  @Length(5, 500)
  reason: string;
}

export class UpdateScenarioVersionDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  creatorName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 400)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  difficulty?: string;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(['challenge', 'open_lab', 'event_lab'])
  scenarioType?: ScenarioType;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  missionText?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  solutionWriteup?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  requiresMachines?: boolean;

  @IsOptional()
  @IsString()
  codeOfEthics?: string;

  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @IsOptional()
  @IsString()
  validationMode?: string;

  @IsOptional()
  @IsString()
  scoringMode?: string;

  @IsOptional()
  @IsString()
  hintMode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => MachineInputDto)
  machines?: MachineInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HintDto)
  hints?: HintDto[];

  @IsOptional()
  @IsArray()
  assets?: any[]; // Asset metadata from frontend (library references or uploaded files)
}
