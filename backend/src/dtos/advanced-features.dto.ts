import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class ValidateDockerComposeDto {
  @IsNotEmpty()
  @IsString()
  dockerCompose: string;
}

export class TestScenarioDto {
  @IsNotEmpty()
  @IsString()
  dockerCompose: string;
}

export class SubmitToStagingDto {
  @IsNotEmpty()
  @IsString()
  dockerCompose: string;
}

export class ApproveScenarioDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectScenarioDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class IncreaseBudgetDto {
  @IsNotEmpty()
  @IsNumber()
  newLimit: number;
}

export class CreateGuiSessionDto {
  @IsOptional()
  @IsString()
  sessionType?: 'desktop' | 'terminal-only';
}
