-- Phase 1: Enhance ImageVariant with default entrypoints and metadata
-- This allows image variants to define their connection contract

USE `rangex`;

-- Add new fields to image_variants table
ALTER TABLE `image_variants`
  ADD COLUMN `defaultEntrypoints` JSON NULL COMMENT 'Default entrypoints for this image (protocol, port, description)',
  ADD COLUMN `hasGui` TINYINT(1) NULL DEFAULT 0 COMMENT 'Whether this image has a GUI (VNC, RDP, Kasm, etc)',
  ADD COLUMN `recommendedNetworkGroup` VARCHAR(64) NULL COMMENT 'Recommended network group (attacker, dmz, internal, mgmt)',
  ADD COLUMN `notes` TEXT NULL COMMENT 'Admin notes about this image variant';

-- Update existing Kali XFCE variant with default entrypoints (example)
-- Adjust ID based on your actual data
UPDATE `image_variants`
SET 
  `defaultEntrypoints` = JSON_ARRAY(
    JSON_OBJECT('protocol', 'vnc', 'containerPort', 5900, 'exposedToSolver', true, 'description', 'VNC Desktop'),
    JSON_OBJECT('protocol', 'http', 'containerPort', 6901, 'exposedToSolver', true, 'description', 'noVNC Web Access')
  ),
  `hasGui` = 1,
  `recommendedNetworkGroup` = 'attacker',
  `notes` = 'Kali Linux with XFCE desktop - requires VNC or noVNC client'
WHERE `name` LIKE '%Kali%XFCE%' OR `name` LIKE '%kali-desktop%';

-- Update DVWA with default HTTP entrypoint
UPDATE `image_variants`
SET 
  `defaultEntrypoints` = JSON_ARRAY(
    JSON_OBJECT('protocol', 'http', 'containerPort', 80, 'exposedToSolver', false, 'description', 'DVWA Web Interface')
  ),
  `hasGui` = 0,
  `recommendedNetworkGroup` = 'dmz'
WHERE `name` LIKE '%DVWA%' OR `name` LIKE '%dvwa%';

-- Verify changes
SELECT id, name, hasGui, recommendedNetworkGroup, defaultEntrypoints 
FROM `image_variants` 
WHERE defaultEntrypoints IS NOT NULL;
