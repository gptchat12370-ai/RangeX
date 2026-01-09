import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddScenarioVersionTestRuns1767608400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('scenario_version_test_runs');
    if (tableExists) {
      console.log('Table scenario_version_test_runs already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'scenario_version_test_runs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'scenarioVersionId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'initiatedBy',
            type: 'varchar',
            length: '36',
            comment: 'Admin user who started the test',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'deploying', 'testing', 'passed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'deploymentId',
            type: 'varchar',
            length: '36',
            isNullable: true,
            comment: 'Reference to deployment table if deployment succeeded',
          },
          {
            name: 'sessionToken',
            type: 'varchar',
            length: '64',
            isNullable: true,
            comment: 'Test session token for accessing machines',
          },
          {
            name: 'gatewayProxyUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Discovered gateway proxy URL',
          },
          {
            name: 'testResults',
            type: 'json',
            isNullable: true,
            comment: 'Automated test results: {gatewayReachable, machinesHealthy, entrypointsAccessible, errors}',
          },
          {
            name: 'logs',
            type: 'text',
            isNullable: true,
            comment: 'Deployment and test execution logs',
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
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
      true,
    );

    // Foreign key to scenario_versions
    await queryRunner.createForeignKey(
      'scenario_version_test_runs',
      new TableForeignKey({
        columnNames: ['scenarioVersionId'],
        referencedTableName: 'scenario_versions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Foreign key to users (initiatedBy)
    await queryRunner.createForeignKey(
      'scenario_version_test_runs',
      new TableForeignKey({
        columnNames: ['initiatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Index on scenarioVersionId for fast lookups
    await queryRunner.query(
      `CREATE INDEX idx_test_runs_version ON scenario_version_test_runs(scenarioVersionId)`,
    );

    // Index on status for filtering
    await queryRunner.query(
      `CREATE INDEX idx_test_runs_status ON scenario_version_test_runs(status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('scenario_version_test_runs', true);
  }
}
