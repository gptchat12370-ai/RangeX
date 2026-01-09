import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCareerPathAndEvents1765130000000 implements MigrationInterface {
    name = 'AddCareerPathAndEvents1765130000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`career_path\` (\`id\` varchar(36) NOT NULL, \`title\` varchar(200) NOT NULL, \`description\` text NULL, \`isPublic\` tinyint NOT NULL DEFAULT 0, \`ownerUserId\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`career_path_item\` (\`id\` varchar(36) NOT NULL, \`careerPathId\` varchar(36) NOT NULL, \`scenarioVersionId\` varchar(255) NOT NULL, \`sortOrder\` int NOT NULL DEFAULT 0, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`event\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` text NULL, \`startDate\` datetime NULL, \`endDate\` datetime NULL, \`timezone\` varchar(64) NOT NULL DEFAULT 'UTC', \`maxParticipants\` int NOT NULL DEFAULT 0, \`format\` varchar(120) NOT NULL DEFAULT 'standard', \`registrationRequired\` tinyint NOT NULL DEFAULT 1, \`createdByUserId\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`event_scenario\` (\`id\` varchar(36) NOT NULL, \`eventId\` varchar(36) NOT NULL, \`scenarioVersionId\` varchar(255) NOT NULL, \`sortOrder\` int NOT NULL DEFAULT 0, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`career_path_item\` ADD CONSTRAINT \`FK_cp_item_path\` FOREIGN KEY (\`careerPathId\`) REFERENCES \`career_path\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`career_path_item\` ADD CONSTRAINT \`FK_cp_item_version\` FOREIGN KEY (\`scenarioVersionId\`) REFERENCES \`scenario_version\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`event_scenario\` ADD CONSTRAINT \`FK_event_scenario_event\` FOREIGN KEY (\`eventId\`) REFERENCES \`event\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`event_scenario\` ADD CONSTRAINT \`FK_event_scenario_version\` FOREIGN KEY (\`scenarioVersionId\`) REFERENCES \`scenario_version\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`event_scenario\` DROP FOREIGN KEY \`FK_event_scenario_version\``);
        await queryRunner.query(`ALTER TABLE \`event_scenario\` DROP FOREIGN KEY \`FK_event_scenario_event\``);
        await queryRunner.query(`ALTER TABLE \`career_path_item\` DROP FOREIGN KEY \`FK_cp_item_version\``);
        await queryRunner.query(`ALTER TABLE \`career_path_item\` DROP FOREIGN KEY \`FK_cp_item_path\``);
        await queryRunner.query(`DROP TABLE \`event_scenario\``);
        await queryRunner.query(`DROP TABLE \`event\``);
        await queryRunner.query(`DROP TABLE \`career_path_item\``);
        await queryRunner.query(`DROP TABLE \`career_path\``);
    }

}
