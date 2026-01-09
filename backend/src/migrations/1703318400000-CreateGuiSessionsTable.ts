import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateGuiSessionsTable1703318400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'gui_sessions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'session_id',
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
            name: 'environment_session_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'os_type',
            type: 'enum',
            enum: ['windows', 'linux', 'macos'],
          },
          {
            name: 'gui_type',
            type: 'enum',
            enum: ['vnc', 'rdp', 'novnc'],
          },
          {
            name: 'connection_url',
            type: 'text',
          },
          {
            name: 'vnc_port',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'novnc_port',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'rdp_port',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'container_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['starting', 'running', 'stopped', 'error'],
            default: "'starting'",
          },
          {
            name: 'started_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'last_activity',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
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
      'gui_sessions',
      new TableIndex({
        name: 'IDX_GUI_SESSIONS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'gui_sessions',
      new TableIndex({
        name: 'IDX_GUI_SESSIONS_SCENARIO_ID',
        columnNames: ['scenario_id'],
      }),
    );

    await queryRunner.createIndex(
      'gui_sessions',
      new TableIndex({
        name: 'IDX_GUI_SESSIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'gui_sessions',
      new TableIndex({
        name: 'IDX_GUI_SESSIONS_STARTED_AT',
        columnNames: ['started_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('gui_sessions');
  }
}
