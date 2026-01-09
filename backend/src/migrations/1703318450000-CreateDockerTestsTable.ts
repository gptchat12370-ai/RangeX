import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDockerTestsTable1703318450000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'docker_tests',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'test_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'scenario_id',
            type: 'int',
          },
          {
            name: 'compose_content',
            type: 'longtext',
          },
          {
            name: 'container_ids',
            type: 'json',
            comment: 'Array of Docker container IDs',
          },
          {
            name: 'test_results',
            type: 'json',
            isNullable: true,
            comment: 'Validation results from each container',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['starting', 'running', 'validating', 'passed', 'failed', 'stopped', 'error'],
            default: "'starting'",
          },
          {
            name: 'started_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'validation_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'stopped_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'logs',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'network_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cleanup_completed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add indexes
    await queryRunner.createIndex(
      'docker_tests',
      new TableIndex({
        name: 'IDX_DOCKER_TESTS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'docker_tests',
      new TableIndex({
        name: 'IDX_DOCKER_TESTS_SCENARIO_ID',
        columnNames: ['scenario_id'],
      }),
    );

    await queryRunner.createIndex(
      'docker_tests',
      new TableIndex({
        name: 'IDX_DOCKER_TESTS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'docker_tests',
      new TableIndex({
        name: 'IDX_DOCKER_TESTS_STARTED_AT',
        columnNames: ['started_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('docker_tests');
  }
}
