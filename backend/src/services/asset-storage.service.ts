import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Client as MinioClient } from 'minio';
import { Express } from 'express';

interface StoredObject {
  key: string;
  url: string;
}

@Injectable()
export class AssetStorageService {
  private driver: 'local' | 'minio';
  private uploadDir: string;
  private minio?: MinioClient;
  private minioBucket?: string;
  private publicBaseUrl?: string;
  private minioPublicEndpoint?: string;

  constructor(private readonly config: ConfigService) {
    this.driver = (this.config.get<string>('ASSETS_STORAGE_DRIVER') as 'local' | 'minio') || 'local';
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.publicBaseUrl = this.config.get<string>('ASSETS_PUBLIC_BASE_URL');

    if (this.driver === 'local') {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } else {
      this.minioBucket = this.config.get<string>('MINIO_BUCKET') || 'assets';
      const internalEndpoint = this.config.get<string>('MINIO_ENDPOINT') || 'localhost';
      const port = this.config.get<number>('MINIO_PORT') || 9000;
      
      // Store public endpoint for URL replacement
      if (this.publicBaseUrl) {
        const publicUrl = new URL(this.publicBaseUrl);
        this.minioPublicEndpoint = `${publicUrl.hostname}:${publicUrl.port || port}`;
      }
      
      this.minio = new MinioClient({
        endPoint: internalEndpoint,
        port,
        useSSL: this.config.get<string>('MINIO_USE_SSL') === 'true',
        accessKey: this.config.get<string>('MINIO_ACCESS_KEY') || '',
        secretKey: this.config.get<string>('MINIO_SECRET_KEY') || '',
      });
    }
  }

  getDriver() {
    return this.driver;
  }

  async getPublicUrl(key: string, requestHostname?: string): Promise<string> {
    // Always use backend proxy for security and network compatibility
    return `/api/assets/file/${key}`;
  }

