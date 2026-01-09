import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Res,
  BadRequestException,
  Req,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../entities/asset.entity';
import * as fs from 'fs';
import { AssetStorageService } from '../services/asset-storage.service';
import { Express } from 'express';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller('assets')
export class AssetsController {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly storage: AssetStorageService,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async list() {
    const assets = await this.assetRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return Promise.all(
      assets.map(async (a) => ({
        ...a,
        url: await this.storage.getPublicUrl(a.storageKey),
      })),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024, // 15MB
      },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf', 'text/plain'];
        if (file.originalname.includes('..')) {
          return cb(new BadRequestException('Invalid filename'), false);
        }
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('File type not allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @Res() res: Response, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const userId = req.user?.sub || 'unknown';
    // Enforce simple quota: 500 MB per user
    const raw = await this.assetRepo
      .createQueryBuilder('asset')
      .select('SUM(asset.sizeBytes)', 'total')
      .where('asset.createdByUserId = :userId', { userId })
      .getRawOne();
    const used = Number(raw?.total || 0);
    const limit = 500 * 1024 * 1024;
    if (used + file.size > limit) {
      throw new BadRequestException('Storage quota exceeded (500 MB per user)');
    }

    const stored = await this.storage.store(file);

    const asset = this.assetRepo.create({
      id: randomUUID(),
      name: file.originalname,
      type: file.mimetype,
      storageKey: stored.key,
      sizeBytes: file.size,
      createdByUserId: userId,
    });
    await this.assetRepo.save(asset);

    return res.json({
      id: asset.id,
      name: asset.name,
      sizeBytes: asset.sizeBytes,
      url: stored.url,
    });
  }

  @Get('file/*')
  async serve(@Req() req: any, @Res() res: Response) {
    // Extract filename from path (everything after /file/)
    // NestJS path-to-regexp v6+ uses named params: req.params.path is an array
    const pathArray = req.params.path || req.params[0];
    const filename = Array.isArray(pathArray) ? pathArray.join('/') : pathArray;
    
    console.log(`🔍 [assets/file] Request for: ${filename}`);
    
    if (!filename || filename.includes('..')) {
      console.error(`❌ [assets/file] Invalid filename: ${filename}`);
      throw new BadRequestException('Invalid filename');
    }
    
    // Stream file through backend (secure, no direct MinIO access)
    if (this.storage.getDriver() === 'local') {
      const filePath = join(UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ [assets/file] File not found (local): ${filePath}`);
        throw new BadRequestException('File not found');
      }
      console.log(`✅ [assets/file] Serving from local: ${filePath}`);
      return res.sendFile(filePath);
    }
    
    // For MinIO, stream through backend with proper headers
    try {
      console.log(`📥 [assets/file] Fetching from MinIO: ${filename}`);
      const stream = await this.storage.getStream(filename);
      
      // Set Content-Type based on file extension
      const ext = extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // CORS headers for cross-origin image requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      console.log(`✅ [assets/file] Streaming ${filename} as ${contentType}`);
      stream.pipe(res);
    } catch (error: any) {
      console.error(`❌ [assets/file] Failed to stream ${filename}:`, error);
      
      // If file not found in MinIO, return 404 with helpful message
      if (error.code === 'NoSuchKey' || error.message?.includes('does not exist')) {
        console.warn(`⚠️ [assets/file] File not found in storage: ${filename}`);
        throw new NotFoundException(`Asset file not found: ${filename}. The file may have been deleted or was never uploaded.`);
      }
      
      // For other errors, return generic error
      throw new BadRequestException('Failed to retrieve file');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    console.log(`[AssetsController] Delete request for asset ID: ${id}`);
    
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) {
      console.log(`[AssetsController] Asset not found: ${id}`);
      throw new NotFoundException('Asset not found');
    }

    console.log(`[AssetsController] Found asset: ${asset.name}, storageKey: ${asset.storageKey}`);

    // Delete from storage (MinIO or local disk)
    await this.storage.delete(asset.storageKey);
    console.log(`[AssetsController] Deleted from storage`);

    // Delete from database
    await this.assetRepo.remove(asset);
    console.log(`[AssetsController] Deleted from database`);

    return { success: true };
  }
}
