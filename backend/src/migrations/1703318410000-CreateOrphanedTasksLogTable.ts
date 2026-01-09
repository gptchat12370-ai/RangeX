import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOrphanedTasksLogTable1703318410000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orphaned_tasks_log',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'task_arn',
            type: 'varchar',
            length: '512',
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
            name: 'started_at',
            type: 'timestamp',
          },
          {
            name: 'detected_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'terminated_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_activity',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'running_minutes',
            type: 'int',
          },
          {
            name: 'inactive_minutes',
            type: 'int',
          },
          {
            name: 'estimated_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'termination_reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['detected', 'terminating', 'terminated', 'error'],
            default: "'detected'",
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
            comment: 'Task Metadata Endpoint v4 data',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add indexes
    await queryRunner.createIndex(
      'orphaned_tasks_log',
      new TableIndex({
        name: 'IDX_ORPHANED_TASKS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'orphaned_tasks_log',
      new TableIndex({
        name: 'IDX_ORPHANED_TASKS_SCENARIO_ID',
        columnNames: ['scenario_id'],
      }),
    );

    await queryRunner.createIndex(
      'orphaned_tasks_log',
      new TableIndex({
        name: 'IDX_ORPHANED_TASKS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'orphaned_tasks_log',
      new TableIndex({
        name: 'IDX_ORPHANED_TASKS_DETECTED_AT',
        columnNames: ['detected_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orphaned_tasks_log');
  }
}
