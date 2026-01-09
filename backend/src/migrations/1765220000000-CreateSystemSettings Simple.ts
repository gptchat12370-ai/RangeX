import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemSettingsSimple1765220000000 implements MigrationInterface {
    name = 'CreateSystemSettingsSimple1765220000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`system_settings\` (
                \`id\` varchar(36) NOT NULL,
                \`maintenanceMode\` tinyint NOT NULL DEFAULT 0,
                \`maintenanceMessage\` text NULL,
                \`maxConcurrentUsers\` int NOT NULL DEFAULT '0' COMMENT 'Max concurrent users, 0 = unlimited',
                \`maxTotalUsers\` int NOT NULL DEFAULT '0' COMMENT 'Max total registered users, 0 = unlimited',
                \`allowNewRegistrations\` tinyint NOT NULL DEFAULT 1,
                \`maxSessionsPerUser\` int NOT NULL DEFAULT '1' COMMENT 'Max concurrent sessions per user',
                \`maxSessionsPerHour\` int NOT NULL DEFAULT '3' COMMENT 'Max session starts per hour per user',
                \`maxSessionsPerDay\` int NOT NULL DEFAULT '10' COMMENT 'Max session starts per day per user',
                \`idleTimeoutMinutes\` int NOT NULL DEFAULT '30' COMMENT 'Idle timeout in minutes',
                \`maxSessionDurationMinutes\` int NOT NULL DEFAULT '180' COMMENT 'Max session duration in minutes',
                \`maxTotalContainers\` int NOT NULL DEFAULT '0' COMMENT 'Max total running containers, 0 = unlimited',
                \`maxAccessibleScenarios\` int NOT NULL DEFAULT '1' COMMENT 'Max scenarios that can be accessed',
                \`allowAllScenarios\` tinyint NOT NULL DEFAULT 0 COMMENT 'Allow users to access all scenarios',
                \`budgetHardCapUsd\` decimal(12,2) NOT NULL DEFAULT '0.00',
                \`budgetAlertPercentage\` int NOT NULL DEFAULT '80' COMMENT 'Budget alert percentage threshold',
                \`autoMaintenanceOnBudgetCap\` tinyint NOT NULL DEFAULT 1 COMMENT 'Auto-enable maintenance at budget cap',
                \`maxStoragePerUserBytes\` bigint NOT NULL DEFAULT '0' COMMENT 'Max storage per user in bytes, 0 = unlimited',
                \`maxTotalStorageBytes\` bigint NOT NULL DEFAULT '0' COMMENT 'Max total storage in bytes, 0 = unlimited',
                \`storageDriver\` varchar(255) NOT NULL DEFAULT 'minio',
                \`minioEndpoint\` varchar(255) NULL,
                \`minioPort\` int NULL,
                \`minioUseSSL\` tinyint NOT NULL DEFAULT 0,
                \`minioAccessKey\` varchar(255) NULL,
                \`minioSecretKey\` varchar(255) NULL,
                \`minioBucket\` varchar(255) NOT NULL DEFAULT 'assets',
                \`awsRegion\` varchar(50) NULL,
                \`awsEcsClusterName\` varchar(255) NULL,
                \`awsEcsSubnetIds\` text NULL COMMENT 'Comma-separated subnet IDs',
                \`awsEcsSecurityGroupIds\` text NULL COMMENT 'Comma-separated security group IDs',
                \`awsEcrRegistry\` varchar(255) NULL,
                \`useLocalDocker\` tinyint NOT NULL DEFAULT 0 COMMENT 'Use local Docker instead of Fargate',
                \`enablePrometheusMetrics\` tinyint NOT NULL DEFAULT 1,
                \`enableRequestLogging\` tinyint NOT NULL DEFAULT 1,
                \`logRetentionDays\` int NOT NULL DEFAULT '7' COMMENT 'Log retention in days',
                \`sendErrorNotifications\` tinyint NOT NULL DEFAULT 1,
                \`adminEmails\` text NULL COMMENT 'Comma-separated admin emails',
                \`slackWebhookUrl\` text NULL,
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`system_settings\``);
    }
}
