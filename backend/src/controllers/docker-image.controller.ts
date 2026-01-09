import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Res, StreamableFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DockerImageService } from '../services/docker-image.service';
import { ImagePullService } from '../services/image-pull.service';
import { Response } from 'express';

@Controller('docker-images')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DockerImageController {
  constructor(
    private readonly dockerImageService: DockerImageService,
    private readonly imagePullService: ImagePullService,
  ) {}

  @Roles('admin', 'creator', 'solver')
  @Post('verify/public')
  async verifyPublicImage(@Body() body: { imageName: string; tag?: string }) {
    const isValid = await this.dockerImageService.verifyPublicImage(
      body.imageName,
      body.tag || 'latest'
    );
    return { valid: isValid, message: isValid ? 'Image found' : 'Image not found' };
  }

  @Roles('admin', 'creator', 'solver')
  @Post('verify/private')
  async verifyPrivateImage(
    @Body() body: {
      registryUrl: string;
      imageName: string;
      tag?: string;
      username: string;
      password: string;
    }
  ) {
    const isValid = await this.dockerImageService.verifyPrivateImage(
      body.registryUrl,
      body.imageName,
      body.tag || 'latest',
      body.username,
      body.password
    );
    return { valid: isValid, message: isValid ? 'Image found and accessible' : 'Image not found or inaccessible' };
  }

  @Roles('admin', 'creator', 'solver')
  @Post('credentials')
  async saveCredential(
    @Req() req: any,
    @Body() body: { registryUrl: string; username: string; password: string }
  ) {
    const userId = req.user?.userId;
    await this.dockerImageService.saveCredential(
      userId,
      body.registryUrl,
      body.username,
      body.password
    );
    return { saved: true };
  }

  @Roles('admin', 'creator', 'solver')
  @Get('credentials/:registryUrl')
  async getCredential(@Req() req: any, @Param('registryUrl') registryUrl: string) {
    const userId = req.user?.userId;
    const credential = await this.dockerImageService.getCredential(userId, registryUrl);
    return { username: credential.username, registryUrl: credential.registryUrl };
  }

  @Roles('admin', 'creator', 'solver')
  @Post()
  async createImage(
    @Req() req: any,
    @Body() body: {
      name: string;
      tag: string;
      registryUrl?: string;
      description?: string;
      category?: string;
      isPublic: boolean;
      isReadyImage?: boolean;
    }
  ) {
    const userId = req.user?.userId;
    return this.dockerImageService.createImage({ ...body, createdBy: userId });
  }

  @Roles('admin', 'creator', 'solver')
  @Get('ready')
  async listReadyImages() {
    return this.dockerImageService.listReadyImages();
  }

  @Roles('admin')
  @Get('all')
  async listAllImages() {
    return this.dockerImageService.listAllImages();
  }

  @Roles('admin')
  @Put(':id')
  async updateImage(@Param('id') id: string, @Body() updates: any) {
    return this.dockerImageService.updateImage(id, updates);
  }

  @Roles('admin')
  @Delete(':id')
  async deleteImage(@Param('id') id: string) {
    return this.dockerImageService.deleteImage(id);
  }

  /**
   * Pull image and store in MinIO
   */
  @Roles('admin', 'creator')
  @Post(':id/pull-and-store')
  async pullAndStoreImage(@Param('id') id: string) {
    const result = await this.imagePullService.pullAndStoreImage(id);
    return {
      success: true,
      minioPath: result.minioPath,
      sizeMb: result.sizeMb,
      message: `Image pulled and stored successfully (${result.sizeMb} MB)`,
    };
  }

  /**
   * Check if image exists in MinIO
   */
  @Roles('admin', 'creator', 'solver')
  @Get(':id/minio-status')
  async checkMinioStatus(@Param('id') id: string) {
    const exists = await this.imagePullService.checkImageInMinIO(id);
    return { cached: exists };
  }

  /**
   * Get storage statistics
   */
  @Roles('admin')
  @Get('stats/storage')
  async getStorageStats() {
    return this.imagePullService.getStorageStats();
  }

  /**
   * Download image from MinIO as stream
   */
  @Roles('admin', 'creator')
  @Get(':id/download')
  async downloadImage(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const stream = await this.imagePullService.getImageFromMinIO(id);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="image.tar"',
    });
    return new StreamableFile(stream);
  }

  /**
   * Delete image from MinIO cache
   */
  @Roles('admin')
  @Delete(':id/minio-cache')
  async deleteFromMinIO(@Param('id') id: string) {
    await this.imagePullService.deleteImageFromMinIO(id);
    return { success: true, message: 'Image removed from MinIO cache' };
  }
}
