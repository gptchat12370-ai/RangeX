import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * File Organization Service
 * 
 * Centralizes all object storage path generation and validation following best practices:
 * - Hierarchical structure: resource-type/resource-id/sub-type/file
 * - UUID-based filenames to prevent collisions
 * - Type-based folders for easy management
 * - Version isolation for clean lifecycle management
 * - Temporary storage for unsaved uploads
 */

export enum FileType {
  COVER_IMAGE = 'cover',
  MISSION_IMAGE = 'mission-images',
  WRITEUP_IMAGE = 'writeup-images',
  DOWNLOADABLE_ASSET = 'assets',
  DOCKER_COMPOSE = 'docker-compose',
  PROFILE_AVATAR = 'profiles',
  TEMP_UPLOAD = 'temp',
}

export interface UploadContext {
  userId: string;
  scenarioId?: string;
  versionId?: string;
  fileType: FileType;
  originalFilename: string;
  mimetype: string;
}

export interface PathComponents {
  bucket: string;
  objectPath: string;
  publicUrl: string;
}

@Injectable()
export class FileOrganizationService {
  private readonly BUCKET_NAME = 'rangex-uploads';
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  private readonly ALLOWED_ASSET_TYPES = [
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain',
    'application/json',
  ];
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB
  
  /**
   * Generate organized path for file upload
   * 
   * Examples:
   * - Cover: scenarios/cover-images/{scenarioId}/{versionId}/cover.jpg
   * - Mission Image: scenarios/editor-images/{scenarioId}/{versionId}/{uuid}.png
   * - Asset: scenarios/assets/images/{scenarioId}/{versionId}/{uuid}.pdf
   * - Temp: scenarios/temp/{userId}/{uuid}.jpg
   */
  generateUploadPath(context: UploadContext): PathComponents {
    // Validate context
    this.validateUploadContext(context);
    
    // Generate filename
    const extension = this.getFileExtension(context.originalFilename);
    const filename = this.generateFilename(context.fileType, extension);
    
    // Build path based on file type
    let objectPath: string;
    
    switch (context.fileType) {
      case FileType.COVER_IMAGE:
        if (!context.scenarioId || !context.versionId) {
          throw new BadRequestException('Cover images require scenarioId and versionId');
        }
        objectPath = `scenarios/cover-images/${context.scenarioId}/${context.versionId}/${filename}`;
        break;
        
      case FileType.MISSION_IMAGE:
      case FileType.WRITEUP_IMAGE:
        if (!context.scenarioId || !context.versionId) {
          throw new BadRequestException(`${context.fileType} requires scenarioId and versionId`);
        }
        objectPath = `scenarios/editor-images/${context.scenarioId}/${context.versionId}/${filename}`;
        break;
        
      case FileType.DOWNLOADABLE_ASSET:
        if (!context.scenarioId || !context.versionId) {
          throw new BadRequestException('Assets require scenarioId and versionId');
        }
        objectPath = `scenarios/assets/images/${context.scenarioId}/${context.versionId}/${filename}`;
        break;
        
      case FileType.DOCKER_COMPOSE:
        if (!context.scenarioId || !context.versionId) {
          throw new BadRequestException('Docker compose requires scenarioId and versionId');
        }
        objectPath = `scenarios/${context.versionId}/docker-compose.yml`;
        break;
        
      case FileType.PROFILE_AVATAR:
        objectPath = `profiles/${context.userId}/avatar.${extension}`;
        break;
        
      case FileType.TEMP_UPLOAD:
        objectPath = `scenarios/temp/${context.userId}/${filename}`;
        break;
        
      default:
        throw new BadRequestException('Invalid file type');
    }
    
    return {
      bucket: this.BUCKET_NAME,
      objectPath,
      publicUrl: `/api/assets/file/${objectPath}`,
    };
  }
  
