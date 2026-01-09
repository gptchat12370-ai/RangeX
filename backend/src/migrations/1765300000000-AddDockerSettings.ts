import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDockerSettings1765300000000 implements MigrationInterface {
    name = 'AddDockerSettings1765300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns already exist
        const table = await queryRunner.getTable('system_settings');
        const dockerMaxContainersColumn = table?.findColumnByName('dockerMaxContainers');
        
        if (!dockerMaxContainersColumn) {
            // Add Docker testing configuration columns to system_settings
            await queryRunner.query(`
                ALTER TABLE \`system_settings\`
                ADD COLUMN \`dockerMaxContainers\` int NOT NULL DEFAULT '5' COMMENT 'Max concurrent Docker test containers' AFTER \`useLocalDocker\`,
                ADD COLUMN \`dockerMaxCpusPerContainer\` decimal(4,2) NOT NULL DEFAULT '0.50' COMMENT 'Max CPUs per test container' AFTER \`dockerMaxContainers\`,
                ADD COLUMN \`dockerMaxMemoryMbPerContainer\` int NOT NULL DEFAULT '250' COMMENT 'Max memory in MB per test container' AFTER \`dockerMaxCpusPerContainer\`,
                ADD COLUMN \`dockerTestTimeoutMinutes\` int NOT NULL DEFAULT '60' COMMENT 'Test timeout in minutes' AFTER \`dockerMaxMemoryMbPerContainer\`,
                ADD COLUMN \`dockerEnablePullFromHub\` tinyint NOT NULL DEFAULT '0' COMMENT 'Enable pulling from Docker Hub' AFTER \`dockerTestTimeoutMinutes\`
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove Docker testing configuration columns
        await queryRunner.query(`
            ALTER TABLE \`system_settings\`
            DROP COLUMN \`dockerEnablePullFromHub\`,
            DROP COLUMN \`dockerTestTimeoutMinutes\`,
            DROP COLUMN \`dockerMaxMemoryMbPerContainer\`,
            DROP COLUMN \`dockerMaxCpusPerContainer\`,
            DROP COLUMN \`dockerMaxContainers\`
        `);
    }
}
