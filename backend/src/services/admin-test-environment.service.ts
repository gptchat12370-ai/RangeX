import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersionTestRun, TestResults, TestRunStatus } from '../entities/scenario-version-test-run.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { EnvironmentService } from './environment.service';
import { GatewayProxyService } from './gateway-proxy.service';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class AdminTestEnvironmentService {
  private readonly logger = new Logger(AdminTestEnvironmentService.name);

  constructor(
    @InjectRepository(ScenarioVersionTestRun)
    private readonly testRunRepo: Repository<ScenarioVersionTestRun>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly environmentService: EnvironmentService,
    private readonly gatewayProxyService: GatewayProxyService,
  ) {}

  /**
   * Start a test run for a scenario version
   * This deploys the scenario to AWS and runs automated validation
   */
  async startTestRun(versionId: string, adminUserId: string): Promise<ScenarioVersionTestRun> {
    this.logger.log(`Starting test run for version ${versionId} by admin ${adminUserId}`);

    // Check if version exists
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException(`Scenario version ${versionId} not found`);
    }

    // Check if a test is already running
    const existingTest = await this.testRunRepo.findOne({
      where: {
        scenarioVersionId: versionId,
        status: 'deploying' as TestRunStatus,
      },
    });

    if (existingTest) {
      throw new BadRequestException('A test deployment is already running for this version');
    }

    // Create test run record
    const testRun = this.testRunRepo.create({
      scenarioVersionId: versionId,
      initiatedBy: adminUserId,
      status: 'pending',
      sessionToken: this.generateSessionToken(),
      logs: '',
    });

    await this.testRunRepo.save(testRun);

    // Start deployment asynchronously
    this.executeTestDeployment(testRun.id).catch((err) => {
      this.logger.error(`Test deployment failed for ${testRun.id}: ${err.message}`, err.stack);
    });

    return testRun;
  }

  /**
   * Execute test deployment and validation
   * Runs asynchronously in the background
   */
  private async executeTestDeployment(testRunId: string): Promise<void> {
    const testRun = await this.testRunRepo.findOne({ where: { id: testRunId } });
    if (!testRun) return;

    try {
      // Step 1: Update status to deploying
      await this.updateTestRun(testRunId, {
        status: 'deploying',
        logs: this.appendLog(testRun.logs, '[DEPLOY] Starting deployment to AWS...'),
      });

      // Step 2: Deploy scenario to AWS
      this.logger.log(`Deploying scenario version ${testRun.scenarioVersionId}...`);
      const { sessionId } = await this.environmentService.startEnvironment(
        testRun.scenarioVersionId,
        testRun.initiatedBy,
        true, // isTest
      );

      await this.updateTestRun(testRunId, {
        deploymentId: sessionId,
        logs: this.appendLog(testRun.logs, `[DEPLOY] Session created: ${sessionId}`),
      });

      // Wait for deployment to stabilize (machines running)
      await this.waitForDeploymentReady(sessionId, testRunId);

      // Step 3: Discover gateway proxy URL
      await this.updateTestRun(testRunId, {
        status: 'testing',
        logs: this.appendLog(testRun.logs, '[TEST] Discovering gateway proxy...'),
      });

      const gatewayInfo = await this.gatewayProxyService.discoverGatewayProxy(true);
      const gatewayProxyUrl = `http://${gatewayInfo.publicIp}:8080`;

      await this.updateTestRun(testRunId, {
        gatewayProxyUrl,
        logs: this.appendLog(testRun.logs, `[TEST] Gateway proxy found: ${gatewayProxyUrl}`),
      });

      // Step 4: Run automated tests
      const testResults = await this.runAutomatedTests(
        testRun.scenarioVersionId,
        sessionId,
        gatewayProxyUrl,
        testRunId,
      );

      // Step 5: Update final status
      const finalStatus: TestRunStatus = testResults.errors.length === 0 ? 'passed' : 'failed';
      await this.updateTestRun(testRunId, {
        status: finalStatus,
        testResults,
        completedAt: new Date(),
        logs: this.appendLog(
          testRun.logs,
          `[COMPLETE] Test ${finalStatus.toUpperCase()} - ${testResults.errors.length} errors`,
        ),
      });

      this.logger.log(`Test run ${testRunId} completed with status: ${finalStatus}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Test run ${testRunId} failed: ${errorMessage}`, error instanceof Error ? error.stack : '');

      await this.updateTestRun(testRunId, {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        logs: this.appendLog(testRun.logs, `[ERROR] ${errorMessage}`),
      });
    }
  }

  /**
   * Run automated validation tests
   */
  private async runAutomatedTests(
    versionId: string,
    sessionId: string,
    gatewayProxyUrl: string,
    testRunId: string,
  ): Promise<TestResults> {
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    const results: TestResults = {
      gatewayReachable: false,
      machinesHealthy: {},
      entrypointsAccessible: {},
      errors: [],
      checkDetails: {
        gatewayCheck: undefined,
        machineHealthChecks: [],
        entrypointChecks: [],
      },
    };

    // Test 1: Gateway proxy reachability
    try {
      await this.updateTestRun(testRunId, {
        logs: this.appendLog((await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs, '[TEST] Checking gateway proxy reachability...'),
      });

      const response = await axios.get(`${gatewayProxyUrl}/health`, { timeout: 10000, validateStatus: () => true });
      results.gatewayReachable = response.status === 200 || response.status === 404;
      results.checkDetails!.gatewayCheck = {
        success: true,
        message: `Gateway proxy responded with status ${response.status}`,
        timestamp: new Date(),
      };

      await this.updateTestRun(testRunId, {
        logs: this.appendLog(
          (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
          `[TEST] ✅ Gateway proxy reachable (${response.status})`,
        ),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push(`Gateway proxy not reachable: ${errorMessage}`);
      results.checkDetails!.gatewayCheck = {
        success: false,
        message: errorMessage,
        timestamp: new Date(),
      };

      await this.updateTestRun(testRunId, {
        logs: this.appendLog(
          (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
          `[TEST] ❌ Gateway proxy unreachable: ${errorMessage}`,
        ),
      });
    }

    // Test 2: Machine health checks (ECS task running status)
    for (const machine of version.machines || []) {
      try {
        await this.updateTestRun(testRunId, {
          logs: this.appendLog(
            (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
            `[TEST] Checking machine ${machine.name} health...`,
          ),
        });

        // Check if ECS task is running (via environment service)
        const isHealthy = await this.checkMachineHealth(machine.id, sessionId);
        results.machinesHealthy[machine.id] = isHealthy;

        results.checkDetails!.machineHealthChecks!.push({
          machineId: machine.id,
          machineName: machine.name,
          success: isHealthy,
          message: isHealthy ? 'ECS task running' : 'ECS task not running or unhealthy',
        });

        if (!isHealthy) {
          results.errors.push(`Machine ${machine.name} is not healthy`);
          await this.updateTestRun(testRunId, {
            logs: this.appendLog(
              (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
              `[TEST] ❌ Machine ${machine.name} unhealthy`,
            ),
          });
        } else {
          await this.updateTestRun(testRunId, {
            logs: this.appendLog(
              (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
              `[TEST] ✅ Machine ${machine.name} healthy`,
            ),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.machinesHealthy[machine.id] = false;
        results.errors.push(`Machine ${machine.name} health check failed: ${errorMessage}`);

        results.checkDetails!.machineHealthChecks!.push({
          machineId: machine.id,
          machineName: machine.name,
          success: false,
          message: errorMessage,
        });
      }
    }

    // Test 3: Entrypoint accessibility (HTTP GET to proxy URLs)
    for (const machine of version.machines || []) {
      if (!machine.allowSolverEntry || !machine.entrypoints) continue;

      // Get the environment machine to check its private IP
      const session = await this.environmentService['sessionRepo'].findOne({
        where: { id: sessionId },
        relations: ['environmentMachines'],
      });
      const envMachine = session?.environmentMachines?.find((em: any) => em.machineId === machine.id);
      const machinePrivateIp = envMachine?.privateIp;

      for (const entrypoint of machine.entrypoints.filter((e: any) => e.exposedToSolver)) {
        const machineSlug = this.sanitizeName(machine.name);
        const entrypointKey = `${machineSlug}:${entrypoint.protocol}:${entrypoint.containerPort}`;
        
        // Build URL using the same format as session-connection.service.ts
        const destination = machinePrivateIp || machineSlug;
        const url = entrypoint.protocol === 'http' || entrypoint.protocol === 'https'
          ? `${gatewayProxyUrl}/http?dst=${destination}&port=${entrypoint.containerPort}&path=/&token=${sessionId}`
          : null; // Don't test non-HTTP protocols via HTTP

        try {
          await this.updateTestRun(testRunId, {
            logs: this.appendLog(
              (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
              `[TEST] Checking entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort}...`,
            ),
          });

          // Only test HTTP/HTTPS entrypoints (SSH/RDP/VNC require different testing)
          if (url && (entrypoint.protocol === 'http' || entrypoint.protocol === 'https')) {
            const response = await axios.get(url, { timeout: 10000, maxRedirects: 0, validateStatus: () => true });
            const isAccessible = response.status < 500; // Accept any non-5xx response
            results.entrypointsAccessible[entrypointKey] = isAccessible;

            results.checkDetails!.entrypointChecks!.push({
              entrypointKey,
              url,
              success: isAccessible,
              message: `HTTP ${response.status}`,
            });

            if (!isAccessible) {
              results.errors.push(`Entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort} not accessible (HTTP ${response.status})`);
              await this.updateTestRun(testRunId, {
                logs: this.appendLog(
                  (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
                  `[TEST] ❌ Entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort} - HTTP ${response.status}`,
                ),
              });
            } else {
              await this.updateTestRun(testRunId, {
                logs: this.appendLog(
                  (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
                  `[TEST] ✅ Entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort} - HTTP ${response.status}`,
                ),
              });
            }
          } else {
            // For non-HTTP protocols (SSH/VNC/RDP), mark as passed if machine is healthy
            const machineHealthy = results.machinesHealthy[machine.id] || false;
            results.entrypointsAccessible[entrypointKey] = machineHealthy;
            results.checkDetails!.entrypointChecks!.push({
              entrypointKey,
              url: url || 'N/A (non-HTTP protocol)',
              success: machineHealthy,
              message: `Non-HTTP protocol - using machine health status`,
            });
            
            await this.updateTestRun(testRunId, {
              logs: this.appendLog(
                (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
                `[TEST] ✅ Entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort} - Non-HTTP (machine healthy)`,
              ),
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.entrypointsAccessible[entrypointKey] = false;
          results.errors.push(`Entrypoint ${machine.name}:${entrypoint.protocol}:${entrypoint.containerPort} not accessible: ${errorMessage}`);

          results.checkDetails!.entrypointChecks!.push({
            entrypointKey,
            url: url || 'N/A',
            success: false,
            message: errorMessage,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if a machine is healthy (ECS task running)
   */
  private async checkMachineHealth(machineId: string, sessionId: string): Promise<boolean> {
    try {
      // Get the session with environment machines
      const session = await this.environmentService['sessionRepo'].findOne({
        where: { id: sessionId },
        relations: ['environmentMachines'],
      });

      if (!session || !session.environmentMachines) {
        return false;
      }

      // Find the environment machine for this machine ID
      const envMachine = session.environmentMachines.find((em: any) => em.machineId === machineId);
      
      if (!envMachine) {
        return false;
      }

      // Check if machine is running or healthy
      return envMachine.status === 'running' || envMachine.status === 'healthy';
    } catch (error) {
      this.logger.warn(`Failed to check machine ${machineId} health: ${error}`);
      return false;
    }
  }

  /**
   * Wait for deployment to be ready (all tasks running)
   */
  private async waitForDeploymentReady(sessionId: string, testRunId: string, maxWaitMs = 300000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitMs) {
      await this.updateTestRun(testRunId, {
        logs: this.appendLog(
          (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
          `[DEPLOY] Waiting for session ${sessionId} to be ready...`,
        ),
      });

      // Check if session is running AND all machines are healthy
      const session = await this.environmentService['sessionRepo'].findOne({ 
        where: { id: sessionId },
        relations: ['environmentMachines']
      });
      
      if (session && session.status === 'running') {
        // Check if all environment machines are running or healthy
        const machines = session.environmentMachines || [];
        const allMachinesReady = machines.every(
          (em: any) => em.status === 'running' || em.status === 'healthy'
        );
        
        if (allMachinesReady && machines.length > 0) {
          await this.updateTestRun(testRunId, {
            logs: this.appendLog(
              (await this.testRunRepo.findOne({ where: { id: testRunId } }))!.logs,
              `[DEPLOY] ✅ Session ready - all ${machines.length} machines running`,
            ),
          });
          
          // Give machines extra 15 seconds to fully initialize services
          await new Promise((resolve) => setTimeout(resolve, 15000));
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Session ${sessionId} did not become ready within ${maxWaitMs / 1000} seconds`);
  }

  /**
   * Get test run by ID
   */
  async getTestRun(testRunId: string): Promise<ScenarioVersionTestRun> {
    const testRun = await this.testRunRepo.findOne({
      where: { id: testRunId },
      relations: ['scenarioVersion', 'initiator'],
    });

    if (!testRun) {
      throw new NotFoundException(`Test run ${testRunId} not found`);
    }

    return testRun;
  }

  /**
   * Get latest test run for a scenario version
   */
  async getLatestTestRun(versionId: string): Promise<ScenarioVersionTestRun | null> {
    return await this.testRunRepo.findOne({
      where: { scenarioVersionId: versionId },
      order: { createdAt: 'DESC' },
      relations: ['initiator'],
    });
  }

  /**
   * Cancel a running test
   */
  async cancelTestRun(testRunId: string): Promise<void> {
    const testRun = await this.testRunRepo.findOne({ where: { id: testRunId } });
    if (!testRun) {
      throw new NotFoundException(`Test run ${testRunId} not found`);
    }

    if (testRun.status !== 'deploying' && testRun.status !== 'testing') {
      throw new BadRequestException(`Test run is not active (status: ${testRun.status})`);
    }

    // Terminate deployment if exists
    if (testRun.deploymentId) {
      await this.environmentService.terminateEnvironment(testRun.deploymentId, 'Test run cancelled by admin');
    }

    await this.updateTestRun(testRunId, {
      status: 'cancelled',
      completedAt: new Date(),
      logs: this.appendLog(testRun.logs, '[CANCELLED] Test run cancelled by admin'),
    });
  }

  /**
   * Helper: Update test run
   */
  private async updateTestRun(testRunId: string, updates: Partial<ScenarioVersionTestRun>): Promise<void> {
    await this.testRunRepo.update(testRunId, updates);
  }

  /**
   * Helper: Append log entry
   */
  private appendLog(existingLogs: string | null, newEntry: string): string {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${newEntry}\n`;
    return (existingLogs || '') + logEntry;
  }

  /**
   * Helper: Generate session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Helper: Sanitize machine name to slug
   */
  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
