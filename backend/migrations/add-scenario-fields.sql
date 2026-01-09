-- Add missing columns to existing tables

-- Add coverImageUrl to scenario_version (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'scenario_version' AND column_name = 'coverImageUrl');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE scenario_version ADD COLUMN coverImageUrl VARCHAR(500) NULL AFTER solutionWriteup', 
  'SELECT "coverImageUrl already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add ecrUrl to platform_image (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'platform_image' AND column_name = 'ecrUrl');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE platform_image ADD COLUMN ecrUrl VARCHAR(500) NULL', 
  'SELECT "ecrUrl already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add isCustom to platform_image (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'platform_image' AND column_name = 'isCustom');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE platform_image ADD COLUMN isCustom BOOLEAN DEFAULT FALSE', 
  'SELECT "isCustom already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add creatorId to platform_image (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'platform_image' AND column_name = 'creatorId');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE platform_image ADD COLUMN creatorId VARCHAR(36) NULL', 
  'SELECT "creatorId already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create scenario_asset table if not exists
CREATE TABLE IF NOT EXISTS scenario_asset (
  id VARCHAR(36) PRIMARY KEY,
  scenarioVersionId VARCHAR(36) NOT NULL,
  assetType ENUM('tool', 'script', 'file', 'wordlist') NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  fileUrl VARCHAR(500) NOT NULL,
  fileSize INT NULL,
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scenarioVersionId) REFERENCES scenario_version(id) ON DELETE CASCADE,
  INDEX idx_scenario_version (scenarioVersionId)
);

SELECT 'Migration completed successfully!' AS status;
