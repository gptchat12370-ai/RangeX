import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocalTestAndBundleStatus1735700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add localTestStatus column
    await queryRunner.addColumn('scenario_version', new TableColumn({
      name: 'localTestStatus',
      type: 'varchar',
      length: '24',
      isNullable: true,
      default: "'NONE'",
      comment: 'Local Docker test status: NONE, RUNNING, PASS, FAIL, STOPPED',
    }));

    // Add bundleStatus column
    await queryRunner.addColumn('scenario_version', new TableColumn({
      name: 'bundleStatus',
      type: 'varchar',
      length: '24',
      isNullable: true,
      default: "'NONE'",
      comment: 'Bundle creation status: NONE, CREATING, READY, FAILED',
    }));

    // Add bundlePath column (MinIO path)
    await queryRunner.addColumn('scenario_version', new TableColumn({
      name: 'bundlePath',
      type: 'varchar',
      length: '512',
      isNullable: true,
      comment: 'MinIO path to scenario bundle',
    }));

    // Add currentStage column for pipeline tracking
    await queryRunner.addColumn('scenario_version', new TableColumn({
      name: 'currentStage',
      type: 'varchar',
      length: '32',
      isNullable: true,
      default: "'draft'",
      comment: 'Pipeline stage: draft, local_test, submitted, review, bundled, deployed',
    }));

    // Update existing rows
    await queryRunner.query(`
      UPDATE scenario_version 
      SET localTestStatus = 'NONE', 
          bundleStatus = 'NONE', 
          currentStage = CASE 
            WHEN status = 'DRAFT' THEN 'draft'
            WHEN status = 'SUBMITTED' THEN 'submitted'
            WHEN status = 'APPROVED' THEN 'review'
            WHEN status = 'PUBLISHED' THEN 'deployed'
            ELSE 'draft'
          END
      WHERE localTestStatus IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('scenario_version', 'currentStage');
    await queryRunner.dropColumn('scenario_version', 'bundlePath');
    await queryRunner.dropColumn('scenario_version', 'bundleStatus');
    await queryRunner.dropColumn('scenario_version', 'localTestStatus');
  }
}
