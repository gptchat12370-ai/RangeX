import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { RESOURCE_PROFILES } from '../entities/machine.entity';

export class CreatePlatformImageDto {
  @IsString()
  @Length(2, 120)
  label: string;

  @IsString()
  @Length(3, 255)
  imageRef: string;

  @IsBoolean()
  compatibleAttacker: boolean;

  @IsBoolean()
  compatibleInternal: boolean;

  @IsBoolean()
  compatibleService: boolean;

  @IsEnum(RESOURCE_PROFILES)
  resourceProfile: (typeof RESOURCE_PROFILES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlatformImageDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  label?: string;

  @IsOptional()
  @IsString()
  @Length(3, 255)
  imageRef?: string;

  @IsOptional()
  @IsBoolean()
  compatibleAttacker?: boolean;

  @IsOptional()
  @IsBoolean()
  compatibleInternal?: boolean;

  @IsOptional()
  @IsBoolean()
  compatibleService?: boolean;

  @IsOptional()
  @IsString()
  resourceProfile?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
