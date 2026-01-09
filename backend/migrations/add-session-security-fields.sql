-- Migration: Add Session Security and Management Fields
-- Date: 2025-12-18
-- Purpose: Implement OWASP session management requirements

-- Add session binding fields (prevent session hijacking)
ALTER TABLE environment_session 
ADD COLUMN clientIp VARCHAR(45) COMMENT 'Client IP address for session binding',
ADD COLUMN clientUserAgent VARCHAR(512) COMMENT 'Client User-Agent for session binding',
ADD COLUMN lastActivityAt TIMESTAMP NULL COMMENT 'Last heartbeat/activity timestamp for idle timeout',
ADD COLUMN pausedRemainingSeconds INT NULL COMMENT 'Frozen timer when session is paused',
ADD COLUMN version INT NOT NULL DEFAULT 0 COMMENT 'Optimistic locking version';

-- Add index for timeout queries (performance optimization)
CREATE INDEX idx_session_timeout ON environment_session(status, lastActivityAt);
CREATE INDEX idx_session_expires ON environment_session(status, expiresAt);

-- Update existing sessions with default values
UPDATE environment_session 
SET lastActivityAt = COALESCE(updatedAt, startedAt, createdAt),
    version = 0
WHERE lastActivityAt IS NULL;

-- Add comment to existing status column for documentation
ALTER TABLE environment_session 
MODIFY COLUMN status VARCHAR(24) NOT NULL 
COMMENT 'Session state: created|starting|running|paused|stopping|terminated|error';

-- Verify migration
SELECT 
    COUNT(*) as total_sessions,
    COUNT(clientIp) as with_ip,
    COUNT(clientUserAgent) as with_user_agent,
    COUNT(lastActivityAt) as with_activity
FROM environment_session;
