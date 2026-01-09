import { BadRequestException } from '@nestjs/common';
import { ScenarioVersionStatus } from '../entities/scenario-version.entity';

/**
 * Normalizes scenario status input to accept both old lowercase and new uppercase values
 * Temporary compatibility layer during migration
 */
export function normalizeScenarioStatus(input: string): ScenarioVersionStatus {
  const v = (input || '').trim();

  const map: Record<string, ScenarioVersionStatus> = {
    draft: ScenarioVersionStatus.DRAFT,
    pending_approval: ScenarioVersionStatus.SUBMITTED,
    approved: ScenarioVersionStatus.APPROVED,
    published: ScenarioVersionStatus.PUBLISHED,
    rejected: ScenarioVersionStatus.REJECTED,
    archived: ScenarioVersionStatus.ARCHIVED,

    DRAFT: ScenarioVersionStatus.DRAFT,
    SUBMITTED: ScenarioVersionStatus.SUBMITTED,
    APPROVED: ScenarioVersionStatus.APPROVED,
    PUBLISHED: ScenarioVersionStatus.PUBLISHED,
    REJECTED: ScenarioVersionStatus.REJECTED,
    ARCHIVED: ScenarioVersionStatus.ARCHIVED,
  };

  const out = map[v];
  if (!out) throw new BadRequestException(`Invalid scenario status: ${input}`);
  return out;
}
