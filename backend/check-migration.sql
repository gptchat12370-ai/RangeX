-- Check if network topology tables exist
SHOW TABLES LIKE 'session_%';

-- Check machine table for network columns
SHOW COLUMNS FROM machine LIKE '%network%';

-- Check if network_group column exists
SELECT COUNT(*) as network_group_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rangex' 
  AND TABLE_NAME = 'machine' 
  AND COLUMN_NAME = 'network_group';
