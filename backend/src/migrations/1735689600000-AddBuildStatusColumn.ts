import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBuildStatusColumn1735689600000 implements MigrationInterface {
  name = 'AddBuildStatusColumn1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add buildStatus column to scenario_version table
    await queryRunner.addColumn(
      'scenario_version',
      new TableColumn({
        name: 'buildStatus',
        type: 'varchar',
        length: '24',
        isNullable: true,
        comment: 'Build pipeline status: RUNNING, SUCCESS, FAILED',
      }),
    );

    // Set existing scenarios with buildLogs to SUCCESS (assume successful builds)
    await queryRunner.query(`
      UPDATE scenario_version 
      SET buildStatus = 'SUCCESS' 
      WHERE buildLogs IS NOT NULL 
        AND buildLogs NOT LIKE '%BUILD FAILED%'
    `);

    // Set existing scenarios with failed build logs to FAILED
    await queryRunner.query(`
      UPDATE scenario_version 
      SET buildStatus = 'FAILED' 
      WHERE buildLogs LIKE '%BUILD FAILED%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove buildStatus column
    await queryRunner.dropColumn('scenario_version', 'buildStatus');
  }
}
