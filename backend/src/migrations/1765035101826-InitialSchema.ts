import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1765035101826 implements MigrationInterface {
    name = 'InitialSchema1765035101826'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`playlist\` CHANGE \`scenarioVersionIds\` \`ownerUserId\` json NOT NULL`);
        await queryRunner.query(`CREATE TABLE \`playlist_item\` (\`id\` varchar(36) NOT NULL, \`playlistId\` varchar(255) NOT NULL, \`scenarioVersionId\` varchar(255) NOT NULL, \`sortOrder\` int NOT NULL DEFAULT '0', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`team_member\` (\`id\` varchar(36) NOT NULL, \`teamId\` varchar(255) NOT NULL, \`userId\` varchar(255) NOT NULL, \`role\` varchar(64) NOT NULL DEFAULT 'member', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`team\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(160) NOT NULL, \`description\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`notification\` (\`id\` varchar(36) NOT NULL, \`userId\` varchar(255) NULL, \`title\` varchar(200) NOT NULL, \`body\` text NOT NULL, \`type\` varchar(64) NOT NULL DEFAULT 'info', \`isRead\` tinyint NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`asset_scenario_version\` (\`id\` varchar(36) NOT NULL, \`assetId\` varchar(255) NOT NULL, \`scenarioVersionId\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`interface_endpoint\` (\`id\` varchar(36) NOT NULL, \`label\` varchar(160) NOT NULL, \`type\` varchar(64) NOT NULL, \`value\` varchar(255) NOT NULL, \`notes\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`audit_log\` ADD \`ipAddress\` varchar(64) NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_log\` ADD \`userAgent\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`asset\` ADD \`scenarioVersionId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`environment_session\` ADD \`costAccumulatedRm\` decimal(12,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE \`environment_session\` ADD \`softLimitWarned\` tinyint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`submittedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`approvedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`approvedByUserId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`rejectedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`rejectReason\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`isFeatured\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` ADD \`isArchived\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` ADD \`lastUsedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` ADD \`lastTestedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` ADD \`status\` varchar(32) NOT NULL DEFAULT 'unknown'`);
        await queryRunner.query(`ALTER TABLE \`usage_daily\` ADD \`vcpuCostRm\` decimal(12,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE \`usage_daily\` ADD \`memoryCostRm\` decimal(12,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD \`lastLoginAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD \`lastIp\` varchar(64) NULL`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD \`passwordUpdatedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`playlist\` DROP COLUMN \`ownerUserId\``);
        await queryRunner.query(`ALTER TABLE \`playlist\` ADD \`ownerUserId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`playlist_item\` ADD CONSTRAINT \`FK_9b9b229772d88966e7d9959d907\` FOREIGN KEY (\`playlistId\`) REFERENCES \`playlist\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`playlist_item\` ADD CONSTRAINT \`FK_e76af5554beedbe5193b92ebe3a\` FOREIGN KEY (\`scenarioVersionId\`) REFERENCES \`scenario_version\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`team_member\` ADD CONSTRAINT \`FK_74da8f612921485e1005dc8e225\` FOREIGN KEY (\`teamId\`) REFERENCES \`team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`team_member\` ADD CONSTRAINT \`FK_d2be3e8fc9ab0f69673721c7fc3\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`asset_scenario_version\` ADD CONSTRAINT \`FK_b789f49d8a9d5e11d66964a74b4\` FOREIGN KEY (\`assetId\`) REFERENCES \`asset\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`asset_scenario_version\` ADD CONSTRAINT \`FK_179d025f99187ac2e81b9a93746\` FOREIGN KEY (\`scenarioVersionId\`) REFERENCES \`scenario_version\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`asset_scenario_version\` DROP FOREIGN KEY \`FK_179d025f99187ac2e81b9a93746\``);
        await queryRunner.query(`ALTER TABLE \`asset_scenario_version\` DROP FOREIGN KEY \`FK_b789f49d8a9d5e11d66964a74b4\``);
        await queryRunner.query(`ALTER TABLE \`team_member\` DROP FOREIGN KEY \`FK_d2be3e8fc9ab0f69673721c7fc3\``);
        await queryRunner.query(`ALTER TABLE \`team_member\` DROP FOREIGN KEY \`FK_74da8f612921485e1005dc8e225\``);
        await queryRunner.query(`ALTER TABLE \`playlist_item\` DROP FOREIGN KEY \`FK_e76af5554beedbe5193b92ebe3a\``);
        await queryRunner.query(`ALTER TABLE \`playlist_item\` DROP FOREIGN KEY \`FK_9b9b229772d88966e7d9959d907\``);
        await queryRunner.query(`ALTER TABLE \`playlist\` DROP COLUMN \`ownerUserId\``);
        await queryRunner.query(`ALTER TABLE \`playlist\` ADD \`ownerUserId\` json NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`passwordUpdatedAt\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`lastIp\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`lastLoginAt\``);
        await queryRunner.query(`ALTER TABLE \`usage_daily\` DROP COLUMN \`memoryCostRm\``);
        await queryRunner.query(`ALTER TABLE \`usage_daily\` DROP COLUMN \`vcpuCostRm\``);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` DROP COLUMN \`status\``);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` DROP COLUMN \`lastTestedAt\``);
        await queryRunner.query(`ALTER TABLE \`registry_credential\` DROP COLUMN \`lastUsedAt\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`isArchived\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`isFeatured\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`rejectReason\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`rejectedAt\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`approvedByUserId\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`approvedAt\``);
        await queryRunner.query(`ALTER TABLE \`scenario_version\` DROP COLUMN \`submittedAt\``);
        await queryRunner.query(`ALTER TABLE \`environment_session\` DROP COLUMN \`softLimitWarned\``);
        await queryRunner.query(`ALTER TABLE \`environment_session\` DROP COLUMN \`costAccumulatedRm\``);
        await queryRunner.query(`ALTER TABLE \`asset\` DROP COLUMN \`scenarioVersionId\``);
        await queryRunner.query(`ALTER TABLE \`audit_log\` DROP COLUMN \`userAgent\``);
        await queryRunner.query(`ALTER TABLE \`audit_log\` DROP COLUMN \`ipAddress\``);
        await queryRunner.query(`DROP TABLE \`interface_endpoint\``);
        await queryRunner.query(`DROP TABLE \`asset_scenario_version\``);
        await queryRunner.query(`DROP TABLE \`notification\``);
        await queryRunner.query(`DROP TABLE \`team\``);
        await queryRunner.query(`DROP TABLE \`team_member\``);
        await queryRunner.query(`DROP TABLE \`playlist_item\``);
        await queryRunner.query(`ALTER TABLE \`playlist\` CHANGE \`ownerUserId\` \`scenarioVersionIds\` json NOT NULL`);
    }

}
