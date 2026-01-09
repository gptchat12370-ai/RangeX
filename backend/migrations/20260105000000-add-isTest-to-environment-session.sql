-- Add isTest field to EnvironmentSession for admin testing
ALTER TABLE environment_session 
ADD COLUMN isTest TINYINT(1) NOT NULL DEFAULT 0
AFTER pausedRemainingSeconds;

-- Create index for faster queries on test sessions
CREATE INDEX idx_environment_session_isTest_status 
ON environment_session(isTest, status);
