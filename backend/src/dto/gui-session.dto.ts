import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OSType {
  LINUX = 'linux',
  WINDOWS = 'windows',
  MACOS = 'macos',
}

/**
 * DTO for creating a GUI session
 * SECURITY: containerIp removed - derived from session in controller
 */
export class CreateGuiSessionDto {
  @IsNotEmpty()
  @IsEnum(OSType)
  osType: OSType;
}

/**
 * DTO for SSH connection request
 */
export class SshConnectionDto {
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @IsNotEmpty()
  @IsString()
  machineId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
