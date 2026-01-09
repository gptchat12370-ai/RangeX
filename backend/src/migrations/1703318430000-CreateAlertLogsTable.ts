import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAlertLogsTable1703318430000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'alert_logs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'alert_type',
            type: 'enum',
            enum: ['budget', 'orphaned_task', 'aws_config', 'security', 'system'],
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          {
            name: 'channel',
            type: 'enum',
            enum: ['email', 'sms', 'web', 'all'],
          },
          {
            name: 'recipient',
            type: 'varchar',
            length: '255',
            comment: 'Email, phone number, or user ID',
          },
          {
            name: 'subject',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'failed', 'bounced'],
            default: "'pending'",
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'int',
            default: 0,
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
      'alert_logs',
      new TableIndex({
        name: 'IDX_ALERT_LOGS_TYPE',
        columnNames: ['alert_type'],
      }),
    );

    await queryRunner.createIndex(
      'alert_logs',
      new TableIndex({
        name: 'IDX_ALERT_LOGS_PRIORITY',
        columnNames: ['priority'],
      }),
    );

    await queryRunner.createIndex(
      'alert_logs',
      new TableIndex({
        name: 'IDX_ALERT_LOGS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'alert_logs',
      new TableIndex({
        name: 'IDX_ALERT_LOGS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('alert_logs');
  }
}
