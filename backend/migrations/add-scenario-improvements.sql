-- Database Migration for Scenario System Improvements
-- Run this in your MySQL database

-- Add new fields to scenario_version table (skip if column already exists)
-- codeOfEthics
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'rangex' AND TABLE_NAME = 'scenario_version' AND COLUMN_NAME = 'codeOfEthics';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE scenario_version ADD COLUMN `codeOfEthics` TEXT;', 'SELECT "Column codeOfEthics already exists";');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- validationMode
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'rangex' AND TABLE_NAME = 'scenario_version' AND COLUMN_NAME = 'validationMode';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE scenario_version ADD COLUMN `validationMode` VARCHAR(24) DEFAULT ''instant'';', 'SELECT "Column validationMode already exists";');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- scoringMode
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'rangex' AND TABLE_NAME = 'scenario_version' AND COLUMN_NAME = 'scoringMode';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE scenario_version ADD COLUMN `scoringMode` VARCHAR(24) DEFAULT ''allOrNothing'';', 'SELECT "Column scoringMode already exists";');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- hintMode
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'rangex' AND TABLE_NAME = 'scenario_version' AND COLUMN_NAME = 'hintMode';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE scenario_version ADD COLUMN `hintMode` VARCHAR(24) DEFAULT ''disabled'';', 'SELECT "Column hintMode already exists";');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records to have default values
UPDATE scenario_version 
SET validationMode = 'instant' 
WHERE validationMode IS NULL;

UPDATE scenario_version 
SET scoringMode = 'allOrNothing' 
WHERE scoringMode IS NULL;

UPDATE scenario_version 
SET hintMode = 'disabled' 
WHERE hintMode IS NULL;

-- Ensure requiresMachines column exists and has default value
ALTER TABLE scenario_version 
MODIFY COLUMN `requiresMachines` TINYINT(1) DEFAULT 1;
