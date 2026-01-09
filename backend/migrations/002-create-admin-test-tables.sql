-- Phase 1: Create admin cloud test tracking tables
-- Admin-only AWS validation before publishing to solvers

USE `rangex`;

-- Admin test runs for scenario versions
CREATE TABLE IF NOT EXISTS `scenario_version_admin_test` (
  `id` VARCHAR(36) PRIMARY KEY,
  `scenarioVersionId` VARCHAR(36) NOT NULL,
  `status` ENUM('pending', 'running', 'pass', 'fail', 'error') NOT NULL DEFAULT 'pending',
  `mode` ENUM('cloud_aws', 'local_docker') NOT NULL DEFAULT 'cloud_aws',
  `startedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finishedAt` DATETIME NULL,
  `duration` INT NULL COMMENT 'Duration in seconds',
  
  -- Test results
  `reportJson` JSON NULL COMMENT 'Full test report with per-machine/entrypoint results',
  `summary` TEXT NULL COMMENT 'Human-readable summary',
  `errorMessage` TEXT NULL,
  
  -- AWS session info (if cloud test)
  `testSessionId` VARCHAR(36) NULL COMMENT 'Environment session ID used for testing',
  `gatewayIp` VARCHAR(45) NULL,
  
  -- Admin tracking
  `createdByAdminId` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`scenarioVersionId`) REFERENCES `scenario_version`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`createdByAdminId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
  INDEX `idx_version_status` (`scenarioVersionId`, `status`),
  INDEX `idx_created_at` (`createdAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Test validation checks (detailed per-machine/entrypoint results)
CREATE TABLE IF NOT EXISTS `admin_test_validation` (
  `id` VARCHAR(36) PRIMARY KEY,
  `adminTestId` VARCHAR(36) NOT NULL,
  `machineId` VARCHAR(36) NULL COMMENT 'Machine template ID being tested',
  `machineName` VARCHAR(255) NULL,
  `checkType` ENUM('task_running', 'private_ip', 'entrypoint_reachable', 'segmentation', 'credentials') NOT NULL,
  `checkTarget` VARCHAR(255) NULL COMMENT 'Entrypoint being tested or segmentation rule',
  `status` ENUM('pass', 'fail', 'skip') NOT NULL,
  `message` TEXT NULL,
  `details` JSON NULL,
  `checkedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`adminTestId`) REFERENCES `scenario_version_admin_test`(`id`) ON DELETE CASCADE,
  INDEX `idx_test_machine` (`adminTestId`, `machineId`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add publishing gate field to scenario_version
ALTER TABLE `scenario_version`
  ADD COLUMN `lastAdminTestStatus` ENUM('none', 'pending', 'pass', 'fail') NULL DEFAULT 'none' COMMENT 'Latest admin cloud test result',
  ADD COLUMN `lastAdminTestId` VARCHAR(36) NULL COMMENT 'Reference to latest test',
  ADD COLUMN `publishingBlocked` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Blocked until admin test passes';

-- Add foreign key
ALTER TABLE `scenario_version`
  ADD CONSTRAINT `fk_last_admin_test` 
  FOREIGN KEY (`lastAdminTestId`) REFERENCES `scenario_version_admin_test`(`id`) ON DELETE SET NULL;

-- Verify tables created
SHOW TABLES LIKE '%admin_test%';
