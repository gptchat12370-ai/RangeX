-- Add learning outcomes field to scenario_version table
ALTER TABLE scenario_version ADD COLUMN learningOutcomes TEXT NULL AFTER codeOfEthics;

-- Create user_favorites table for favorite scenarios
CREATE TABLE IF NOT EXISTS user_favorites (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  scenarioId VARCHAR(36) NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_scenario (userId, scenarioId),
  INDEX idx_user_favorites_userId (userId),
  INDEX idx_user_favorites_scenarioId (scenarioId)
);

-- Create scenario_ratings table for user ratings
CREATE TABLE IF NOT EXISTS scenario_ratings (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  scenarioId VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_scenario_rating (userId, scenarioId),
  INDEX idx_scenario_ratings_userId (userId),
  INDEX idx_scenario_ratings_scenarioId (scenarioId)
);

-- Add rating statistics to scenario table
ALTER TABLE scenario ADD COLUMN averageRating DECIMAL(3,2) DEFAULT 0.00 AFTER slug;
ALTER TABLE scenario ADD COLUMN totalRatings INT DEFAULT 0 AFTER averageRating;
