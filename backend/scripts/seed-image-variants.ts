import { DataSource } from 'typeorm';
import { ImageVariant } from '../src/entities/image-variant.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'rangex_app',
  password: process.env.DB_PASSWORD || 'R@n53xP@ssw0rd!',
  database: process.env.DB_DATABASE || 'rangex',
  entities: [ImageVariant],
  synchronize: false,
});

const imageVariants = [
  // ============ KALI LINUX (Attacker) ============
  {
    baseOs: 'kali',
    variantType: 'lite',
    imageRef: 'kalilinux/kali-rolling:latest',
    displayName: 'Kali Linux Lite',
    description: 'Minimal Kali with essential penetration testing tools',
    cpuCores: 0.5,
    memoryMb: 512,
    diskGb: 10,
    hourlyCostRm: 0.05,
    suitableForRoles: ['attacker'],
    includedTools: ['nmap', 'netcat', 'wireshark'],
    isActive: true,
    isAdminApproved: true,
    tags: ['penetration-testing', 'lightweight'],
  },
  {
    baseOs: 'kali',
    variantType: 'standard',
    imageRef: 'kalilinux/kali-last-release:latest',
    displayName: 'Kali Linux Standard',
    description: 'Standard Kali with most common penetration testing tools',
    cpuCores: 1.0,
    memoryMb: 1024,
    diskGb: 20,
    hourlyCostRm: 0.10,
    suitableForRoles: ['attacker'],
    includedTools: ['nmap', 'sqlmap', 'metasploit', 'burpsuite', 'wireshark'],
    isActive: true,
    isAdminApproved: true,
    tags: ['penetration-testing', 'full-featured'],
  },
  {
    baseOs: 'kali',
    variantType: 'full',
    imageRef: 'kasmweb/core-kali-rolling:1.16.1-rolling-weekly',
    displayName: 'Kali Linux Desktop (Web + VNC)',
    description: 'Kali Linux with Xfce desktop, VNC on port 5900, web desktop on port 6901 (user: kasm_user, pass: password)',
    cpuCores: 1.0,
    memoryMb: 2048,
    diskGb: 20,
    hourlyCostRm: 0.20,
    suitableForRoles: ['attacker'],
    includedTools: ['nmap', 'sqlmap', 'metasploit', 'burpsuite', 'wireshark', 'xfce-desktop', 'vnc', 'web-gui'],
    isActive: true,
    isAdminApproved: true,
    tags: ['penetration-testing', 'gui', 'desktop', 'vnc', 'xfce'],
  },

  // ============ UBUNTU (All roles) ============
  {
    baseOs: 'ubuntu',
    variantType: 'lite',
    imageRef: 'ubuntu:22.04',
    displayName: 'Ubuntu 22.04 Minimal',
    description: 'Minimal Ubuntu Linux server',
    cpuCores: 0.25,
    memoryMb: 256,
    diskGb: 5,
    hourlyCostRm: 0.02,
    suitableForRoles: ['attacker', 'internal', 'service'],
    includedTools: [],
    isActive: true,
    isAdminApproved: true,
    tags: ['base-image', 'lightweight'],
  },
  {
    baseOs: 'ubuntu',
    variantType: 'standard',
    imageRef: 'ubuntu:latest',
    displayName: 'Ubuntu Latest',
    description: 'Full Ubuntu server with systemd',
    cpuCores: 0.5,
    memoryMb: 512,
    diskGb: 10,
    hourlyCostRm: 0.04,
    suitableForRoles: ['attacker', 'internal', 'service'],
    includedTools: ['curl', 'wget', 'git'],
    isActive: true,
    isAdminApproved: true,
    tags: ['general-purpose'],
  },

  // ============ ALPINE LINUX (All roles) ============
  {
    baseOs: 'alpine',
    variantType: 'lite',
    imageRef: 'alpine:latest',
    displayName: 'Alpine Linux',
    description: 'Minimal Docker image based on Alpine Linux (~7MB)',
    cpuCores: 0.25,
    memoryMb: 128,
    diskGb: 5,
    hourlyCostRm: 0.01,
    suitableForRoles: ['attacker', 'internal', 'service'],
    includedTools: [],
    isActive: true,
    isAdminApproved: true,
    tags: ['base-image', 'minimal', 'lightweight'],
  },
];

async function seed() {
  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const variantRepo = dataSource.getRepository(ImageVariant);

    // Clear existing variants
    const existingVariants = await variantRepo.find();
    if (existingVariants.length > 0) {
      await variantRepo.remove(existingVariants);
      console.log(`🗑️  Cleared ${existingVariants.length} existing variants`);
    }

    // Insert new variants
    for (const variantData of imageVariants) {
      const variant = variantRepo.create(variantData);
      await variantRepo.save(variant);
      console.log(`✅ Created: ${variant.displayName} (${variant.imageRef})`);
    }

    console.log(`\n✅ Successfully seeded ${imageVariants.length} image variants!`);
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
