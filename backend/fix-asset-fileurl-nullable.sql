-- Fix scenario_asset.fileUrl to allow NULL for pending uploads
-- This allows assets to be saved during draft creation before being uploaded to MinIO

USE `rangex`;

-- Make fileUrl nullable
ALTER TABLE `scenario_asset` 
MODIFY COLUMN `fileUrl` VARCHAR(500) NULL;

-- Verify the change
DESCRIBE `scenario_asset`;
