-- Migration: Add fargateTaskDefinition column to machine table
-- Purpose: Store per-machine task definition ARN for Phase 2 architecture
-- Date: 2026-01-02

-- Check if column exists before adding (idempotent)
SET @dbname = DATABASE();
SET @tablename = 'machine';
SET @columnname = 'fargateTaskDefinition';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT ''Column already exists, skipping...'' AS Info;',
  'ALTER TABLE machine ADD COLUMN fargateTaskDefinition VARCHAR(255) NULL COMMENT ''ECS Task Definition ARN for this machine (Phase 2: one task def per machine)'';'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verify column was created
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'machine' 
    AND COLUMN_NAME = 'fargateTaskDefinition';
