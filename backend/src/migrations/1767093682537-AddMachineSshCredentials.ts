import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMachineSshCredentials1767093682537 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add SSH credentials to machine table
        await queryRunner.query(`
            ALTER TABLE machine 
            ADD COLUMN sshUsername VARCHAR(64) DEFAULT 'root' NULL COMMENT 'SSH username for terminal access',
            ADD COLUMN sshPassword VARCHAR(255) NULL COMMENT 'SSH password (encrypted in production)'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove SSH credentials columns
        await queryRunner.query(`
            ALTER TABLE machine 
            DROP COLUMN IF EXISTS sshUsername,
            DROP COLUMN IF EXISTS sshPassword
        `);
    }

}
