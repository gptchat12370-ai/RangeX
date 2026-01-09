import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly minioClient: Minio.Client;
  private readonly defaultBucket: string;
  private readonly stagingBucket = 'rangex-staging';
  private readonly approvedBucket = 'rangex-approved';
  private readonly assetsBucket = 'rangex-assets';

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT') || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT') || '9000'),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY') || 'minioadmin',
    });
    this.defaultBucket = this.configService.get('MINIO_BUCKET') || 'rangex-assets';
    this.ensureBuckets();
  }

  private async ensureBuckets() {
    const bucketsToCreate = [
      this.defaultBucket,
      this.stagingBucket,
      this.approvedBucket,
      this.assetsBucket,
    ];

    const minioRegion = this.configService.get<string>('AWS_REGION', 'ap-south-2');
    for (const bucketName of bucketsToCreate) {
      try {
        const exists = await this.minioClient.bucketExists(bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(bucketName, minioRegion);
          this.logger.log(`Bucket created: ${bucketName}`);
        }
      } catch (error) {
        this.logger.error(`Failed to ensure bucket ${bucketName} exists: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Upload a file to MinIO
   * @param file - File buffer
   * @param objectPath - Full object path (e.g., 'scenarios/editor-images/uuid.png')
   * @param bucket - Target bucket (defaults to assets bucket)
   * @returns API proxy URL for secure access across network
   */
  async uploadFile(file: Buffer, objectPath: string, bucket?: string): Promise<string> {
    const targetBucket = bucket || this.assetsBucket;
    try {
      this.logger.log(`⬆️  [uploadFile] Uploading ${file.length} bytes to ${targetBucket}/${objectPath}`);
      await this.minioClient.putObject(targetBucket, objectPath, file, file.length);
      this.logger.log(`✅ [uploadFile] Upload complete: ${objectPath}`);
      
      // Return API proxy URL for network compatibility and security
      // This ensures files work when accessed from any IP on the network
      const proxyUrl = `/api/assets/file/${objectPath}`;
      
      this.logger.log(`File uploaded successfully: ${objectPath} -> ${proxyUrl}`);
      return proxyUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Extract MinIO object path from full URL
   * @param urlOrPath - Either full URL (http://localhost:9000/bucket/path) or just path
   * @returns Object path in bucket
   */
  private extractPath(urlOrPath: string): string {
    if (!urlOrPath) return '';
    
    // Remove query parameters
    let withoutQuery = urlOrPath.split('?')[0];
    
    // CRITICAL FIX: Strip /api/assets/file/ prefix if present (stored URL format in database)
    if (withoutQuery.startsWith('/api/assets/file/')) {
      withoutQuery = withoutQuery.replace('/api/assets/file/', '');
      this.logger.log(`Stripped /api/assets/file/ prefix, result: ${withoutQuery}`);
      return withoutQuery;
    }
    
    // If it starts with /, strip it (MinIO paths don't have leading slash)
    if (withoutQuery.startsWith('/') && !withoutQuery.startsWith('http')) {
      withoutQuery = withoutQuery.substring(1);
      this.logger.log(`Stripped leading slash, result: ${withoutQuery}`);
      return withoutQuery;
    }
    
    // If it's already just a path (no protocol), return it
    if (!withoutQuery.startsWith('http://') && !withoutQuery.startsWith('https://')) {
      return withoutQuery;
    }
    
    // Extract path from URL
    // Match patterns like:
    // - http://localhost:9000/bucket-name/path/to/file
    // - https://minio.example.com/bucket-name/path/to/file
    const bucketMatch = withoutQuery.match(/\/[^\/]+\/(.+)$/);
    if (bucketMatch) {
      return bucketMatch[1];
    }
    
    // Fallback: try to extract everything after domain/port
    const urlObj = new URL(withoutQuery);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 1) {
      // Skip bucket name (first part) and return rest
      return pathParts.slice(1).join('/');
    }
    
    this.logger.warn(`Could not extract path from URL: ${urlOrPath}`);
    return withoutQuery;
  }

  /**
   * Delete a file from MinIO
   * @param urlOrPath - Full URL or object path in bucket
   */
  async deleteFile(urlOrPath: string): Promise<void> {
    const objectPath = this.extractPath(urlOrPath);
    try {
      this.logger.log(`Deleting object: ${objectPath} from bucket: ${this.assetsBucket}`);
      
      // First, verify the file exists
      try {
        await this.minioClient.statObject(this.assetsBucket, objectPath);
        this.logger.log(`File exists, proceeding with deletion: ${objectPath}`);
      } catch (statError: any) {
        if (statError.code === 'NotFound') {
          this.logger.warn(`File not found, already deleted: ${objectPath}`);
          return; // File doesn't exist, consider it deleted
        }
        throw statError; // Other errors should be thrown
      }
      
      // Perform the deletion
      await this.minioClient.removeObject(this.assetsBucket, objectPath);
      this.logger.log(`removeObject called for: ${objectPath}`);
      
      // Verify deletion
      try {
        await this.minioClient.statObject(this.assetsBucket, objectPath);
        // If we get here, the file still exists!
        this.logger.error(`DELETION FAILED: File still exists after removeObject: ${objectPath}`);
        throw new Error(`Failed to delete file from MinIO: ${objectPath}`);
      } catch (verifyError: any) {
        if (verifyError.code === 'NotFound') {
          this.logger.log(`File deleted successfully (verified): ${objectPath}`);
        } else {
          throw verifyError;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete all files in a folder (recursive)
   * @param folderPath - Folder path (e.g., 'scenarios/editor-images/scenarioId')
   */
  async deleteFolder(folderPath: string): Promise<void> {
    try {
      this.logger.log(`Deleting folder: ${folderPath} from bucket: ${this.assetsBucket}`);
      
      // List all objects in the folder
      const objectsList = await this.listFiles(folderPath);
      
      if (objectsList.length === 0) {
        this.logger.log(`No objects found in folder: ${folderPath}`);
        return;
      }
      
      // Delete all objects
      const deletePromises = objectsList.map(objectName =>
        this.minioClient.removeObject(this.assetsBucket, objectName)
      );
      
      await Promise.all(deletePromises);
      this.logger.log(`Folder deleted successfully: ${folderPath} (${objectsList.length} objects)`);
    } catch (error) {
      this.logger.error(`Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for private file access
   * @param objectName - Object name in bucket
   * @param expiry - Expiry time in seconds (default: 7 days)
   * @returns Presigned URL
   */
  async getPresignedUrl(objectName: string, expiry: number = 7 * 24 * 60 * 60): Promise<string> {
    try {
      const url = await this.minioClient.presignedGetObject(this.assetsBucket, objectName, expiry);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate a presigned PUT URL for uploading files
   * @param bucket - Bucket name
   * @param objectName - Object name in bucket
   * @param expiry - Expiry time in seconds (default: 1 hour)
   * @returns Presigned PUT URL
   */
  async getPresignedPutUrl(bucket: string, objectName: string, expiry: number = 60 * 60): Promise<string> {
    try {
      const url = await this.minioClient.presignedPutObject(bucket, objectName, expiry);
      this.logger.log(`Generated presigned PUT URL for ${bucket}/${objectName}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned PUT URL: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Download object content as string
   * @param bucket - Bucket name
   * @param objectName - Object name (full path in bucket)
   * @returns Object content as string
   */
  async downloadObject(bucket: string, objectName: string): Promise<string> {
    try {
      const buffer = await this.getFileFromBucket(bucket, objectName);
      return buffer.toString('utf-8');
    } catch (error) {
      this.logger.error(`Failed to download object ${bucket}/${objectName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List objects with size information
   * @param bucket - Bucket name
   * @param prefix - Object prefix/folder path
   * @returns Array of objects with name and size
   */
  async listObjectsWithSize(bucket: string, prefix: string): Promise<{ name: string; size: number }[]> {
    const objects: { name: string; size: number }[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = this.minioClient.listObjects(bucket, prefix, true);
      
      stream.on('data', (obj) => {
        if (obj.name && obj.size !== undefined) {
          objects.push({ name: obj.name, size: obj.size });
        }
      });
      
      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * List all files in a folder
   * @param folder - Folder path
   * @returns Array of object names
   */
  async listFiles(folder: string): Promise<string[]> {
    const objectNames: string[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = this.minioClient.listObjects(this.assetsBucket, folder, true);
      
      stream.on('data', (obj) => {
        if (obj.name) objectNames.push(obj.name);
      });
      
      stream.on('end', () => resolve(objectNames));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Upload a stream to MinIO
   * @param stream - Readable stream
   * @param objectName - Object name (full path in bucket)
   * @param size - Optional size if known
   */
  async uploadStream(stream: any, objectName: string, size?: number): Promise<void> {
    try {
      await this.minioClient.putObject(this.assetsBucket, objectName, stream, size);
      this.logger.log(`Stream uploaded successfully: ${objectName}`);
    } catch (error) {
      this.logger.error(`Failed to upload stream: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a file as a Buffer from MinIO (from assets bucket)
   * @param objectName - Object name (full path in bucket)
   * @returns File buffer
   */
  async getFile(objectName: string): Promise<Buffer> {
    return this.getFileFromBucket(this.assetsBucket, objectName);
  }

  /**
   * Get a file as a Buffer from any bucket
   * @param bucket - Bucket name
   * @param objectName - Object name (full path in bucket)
   * @returns File buffer
   */
  async getFileFromBucket(bucket: string, objectName: string): Promise<Buffer> {
    try {
      const chunks: Buffer[] = [];
      const stream = await this.minioClient.getObject(bucket, objectName);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to get file from ${bucket}/${objectName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a file as a stream from MinIO
   * @param objectName - Object name (full path in bucket)
   * @returns Readable stream
   */
  async getFileStream(objectName: string): Promise<NodeJS.ReadableStream> {
    try {
      const stream = await this.minioClient.getObject(this.assetsBucket, objectName);
      return stream;
    } catch (error) {
      this.logger.error(`Failed to get file stream: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if an object exists in MinIO
   * @param objectName - Object name (full path in bucket)
   * @returns Boolean indicating if object exists
   */
  async objectExists(objectName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.assetsBucket, objectName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Copy a file from one location to another within MinIO
   * @param sourcePath - Source object path
   * @param destinationPath - Destination object path
   * @param sourceBucket - Source bucket (optional, defaults to assets bucket)
   * @param destinationBucket - Destination bucket (optional, defaults to assets bucket)
   */
  async copyFile(
    sourcePath: string,
    destinationPath: string,
    sourceBucket?: string,
    destinationBucket?: string,
  ): Promise<void> {
    const srcBucket = sourceBucket || this.assetsBucket;
    const destBucket = destinationBucket || this.assetsBucket;

    try {
      // First check if source file exists
      this.logger.log(`🔍 [copyFile] Checking if source exists: ${srcBucket}/${sourcePath}`);
      try {
        await this.minioClient.statObject(srcBucket, sourcePath);
        this.logger.log(`✅ [copyFile] Source file exists`);
      } catch (statError: any) {
        this.logger.error(`❌ [copyFile] Source file does NOT exist: ${statError.message}`);
        this.logger.error(`❌ [copyFile] This usually means the file was never uploaded or was already deleted`);
        throw new Error(`Source file not found: ${srcBucket}/${sourcePath}`);
      }
      
      this.logger.log(`Copying file from ${srcBucket}/${sourcePath} to ${destBucket}/${destinationPath}`);
      
      // Use MinIO's copy object method
      const conds = new Minio.CopyConditions();
      await this.minioClient.copyObject(
        destBucket,
        destinationPath,
        `/${srcBucket}/${sourcePath}`,
        conds,
      );
      
      this.logger.log(`File copied successfully to ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
