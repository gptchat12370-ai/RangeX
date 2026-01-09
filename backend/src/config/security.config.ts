/**
 * Security Configuration for RangeX Phase 2-3
 * 
 * Enforces strict security policies:
 * - CORS allowlist (no wildcard with credentials)
 * - Upload validation (file size, type, zip-slip prevention)
 * - Compose escape hatch blocking (docker.sock, privileged mode)
 */

export const SECURITY_CONFIG = {
  /**
   * CORS Configuration
   * NO WILDCARD (*) when credentials are enabled
   */
  CORS: {
    ALLOWED_ORIGINS: [
      'http://localhost:5173',           // Vite dev server
      'http://localhost:3000',           // Alternative dev port
      'https://rangex.cyp.edu.my',       // Production domain
      'https://www.rangex.cyp.edu.my',   // Production www
    ],
    DEV_ALLOWED_PORTS: new Set([5173, 3000, 4173]), // Dev server ports
    CREDENTIALS: true,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Requested-With', 'Accept', 'X-CSRF-Token'],
    MAX_AGE: 86400, // 24 hours
  },

  /**
   * File Upload Limits
   */
  UPLOADS: {
    MAX_FILE_SIZE: 100 * 1024 * 1024,    // 100 MB per file
    MAX_TOTAL_SIZE: 500 * 1024 * 1024,   // 500 MB total per scenario
    ALLOWED_MIME_TYPES: [
      // Archives
      'application/zip',
      'application/x-zip-compressed',
      'application/gzip',
      'application/x-gzip',
      'application/x-tar',
      
      // Text files
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'text/markdown',
      
      // Scripts (browsers often send as octet-stream)
      'application/x-sh',
      'application/x-python',
      'text/x-python',
      'application/x-sql',
      'text/x-sql',
      'application/octet-stream', // Generic binary (validated by extension)
      
      // Images
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/svg+xml',
      
      // Documents
      'application/pdf',
    ],
    ALLOWED_EXTENSIONS: [
      '.zip', '.tar', '.gz', '.tgz',
      '.txt', '.md', '.html', '.css', '.js', '.json',
      '.png', '.jpg', '.jpeg', '.gif', '.svg',
      '.pdf', '.sh', '.py', '.sql',
    ],
    FORBIDDEN_FILENAMES: [
      '..',           // Directory traversal
      '.env',         // Environment files
      '.git',         // Git metadata
      'id_rsa',       // SSH keys
      'id_dsa',       // SSH keys
      '.npmrc',       // NPM credentials
      '.aws',         // AWS credentials
    ],
  },

  /**
   * Docker Compose Security
   * Blocks dangerous escape hatches
   */
  COMPOSE: {
    // Forbidden volume mounts (container escape)
    FORBIDDEN_VOLUMES: [
      '/var/run/docker.sock',
      '/var/run/docker.sock:',
      'docker.sock',
      '/proc',
      '/sys',
      '/dev',
      '/host',
    ],

    // Allowed Linux capabilities (security-critical only)
    ALLOWED_CAPABILITIES: [
      'NET_ADMIN',      // Network administration
      'NET_RAW',        // Raw sockets (for packet crafting labs)
      'SYS_PTRACE',     // Process tracing (for debugging labs)
    ],

    // Allowed sysctls (network tuning only)
    ALLOWED_SYSCTLS: [
      'net.ipv4.ip_forward',
      'net.ipv4.conf.all.route_localnet',
      'net.ipv6.conf.all.disable_ipv6',
      'net.ipv6.conf.default.disable_ipv6',
    ],

    // Security flags
    ALLOW_PRIVILEGED: false,          // Never allow privileged containers
    ALLOW_HOST_NETWORK: false,        // No host network mode
    ALLOW_HOST_PID: false,            // No host PID namespace
    ALLOW_HOST_IPC: false,            // No host IPC namespace
  },

  /**
   * Rate Limiting
   */
  RATE_LIMITS: {
    GLOBAL: {
      TTL: 60,         // 1 minute
      LIMIT: 100,      // 100 requests per minute
    },
    AUTH: {
      TTL: 900,        // 15 minutes
      LIMIT: 5,        // 5 login attempts per 15 min
    },
    UPLOADS: {
      TTL: 3600,       // 1 hour
      LIMIT: 20,       // 20 uploads per hour
    },
    COMPOSE_SYNC: {
      TTL: 60,         // 1 minute
      LIMIT: 10,       // 10 sync operations per minute
    },
  },

  /**
   * Session Security
   */
  SESSIONS: {
    MAX_CONCURRENT_SESSIONS: 3,        // Per user
    SESSION_TIMEOUT_MINUTES: 240,      // 4 hours
    IDLE_TIMEOUT_MINUTES: 30,          // 30 minutes idle
  },
};

