# Admin System Testing Guide

## Overview
This document provides comprehensive testing procedures for the newly implemented admin system, including session limit enforcement, cost monitoring, and container management.

## Test Environment Setup

### Prerequisites
1. Start all services: `docker compose up -d` (from `local/` directory)
2. Verify database migration: Check `system_settings` table exists
3. Login as admin user (role: 'admin')
4. Access admin console at `/admin`

## Feature Testing

### 1. Session Limit Enforcement (Backend)

**Purpose**: Verify session limits are enforced BEFORE container spawning

**Test Cases**:

#### TC1.1: Maintenance Mode Enforcement
```bash
# Setup
1. Navigate to /admin/system-settings
2. Go to "Access Control" tab
3. Enable "Maintenance Mode"
4. Set message: "System under maintenance"
5. Click "Save Settings"

# Test
1. Logout and login as regular user
2. Try to start any scenario
3. Expected: Error message "System is under maintenance"
4. Verify: No container is spawned in Docker
5. Verify: No new session in database

# Cleanup
1. Login as admin
2. Disable maintenance mode
```

#### TC1.2: Session Rate Limits (3/hour, 10/day)
```bash
# Setup
1. Ensure maintenance mode is OFF
2. Note current time and user

# Test - Hourly Limit
1. Start scenario 1 → Success
2. Wait 1 minute, start scenario 2 → Success
3. Wait 1 minute, start scenario 3 → Success
4. Immediately try scenario 4 → Expected: "Session limit exceeded: 3 per hour"
5. Verify: No container spawned for attempt 4

# Test - Daily Limit
1. Wait 1 hour (or adjust systemSettings.maxSessionsPerDay to 5 for faster testing)
2. Start 7 more sessions (total 10 for day)
3. Try 11th session → Expected: "Session limit exceeded: 10 per day"

# Verify in Database
SELECT COUNT(*) FROM environment_sessions 
WHERE userId = <test_user_id> 
  AND createdAt >= CURDATE();
-- Should be exactly 10
```

#### TC1.3: Concurrent Session Limit
```bash
# Setup
1. Login as regular user
2. Start scenario 1 → Success (session 1 running)
3. Start scenario 2 → Success (session 2 running)

# Test
4. Try to start scenario 3 → Expected: "Maximum concurrent sessions reached (2)"
5. Verify: Only 2 containers in Docker
6. Stop one session
7. Try scenario 3 again → Success

# Verify in Database
SELECT COUNT(*) FROM environment_sessions 
WHERE userId = <test_user_id> 
  AND status IN ('starting', 'running');
-- Should never exceed 2
```

#### TC1.4: Total Container Limit
```bash
# Setup
1. Login as admin
2. Navigate to /admin/system-settings → "Containers" tab
3. Set "Max Total Containers" = 5
4. Save settings

# Test
1. Have 3 users each start 2 sessions (total 6 attempts)
2. First 5 should succeed
3. 6th attempt → Expected: "System container capacity reached"
4. Verify: Exactly 5 containers running in Docker

# Verify
docker ps --filter "label=rangex-session" | wc -l
# Should be 5 (plus 1 for header = 6 lines)
```

#### TC1.5: Scenario Access Limit
```bash
# Setup
1. Navigate to /admin/system-settings → "Containers" tab
2. Set "Allow All Scenarios" = OFF
3. Set "Max Accessible Scenarios" = 1
4. Save settings

# Test
1. Login as new user
2. Start "Scenario A" → Success
3. Stop "Scenario A"
4. Try to start "Scenario B" → Expected: "Scenario access limit exceeded (max: 1)"
5. Try "Scenario A" again → Success (already accessed)

# Verify in Database
SELECT DISTINCT scenarioId FROM environment_sessions 
WHERE userId = <test_user_id>;
-- Should return only 1 scenario
```

### 2. System Settings Management

