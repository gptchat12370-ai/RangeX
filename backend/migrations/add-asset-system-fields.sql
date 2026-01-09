-- Migration: Add Asset System Fields
-- Date: 2025-12-24
-- Description: Add fields for two-type asset system and Docker integration

-- Add fields to scenario_version table
ALTER TABLE scenario_version
  ADD COLUMN dockerComposePath VARCHAR(500) NULL
  COMMENT 'MinIO path to saved docker-compose.yml file';

ALTER TABLE scenario_version
  ADD COLUMN ecrImagesPushed BOOLEAN DEFAULT FALSE
  COMMENT 'Flag indicating if Docker images have been pushed to ECR';

ALTER TABLE scenario_version
  ADD COLUMN embeddedAssetsDeleted BOOLEAN DEFAULT FALSE
  COMMENT 'Flag indicating if machine-embedded assets have been deleted from MinIO';

ALTER TABLE scenario_version
  ADD COLUMN fargateTaskDefinition VARCHAR(500) NULL
  COMMENT 'ARN of the Fargate task definition';

-- Modify scenario_asset table
-- First, make assetType nullable for backward compatibility
ALTER TABLE scenario_asset
  MODIFY COLUMN assetType ENUM('tool', 'script', 'file', 'wordlist', 'config') NULL
  COMMENT 'Legacy asset type field (deprecated, use assetLocation)';

-- Add new fields to scenario_asset table
ALTER TABLE scenario_asset
  ADD COLUMN assetLocation ENUM('machine-embedded', 'downloadable') NULL
  COMMENT 'Asset location type: machine-embedded (baked into containers) or downloadable (permanent MinIO storage)';

ALTER TABLE scenario_asset
  ADD COLUMN minioPath VARCHAR(500) NULL
  COMMENT 'Full MinIO path to the asset file';

ALTER TABLE scenario_asset
  ADD COLUMN deletedFromMinio BOOLEAN DEFAULT FALSE
  COMMENT 'Flag indicating if asset has been deleted from MinIO (for machine-embedded assets after ECR push)';

-- Create indexes for better query performance
CREATE INDEX idx_scenario_version_docker_compose 
  ON scenario_version(dockerComposePath);

CREATE INDEX idx_scenario_asset_location 
  ON scenario_asset(assetLocation);

CREATE INDEX idx_scenario_asset_minio_path 
  ON scenario_asset(minioPath);

CREATE INDEX idx_scenario_asset_deleted 
  ON scenario_asset(deletedFromMinio);
