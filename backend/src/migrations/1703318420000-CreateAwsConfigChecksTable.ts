import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAwsConfigChecksTable1703318420000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'aws_config_checks',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'check_type',
            type: 'enum',
            enum: ['vpc', 'ecr', 'ecs', 'full_sync'],
          },
          {
            name: 'service_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ok', 'warning', 'error', 'critical'],
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'details',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'auto_healed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'heal_action',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'checked_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
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
      'aws_config_checks',
      new TableIndex({
        name: 'IDX_AWS_CONFIG_CHECKS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'aws_config_checks',
      new TableIndex({
        name: 'IDX_AWS_CONFIG_CHECKS_CHECKED_AT',
        columnNames: ['checked_at'],
      }),
    );

    await queryRunner.createIndex(
      'aws_config_checks',
      new TableIndex({
        name: 'IDX_AWS_CONFIG_CHECKS_SERVICE',
        columnNames: ['service_name'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('aws_config_checks');
  }
}
