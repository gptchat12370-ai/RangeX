-- Add archivedAt column to scenario_version table
-- This allows tracking when a version was archived

ALTER TABLE scenario_version 
ADD COLUMN archivedAt DATETIME NULL
AFTER isArchived;

-- Update existing archived versions to have a timestamp
UPDATE scenario_version 
SET archivedAt = NOW() 
WHERE isArchived = true AND archivedAt IS NULL;
