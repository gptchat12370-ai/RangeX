/**
 * Platform-wide limits and constraints
 * Single source of truth for validation and generation
 */

export const PLATFORM_LIMITS = {
  // Machine limits
  MAX_MACHINES_PER_SCENARIO: 4,
  MAX_EXPOSED_PORTS_PER_MACHINE: 5,

  // Allowed container ports (including Kasm GUI port 6901)
  ALLOWED_CONTAINER_PORTS: [
    22, // SSH
    80, // HTTP
    443, // HTTPS
    3000, // Common app port
    5900, // VNC
    6901, // Kasm GUI
    8080, // Alt HTTP
    8443, // Alt HTTPS
    9090, // Common monitoring port
  ],

  // Resource profiles (vCPU, Memory in MiB)
  RESOURCE_PROFILES: {
    micro: {
      cpu: 0.25,
      memory: 512,
      displayName: 'Micro (0.25 vCPU, 512 MB)',
    },
    small: {
      cpu: 0.5,
      memory: 1024,
      displayName: 'Small (0.5 vCPU, 1 GB)',
    },
    medium: {
      cpu: 1,
      memory: 2048,
      displayName: 'Medium (1 vCPU, 2 GB)',
    },
    large: {
      cpu: 2,
      memory: 4096,
      displayName: 'Large (2 vCPU, 4 GB)',
    },
  },

  // Default profiles by machine role
  DEFAULT_PROFILES: {
    internal: 'micro', // Non-entrypoint services
    service: 'micro', // Background services
    attacker: 'small', // Attacker workstation
  },

  // Maximum allowed resources (hard caps)
  MAX_RESOURCES: {
    cpu: 2,
    memory: 4096,
  },

  // Host port allocation range (for local_compose mode)
  HOST_PORT_RANGE: {
    start: 8000,
    end: 9000,
  },

  // Kasm GUI specific
  KASM_GUI_PORT: 6901,

  // Network subnet allocation
  SUBNET_BASE: '172.16.0.0', // RFC 1918 private range
  SUBNET_MASK: 12, // /12 gives 172.16.0.0 - 172.31.255.255
  SUBNET_PREFIX: 24, // Each network gets a /24

  // Pricing (Fargate in ap-south-2)
  PRICING: {
    CPU_PER_VCPU_HOUR: 0.04556, // USD
    MEMORY_PER_GB_HOUR: 0.00533, // USD
    USD_TO_RM: 4.5,
  },
} as const;

/**
 * Attacker GUI image options
 */
export const ATTACKER_GUI_IMAGES = {
  kaliDesktop: {
    image: 'lukaszlach/kali-desktop:latest',
    displayName: 'Kali Linux Desktop',
    hasGui: true,
    hasBrowser: false,
    defaultPassword: 'root',
    shmSize: '512m',
  },
  parrotDesktop: {
    image: 'kasmweb/parrotos-desktop:1.16.1-rolling-weekly',
    displayName: 'Parrot OS Desktop (with browser)',
    hasGui: true,
    hasBrowser: true,
    defaultPassword: 'password',
    shmSize: '512m',
  },
  kaliCLI: {
    image: 'kalilinux/kali-rolling:latest',
    displayName: 'Kali Linux CLI (no GUI)',
    hasGui: false,
    hasBrowser: false,
    defaultPassword: 'toor',
    shmSize: null,
  },
} as const;

/**
 * Required labels for all compose services
 */
export const REQUIRED_LABELS = [
  'rangex.scenario.name',
  'rangex.scenario.creator',
  'rangex.scenario-version',
  'rangex.role',
  'rangex.resource-profile',
] as const;

/**
 * Security hardening rules
 */
export const SECURITY_RULES = {
  DISALLOWED_CONFIGS: {
    privileged: true,
    volumeMounts: ['/var/run/docker.sock'],
  },
} as const;

/**
 * Helper to get resource profile
 */
export function getResourceProfile(
  profileName: keyof typeof PLATFORM_LIMITS.RESOURCE_PROFILES,
) {
  return PLATFORM_LIMITS.RESOURCE_PROFILES[profileName];
}

/**
 * Helper to validate container port
 */
export function isAllowedPort(port: number): boolean {
  return (PLATFORM_LIMITS.ALLOWED_CONTAINER_PORTS as readonly number[]).includes(port);
}

/**
 * Helper to get default profile for role
 */
export function getDefaultProfileForRole(
  role: 'attacker' | 'internal' | 'service',
): keyof typeof PLATFORM_LIMITS.RESOURCE_PROFILES {
  return PLATFORM_LIMITS.DEFAULT_PROFILES[role] as keyof typeof PLATFORM_LIMITS.RESOURCE_PROFILES;
}
