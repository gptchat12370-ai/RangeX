import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RESOURCE_PROFILES, ResourceProfile } from '../entities/machine.entity';

export class StartEnvironmentDto {
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  ttlMinutes?: number;

  @IsOptional()
  @IsIn(RESOURCE_PROFILES)
  envProfile?: ResourceProfile;

  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
