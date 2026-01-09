import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateImageVariantsAndPreferences1703340000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create image_variants table
    await queryRunner.createTable(
      new Table({
        name: 'image_variants',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'baseOs',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'variantType',
            type: 'varchar',
            length: '16',
          },
          {
            name: 'imageRef',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '120',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cpuCores',
            type: 'decimal',
            precision: 3,
            scale: 2,
          },
          {
            name: 'memoryMb',
            type: 'int',
          },
          {
            name: 'diskGb',
            type: 'int',
          },
          {
            name: 'hourlyCostRm',
            type: 'decimal',
            precision: 10,
            scale: 4,
          },
          {
            name: 'suitableForRoles',
            type: 'text',
          },
          {
            name: 'includedTools',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isAdminApproved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create creator_preferences table
    await queryRunner.createTable(
      new Table({
        name: 'creator_preferences',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'preferredAttackerVariantId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'preferredVictimVariantId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'preferredServiceVariantId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'defaultResourceProfile',
            type: 'varchar',
            length: '24',
            default: "'small'",
          },
          {
            name: 'dockerRegistryUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'dockerUsername',
            type: 'varchar',
            length: '120',
            isNullable: true,
          },
          {
            name: 'dockerPasswordEncrypted',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notifyOnApproval',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notifyOnRejection',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notifyOnCostAlert',
            type: 'boolean',
            default: false,
          },
          {
            name: 'costAlertThreshold',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'creator_preferences',
      new TableForeignKey({
        name: 'fk_creator_preferences_user',
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'creator_preferences',
      new TableForeignKey({
        name: 'fk_creator_preferences_attacker_variant',
        columnNames: ['preferredAttackerVariantId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'image_variants',
        onDelete: 'SET NULL',
      })
    );

    await queryRunner.createForeignKey(
      'creator_preferences',
      new TableForeignKey({
        name: 'fk_creator_preferences_victim_variant',
        columnNames: ['preferredVictimVariantId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'image_variants',
        onDelete: 'SET NULL',
      })
    );

    await queryRunner.createForeignKey(
      'creator_preferences',
      new TableForeignKey({
        name: 'fk_creator_preferences_service_variant',
        columnNames: ['preferredServiceVariantId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'image_variants',
        onDelete: 'SET NULL',
      })
    );

    // Step 2: Update machine table with new columns (check if column exists first)
    const machineTableCheck = await queryRunner.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'rangex' AND TABLE_NAME = 'machine' AND COLUMN_NAME = 'imageVariantId'
    `);
    
    if (machineTableCheck.length === 0) {
      await queryRunner.query(`
        ALTER TABLE machine
        ADD COLUMN imageVariantId VARCHAR(36),
        ADD COLUMN customImageRef VARCHAR(255),
        ADD COLUMN cpuCores DECIMAL(3,2) DEFAULT 0.5,
        ADD COLUMN memoryMb INT DEFAULT 512,
        ADD COLUMN diskGb INT DEFAULT 10,
        ADD COLUMN estimatedCostPerHour DECIMAL(10,4) DEFAULT 0.12,
        ADD COLUMN exposedPorts JSON,
        ADD COLUMN sshEnabled BOOLEAN DEFAULT false,
        ADD COLUMN rdpEnabled BOOLEAN DEFAULT false,
        ADD COLUMN webEnabled BOOLEAN DEFAULT false,
        ADD COLUMN environmentVars JSON,
        ADD COLUMN labels JSON
      `);
    }

    // Add foreign key for machine -> image_variants (check if exists first)
    const fkCheck = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = 'rangex' 
        AND TABLE_NAME = 'machine' 
        AND CONSTRAINT_NAME = 'fk_machine_image_variant'
    `);
    
    if (fkCheck.length === 0) {
      await queryRunner.query(`
        ALTER TABLE machine
        ADD CONSTRAINT fk_machine_image_variant
        FOREIGN KEY (imageVariantId) 
        REFERENCES image_variants(id)
        ON DELETE SET NULL
      `);
    }

    // Create indexes (MySQL doesn't support IF NOT EXISTS for CREATE INDEX in older versions)
    try {
      await queryRunner.query(`CREATE INDEX idx_machine_variant ON machine(imageVariantId)`);
    } catch (e) {
      // Index might already exist, ignore
    }
    
    try {
      await queryRunner.query(`CREATE INDEX idx_machine_scenario_version ON machine(scenarioVersionId)`);
    } catch (e) {
      // Index might already exist, ignore
    }
    
    try {
      await queryRunner.query(`CREATE INDEX idx_image_variants_base_os ON image_variants(baseOs)`);
    } catch (e) {
      // Index might already exist, ignore
    }
    
    try {
      await queryRunner.query(`CREATE INDEX idx_image_variants_variant_type ON image_variants(variantType)`);
    } catch (e) {
      // Index might already exist, ignore
    }
    
    try {
      await queryRunner.query(`CREATE INDEX idx_image_variants_active ON image_variants(isActive, isAdminApproved)`);
    } catch (e) {
      // Index might already exist, ignore
    }
    
    try {
      await queryRunner.query(`CREATE UNIQUE INDEX idx_creator_prefs_user ON creator_preferences(userId)`);
    } catch (e) {
      // Index might already exist, ignore
    }

    // Insert seed data for image variants (MySQL UUID() generates UUIDs)
    await queryRunner.query(`
      INSERT INTO image_variants (id, baseOs, variantType, imageRef, displayName, description, cpuCores, memoryMb, diskGb, hourlyCostRm, suitableForRoles, includedTools, isActive, isAdminApproved, tags) VALUES
      (UUID(), 'kali', 'lite', 'kalilinux/kali-last-release:latest', 'Kali Linux Lite', 'Lightweight Kali with essential penetration testing tools only. Ideal for basic network assessments and educational CTFs.', 0.5, 512, 10, 0.12, 'attacker', 'nmap,netcat,john,hydra,aircrack-ng', true, true, 'penetration-testing,network-analysis,password-cracking'),
      (UUID(), 'kali', 'standard', 'kalilinux/kali-rolling:latest', 'Kali Linux Standard', 'Standard Kali with most common penetration testing tools. Suitable for web app testing and network exploitation.', 1.0, 1024, 20, 0.24, 'attacker', 'nmap,sqlmap,metasploit,burpsuite,nikto,gobuster,dirb', true, true, 'penetration-testing,web-application-testing,exploitation'),
      (UUID(), 'kali', 'full', 'kalilinux/kali-everything:latest', 'Kali Linux Full', 'Complete Kali with all tools and frameworks. For advanced penetration testing and red team operations.', 2.0, 2048, 30, 0.48, 'attacker', 'all-kali-tools', true, true, 'penetration-testing,red-team,advanced-exploitation'),
      (UUID(), 'ubuntu', 'lite', 'ubuntu:22.04-minimal', 'Ubuntu Minimal', 'Minimal Ubuntu for lightweight services and victim machines. Reduced attack surface.', 0.25, 256, 5, 0.06, 'victim,service,internal', '', true, true, 'victim-machine,web-server,minimal'),
      (UUID(), 'ubuntu', 'standard', 'ubuntu:22.04', 'Ubuntu Standard', 'Standard Ubuntu server for web services, databases, and victim machines in CTF scenarios.', 0.5, 512, 10, 0.12, 'victim,service,internal', 'nginx,apache,mysql', true, true, 'victim-machine,web-server,database'),
      (UUID(), 'ubuntu', 'full', 'ubuntu:22.04-full', 'Ubuntu Full', 'Ubuntu with development tools and build essentials. For complex victim scenarios requiring compilation.', 1.0, 1024, 20, 0.24, 'victim,service,internal', 'build-essential,python3,nodejs,gcc,g++', true, true, 'victim-machine,development,full-stack'),
      (UUID(), 'windows', 'lite', 'mcr.microsoft.com/windows/nanoserver:ltsc2022', 'Windows Nano Server', 'Minimal Windows for lightweight services. Smallest Windows footprint.', 0.5, 512, 10, 0.15, 'victim,service', '', true, true, 'victim-machine,windows,minimal'),
      (UUID(), 'windows', 'standard', 'mcr.microsoft.com/windows/servercore:ltsc2022', 'Windows Server Core', 'Standard Windows Server without GUI. For Active Directory, file servers, and web services.', 1.0, 2048, 30, 0.40, 'victim,internal', 'iis,powershell', true, true, 'victim-machine,windows,server,active-directory'),
      (UUID(), 'windows', 'full', 'mcr.microsoft.com/windows:ltsc2022', 'Windows Server Full', 'Full Windows Server with GUI. For realistic Windows exploitation scenarios.', 2.0, 4096, 50, 0.80, 'victim,internal', 'full-gui,rdp,powershell,iis', true, true, 'victim-machine,windows,gui,rdp'),
      (UUID(), 'alpine', 'lite', 'alpine:latest', 'Alpine Linux', 'Ultra-lightweight Linux (5MB). Perfect for microservices and minimal attack scenarios.', 0.25, 128, 2, 0.03, 'service,internal', '', true, true, 'microservice,minimal,lightweight'),
      (UUID(), 'debian', 'lite', 'debian:stable-slim', 'Debian Slim', 'Lightweight Debian for stable services.', 0.25, 256, 5, 0.06, 'victim,service,internal', '', true, true, 'victim-machine,stable,minimal'),
      (UUID(), 'debian', 'standard', 'debian:stable', 'Debian Standard', 'Standard Debian for general-purpose victim machines.', 0.5, 512, 10, 0.12, 'victim,service,internal', '', true, true, 'victim-machine,stable,general-purpose')
    `);

    console.log('✅ Image variants and creator preferences tables created successfully');
    console.log('✅ Machines table updated with new columns');
    console.log('✅ Seed data inserted for 13 image variants');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`ALTER TABLE machines DROP CONSTRAINT IF EXISTS fk_machines_image_variant;`);
    await queryRunner.dropTable('creator_preferences');
    await queryRunner.dropTable('image_variants');

    // Remove new columns from machines
    await queryRunner.query(`
      ALTER TABLE machines
      DROP COLUMN IF EXISTS imageVariantId,
      DROP COLUMN IF EXISTS customImageRef,
      DROP COLUMN IF EXISTS cpuCores,
      DROP COLUMN IF EXISTS memoryMb,
      DROP COLUMN IF EXISTS diskGb,
      DROP COLUMN IF EXISTS estimatedCostPerHour,
      DROP COLUMN IF EXISTS exposedPorts,
      DROP COLUMN IF EXISTS sshEnabled,
      DROP COLUMN IF EXISTS rdpEnabled,
      DROP COLUMN IF EXISTS webEnabled,
      DROP COLUMN IF EXISTS environmentVars,
      DROP COLUMN IF EXISTS labels;
    `);
  }
}
