import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsUUID()
  preferredAttackerVariantId?: string;

  @IsOptional()
  @IsUUID()
  preferredVictimVariantId?: string;

  @IsOptional()
  @IsUUID()
  preferredServiceVariantId?: string;

  @IsOptional()
  @IsEnum(['micro', 'small', 'medium', 'large'])
  defaultResourceProfile?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnRejection?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnCostAlert?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costAlertThreshold?: number;
}

export class SaveDockerCredentialsDto {
  @IsString()
  registryUrl: string;

  @IsString()
  username: string;

  @IsString()
  password: string;
}
