import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns database schema with new entity fields added for approvals, costs, registry tracking, and user profile data.
 */
export class AddMissingColumns1710000000000 implements MigrationInterface {
  name = 'AddMissingColumns1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ScenarioVersion new lifecycle fields
    if (!(await queryRunner.hasColumn('scenario_version', 'submittedAt'))) {
      await queryRunner.query(`ALTER TABLE scenario_version ADD COLUMN submittedAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'approvedAt'))) {
      await queryRunner.query(`ALTER TABLE scenario_version ADD COLUMN approvedAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'approvedByUserId'))) {
      await queryRunner.query(`ALTER TABLE scenario_version ADD COLUMN approvedByUserId char(36) NULL`);
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'rejectedAt'))) {
      await queryRunner.query(`ALTER TABLE scenario_version ADD COLUMN rejectedAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'rejectReason'))) {
      await queryRunner.query(`ALTER TABLE scenario_version ADD COLUMN rejectReason text NULL`);
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'isFeatured'))) {
      await queryRunner.query(
        `ALTER TABLE scenario_version ADD COLUMN isFeatured tinyint(1) NOT NULL DEFAULT 0`,
      );
    }
    if (!(await queryRunner.hasColumn('scenario_version', 'isArchived'))) {
      await queryRunner.query(
        `ALTER TABLE scenario_version ADD COLUMN isArchived tinyint(1) NOT NULL DEFAULT 0`,
      );
    }

    // EnvironmentSession cost tracking and flags
    if (!(await queryRunner.hasColumn('environment_session', 'costAccumulatedRm'))) {
      await queryRunner.query(
        `ALTER TABLE environment_session ADD COLUMN costAccumulatedRm decimal(12,2) NOT NULL DEFAULT 0`,
      );
    }
    if (!(await queryRunner.hasColumn('environment_session', 'softLimitWarned'))) {
      await queryRunner.query(
        `ALTER TABLE environment_session ADD COLUMN softLimitWarned tinyint(1) NOT NULL DEFAULT 0`,
      );
    }

    // UsageDaily cost components
    if (!(await queryRunner.hasColumn('usage_daily', 'vcpuCostRm'))) {
      await queryRunner.query(
        `ALTER TABLE usage_daily ADD COLUMN vcpuCostRm decimal(12,2) NOT NULL DEFAULT 0`,
      );
    }
    if (!(await queryRunner.hasColumn('usage_daily', 'memoryCostRm'))) {
      await queryRunner.query(
        `ALTER TABLE usage_daily ADD COLUMN memoryCostRm decimal(12,2) NOT NULL DEFAULT 0`,
      );
    }

    // User profile / security metadata
    if (!(await queryRunner.hasColumn('user', 'avatarUrl'))) {
      await queryRunner.query(`ALTER TABLE user ADD COLUMN avatarUrl varchar(255) NULL`);
    }
    if (!(await queryRunner.hasColumn('user', 'lastLoginAt'))) {
      await queryRunner.query(`ALTER TABLE user ADD COLUMN lastLoginAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('user', 'lastIp'))) {
      await queryRunner.query(`ALTER TABLE user ADD COLUMN lastIp varchar(64) NULL`);
    }
    if (!(await queryRunner.hasColumn('user', 'passwordUpdatedAt'))) {
      await queryRunner.query(`ALTER TABLE user ADD COLUMN passwordUpdatedAt datetime NULL`);
    }

    // Registry credential observability
    if (!(await queryRunner.hasColumn('registry_credential', 'lastUsedAt'))) {
      await queryRunner.query(`ALTER TABLE registry_credential ADD COLUMN lastUsedAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('registry_credential', 'lastTestedAt'))) {
      await queryRunner.query(`ALTER TABLE registry_credential ADD COLUMN lastTestedAt datetime NULL`);
    }
    if (!(await queryRunner.hasColumn('registry_credential', 'status'))) {
      await queryRunner.query(
        `ALTER TABLE registry_credential ADD COLUMN status varchar(32) NOT NULL DEFAULT 'unknown'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE registry_credential
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS lastTestedAt,
      DROP COLUMN IF EXISTS lastUsedAt
    `);

    await queryRunner.query(`
      ALTER TABLE user
      DROP COLUMN IF EXISTS passwordUpdatedAt,
      DROP COLUMN IF EXISTS lastIp,
      DROP COLUMN IF EXISTS lastLoginAt,
      DROP COLUMN IF EXISTS avatarUrl
    `);

    await queryRunner.query(`
      ALTER TABLE usage_daily
      DROP COLUMN IF EXISTS memoryCostRm,
      DROP COLUMN IF EXISTS vcpuCostRm
    `);

    await queryRunner.query(`
      ALTER TABLE environment_session
      DROP COLUMN IF EXISTS softLimitWarned,
      DROP COLUMN IF EXISTS costAccumulatedRm
    `);

    await queryRunner.query(`
      ALTER TABLE scenario_version
      DROP COLUMN IF EXISTS isArchived,
      DROP COLUMN IF EXISTS isFeatured,
      DROP COLUMN IF EXISTS rejectReason,
      DROP COLUMN IF EXISTS rejectedAt,
      DROP COLUMN IF EXISTS approvedByUserId,
      DROP COLUMN IF EXISTS approvedAt,
      DROP COLUMN IF EXISTS submittedAt
    `);
  }
}
