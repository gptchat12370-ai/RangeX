-- Migration: Add buildStatus column to scenario_version table
-- Date: 2024-12-31
-- Purpose: Track build pipeline status explicitly (RUNNING/SUCCESS/FAILED)

ALTER TABLE scenario_version 
ADD COLUMN buildStatus VARCHAR(24) NULL 
COMMENT 'Build pipeline status: RUNNING, SUCCESS, FAILED'
AFTER buildLogs;

-- Set existing scenarios with buildLogs to SUCCESS (assume successful builds)
UPDATE scenario_version 
SET buildStatus = 'SUCCESS' 
WHERE buildLogs IS NOT NULL 
  AND buildLogs NOT LIKE '%BUILD FAILED%';

-- Set existing scenarios with failed build logs to FAILED
UPDATE scenario_version 
SET buildStatus = 'FAILED' 
WHERE buildLogs LIKE '%BUILD FAILED%';
