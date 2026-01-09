-- Database Indexes for Session Security and Performance Optimization
-- Run this script to create indexes for timeout queries and event cleanup

-- Index for session timeout queries (idle session detection)
-- Used by SessionTimeoutService.checkIdleSessions()
CREATE INDEX idx_session_timeout 
ON environment_session(status, lastActivityAt);

-- Index for event cleanup queries (find ended events)
-- Used by EventCleanupService.terminateExpiredEventSessions()
CREATE INDEX idx_event_end_date 
ON event(endDate);

-- Index for event session cleanup (status updates)
-- Used by EventCleanupService.terminateEventSessions()
CREATE INDEX idx_event_session_cleanup 
ON event_sessions(eventId, status);

-- Index for environment session by event and status
-- Used by EventParticipationService.unregister() and EventCleanupService
CREATE INDEX idx_env_session_event_status 
ON environment_session(eventId, status);

-- Index for environment session by user and event (for unregister)
CREATE INDEX idx_env_session_user_event 
ON environment_session(userId, eventId, status);

-- Index for environment session by team and event (for team unregister)
CREATE INDEX idx_env_session_team_event 
ON environment_session(teamId, eventId, status);

-- Index for session security metadata lookups
-- Used by SessionSecurityService.validateSessionSecurity()
CREATE INDEX idx_session_security 
ON environment_session(id, clientIp, clientUserAgent);

-- Index for event participation queries
CREATE INDEX idx_event_participation_user 
ON event_participation(eventId, userId);

CREATE INDEX idx_event_participation_team 
ON event_participation(eventId, teamId);

-- Index for event session by participation
CREATE INDEX idx_event_session_participation 
ON event_sessions(participationId, status);

-- Verify indexes created
SELECT 
  table_name,
  index_name,
  GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns
FROM information_schema.statistics 
WHERE table_schema = DATABASE() 
  AND table_name IN (
    'environment_session', 
    'event', 
    'event_sessions', 
    'event_participation'
  )
GROUP BY table_name, index_name
ORDER BY table_name, index_name;
