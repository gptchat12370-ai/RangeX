# Environment Variables

## Security Configuration

### Session Security

**STRICT_IP_VALIDATION**
- Type: `boolean`
- Default: `false`
- Description: Enable strict IP address validation for session security. When `true`, localhost connections (127.0.0.1, ::1) will be checked for IP changes. When `false`, localhost bypasses IP validation (recommended for development).
- Production Recommendation: `true` for production deployments
- Development: `false` for local testing

**ALLOW_VPN_IP_CHANGE**
- Type: `boolean`
- Default: `true`
- Description: Allow IP address changes for VPN users. When `true`, IP changes are logged but sessions remain valid if User-Agent matches. When `false`, any IP change terminates the session.
- Production Recommendation: `true` if users connect via VPNs, `false` for maximum security
- Note: User-Agent is ALWAYS validated regardless of this setting

### Session Timeouts

**IDLE_TIMEOUT_PRACTICE**
- Type: `number` (minutes)
- Default: `30`
- Description: Idle timeout for practice/normal sessions. Sessions with no activity for this duration will be automatically terminated.
- OWASP Recommendation: 15-30 minutes for low-risk applications
- Range: 15-60 minutes

**IDLE_TIMEOUT_EVENT**
- Type: `number` (minutes)
- Default: `15`
- Description: Idle timeout for event sessions. Event sessions are considered high-value and use stricter timeout.
- OWASP Recommendation: 2-15 minutes for high-value applications
- Range: 5-30 minutes

## Example Configuration

### Development (.env.local)
```env
# Development settings (relaxed security for local testing)
STRICT_IP_VALIDATION=false
ALLOW_VPN_IP_CHANGE=true
IDLE_TIMEOUT_PRACTICE=30
IDLE_TIMEOUT_EVENT=15
```

### Production (.env.production)
```env
# Production settings (OWASP-compliant security)
STRICT_IP_VALIDATION=true
ALLOW_VPN_IP_CHANGE=true
IDLE_TIMEOUT_PRACTICE=30
IDLE_TIMEOUT_EVENT=15
```

### High-Security Production
```env
# Maximum security configuration
STRICT_IP_VALIDATION=true
ALLOW_VPN_IP_CHANGE=false
IDLE_TIMEOUT_PRACTICE=20
IDLE_TIMEOUT_EVENT=10
```

## Security Features

### Session Binding
- **IP Address Validation**: Sessions are bound to the client IP address
- **User-Agent Validation**: Sessions are bound to the client browser/app signature
- **Localhost Bypass**: Development mode allows IP changes on localhost
- **VPN Support**: Configurable tolerance for IP changes with User-Agent validation

### Auto-Termination
- **Event Cleanup**: Sessions are automatically terminated when events end
- **Idle Timeout**: Different timeouts for practice (30min) and event (15min) sessions
- **Cron Jobs**: Background tasks run every minute (timeout) and every 5 minutes (event cleanup)

### Token Security
- **Token Rotation**: Capability to rotate session tokens for sensitive operations
- **Token Entropy**: 48-character hexadecimal tokens (192 bits of entropy)
- **Activity Tracking**: `lastActivityAt` timestamp updated on every action

## Monitoring

All security events are logged:
- IP address changes (INFO level)
- User-Agent mismatches (WARN level)
- Session hijacking attempts (ERROR level)
- Auto-terminations (WARN level)

Check application logs for security monitoring:
```bash
# View security logs
grep "Session security" backend/logs/application.log
grep "IP changed" backend/logs/application.log
grep "Session hijacking" backend/logs/application.log
```