  /**
   * Validate file upload
   */
  validateFile(file: Express.Multer.File, fileType: FileType): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    
    // Validate mimetype based on file type
    if (this.isImageType(fileType)) {
      if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid image type. Allowed: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
        );
      }
      
      if (file.size > this.MAX_IMAGE_SIZE) {
        throw new BadRequestException(`Image must be less than ${this.MAX_IMAGE_SIZE / 1024 / 1024}MB`);
      }
    } else if (fileType === FileType.DOWNLOADABLE_ASSET) {
      if (!this.ALLOWED_ASSET_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid asset type. Allowed: ${this.ALLOWED_ASSET_TYPES.join(', ')}`
        );
      }
      
      if (file.size > this.MAX_ASSET_SIZE) {
        throw new BadRequestException(`Asset must be less than ${this.MAX_ASSET_SIZE / 1024 / 1024}MB`);
      }
    }
    
    // Security: Validate filename doesn't contain path traversal
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      throw new BadRequestException('Invalid filename: path traversal detected');
    }
  }
  
  /**
   * Validate path format (for DELETE operations)
   */
  validatePath(path: string): void {
    if (!path) {
      throw new BadRequestException('No path provided');
    }
    
    // Security: Prevent path traversal
    if (path.includes('..') || path.includes('//')) {
      throw new ForbiddenException('Invalid path: path traversal detected');
    }
    
    // Validate path starts with allowed prefix
    const allowedPrefixes = [
      'scenarios/',
      'profiles/',
      'rangex-assets/scenarios/', // Legacy support
    ];
    
    if (!allowedPrefixes.some(prefix => path.startsWith(prefix))) {
      throw new ForbiddenException('Invalid path: must start with allowed prefix');
    }
  }
  
  /**
   * Parse path to extract components (scenarioId, versionId, fileType)
   */
  parsePath(path: string): {
    scenarioId?: string;
    versionId?: string;
    fileType?: string;
    filename?: string;
  } {
    this.validatePath(path);
    
    const parts = path.split('/');
    
    // Handle legacy format: rangex-assets/scenarios/...
    if (parts[0] === 'rangex-assets') {
      parts.shift(); // Remove 'rangex-assets'
    }
    
    // Format: scenarios/cover-images/{scenarioId}/{versionId}/{filename}
    // Format: scenarios/editor-images/{scenarioId}/{versionId}/{filename}
    // Format: scenarios/assets/images/{scenarioId}/{versionId}/{filename}
    if (parts[0] === 'scenarios') {
      if (parts[1] === 'temp') {
        // Temp format: scenarios/temp/{userId}/{filename}
        return {
          fileType: 'temp',
          filename: parts[3],
        };
      }
      
      // New format: scenarios/{type}/{scenarioId}/{versionId}/{filename}
      if (parts[1] === 'cover-images' || parts[1] === 'editor-images' || parts[1] === 'assets') {
        return {
          fileType: parts[1],
          scenarioId: parts[2],
          versionId: parts[3],
          filename: parts[4],
        };
      }
    }
    
    // Format: profiles/{userId}/avatar.ext
    if (parts[0] === 'profiles') {
      return {
        fileType: 'profile',
        filename: parts[2],
      };
    }
    
    return {};
  }
  
  /**
   * Move temp file to permanent location
   * Used when draft is saved and temp uploads need to be associated with version
   */
  async moveTempFile(tempPath: string, context: UploadContext, minioService: any): Promise<PathComponents> {
    // Strip /api/assets/file/ prefix if present FIRST
    const cleanPath = tempPath.replace('/api/assets/file/', '');
    
    // Now validate the clean path (must start with scenarios/)
    this.validatePath(cleanPath);
    
    // Generate new permanent path
    const permanentPath = this.generateUploadPath(context);
    
    // Copy file from temp to permanent location
    await minioService.copyFile(cleanPath, permanentPath.objectPath);
    
    // Delete temp file
    await minioService.deleteFile(cleanPath);
    
    return permanentPath;
  }
  
  /**
   * Get folder path for version cleanup
   * Returns the base folder containing all files for a version
   */
  getVersionFolder(scenarioId: string, versionId: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Returns base - cleanup function will append specific paths like cover-images/, editor-images/, etc.
    return `scenarios`;
  }
  
  /**
   * Get scenario folder for scenario cleanup
   */
  getScenarioFolder(scenarioId: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(scenarioId)) {
      throw new BadRequestException('Invalid scenarioId format');
    }
    
    // Returns base - cleanup function will handle cover-images/, editor-images/, assets/ folders
    return `scenarios`;
  }
  
  // ===== Private Helper Methods =====
  
  private validateUploadContext(context: UploadContext): void {
    if (!context.userId) {
      throw new BadRequestException('userId is required');
    }
    
    if (!context.fileType) {
      throw new BadRequestException('fileType is required');
    }
    
    if (!context.originalFilename) {
      throw new BadRequestException('originalFilename is required');
    }
    
    // Validate UUIDs if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (context.scenarioId && !uuidRegex.test(context.scenarioId)) {
      throw new BadRequestException('Invalid scenarioId format');
    }
    
    if (context.versionId && !uuidRegex.test(context.versionId)) {
      throw new BadRequestException('Invalid versionId format');
    }
  }
  
  private generateFilename(fileType: FileType, extension: string): string {
    // Cover and docker-compose use fixed names
    if (fileType === FileType.COVER_IMAGE) {
      return `cover.${extension}`;
    }
    
    if (fileType === FileType.DOCKER_COMPOSE) {
      return 'docker-compose.yml';
    }
    
    if (fileType === FileType.PROFILE_AVATAR) {
      return `avatar.${extension}`;
    }
    
    // All other files use UUID to prevent collisions
    return `${uuidv4()}.${extension}`;
  }
  
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) {
      throw new BadRequestException('Filename must have an extension');
    }
    return parts[parts.length - 1].toLowerCase();
  }
  
  private isImageType(fileType: FileType): boolean {
    return [
      FileType.COVER_IMAGE,
      FileType.MISSION_IMAGE,
      FileType.WRITEUP_IMAGE,
      FileType.PROFILE_AVATAR,
    ].includes(fileType);
  }
}
