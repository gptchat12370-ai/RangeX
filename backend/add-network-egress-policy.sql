-- Add networkEgressPolicy column to machine table
USE rangex;

-- Check if column doesn't exist and add it
SET @dbname = DATABASE();
SET @tablename = 'machine';
SET @columnname = 'networkEgressPolicy';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) NOT NULL DEFAULT ''none'' COMMENT ''Outbound internet access policy: none, session-only, internet''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