  async store(file: Express.Multer.File): Promise<StoredObject> {
    const key = `${Date.now()}-${randomUUID()}${extname(file.originalname)}`;

    if (this.driver === 'local') {
      const dest = path.join(this.uploadDir, key);
      await fs.promises.writeFile(dest, file.buffer);
      // Always return relative URL for network compatibility
      const url = `/api/assets/file/${key}`;
      return { key, url };
    }

    if (!this.minio || !this.minioBucket) {
      throw new InternalServerErrorException('MinIO not configured');
    }

    // Ensure bucket exists
    const buckets = await this.minio.listBuckets();
    const exists = buckets.some((b) => b.name === this.minioBucket);
    if (!exists) {
      await this.minio.makeBucket(this.minioBucket, '');
    }
    await this.minio.putObject(this.minioBucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    const url = await this.getPublicUrl(key);
    return { key, url };
  }

  async storeWithPath(file: Express.Multer.File, objectPath: string): Promise<StoredObject> {
    console.log(`[AssetStorageService] storeWithPath called - driver: ${this.driver}, bucket: ${this.minioBucket}, path: ${objectPath}`);
    
    if (this.driver === 'local') {
      const dest = path.join(this.uploadDir, objectPath);
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await fs.promises.writeFile(dest, file.buffer);
      // Always return relative URL for network compatibility
      const url = `/api/assets/file/${objectPath}`;
      console.log(`[AssetStorageService] Local file saved: ${dest}, URL: ${url}`);
      return { key: objectPath, url };
    }

    if (!this.minio || !this.minioBucket) {
      console.error('[AssetStorageService] MinIO not configured!', { minio: !!this.minio, bucket: this.minioBucket });
      throw new InternalServerErrorException('MinIO not configured');
    }

    // Ensure bucket exists
    console.log(`[AssetStorageService] Ensuring bucket exists: ${this.minioBucket}`);
    const buckets = await this.minio.listBuckets();
    const exists = buckets.some((b) => b.name === this.minioBucket);
    if (!exists) {
      console.log(`[AssetStorageService] Bucket ${this.minioBucket} doesn't exist, creating...`);
      await this.minio.makeBucket(this.minioBucket, '');
      console.log(`[AssetStorageService] Bucket created: ${this.minioBucket}`);
    }
    
    console.log(`[AssetStorageService] Uploading to MinIO - bucket: ${this.minioBucket}, path: ${objectPath}, size: ${file.size}, type: ${file.mimetype}`);
    await this.minio.putObject(this.minioBucket, objectPath, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    
    const url = await this.getPublicUrl(objectPath);
    console.log(`[AssetStorageService] Upload successful! URL: ${url}`);
    return { key: objectPath, url };
  }

  async delete(key: string): Promise<void> {
    console.log(`[AssetStorageService] Deleting asset with key: ${key}, driver: ${this.driver}, bucket: ${this.minioBucket}`);
    
    if (this.driver === 'local') {
      const filePath = path.join(this.uploadDir, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`[AssetStorageService] Deleted local file: ${filePath}`);
      }
    } else {
      if (!this.minio || !this.minioBucket) {
        throw new InternalServerErrorException('MinIO not configured');
      }
      try {
        console.log(`[AssetStorageService] Attempting to delete from MinIO bucket: ${this.minioBucket}, key: ${key}`);
        await this.minio.removeObject(this.minioBucket, key);
        console.log(`[AssetStorageService] Successfully deleted from MinIO: ${key}`);
      } catch (error) {
        console.error(`[AssetStorageService] Error deleting from MinIO:`, error);
        throw error; // Don't swallow the error
      }
    }
  }

  async deleteFolder(prefix: string): Promise<void> {
    console.log(`[AssetStorageService] ========== DELETING FOLDER ==========`);
    console.log(`[AssetStorageService] Prefix: ${prefix}, driver: ${this.driver}, bucket: ${this.minioBucket}`);
    
    if (this.driver === 'local') {
      const folderPath = path.join(this.uploadDir, prefix);
      if (fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
        console.log(`[AssetStorageService] Deleted local folder: ${folderPath}`);
      }
    } else {
      if (!this.minio || !this.minioBucket) {
        throw new InternalServerErrorException('MinIO not configured');
      }
      
      try {
        // List all objects with this prefix
        const objectsList: string[] = [];
        const stream = this.minio.listObjects(this.minioBucket, prefix, true);
        
        console.log(`[AssetStorageService] Listing objects with prefix: ${prefix}`);
        
        // Collect all object names
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (obj) => {
            if (obj.name) {
              objectsList.push(obj.name);
              console.log(`[AssetStorageService] Found object: ${obj.name}`);
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', (err) => reject(err));
        });
        
        console.log(`[AssetStorageService] Found ${objectsList.length} objects to delete`);
        
        // Delete all objects
        if (objectsList.length > 0) {
          for (const objName of objectsList) {
            console.log(`[AssetStorageService] Deleting: ${objName}`);
            await this.minio.removeObject(this.minioBucket, objName);
          }
          console.log(`[AssetStorageService] ✅ Successfully deleted ${objectsList.length} objects from folder: ${prefix}`);
        } else {
          console.log(`[AssetStorageService] No objects found with prefix: ${prefix}`);
        }
        
      } catch (error) {
        console.error(`[AssetStorageService] ❌ Error deleting folder from MinIO:`, error);
        throw error;
      }
    }
  }

  async getStream(key: string): Promise<any> {
    if (this.driver === 'local') {
      const filePath = path.join(this.uploadDir, key);
      if (!fs.existsSync(filePath)) {
        throw new InternalServerErrorException(`Local file not found: ${key}`);
      }
      return fs.createReadStream(filePath);
    }
    if (!this.minio || !this.minioBucket) {
      throw new InternalServerErrorException('MinIO not configured');
    }
    console.log(`📥 [AssetStorageService] Getting stream from MinIO: bucket=${this.minioBucket}, key=${key}`);
    try {
      // First check if object exists
      await this.minio.statObject(this.minioBucket, key);
      const stream = await this.minio.getObject(this.minioBucket, key);
      console.log(`✅ [AssetStorageService] Stream created for: ${key}`);
      return stream;
    } catch (error: any) {
      console.error(`❌ [AssetStorageService] Failed to get stream for ${key}:`, error.message);
      
      // Add more context to NoSuchKey errors
      if (error.code === 'NoSuchKey') {
        const contextError: any = new Error(`File not found in MinIO: ${key}`);
        contextError.code = 'NoSuchKey';
        contextError.key = key;
        throw contextError;
      }
      
      throw error;
    }
  }
}
