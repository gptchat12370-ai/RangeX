import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSystemSettingsDto {
  // Access Control
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @IsOptional()
  @IsBoolean()
  allowNewRegistrations?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  maxConcurrentUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  maxTotalUsers?: number;

  // Session Limits
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSessionsPerUser?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSessionsPerHour?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  maxSessionsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  idleTimeoutMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(480)
  maxSessionDurationMinutes?: number;

  // Container Resources
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxTotalContainers?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  cpuLimitMillicores?: number;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(8192)
  memoryLimitMb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  diskLimitGb?: number;

  // Budget Control
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  budgetSoftCapUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  budgetHardCapUsd?: number;

  @IsOptional()
  @IsString()
  budgetAlertEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(95)
  budgetAlertPercentage?: number;

  @IsOptional()
  @IsBoolean()
  autoMaintenanceOnBudgetCap?: boolean;

  // Scenario Access
  @IsOptional()
  @IsBoolean()
  allowAllScenarios?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxAccessibleScenarios?: number;

  // Storage
  @IsOptional()
  @IsString()
  minioEndpoint?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  minioPort?: number;

  @IsOptional()
  @IsBoolean()
  minioUseSSL?: boolean;

  @IsOptional()
  @IsString()
  minioAccessKey?: string;

  @IsOptional()
  @IsString()
  minioSecretKey?: string;

  @IsOptional()
  @IsString()
  minioBucket?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStoragePerUserBytes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTotalStorageBytes?: number;

  // AWS Configuration
  @IsOptional()
  @IsString()
  awsRegion?: string;

  @IsOptional()
  @IsString()
  awsVpcId?: string;

  @IsOptional()
  @IsString()
  awsSubnets?: string;

  @IsOptional()
  @IsString()
  awsSecurityGroups?: string;
}