#### TC2.1: Settings Persistence
```bash
# Test
1. Navigate to /admin/system-settings
2. Update settings in each tab:
   - Access Control: Change maintenance message
   - Sessions: maxConcurrentSessions = 3
   - Containers: maxTotalContainers = 10
   - Budget: monthlyBudgetCap = 100
   - Storage: MinIO bucket name
   - AWS: Region = us-west-2
   - Monitoring: Enable request logging
3. Click "Save Settings" after each tab
4. Refresh page
5. Verify: All settings retained

# Verify in Database
SELECT * FROM system_settings ORDER BY id DESC LIMIT 1;
-- Check all columns match your inputs
```

#### TC2.2: Settings Cache
```bash
# Test
1. Update maxConcurrentSessions to 5
2. Immediately (within 5 minutes) try to start 6 concurrent sessions
3. Expected: Limit enforced with new value (5)

# This verifies the cache is invalidated on update
```

### 3. Cost Monitoring

#### TC3.1: Cost Dashboard Real-Time Data
```bash
# Test
1. Navigate to /admin/costs
2. Note current budget percentage
3. Start a new session (as any user)
4. Wait 30 seconds (auto-refresh)
5. Verify: Running sessions count increased
6. Verify: Budget percentage updated

# Check API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/costs/dashboard
# Should return:
# - monthlyBudgetCap
# - currentMonthSpend
# - budgetPercentage
# - runningSessions
# - topUsers (with cost and sessionCount)
```

#### TC3.2: Budget Alerts
```bash
# Setup
1. Set monthlyBudgetCap = $10
2. Set alertPercentage = 80 (80%)

# Test
1. Simulate cost increase (or run many sessions)
2. When spend reaches $8 (80% of $10):
   - Check /admin/costs dashboard
   - Verify: Yellow alert "Budget at 80%"
3. When spend reaches $9 (90% of $10):
   - Verify: Red alert "Critical: Budget at 90%"
4. When spend reaches $10 (100%):
   - If enableMaintenanceOnBudgetCap = true
   - Verify: Maintenance mode auto-enabled
   - Verify: No new sessions can start

# Verify in Logs
grep "Budget alert" backend/logs/*.log
# Should show alert triggers
```

### 4. Container Management

#### TC4.1: Real-Time Container Monitor
```bash
# Test
1. Navigate to /admin/containers
2. Start 3 sessions (as any user)
3. Verify: All 3 appear in container list
4. Check columns:
   - Session ID: Valid UUID
   - User: Correct username
   - Scenario: Correct name
   - Status: "running"
   - Idle Time: "< 1 min" (green)
   - Cost: "$0.XX"
5. Wait 10 seconds
6. Verify: Page auto-refreshes, idle times update

# Check API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/containers/running
# Should return array of running sessions with idleMinutes
```

#### TC4.2: Idle Time Warnings
```bash
# Test
1. Start a session
2. Leave it idle (don't interact)
3. Monitor /admin/containers page:
   - At 15 minutes: Idle time turns YELLOW
   - At 25 minutes: Idle time turns RED
   - At 30 minutes: Session auto-terminated (if idle termination enabled)

# Verify Auto-Termination
SELECT * FROM environment_sessions 
WHERE status = 'terminated' 
  AND terminatedAt IS NOT NULL
  AND terminationReason = 'idle_timeout';
```

#### TC4.3: Manual Termination
```bash
# Test
1. Start a session
2. Navigate to /admin/containers
3. Find the session in list
4. Click "Terminate" button
5. Confirm action
6. Verify: Session removed from list
7. Verify: Container stopped in Docker

# Check Docker
docker ps --filter "label=rangex-session=<session_id>"
# Should return no results

# Check Database
SELECT status FROM environment_sessions WHERE id = '<session_id>';
-- Should be 'terminated'
```

### 5. Navigation & UI

#### TC5.1: Admin Dashboard Navigation Cards
```bash
# Test
1. Navigate to /admin
2. Verify 3 large cards at top:
   - System Settings (blue gear icon)
   - Cost Dashboard (green dollar icon)
   - Container Monitor (purple container icon)
3. Hover over each card → Verify background color changes
4. Click "System Settings" → Navigate to /admin/system-settings
5. Click back, click "Cost Dashboard" → Navigate to /admin/costs
6. Click back, click "Container Monitor" → Navigate to /admin/containers

# All navigation should be instant (lazy-loaded chunks)
```