/**
 * Helper: Check if hostname is IPv4
 */
function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Helper: Check if IPv4 is private (RFC1918)
 */
function isPrivateIpv4(host: string): boolean {
  if (!isIpv4(host)) return false;
  const [a, b] = host.split('.').map(n => parseInt(n, 10));

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

/**
 * Helper: Check if hostname is localhost
 */
function isLocalhost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * Validate CORS origin against allowlist
 * DEV: allows LAN/private IPs on dev ports
 * PROD: strict allowlist only
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  // Non-browser / server-to-server requests often have no Origin
  if (!origin) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // Invalid URL format
  }

  const host = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

  // Always allow explicit production origins
  if ((SECURITY_CONFIG.CORS.ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
    return true;
  }

  // Only allow private/LAN origins in development (explicit APP_ENV check)
  // Treat staging as production for security
  const appEnv = process.env.APP_ENV || 'production'; // Default to production for safety
  if (appEnv === 'development') {
    if ((isLocalhost(host) || isPrivateIpv4(host)) && SECURITY_CONFIG.CORS.DEV_ALLOWED_PORTS.has(port)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if file extension is allowed
 */
export function isAllowedFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return false;
  return (SECURITY_CONFIG.UPLOADS.ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Check if filename is forbidden (security risk)
 */
export function isForbiddenFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SECURITY_CONFIG.UPLOADS.FORBIDDEN_FILENAMES.some(forbidden =>
    lower.includes(forbidden)
  );
}

/**
 * Validate file upload
 */
export function validateUpload(
  filename: string,
  mimetype: string,
  size: number
): { valid: boolean; error?: string } {
  // Check file size
  if (size > SECURITY_CONFIG.UPLOADS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: ${SECURITY_CONFIG.UPLOADS.MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check forbidden filenames
  if (isForbiddenFilename(filename)) {
    return {
      valid: false,
      error: 'Forbidden filename detected',
    };
  }

  // Check extension
  if (!isAllowedFileExtension(filename)) {
    return {
      valid: false,
      error: 'File type not allowed',
    };
  }

  // Check MIME type (allow octet-stream only if extension is safe)
  if (!(SECURITY_CONFIG.UPLOADS.ALLOWED_MIME_TYPES as readonly string[]).includes(mimetype)) {
    // Special case: browsers often send octet-stream for .sh/.py/.sql
    if (mimetype === 'application/octet-stream') {
      const scriptExtensions = ['.sh', '.py', '.sql'];
      const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
      if (!ext || !scriptExtensions.includes(ext)) {
        return {
          valid: false,
          error: 'MIME type not allowed (octet-stream requires script extension)',
        };
      }
    } else {
      return {
        valid: false,
        error: 'MIME type not allowed',
      };
    }
  }

  return { valid: true };
}

/**
 * Check if volume mount is forbidden (container escape risk)
 */
export function isForbiddenVolume(volumeSpec: string): boolean {
  const lower = volumeSpec.toLowerCase();
  return SECURITY_CONFIG.COMPOSE.FORBIDDEN_VOLUMES.some(forbidden =>
    lower.includes(forbidden)
  );
}

/**
 * Check if capability is allowed
 */
export function isAllowedCapability(cap: string): boolean {
  const upper = cap.toUpperCase();
  return SECURITY_CONFIG.COMPOSE.ALLOWED_CAPABILITIES.includes(upper as any);
}

/**
 * Check if sysctl is allowed
 */
export function isAllowedSysctl(key: string): boolean {
  return (SECURITY_CONFIG.COMPOSE.ALLOWED_SYSCTLS as readonly string[]).includes(key);
}
