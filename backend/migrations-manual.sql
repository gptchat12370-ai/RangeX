-- Add Machine Phase 2-3 columns
ALTER TABLE machine 
  ADD COLUMN IF NOT EXISTS envVars JSON NULL COMMENT 'Additional environment variables',
  ADD COLUMN IF NOT EXISTS command JSON NULL COMMENT 'Container command override',
  ADD COLUMN IF NOT EXISTS entrypoint JSON NULL COMMENT 'Entrypoint override',
  ADD COLUMN IF NOT EXISTS dependsOn JSON NULL COMMENT 'Machine dependencies',
  ADD COLUMN IF NOT EXISTS healthcheck JSON NULL COMMENT 'Healthcheck configuration',
  ADD COLUMN IF NOT EXISTS networkAliases JSON NULL COMMENT 'Local compose network aliases',
  ADD COLUMN IF NOT EXISTS solverHints JSON NULL COMMENT 'Hints shown to solvers (creator-specified)',
  ADD COLUMN IF NOT EXISTS attackerBootstrap JSON NULL COMMENT 'Attacker bootstrap config (role=attacker only)',
  ADD COLUMN IF NOT EXISTS composeExtensions JSON NULL COMMENT 'Local-only compose extensions (allowlisted)';

-- Add ScenarioVersion lifecycle columns
ALTER TABLE scenario_version 
  ADD COLUMN IF NOT EXISTS runtimeManifest JSON NULL COMMENT 'AWS runtime manifest',
  ADD COLUMN IF NOT EXISTS buildLogs TEXT NULL COMMENT 'ECR build pipeline logs',
  ADD COLUMN IF NOT EXISTS publishedAt DATETIME NULL COMMENT 'When marked PUBLISHED';

-- Update existing status values to uppercase enum
UPDATE scenario_version SET status = 'DRAFT' WHERE LOWER(status) = 'draft';
UPDATE scenario_version SET status = 'SUBMITTED' WHERE LOWER(status) IN ('pending_approval', 'pending approval');
UPDATE scenario_version SET status = 'APPROVED' WHERE LOWER(status) = 'approved';
UPDATE scenario_version SET status = 'ARCHIVED' WHERE LOWER(status) = 'archived';