#### TC5.2: Admin Console Tabs
```bash
# Test
1. Navigate to /admin
2. Verify existing tabs still work:
   - Dashboard (default)
   - Users
   - Scenarios
   - Approvals
   - Playlists
   - Career Paths
   - Teams
   - Assets
   - Events
   - Settings
3. Each tab should load correctly
```

### 6. Error Handling

#### TC6.1: Invalid Settings
```bash
# Test
1. Navigate to /admin/system-settings
2. Try to set maxConcurrentSessions = -1
3. Expected: Validation error
4. Try to set monthlyBudgetCap = "invalid"
5. Expected: Validation error
6. Set very large number (maxTotalContainers = 99999)
7. Expected: Warning or reasonable cap applied
```

#### TC6.2: API Error Handling
```bash
# Test
1. Stop backend server
2. Try to save settings in admin UI
3. Expected: Error toast "Failed to save settings"
4. Restart backend
5. Retry save → Success

# Test with expired token
1. Login, wait 15 minutes (token expiry)
2. Try to access /admin/costs
3. Expected: Redirect to login page
```

### 7. Integration Testing

#### TC7.1: Full User Flow
```bash
# Scenario: New user accessing platform with limits

1. Admin Setup:
   - Set maxConcurrentSessions = 2
   - Set maxSessionsPerHour = 3
   - Set maxAccessibleScenarios = 1
   - Set allowAllScenarios = false
   - Set monthlyBudgetCap = $50

2. User Registration:
   - Register new account → Success
   - Admin approves user

3. User Session 1:
   - Start "Web Security 101" → Success
   - Verify: Container spawned
   - Verify: Cost tracking starts

4. User Session 2:
   - Start "Network Security" → Success
   - Verify: 2 containers running

5. User Session 3 (should fail):
   - Try "SQL Injection Lab" → Error: "Maximum concurrent sessions reached"

6. User Stops Session 1:
   - Stop "Web Security 101"
   - Cost calculated and saved

7. User Session 3 (retry):
   - Try "SQL Injection Lab" → Error: "Scenario access limit exceeded"
   - Can only access scenarios: ["Web Security 101", "Network Security"]

8. Admin Monitoring:
   - Check /admin/containers → See 1 running session (Network Security)
   - Check /admin/costs → See user's total spend
   - Check top users → User appears in list

9. Budget Cap Hit:
   - Platform reaches $50 (100% of cap)
   - Maintenance mode auto-enabled (if configured)
   - User tries new session → Error: "System under maintenance"

10. Admin Intervention:
    - Admin increases budget cap to $100
    - Disables maintenance mode
    - User can start sessions again
```

## Database Validation Queries

```sql
-- Check system settings
SELECT * FROM system_settings ORDER BY updatedAt DESC LIMIT 1;

-- Count sessions per user today
SELECT userId, COUNT(*) as session_count, 
       SUM(estimatedCost) as total_cost
FROM environment_sessions 
WHERE DATE(createdAt) = CURDATE()
GROUP BY userId
ORDER BY total_cost DESC;

-- Find idle sessions
SELECT id, userId, scenarioId, 
       TIMESTAMPDIFF(MINUTE, lastActivityAt, NOW()) as idle_minutes
FROM environment_sessions 
WHERE status = 'running'
  AND TIMESTAMPDIFF(MINUTE, lastActivityAt, NOW()) >= 15
ORDER BY idle_minutes DESC;

-- Check session rate limits (last hour)
SELECT userId, COUNT(*) as sessions_last_hour
FROM environment_sessions 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY userId
HAVING sessions_last_hour >= 3;

-- Audit session terminations
SELECT id, userId, status, terminationReason, terminatedAt
FROM environment_sessions 
WHERE terminatedAt IS NOT NULL
  AND DATE(terminatedAt) = CURDATE()
ORDER BY terminatedAt DESC;
```

