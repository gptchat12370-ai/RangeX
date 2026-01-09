import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBudgetAlertsTable1703318440000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'budget_alerts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'scenario_id',
            type: 'int',
            isNullable: true,
            comment: 'NULL for global budget alerts',
          },
          {
            name: 'alert_month',
            type: 'varchar',
            length: '7',
            comment: 'YYYY-MM format',
          },
          {
            name: 'current_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'budget_limit',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'percentage_used',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'grace_period_starts',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'grace_period_ends',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'grace_period_hours',
            type: 'int',
            default: 24,
          },
          {
            name: 'auto_shutdown_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'shutdown_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['warning', 'grace_period', 'shutdown', 'resolved'],
            default: "'warning'",
          },
          {
            name: 'admin_notified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'forecast_end_of_month',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
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
      'budget_alerts',
      new TableIndex({
        name: 'IDX_BUDGET_ALERTS_SCENARIO',
        columnNames: ['scenario_id'],
      }),
    );

    await queryRunner.createIndex(
      'budget_alerts',
      new TableIndex({
        name: 'IDX_BUDGET_ALERTS_MONTH',
        columnNames: ['alert_month'],
      }),
    );

    await queryRunner.createIndex(
      'budget_alerts',
      new TableIndex({
        name: 'IDX_BUDGET_ALERTS_STATUS',
        columnNames: ['status'],
      }),
    );

    // Composite index for active grace periods
    await queryRunner.createIndex(
      'budget_alerts',
      new TableIndex({
        name: 'IDX_BUDGET_ALERTS_GRACE_PERIOD',
        columnNames: ['status', 'grace_period_ends'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('budget_alerts');
  }
}
