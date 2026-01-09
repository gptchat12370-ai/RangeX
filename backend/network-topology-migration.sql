-- Network Topology Migration
-- Note: network_group column already exists in machine table, skipping

-- Add fargate_task_definition column to machine (for single-container task ARNs)
-- Check first if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'machine';
SET @columnname = 'fargate_task_definition';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) NULL COMMENT ''ARN of per-machine single-container task definition''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add network_topology to scenario_version
SET @tablename = 'scenario_version';
SET @columnname = 'network_topology';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON NULL COMMENT ''Network isolation configuration: groups, pivot rules, isolation mode''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Create session_network_topology table
CREATE TABLE IF NOT EXISTS session_network_topology (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    machine_name VARCHAR(100) NOT NULL,
    machine_role VARCHAR(50) NULL,
    network_group VARCHAR(50) NULL,
    task_arn VARCHAR(255) NOT NULL,
    private_ip VARCHAR(15) NOT NULL,
    subnet_id VARCHAR(50) NOT NULL,
    security_group_id VARCHAR(50) NOT NULL,
    network_interface_id VARCHAR(50) NULL,
    status ENUM('provisioning', 'running', 'stopped', 'terminated') DEFAULT 'provisioning',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES environment_session(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_private_ip (private_ip),
    INDEX idx_task_arn (task_arn),
    INDEX idx_security_group_id (security_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create session_security_groups table (track SGs for cleanup)
CREATE TABLE IF NOT EXISTS session_security_groups (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    network_group VARCHAR(50) NOT NULL,
    security_group_id VARCHAR(50) NOT NULL UNIQUE,
    security_group_name VARCHAR(255) NOT NULL,
    status ENUM('creating', 'active', 'deleting', 'deleted') DEFAULT 'creating',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (session_id) REFERENCES environment_session(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_status (status),
    INDEX idx_security_group_id (security_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create network_pivot_points table (for pivot point rules)
CREATE TABLE IF NOT EXISTS network_pivot_points (
    id VARCHAR(36) PRIMARY KEY,
    scenario_version_id VARCHAR(36) NOT NULL,
    source_network_group VARCHAR(50) NOT NULL,
    target_network_group VARCHAR(50) NOT NULL,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_version_id) REFERENCES scenario_version(id) ON DELETE CASCADE,
    INDEX idx_scenario_version (scenario_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert migration record
INSERT IGNORE INTO migrations (timestamp, name) VALUES (1735843200000, 'AddNetworkTopologyTables1735843200000');
