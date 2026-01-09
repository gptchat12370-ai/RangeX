import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinioService } from './minio.service';
import { Scenario } from '../entities/scenario.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { v4 as uuidv4 } from 'uuid';

export enum FileType {
  COVER_IMAGE = 'cover',
  EDITOR_IMAGE = 'editor-images',
  DOWNLOADABLE_ASSET = 'assets',
}

@Injectable()
export class FileUploadService {
  constructor(
    private readonly minioService: MinioService,
    @InjectRepository(Scenario)
    private readonly scenarioRepo: Repository<Scenario>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
  ) {}

  /**
   * Upload a file with organized folder structure
   * @param file - The file buffer
   * @param scenarioId - Scenario ID
   * @param versionId - Version ID (optional, for version-specific files)
   * @param fileType - Type of file (cover, editor-image, asset)
   * @param userId - User ID for ownership verification
   * @param originalFilename - Original filename (optional, preserves name for downloadable assets)
   * @returns File URL and path
   */
  async uploadFile(
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    scenarioId: string,
    fileType: FileType,
    userId: string,
    versionId?: string,
    originalFilename?: string,
  ): Promise<{ url: string; path: string }> {
    // Verify scenario ownership
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) {
      throw new ForbiddenException('Scenario not found');
    }

    if (scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to upload files to this scenario');
    }

    // If versionId provided, verify it belongs to scenario
    if (versionId) {
      const version = await this.versionRepo.findOne({
        where: { id: versionId, scenarioId },
      });
      if (!version) {
        throw new BadRequestException('Version not found for this scenario');
      }
    }

    // Validate file type for images
    if (fileType === FileType.COVER_IMAGE || fileType === FileType.EDITOR_IMAGE) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only image files are allowed');
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException('Image size must be less than 5MB');
      }
    }

    // Generate filename
    const extension = file.originalname.split('.').pop();
    const filename = originalFilename || `${uuidv4()}.${extension}`;

    // Organize path based on file type
    // Pattern: scenarios/{scenarioId}/versions/{versionId}/{fileType}/{filename}
    // OR: scenarios/{scenarioId}/{fileType}/{filename} (for scenario-level files like cover without version)
    let objectPath: string;

    if (versionId) {
      objectPath = `scenarios/${scenarioId}/versions/${versionId}/${fileType}/${filename}`;
    } else {
      objectPath = `scenarios/${scenarioId}/${fileType}/${filename}`;
    }

    // Upload to MinIO
    const url = await this.minioService.uploadFile(file.buffer, objectPath);

    return { url, path: objectPath };
  }

  /**
   * Delete a file from MinIO with ownership verification
   * @param filePath - The file path in MinIO
   * @param userId - User ID for ownership verification
   */
  async deleteFile(filePath: string, userId: string): Promise<void> {
    // Extract scenarioId from path
    const pathParts = filePath.split('/');
    
    // Expected format: scenarios/{scenarioId}/... or rangex-assets/scenarios/{scenarioId}/...
    let scenarioIdIndex = 1;
    if (filePath.startsWith('rangex-assets/')) {
      scenarioIdIndex = 2;
    }

    if (pathParts.length <= scenarioIdIndex) {
      throw new BadRequestException('Invalid file path format');
    }

    const scenarioId = pathParts[scenarioIdIndex];

    // Validate scenarioId is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scenarioId)) {
      throw new BadRequestException('Invalid scenario ID in file path');
    }

    // Verify ownership
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) {
      throw new ForbiddenException('Scenario not found');
    }

    if (scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this file');
    }

    // Delete from MinIO
    await this.minioService.deleteFile(filePath);
  }

  /**
   * Migrate old file paths to new organized structure
   * @param oldPath - Old file path
   * @param scenarioId - Scenario ID
   * @param versionId - Version ID
   * @param fileType - Type of file
   * @returns New file path
   */
  async migrateFilePath(
    oldPath: string,
    scenarioId: string,
    versionId: string,
    fileType: FileType,
  ): Promise<string> {
    // Extract filename from old path
    const filename = oldPath.split('/').pop();
    if (!filename) {
      throw new BadRequestException('Invalid file path');
    }

    // Generate new path
    const newPath = `scenarios/${scenarioId}/versions/${versionId}/${fileType}/${filename}`;

    // Copy file to new location
    await this.minioService.copyFile(oldPath, newPath);

    // Delete old file
    await this.minioService.deleteFile(oldPath);

    return newPath;
  }
}
