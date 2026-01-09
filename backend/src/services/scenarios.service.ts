import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scenario } from '../entities/scenario.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { PlaylistItem } from '../entities/playlist-item.entity';
import { CareerPathItem } from '../entities/career-path-item.entity';

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);
  
  constructor(
    @InjectRepository(Scenario)
    private readonly scenarioRepository: Repository<Scenario>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepository: Repository<ScenarioVersion>,
    @InjectRepository(PlaylistItem)
    private readonly playlistItemRepo: Repository<PlaylistItem>,
    @InjectRepository(CareerPathItem)
    private readonly careerPathItemRepo: Repository<CareerPathItem>,
  ) {}

  async findPending(): Promise<ScenarioVersion[]> {
    // Find scenario versions with pending_approval status
    const pendingVersions = await this.versionRepository.find({
      where: { status: ScenarioVersionStatus.SUBMITTED },
      relations: ['scenario', 'machines'],
    });
    
    // Return the pending versions directly (not parent scenarios)
    return pendingVersions;
  }

  async approve(id: string): Promise<ScenarioVersion> {
    const version = await this.versionRepository.findOne({ 
      where: { id },
      relations: ['scenario', 'machines', 'questions', 'assets']
    });
    if (!version) {
      throw new Error('Scenario version not found');
    }
    
    // Validate that scenario has content (machines OR questions OR assets)
    const hasMachines = version.machines && version.machines.length > 0;
    const hasQuestions = version.questions && version.questions.length > 0;
    const hasAssets = version.assets && version.assets.length > 0;
    
    if (!hasMachines && !hasQuestions && !hasAssets) {
      throw new Error(
        'Cannot approve scenario: No content configured. ' +
        'Scenario must have at least one machine, question, or asset.'
      );
    }
    
    // SECURITY: Validate machine images before approval
    if (version.machines && version.machines.length > 0) {
      for (const machine of version.machines) {
        // Block :latest tags (supply chain security - images must be pinned)
        if (machine.imageRef && machine.imageRef.includes(':latest')) {
          throw new Error(
            `Cannot approve scenario: Machine "${machine.name}" uses :latest tag. ` +
            `Please pin to a specific version (e.g., ubuntu:22.04 instead of ubuntu:latest) for security and reproducibility.`
          );
        }
        
        // Enforce attacker role must use Platform Library images only
        if (machine.role === 'attacker' && machine.imageSourceType !== 'platform_library') {
          throw new Error(
            `Cannot approve scenario: Attacker machine "${machine.name}" must use Platform Library images. ` +
            `Current source: ${machine.imageSourceType}. Attacker machines require vetted, trusted images.`
          );
        }
        
        // FARGATE SAFETY: Validate production deployment constraints
        // Note: privileged mode, host networking, docker socket mounts, and hostPath volumes
        // are NOT supported in the Machine entity by design. This prevents scenarios from
        // requesting these unsafe configurations. The docker-compose-generator.service.ts
        // also does not generate these configurations. This comment documents the constraints
        // for future maintainers:
        // - NO privileged: true (container escape risk)
        // - NO network_mode: host (bypasses network isolation)
        // - NO volumes: ['/var/run/docker.sock:/var/run/docker.sock'] (host access)
        // - NO volumes with hostPath mounts (filesystem access)
        // - Egress policy: Default deny recommended (configure via security groups/network policies)
      }
    }
    
    // Archive all previously approved versions of the same scenario
    const previouslyApprovedVersions = await this.versionRepository.find({
      where: { 
        scenarioId: version.scenarioId,
        status: ScenarioVersionStatus.APPROVED
      }
    });
    
    const oldVersionIds: string[] = [];
    for (const oldVersion of previouslyApprovedVersions) {
      oldVersionIds.push(oldVersion.id);
      oldVersion.status = ScenarioVersionStatus.ARCHIVED;
      oldVersion.isArchived = true;
      oldVersion.archivedAt = new Date();
      await this.versionRepository.save(oldVersion);
    }
    
    // Update status to approved
    version.status = ScenarioVersionStatus.APPROVED;
    version.approvedAt = new Date();
    
    await this.versionRepository.save(version);
    
    // Auto-update playlists and career paths to use the new approved version
    if (oldVersionIds.length > 0) {
      this.logger.log(`Updating playlists/career paths: replacing old version IDs ${oldVersionIds.join(', ')} with new version ${version.id}`);
      
      // Update playlist items
      for (const oldVersionId of oldVersionIds) {
        const playlistItems = await this.playlistItemRepo.find({
          where: { scenarioVersionId: oldVersionId }
        });
        
        if (playlistItems.length > 0) {
          this.logger.log(`Found ${playlistItems.length} playlist items with old version ${oldVersionId}`);
          for (const item of playlistItems) {
            item.scenarioVersionId = version.id;
            await this.playlistItemRepo.save(item);
          }
        }
        
        // Update career path items
        const careerPathItems = await this.careerPathItemRepo.find({
          where: { scenarioVersionId: oldVersionId }
        });
        
        if (careerPathItems.length > 0) {
          this.logger.log(`Found ${careerPathItems.length} career path items with old version ${oldVersionId}`);
          for (const item of careerPathItems) {
            item.scenarioVersionId = version.id;
            await this.careerPathItemRepo.save(item);
          }
        }
      }
    }
    
    return version;
  }

  async reject(id: string, reason: string): Promise<ScenarioVersion> {
    const version = await this.versionRepository.findOne({ 
      where: { id },
      relations: ['scenario']
    });
    if (!version) {
      throw new Error('Scenario version not found');
    }
    
    // Update status back to draft when rejected
    version.status = ScenarioVersionStatus.DRAFT;
    version.rejectReason = reason;
    version.rejectedAt = new Date();
    
    await this.versionRepository.save(version);
    return version;
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    await this.scenarioRepository.delete(id);
    return { deleted: true };
  }
}
