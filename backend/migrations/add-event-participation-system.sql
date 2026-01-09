-- Add event-specific scoring tables
-- Migration: add-event-participation-system.sql

-- Table for tracking event participation (players or teams)
CREATE TABLE IF NOT EXISTS event_participation (
  id VARCHAR(36) PRIMARY KEY,
  eventId VARCHAR(36) NOT NULL,
  userId VARCHAR(36) NULL,
  teamId VARCHAR(36) NULL,
  participantType ENUM('player', 'team') NOT NULL,
  totalPoints INT DEFAULT 0,
  challengesCompleted INT DEFAULT 0,
  `rank` INT NULL,
  registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_event_participation_event (eventId),
  INDEX idx_event_participation_user (userId),
  INDEX idx_event_participation_team (teamId),
  INDEX idx_event_participation_points (eventId, totalPoints DESC)
);

-- Table for event-specific sessions (separate from normal sessions)
CREATE TABLE IF NOT EXISTS event_sessions (
  id VARCHAR(36) PRIMARY KEY,
  eventId VARCHAR(36) NOT NULL,
  participationId VARCHAR(36) NOT NULL,
  scenarioVersionId VARCHAR(36) NOT NULL,
  mode ENUM('solo', 'team') NOT NULL,
  status ENUM('InProgress', 'Completed', 'Failed') DEFAULT 'InProgress',
  score INT DEFAULT 0,
  progressPct INT DEFAULT 0,
  startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  finishedAt DATETIME NULL,
  answers JSON NULL,
  FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (participationId) REFERENCES event_participation(id) ON DELETE CASCADE,
  FOREIGN KEY (scenarioVersionId) REFERENCES scenario_versions(id) ON DELETE CASCADE,
  INDEX idx_event_sessions_event (eventId),
  INDEX idx_event_sessions_participation (participationId),
  INDEX idx_event_sessions_scenario (scenarioVersionId)
);

-- Add eventPoints column to teams table for tracking points earned from events only (ignore error if exists)
-- Check if column exists first
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'rangex'
    AND TABLE_NAME = 'teams'
    AND COLUMN_NAME = 'eventPoints'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE teams ADD COLUMN eventPoints INT DEFAULT 0'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
