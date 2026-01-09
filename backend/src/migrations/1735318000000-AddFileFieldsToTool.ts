import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileFieldsToTool1735318000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add file-related fields for MinIO integration
    await queryRunner.query(
      `ALTER TABLE tool ADD COLUMN fileUrl VARCHAR(1000) NULL AFTER iconUrl`
    );
    await queryRunner.query(
      `ALTER TABLE tool ADD COLUMN fileSizeBytes BIGINT NULL AFTER fileUrl`
    );
    await queryRunner.query(
      `ALTER TABLE tool ADD COLUMN fileChecksum VARCHAR(100) NULL AFTER fileSizeBytes`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tool DROP COLUMN fileChecksum`);
    await queryRunner.query(`ALTER TABLE tool DROP COLUMN fileSizeBytes`);
    await queryRunner.query(`ALTER TABLE tool DROP COLUMN fileUrl`);
  }
}
