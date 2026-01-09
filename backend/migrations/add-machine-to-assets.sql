-- Add missing fields to scenario_asset table for machine assignment
ALTER TABLE scenario_asset 
ADD COLUMN machineId VARCHAR(36) NULL AFTER scenarioVersionId,
ADD COLUMN targetPath VARCHAR(500) NULL COMMENT 'Path where file will be mounted in container',
ADD COLUMN permissions VARCHAR(10) NULL DEFAULT '0644' COMMENT 'File permissions (e.g., 0644, 0755)',
ADD COLUMN description TEXT NULL COMMENT 'Purpose of this asset';

-- Add foreign key to machine table
ALTER TABLE scenario_asset 
ADD CONSTRAINT FK_scenario_asset_machine 
FOREIGN KEY (machineId) REFERENCES machine(id) 
ON DELETE CASCADE;

-- Add index for faster queries
CREATE INDEX IDX_scenario_asset_machine ON scenario_asset(machineId);
CREATE INDEX IDX_scenario_asset_version ON scenario_asset(scenarioVersionId);
