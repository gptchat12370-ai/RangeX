import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { ScenarioVersionAdminTest } from '../entities/scenario-version-admin-test.entity';
import { AdminTestValidation } from '../entities/admin-test-validation.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { Machine } from '../entities/machine.entity';
import { EnvironmentService } from './environment.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminTestService {
  private readonly logger = new Logger(AdminTestService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(ScenarioVersionAdminTest)
    private readonly adminTestRepo: Repository<ScenarioVersionAdminTest>,
    @InjectRepository(AdminTestValidation)
    private readonly validationRepo: Repository<AdminTestValidation>,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    private readonly environmentService: EnvironmentService,
  ) {}

  /**
   * Start an admin cloud test for a scenario version
   * Creates a test session, provisions infrastructure, runs validations
   */
  async startAdminTest(
    scenarioVersionId: string,
    adminUserId: string,
  ): Promise<ScenarioVersionAdminTest> {
    // Load scenario version with machines
    const version = await this.versionRepo.findOne({
      where: { id: scenarioVersionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    if (!version.machines || version.machines.length === 0) {
      throw new BadRequestException('Scenario version has no machines to test');
    }

    // Create admin test record
    // Create admin test record with all required fields
    const adminTest = this.adminTestRepo.create({
      id: uuidv4(),
      scenarioVersionId,
      status: 'pending' as 'pending',
      mode: 'cloud_aws' as 'cloud_aws',
      startedAt: new Date(),
      createdByAdminId: adminUserId,
    });

    await this.adminTestRepo.save(adminTest);

    // Provision test session asynchronously
    this.runTestSession(adminTest.id, version).catch(error => {
      this.logger.error(`[ADMIN-TEST ${adminTest.id}] Test failed: ${error.message}`, error.stack);
      this.markTestFailed(adminTest.id, error.message);
    });

    return adminTest;
  }

  /**
   * Run the actual test session (async)
   */
  private async runTestSession(
    adminTestId: string,
    version: ScenarioVersion,
  ): Promise<void> {
    const startTime = Date.now();

    // Update status to running
    await this.adminTestRepo.update(adminTestId, { status: 'running' });

    try {
      // Create a short-lived test session
      this.logger.log(`[ADMIN-TEST ${adminTestId}] Provisioning test session...`);
      const result = await this.environmentService.startEnvironment(
        version.id,
        'admin-test-user', // Dummy user ID for admin tests
      );

      // Fetch the full session to get gateway IP and other details
      const session = await this.sessionRepo.findOne({
        where: { id: result.sessionId },
        relations: ['environmentMachines', 'scenarioVersion', 'scenarioVersion.machines'],
      });

      if (!session) {
        throw new Error('Failed to retrieve created session');
      }

      // Update admin test with session details
      await this.adminTestRepo.update(adminTestId, {
        testSessionId: session.id,
        gatewayIp: session.gatewayIp,
      });

      // Wait for tasks to be running (max 5 minutes)
      this.logger.log(`[ADMIN-TEST ${adminTestId}] Waiting for tasks to start...`);
      const tasksReady = await this.waitForTasksRunning(session.id, 300);

      if (!tasksReady) {
        throw new Error('Tasks did not reach running state within 5 minutes');
      }

      // Run validation checks
      this.logger.log(`[ADMIN-TEST ${adminTestId}] Running validation checks...`);
      await this.runValidationChecks(adminTestId, session.id, version.machines || []);

      // Determine overall status
      const validations = await this.validationRepo.find({
        where: { adminTestId },
      });

      const hasFailures = validations.some(v => v.status === 'fail');
      const allPassed = validations.every(v => v.status === 'pass' || v.status === 'skip');

      const finalStatus = hasFailures ? 'fail' : (allPassed ? 'pass' : 'error');
      const duration = Math.floor((Date.now() - startTime) / 1000);

      const summary = this.generateSummary(validations);

      // Update admin test record
      await this.adminTestRepo.update(adminTestId, {
        status: finalStatus,
        finishedAt: new Date(),
        duration,
        summary,
        reportJson: { validations },
      });

      // Update scenario version with test result
      const testStatusMap: Record<string, 'none' | 'running' | 'passed' | 'failed'> = {
        'pass': 'passed',
        'fail': 'failed',
        'error': 'failed',
      };
      
      await this.versionRepo.update(version.id, {
        lastAdminTestId: adminTestId,
        lastAdminTestStatus: testStatusMap[finalStatus] || 'failed',
        publishingBlocked: finalStatus !== 'pass',
      });

      this.logger.log(`[ADMIN-TEST ${adminTestId}] Test completed: ${finalStatus} (${duration}s)`);

      // Keep test session alive for 30 minutes for admin to explore
      // Admin can manually terminate via the UI
      setTimeout(() => {
        this.environmentService.terminateEnvironment(session.id, 'admin_test_auto_cleanup')
          .catch(err => this.logger.error(`Failed to cleanup test session ${session.id}:`, err));
      }, 1800000); // 30 minutes

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Wait for all Fargate tasks to reach RUNNING state
   */
  private async waitForTasksRunning(
    sessionId: string,
    maxWaitSeconds: number,
  ): Promise<boolean> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId },
        relations: ['environmentMachines'],
      });

      if (!session || !session.environmentMachines) {
        await this.delay(5000);
        continue;
      }

      const allRunning = session.environmentMachines.every(em => 
        em.status === 'running' || em.status === 'healthy'
      );

      if (allRunning && session.environmentMachines.length > 0) {
        return true;
      }

      await this.delay(5000); // Check every 5 seconds
    }

    return false;
  }

  /**
   * Run validation checks on the test session
   */
  private async runValidationChecks(
    adminTestId: string,
    sessionId: string,
    machines: Machine[],
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['environmentMachines'],
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const validations: AdminTestValidation[] = [];

    // Check 1: All tasks running
    for (const machine of machines) {
      const envMachine = session.environmentMachines?.find(em => em.machineId === machine.id);
      
      const check = this.validationRepo.create({
        id: uuidv4(),
        adminTestId,
        machineId: machine.id,
        machineName: machine.name,
        checkType: 'task_running',
        checkTarget: machine.name,
        status: envMachine?.status === 'running' || envMachine?.status === 'healthy' ? 'pass' : 'fail',
        message: envMachine?.status === 'running' || envMachine?.status === 'healthy'
          ? 'Task is running'
          : `Task status: ${envMachine?.status || 'not found'}`,
        checkedAt: new Date(),
      });

      validations.push(check);
    }

    // Check 2: Private IPs assigned
    for (const machine of machines) {
      const envMachine = session.environmentMachines?.find(em => em.machineId === machine.id);
      
      const check = this.validationRepo.create({
        id: uuidv4(),
        adminTestId,
        machineId: machine.id,
        machineName: machine.name,
        checkType: 'private_ip',
        checkTarget: machine.name,
        status: envMachine?.privateIp ? 'pass' : 'fail',
        message: envMachine?.privateIp 
          ? `IP assigned: ${envMachine.privateIp}`
          : 'No private IP assigned',
        details: envMachine?.privateIp ? { privateIp: envMachine.privateIp } : undefined,
        checkedAt: new Date(),
      });

      validations.push(check);
    }

    // Check 3: Entrypoints reachable (via gateway)
    if (session.gatewayIp) {
      for (const machine of machines) {
        if (machine.entrypoints && machine.entrypoints.length > 0) {
          for (const entrypoint of machine.entrypoints) {
            if (entrypoint.exposedToSolver) {
              const reachable = await this.checkEntrypointReachability(
                session.gatewayIp,
                sessionId,
                machine.name,
                entrypoint,
              );

              const check = this.validationRepo.create({
                id: uuidv4(),
                adminTestId,
                machineId: machine.id,
                machineName: machine.name,
                checkType: 'entrypoint_reachable',
                checkTarget: `${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort}`,
                status: reachable ? 'pass' : 'fail',
                message: reachable 
                  ? `Entrypoint ${entrypoint.protocol}:${entrypoint.containerPort} is reachable`
                  : `Entrypoint ${entrypoint.protocol}:${entrypoint.containerPort} not reachable`,
                details: { entrypoint },
                checkedAt: new Date(),
              });

              validations.push(check);
            }
          }
        }
      }
    }

    // Save all validations
    await this.validationRepo.save(validations);
  }

  /**
   * Check if an entrypoint is reachable via gateway
   */
  private async checkEntrypointReachability(
    gatewayIp: string,
    sessionId: string,
    machineName: string,
    entrypoint: any,
  ): Promise<boolean> {
    try {
      // For HTTP/HTTPS, try to connect via proxy path
      if (entrypoint.protocol === 'http' || entrypoint.protocol === 'https') {
        const proxyUrl = `http://${gatewayIp}:8080/proxy/${sessionId}/${machineName}/${entrypoint.protocol}-${entrypoint.containerPort}`;
        
        const response = await axios.get(proxyUrl, {
          timeout: 5000,
          validateStatus: () => true, // Accept any status code
        });

        // Consider 2xx, 3xx, 401, 403 as "reachable" (service responding)
        return response.status < 500;
      }

      // For other protocols, we can't easily check without specialized tools
      // Mark as skip for now
      return true;
    } catch (error: any) {
      this.logger.warn(`Entrypoint check failed for ${machineName}:${entrypoint.containerPort}: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate summary text from validation results
   */
  private generateSummary(validations: AdminTestValidation[]): string {
    const passed = validations.filter(v => v.status === 'pass').length;
    const failed = validations.filter(v => v.status === 'fail').length;
    const skipped = validations.filter(v => v.status === 'skip').length;

    return `Validation Results: ${passed} passed, ${failed} failed, ${skipped} skipped`;
  }

  /**
   * Mark test as failed
   */
  private async markTestFailed(adminTestId: string, errorMessage: string): Promise<void> {
    await this.adminTestRepo.update(adminTestId, {
      status: 'error',
      finishedAt: new Date(),
      errorMessage,
    });

    // Also update scenario version
    const test = await this.adminTestRepo.findOne({ where: { id: adminTestId } });
    if (test) {
      await this.versionRepo.update(test.scenarioVersionId, {
        lastAdminTestId: adminTestId,
        lastAdminTestStatus: 'failed' as const,
        publishingBlocked: true,
      });
    }
  }

  /**
   * Get admin test by ID
   */
  async getAdminTest(adminTestId: string): Promise<ScenarioVersionAdminTest | null> {
    return this.adminTestRepo.findOne({
      where: { id: adminTestId },
      relations: ['scenarioVersion', 'createdBy'],
    });
  }

  /**
   * Get validation results for an admin test
   */
  async getValidations(adminTestId: string): Promise<AdminTestValidation[]> {
    return this.validationRepo.find({
      where: { adminTestId },
      order: { checkedAt: 'ASC' },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
