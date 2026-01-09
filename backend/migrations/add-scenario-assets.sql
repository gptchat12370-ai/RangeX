-- Add columns to scenario_version table
ALTER TABLE scenario_version 
ADD COLUMN coverImageUrl VARCHAR(500) NULL AFTER solutionWriteup,
ADD COLUMN tags JSON NULL AFTER coverImageUrl;

-- Add columns to docker_image table (if exists)
ALTER TABLE docker_image 
ADD COLUMN ecrUrl VARCHAR(500) NULL,
ADD COLUMN isCustom BOOLEAN DEFAULT FALSE,
ADD COLUMN creatorId VARCHAR(36) NULL;

-- Add columns to question table  
ALTER TABLE question 
ADD COLUMN caseSensitive BOOLEAN DEFAULT FALSE,
ADD COLUMN acceptableAnswers JSON NULL;

-- Create scenario_asset table
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
