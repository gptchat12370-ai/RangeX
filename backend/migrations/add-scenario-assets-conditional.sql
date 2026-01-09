-- Conditional migration script - only adds columns if they don't exist

-- Check and add coverImageUrl to scenario_version
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'scenario_version' AND column_name = 'coverImageUrl');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE scenario_version ADD COLUMN coverImageUrl VARCHAR(500) NULL AFTER solutionWriteup', 
  'SELECT "coverImageUrl already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ecrUrl to docker_image
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'docker_image' AND column_name = 'ecrUrl');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE docker_image ADD COLUMN ecrUrl VARCHAR(500) NULL', 
  'SELECT "ecrUrl already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add isCustom to docker_image
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'docker_image' AND column_name = 'isCustom');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE docker_image ADD COLUMN isCustom BOOLEAN DEFAULT FALSE', 
  'SELECT "isCustom already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add creatorId to docker_image
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'docker_image' AND column_name = 'creatorId');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE docker_image ADD COLUMN creatorId VARCHAR(36) NULL', 
  'SELECT "creatorId already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add caseSensitive to question
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'question' AND column_name = 'caseSensitive');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE question ADD COLUMN caseSensitive BOOLEAN DEFAULT FALSE', 
  'SELECT "caseSensitive already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add acceptableAnswers to question
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = 'rangex' AND table_name = 'question' AND column_name = 'acceptableAnswers');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE question ADD COLUMN acceptableAnswers JSON NULL', 
  'SELECT "acceptableAnswers already exists" AS message');
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
