-- Add creatorName field to scenario_version table
ALTER TABLE `scenario_version` 
ADD COLUMN `creatorName` VARCHAR(100) NULL AFTER `scenarioType`;

-- Update existing records to have NULL creatorName (can be filled in later by creators)
UPDATE `scenario_version` SET `creatorName` = NULL WHERE `creatorName` IS NULL;
