import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { JobQueueService } from './job-queue.service';
import * as yaml from 'js-yaml';

export interface ValidationReport {
  versionId: string;
  timestamp: Date;
  hardBlocks: Array<{ check: string; message: string; severity: 'critical' }>;
  warnings: Array<{ check: string; message: string; severity: 'warning' }>;
  passed: boolean;
}

@Injectable()
export class SubmissionValidationService {
  private readonly logger = new Logger(SubmissionValidationService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly minioService: MinioService,
    private readonly jobQueue: JobQueueService,
  ) {}

  /**
   * Validate a submitted scenario version
   * Phase 2: Automated policy checks
   */
  async validateSubmission(versionId: string): Promise<ValidationReport> {
    this.logger.log(`Starting validation for version ${versionId}`);

    const report: ValidationReport = {
      versionId,
      timestamp: new Date(),
      hardBlocks: [],
      warnings: [],
      passed: true,
    };

    try {
      // Download compose from staging
      const composeContent = await this.minioService.downloadObject(
        'rangex-staging',
        `scenarios/${versionId}/compose.yml`
      );

      // Parse compose YAML
      let compose: any;
      try {
        compose = yaml.load(composeContent);
      } catch (yamlError) {
        report.hardBlocks.push({
          check: 'compose_parse',
          message: 'Invalid YAML syntax in docker-compose.yml',
          severity: 'critical',
        });
        report.passed = false;
        return report;
      }

      // Run validation checks
      await this.checkPrivilegedContainers(compose, report);
      await this.checkHostNetworking(compose, report);
      await this.checkResourceLimits(compose, report);
      await this.checkPortAllowlist(compose, report);
      await this.checkImageSizeLimits(versionId, report);
      await this.checkAssetSizeLimits(versionId, report);

      // Update passed status based on hard blocks
      report.passed = report.hardBlocks.length === 0;

      // Store validation report
      await this.minioService.uploadFile(
        Buffer.from(JSON.stringify(report, null, 2)),
        `scenarios/${versionId}/validation/report.json`,
        'rangex-staging',
      );

      // Update version status
      if (report.hardBlocks.length > 0) {
        await this.versionRepo.update(versionId, { status: 'validation_failed' as any });
        this.logger.warn(
          `Validation failed for version ${versionId}: ${report.hardBlocks.length} hard blocks`,
        );
      } else {
        // Enqueue security scan job (Trivy)
        await this.jobQueue.enqueue('SCAN_SUBMISSION', {
          versionId,
          bucketPrefix: `scenarios/${versionId}`,
        });
        await this.versionRepo.update(versionId, { status: 'scanning' as any });
        this.logger.log(
          `Validation passed for version ${versionId}. Enqueued security scan. Warnings: ${report.warnings.length}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Validation error for version ${versionId}: ${errorMessage}`);
      report.hardBlocks.push({
        check: 'validation_error',
        message: `Validation failed: ${errorMessage}`,
        severity: 'critical',
      });
      report.passed = false;
    }

    return report;
  }

  /**
   * Check for privileged containers (security policy)
   * Hard block: Privileged mode grants container full host access
   */
  private async checkPrivilegedContainers(
    compose: any,
    report: ValidationReport,
  ): Promise<void> {
    if (!compose.services) return;

    for (const [serviceName, service] of Object.entries<any>(compose.services)) {
      if (service.privileged === true) {
        report.hardBlocks.push({
          check: 'privileged_container',
          message: `Service "${serviceName}" uses privileged mode. This is not allowed for security reasons.`,
          severity: 'critical',
        });
      }

      // Check for cap_add: ALL or SYS_ADMIN
      if (service.cap_add) {
        const dangerousCaps = ['ALL', 'SYS_ADMIN', 'SYS_MODULE', 'SYS_RAWIO'];
        const caps = Array.isArray(service.cap_add) ? service.cap_add : [service.cap_add];
        const foundDangerous = caps.filter((cap: string) => dangerousCaps.includes(cap.toUpperCase()));
        
        if (foundDangerous.length > 0) {
          report.hardBlocks.push({
            check: 'dangerous_capabilities',
            message: `Service "${serviceName}" requests dangerous capabilities: ${foundDangerous.join(', ')}`,
            severity: 'critical',
          });
        }
      }
    }
  }

  /**
   * Check for host networking (security policy)
   * Hard block: Host networking bypasses Docker network isolation
   */
  private async checkHostNetworking(compose: any, report: ValidationReport): Promise<void> {
    if (!compose.services) return;

    for (const [serviceName, service] of Object.entries<any>(compose.services)) {
      if (service.network_mode === 'host') {
        report.hardBlocks.push({
          check: 'host_networking',
          message: `Service "${serviceName}" uses host networking. This bypasses network isolation and is not allowed.`,
          severity: 'critical',
        });
      }

      // Also check for pid: host and ipc: host
      if (service.pid === 'host') {
        report.hardBlocks.push({
          check: 'host_pid',
          message: `Service "${serviceName}" uses host PID namespace. This is not allowed.`,
          severity: 'critical',
        });
      }

      if (service.ipc === 'host') {
        report.warnings.push({
          check: 'host_ipc',
          message: `Service "${serviceName}" uses host IPC namespace. Consider using isolated IPC.`,
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Check resource limits are set
   * Warning: All services should have memory and CPU limits for cost control
   */
  private async checkResourceLimits(compose: any, report: ValidationReport): Promise<void> {
    if (!compose.services) return;

    const MAX_MEMORY_MB = 4096; // 4GB per container
    const MAX_CPUS = 2.0;

    for (const [serviceName, service] of Object.entries<any>(compose.services)) {
      // Check for deploy.resources.limits (Compose v3 syntax)
      const limits = service.deploy?.resources?.limits;
      const memLimit = service.mem_limit || limits?.memory;
      const cpuLimit = service.cpus || limits?.cpus;

      if (!memLimit) {
        report.warnings.push({
          check: 'missing_memory_limit',
          message: `Service "${serviceName}" has no memory limit. Recommended: <= ${MAX_MEMORY_MB}MB`,
          severity: 'warning',
        });
      } else {
        // Parse memory limit (e.g., "512M", "2G")
        const memMB = this.parseMemoryLimit(memLimit);
        if (memMB > MAX_MEMORY_MB) {
          report.hardBlocks.push({
            check: 'excessive_memory',
            message: `Service "${serviceName}" exceeds memory limit: ${memMB}MB > ${MAX_MEMORY_MB}MB`,
            severity: 'critical',
          });
        }
      }

      if (!cpuLimit) {
        report.warnings.push({
          check: 'missing_cpu_limit',
          message: `Service "${serviceName}" has no CPU limit. Recommended: <= ${MAX_CPUS} cores`,
          severity: 'warning',
        });
      } else if (parseFloat(cpuLimit) > MAX_CPUS) {
        report.hardBlocks.push({
          check: 'excessive_cpu',
          message: `Service "${serviceName}" exceeds CPU limit: ${cpuLimit} > ${MAX_CPUS}`,
          severity: 'critical',
        });
      }
    }
  }

  /**
   * Check exposed ports are in allowlist
   * Hard block: Only allow unprivileged ports (1024-65535)
   */
  private async checkPortAllowlist(compose: any, report: ValidationReport): Promise<void> {
    if (!compose.services) return;

    const MIN_PORT = 1024;
    const MAX_PORT = 65535;
    const BLOCKED_PORTS = [22, 25, 3306, 5432, 6379, 27017]; // SSH, SMTP, MySQL, PostgreSQL, Redis, MongoDB

    for (const [serviceName, service] of Object.entries<any>(compose.services)) {
      const ports = service.ports || [];
      
      for (const portMapping of ports) {
        const portStr = String(portMapping);
        // Parse formats: "8080:80", "8080", "127.0.0.1:8080:80"
        const match = portStr.match(/(\d+):(\d+)/);
        const hostPort = match ? parseInt(match[1]) : parseInt(portStr);
        const containerPort = match ? parseInt(match[2]) : parseInt(portStr);

        // Check host port range
        if (hostPort < MIN_PORT || hostPort > MAX_PORT) {
          report.hardBlocks.push({
            check: 'invalid_port_range',
            message: `Service "${serviceName}" exposes port ${hostPort} outside allowed range (${MIN_PORT}-${MAX_PORT})`,
            severity: 'critical',
          });
        }

        // Check for blocked ports
        if (BLOCKED_PORTS.includes(containerPort)) {
          report.warnings.push({
            check: 'blocked_container_port',
            message: `Service "${serviceName}" uses commonly blocked port ${containerPort}. May cause issues in deployment.`,
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Check image tar file sizes
   * Hard block: Images must be < 5GB each for ECR/deployment efficiency
   */
  private async checkImageSizeLimits(versionId: string, report: ValidationReport): Promise<void> {
    const MAX_IMAGE_SIZE_GB = 5;
    const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_GB * 1024 * 1024 * 1024;

    try {
      const imagePrefix = `scenarios/${versionId}/images/`;
      const objects = await this.minioService.listObjectsWithSize('rangex-staging', imagePrefix);

      for (const obj of objects) {
        if (obj.name.endsWith('.tar')) {
          const sizeGB = (obj.size / (1024 * 1024 * 1024)).toFixed(2);
          
          if (obj.size > MAX_IMAGE_SIZE_BYTES) {
            report.hardBlocks.push({
              check: 'image_size_limit',
              message: `Image "${obj.name.split('/').pop()}" exceeds size limit: ${sizeGB}GB > ${MAX_IMAGE_SIZE_GB}GB`,
              severity: 'critical',
            });
          } else if (obj.size > MAX_IMAGE_SIZE_BYTES * 0.8) {
            // Warning at 80% of limit
            report.warnings.push({
              check: 'large_image',
              message: `Image "${obj.name.split('/').pop()}" is large: ${sizeGB}GB. Consider optimizing.`,
              severity: 'warning',
            });
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not check image sizes for ${versionId}: ${errorMessage}`);
    }
  }

  /**
   * Check asset bundle sizes
   * Hard block: Total assets must be < 1GB for storage efficiency
   */
  private async checkAssetSizeLimits(versionId: string, report: ValidationReport): Promise<void> {
    const MAX_ASSETS_SIZE_GB = 1;
    const MAX_ASSETS_SIZE_BYTES = MAX_ASSETS_SIZE_GB * 1024 * 1024 * 1024;

    try {
      const assetsPrefix = `scenarios/${versionId}/assets/`;
      const objects = await this.minioService.listObjectsWithSize('rangex-staging', assetsPrefix);

      let totalSize = 0;
      for (const obj of objects) {
        totalSize += obj.size;
      }

      const totalGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
      
      if (totalSize > MAX_ASSETS_SIZE_BYTES) {
        report.hardBlocks.push({
          check: 'assets_size_limit',
          message: `Total assets size exceeds limit: ${totalGB}GB > ${MAX_ASSETS_SIZE_GB}GB`,
          severity: 'critical',
        });
      } else if (totalSize > MAX_ASSETS_SIZE_BYTES * 0.8) {
        report.warnings.push({
          check: 'large_assets',
          message: `Total assets size is large: ${totalGB}GB. Consider optimizing.`,
          severity: 'warning',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not check asset sizes for ${versionId}: ${errorMessage}`);
    }
  }

  /**
   * Parse memory limit string to MB
   * Examples: "512M" -> 512, "2G" -> 2048, "1073741824" -> 1024
   */
  private parseMemoryLimit(limit: string | number): number {
    if (typeof limit === 'number') {
      return Math.floor(limit / (1024 * 1024)); // bytes to MB
    }

    const str = String(limit).toUpperCase();
    const match = str.match(/^([0-9.]+)([KMGT]?)B?$/);
    
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'K': return value / 1024;
      case 'M': return value;
      case 'G': return value * 1024;
      case 'T': return value * 1024 * 1024;
      default: return value / (1024 * 1024); // bytes
    }
  }
}
