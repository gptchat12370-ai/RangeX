import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  Param,
  UseGuards,
  BadRequestException,
  Body,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { MinioService } from '../services/minio.service';
import { FileOrganizationService, FileType } from '../services/file-organization.service';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scenario } from '../entities/scenario.entity';

@Controller('upload')
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  private readonly logger = new Logger(UploadController.name);
  
  constructor(
    private readonly minioService: MinioService,
    private readonly fileOrgService: FileOrganizationService,
    @InjectRepository(Scenario)
    private readonly scenarioRepo: Repository<Scenario>,
  ) {}

  /**
   * Upload image to temporary storage (before draft save) or permanent location
   * Supports both legacy format and new organized structure
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`Upload request - User: ${userId}, FileType: ${body.fileType || 'unknown'}`);
    
    try {
      // Determine file type (cover, mission-image, writeup-image, or temp)
      const fileType = this.mapFileType(body.fileType || 'temp');
      
      // Validate file
      this.fileOrgService.validateFile(file, fileType);
      
      // If scenarioId and versionId provided, upload to permanent location
      if (body.scenarioId && body.versionId) {
        // Verify ownership
        await this.verifyOwnership(userId, body.scenarioId);
        
        // Generate permanent path
        const pathInfo = this.fileOrgService.generateUploadPath({
          userId,
          scenarioId: body.scenarioId,
          versionId: body.versionId,
          fileType,
          originalFilename: file.originalname,
          mimetype: file.mimetype,
        });
        
        // Upload to MinIO
        const url = await this.minioService.uploadFile(file.buffer, pathInfo.objectPath);
        
        this.logger.log(`Uploaded to permanent location: ${pathInfo.objectPath}`);
        
        return {
          success: true,
          url: pathInfo.publicUrl,
          path: pathInfo.objectPath,
        };
      }
      
      // Otherwise, upload to temporary storage
      const pathInfo = this.fileOrgService.generateUploadPath({
        userId,
        fileType: FileType.TEMP_UPLOAD,
        originalFilename: file.originalname,
        mimetype: file.mimetype,
      });
      
      // Upload to MinIO temp folder
      this.logger.log(`📤 [uploadImage] Uploading to temp: ${pathInfo.objectPath}, size: ${file.buffer.length} bytes`);
      
      try {
        const url = await this.minioService.uploadFile(file.buffer, pathInfo.objectPath);
        this.logger.log(`✅ [uploadImage] Upload successful: ${pathInfo.objectPath}`);
        this.logger.log(`✅ [uploadImage] Returned URL: ${url}`);
        
        return {
          success: true,
          url: pathInfo.publicUrl,
          path: pathInfo.objectPath,
          isTemp: true,
        };
      } catch (uploadError: any) {
        this.logger.error(`❌ [uploadImage] MinIO upload failed for ${pathInfo.objectPath}:`, uploadError.message);
        this.logger.error(`❌ [uploadImage] Stack:`, uploadError.stack);
        throw new BadRequestException(`Failed to upload to MinIO: ${uploadError.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Image upload error: ${errorMessage}`, errorStack);
      
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to upload image');
    }
  }
  
  /**
   * Upload downloadable asset (PDF, ZIP, etc.)
   */
  @Post('asset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(@UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    
    if (!body.scenarioId || !body.versionId) {
      throw new BadRequestException('scenarioId and versionId are required for asset uploads');
    }
    
    try {
      await this.verifyOwnership(userId, body.scenarioId);
      
      const pathInfo = this.fileOrgService.generateUploadPath({
        userId,
        scenarioId: body.scenarioId,
        versionId: body.versionId,
        fileType: FileType.DOWNLOADABLE_ASSET,
        originalFilename: file.originalname,
        mimetype: file.mimetype,
      });
      
      this.fileOrgService.validateFile(file, FileType.DOWNLOADABLE_ASSET);
      
      const url = await this.minioService.uploadFile(file.buffer, pathInfo.objectPath);
      
      this.logger.log(`Uploaded asset: ${pathInfo.objectPath}`);
      
      return {
        success: true,
        url: pathInfo.publicUrl,
        path: pathInfo.objectPath,
        fileName: file.originalname,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Asset upload error: ${errorMessage}`);
      throw error;
    }
  }

  @Delete('image/*')
  async deleteImage(@Req() req: any) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      
      const fullPath = req.url;
      const pathAfterImage = fullPath.split('/upload/image/')[1];
      
      this.logger.log(`DELETE request - User: ${userId}, Path: ${pathAfterImage}`);
      
      if (!pathAfterImage) {
        throw new BadRequestException('No image path provided');
      }
      
      // Decode and clean path
      const pathWithoutQuery = pathAfterImage.split('?')[0];
      const decodedPath = decodeURIComponent(pathWithoutQuery);
      
      // Use FileOrganizationService for validation
      this.fileOrgService.validatePath(decodedPath);
      
      // Parse path to extract components
      const pathInfo = this.fileOrgService.parsePath(decodedPath);
      
      // If scenarioId exists, verify ownership
      if (pathInfo.scenarioId) {
        await this.verifyOwnership(userId, pathInfo.scenarioId);
      } else if (pathInfo.fileType === 'temp') {
        // For temp files, verify user owns the temp folder
        if (!decodedPath.includes(`/temp/${userId}/`)) {
          throw new ForbiddenException('Can only delete your own temporary files');
        }
      }
      
      this.logger.log(`Deleting file: ${decodedPath}`);
      
      await this.minioService.deleteFile(decodedPath);

      this.logger.log(`Successfully deleted: ${decodedPath}`);

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Delete error: ${errorMessage}`, errorStack);
      
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to delete file');
    }
  }
  
  // ===== Helper Methods =====
  
  private async verifyOwnership(userId: string, scenarioId: string): Promise<void> {
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    
    if (!scenario) {
      throw new ForbiddenException('Scenario not found');
    }
    
    if (scenario.createdByUserId !== userId) {
      this.logger.warn(`Unauthorized access attempt - User: ${userId}, Scenario Owner: ${scenario.createdByUserId}`);
      throw new ForbiddenException('You do not have permission to access this scenario');
    }
  }
  
  private mapFileType(type: string): FileType {
    const typeMap: Record<string, FileType> = {
      'cover': FileType.COVER_IMAGE,
      'cover-image': FileType.COVER_IMAGE,
      'mission': FileType.MISSION_IMAGE,
      'mission-image': FileType.MISSION_IMAGE,
      'writeup': FileType.WRITEUP_IMAGE,
      'writeup-image': FileType.WRITEUP_IMAGE,
      'asset': FileType.DOWNLOADABLE_ASSET,
      'temp': FileType.TEMP_UPLOAD,
    };
    
    return typeMap[type] || FileType.TEMP_UPLOAD;
  }
}
