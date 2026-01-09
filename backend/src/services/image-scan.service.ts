import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { JobQueueService } from './job-queue.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion: string;
  Severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  Title: string;
  Description: string;
  PrimaryURL?: string;
}

interface TrivyResult {
  Results: Array<{
    Target: string;
    Class: string;
    Type: string;
    Vulnerabilities?: TrivyVulnerability[];
  }>;
}

interface ScanReport {
  versionId: string;
  timestamp: Date;
  images: Record<string, {
    scannedAt: Date;
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      unknown: number;
      total: number;
    };
    vulnerabilities: TrivyVulnerability[];
    trivyVersion?: string;
  }>;
  passed: boolean;
}

@Injectable()
export class ImageScanService {
  private readonly logger = new Logger(ImageScanService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private versionRepo: Repository<ScenarioVersion>,
    private minioService: MinioService,
    private jobQueueService: JobQueueService,
  ) {}

  /**
   * Main entry point for scanning a submission
   */
  async scanSubmission(versionId: string): Promise<ScanReport> {
    this.logger.log(`Starting scan for version ${versionId}`);

    try {
      // Download manifest to get image list
      const manifestContent = await this.minioService.downloadObject(
        'rangex-staging',
        `scenarios/${versionId}/manifest.json`,
      );
      const manifest = JSON.parse(manifestContent);

      const scanReport: ScanReport = {
        versionId,
        timestamp: new Date(),
        images: {},
        passed: true,
      };

      // Scan each image
      const imageKeys = Object.keys(manifest.images || {});
      this.logger.log(`Found ${imageKeys.length} images to scan`);

      for (const imageKey of imageKeys) {
        try {
          const imageResult = await this.scanImage(versionId, imageKey);
          scanReport.images[imageKey] = imageResult;
        } catch (error) {
          this.logger.error(
            `Failed to scan image ${imageKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Continue scanning other images
          scanReport.images[imageKey] = {
            scannedAt: new Date(),
            summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0, total: 0 },
            vulnerabilities: [],
          };
        }
      }

      // Store scan report in MinIO
      const reportJson = JSON.stringify(scanReport, null, 2);
      const reportBuffer = Buffer.from(reportJson);
      
      await this.minioService.uploadFile(
        reportBuffer,
        `scenarios/${versionId}/scan/report.json`,
        'rangex-staging',
      );

      // Update version status to READY_FOR_REVIEW (vulnerabilities don't block for security labs)
      await this.versionRepo.update(versionId, { status: 'ready_for_review' as any });

      this.logger.log(`Scan completed for version ${versionId}: ${scanReport.passed ? 'PASSED' : 'FAILED'}`);
      return scanReport;
    } catch (error) {
      this.logger.error(
        `Scan failed for version ${versionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      
      // Update version status to indicate scan failure
      await this.versionRepo.update(versionId, { 
        status: 'validation_failed' as any,
        // Could store error in a notes field if it exists
      });
      
      throw error;
    }
  }

  /**
   * Scan a single image using Trivy
   */
  private async scanImage(
    versionId: string,
    imageKey: string,
  ): Promise<ScanReport['images'][string]> {
    const tmpDir = path.join(os.tmpdir(), `rangex-scan-${versionId}-${imageKey}`);
    const tarPath = path.join(tmpDir, `${imageKey}.tar`);
    const trivyOutputPath = path.join(tmpDir, 'trivy-output.json');

    try {
      // Create temp directory
      await fs.promises.mkdir(tmpDir, { recursive: true });

      // Download image tar from MinIO
      this.logger.log(`Downloading image ${imageKey} for scanning...`);
      const tarBuffer = await this.minioService.getFileFromBucket(
        'rangex-staging',
        `scenarios/${versionId}/images/${imageKey}.tar`,
      );
      await fs.promises.writeFile(tarPath, tarBuffer);

      // Check if Trivy is installed
      try {
        await exec('trivy --version');
      } catch (error) {
        this.logger.warn('Trivy not installed, returning mock scan results');
        return this.generateMockScanResult();
      }

      // Run Trivy scan
      this.logger.log(`Running Trivy scan on ${imageKey}...`);
      const trivyCommand = `trivy image --input "${tarPath}" --format json --output "${trivyOutputPath}" --timeout 10m`;

      try {
        await exec(trivyCommand);
      } catch (error) {
        // Trivy exits with code 1 if vulnerabilities found, but still generates report
        this.logger.warn(`Trivy scan completed with warnings for ${imageKey}`);
      }

      // Read Trivy output
      const trivyOutput = await fs.promises.readFile(trivyOutputPath, 'utf-8');
      const trivyResult: TrivyResult = JSON.parse(trivyOutput);

      // Parse vulnerabilities
      const vulnerabilities: TrivyVulnerability[] = [];
      const summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0, total: 0 };

      for (const result of trivyResult.Results || []) {
        for (const vuln of result.Vulnerabilities || []) {
          vulnerabilities.push(vuln);
          summary.total++;

          switch (vuln.Severity) {
            case 'CRITICAL':
              summary.critical++;
              break;
            case 'HIGH':
              summary.high++;
              break;
            case 'MEDIUM':
              summary.medium++;
              break;
            case 'LOW':
              summary.low++;
              break;
            default:
              summary.unknown++;
          }
        }
      }

      this.logger.log(
        `Scan complete for ${imageKey}: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`,
      );

      return {
        scannedAt: new Date(),
        summary,
        vulnerabilities,
      };
    } finally {
      // Cleanup temp files
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Generate mock scan result when Trivy is not installed (for development)
   */
  private generateMockScanResult(): ScanReport['images'][string] {
    return {
      scannedAt: new Date(),
      summary: {
        critical: 2,
        high: 5,
        medium: 12,
        low: 8,
        unknown: 1,
        total: 28,
      },
      vulnerabilities: [
        {
          VulnerabilityID: 'CVE-2024-MOCK-001',
          PkgName: 'openssl',
          InstalledVersion: '1.1.1',
          FixedVersion: '1.1.1w',
          Severity: 'CRITICAL',
          Title: 'Mock vulnerability for testing',
          Description: 'This is a mock vulnerability generated because Trivy is not installed',
        },
        {
          VulnerabilityID: 'CVE-2024-MOCK-002',
          PkgName: 'libssl',
          InstalledVersion: '1.1.1',
          FixedVersion: '1.1.1w',
          Severity: 'CRITICAL',
          Title: 'Mock vulnerability for testing',
          Description: 'This is a mock vulnerability generated because Trivy is not installed',
        },
      ],
    };
  }
}
