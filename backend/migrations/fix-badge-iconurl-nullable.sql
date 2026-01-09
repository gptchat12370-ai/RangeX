-- Fix Badge iconUrl column to be nullable with default value
-- This resolves the "Field 'iconUrl' doesn't have a default value" error

ALTER TABLE `badge` 
MODIFY COLUMN `iconUrl` VARCHAR(500) NULL DEFAULT 'https://api.dicebear.com/7.x/icons/svg?seed=badge&icon=shield';

-- Update any existing badges that might have NULL iconUrl
UPDATE `badge` 
SET `iconUrl` = 'https://api.dicebear.com/7.x/icons/svg?seed=badge&icon=shield' 
WHERE `iconUrl` IS NULL;