## Performance Validation

### Backend Performance
```bash
# Check EnvironmentService checks don't slow down requests
# Acceptable: < 500ms for startEnvironment()

# Test
time curl -X POST http://localhost:3000/environments/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId": "...", "resourceProfile": "small"}'

# Expected: < 500ms total
# Session checks should use cached settings (5min cache)
```

### Frontend Performance
```bash
# Check admin pages load quickly
# Acceptable: < 2s for initial load

# Test
1. Open DevTools Network tab
2. Navigate to /admin/system-settings
3. Check "DOMContentLoaded" time
4. Expected: < 2 seconds

# Admin pages are lazy-loaded chunks:
# - AdminSystemSettings: 19.76 kB gzipped
# - AdminCostDashboard: 7.31 kB gzipped
# - AdminContainers: 7.70 kB gzipped
```

## Security Validation

### Access Control
```bash
# Test: Non-admin cannot access admin endpoints

1. Login as regular user (role: 'solver' or 'creator')
2. Try: GET http://localhost:3000/admin/system-settings
   Expected: 403 Forbidden
3. Try: PUT http://localhost:3000/admin/system-settings
   Expected: 403 Forbidden
4. Try: POST http://localhost:3000/admin/containers/:id/terminate
   Expected: 403 Forbidden

# Verify in code: @UseGuards(AuthGuard, RoleGuard)
# RoleGuard checks req.user.role === 'admin'
```

### Input Validation
```bash
# Test: Malicious inputs are rejected

# SQL Injection Attempt
curl -X PUT http://localhost:3000/admin/system-settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"maintenanceMessage": "'; DROP TABLE users; --"}'
# Expected: Input sanitized, no SQL execution

# XSS Attempt
# Set maintenanceMessage = "<script>alert('XSS')</script>"
# Expected: HTML escaped, script not executed in UI

# Integer Overflow
# Set maxTotalContainers = 2147483648
# Expected: Validation error or capped to reasonable max
```

## Monitoring & Logging

### Check Logs
```bash
# Session limit violations
grep "Session limit exceeded" backend/logs/*.log

# Maintenance mode activations
grep "Maintenance mode" backend/logs/*.log

# Budget alerts
grep "Budget alert" backend/logs/*.log

# Container terminations
grep "Container terminated" backend/logs/*.log

# Settings updates
grep "System settings updated" backend/logs/*.log
```

### Prometheus Metrics
```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Expected metrics:
# - http_requests_total{path="/environments/start"}
# - active_sessions_total
# - session_limit_violations_total (if implemented)
# - budget_percentage
```

## Test Completion Checklist

- [ ] All session limit checks work (maintenance, rate limits, concurrent, total, scenario)
- [ ] System settings persist and apply correctly
- [ ] Cost dashboard shows real-time data
- [ ] Budget alerts trigger at correct thresholds
- [ ] Container monitor displays running sessions with idle times
- [ ] Manual termination works
- [ ] Navigation cards work from admin dashboard
- [ ] All admin pages load correctly
- [ ] Non-admin users blocked from admin endpoints
- [ ] Input validation prevents malicious data
- [ ] Error handling graceful
- [ ] Logs capture important events
- [ ] Database queries confirm expected behavior
- [ ] Performance within acceptable limits

## Known Issues & Limitations

1. **Snyk Code Scanning**: Requires activation in organization (not enabled for current org)
2. **Cache Timing**: SystemSettings cache is 5 minutes - changes may take up to 5 min to apply (by design for performance)
3. **Idle Termination**: Requires active CostMonitorService interval running (check interval is 5 minutes)
4. **Budget Cap Maintenance**: Auto-maintenance on budget cap requires enableMaintenanceOnBudgetCap=true

## Next Steps

After testing completes:
1. Add usage reports feature (daily/weekly/monthly analytics)
2. Add cost forecasting feature (burn rate, projected costs)
3. Document admin system in main README
4. Consider adding session limit metrics to Prometheus
5. Add email notifications for budget alerts (using admin_emails setting)
