import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddEventRegistration1733610002000 implements MigrationInterface {
  name = 'AddEventRegistration1733610002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('event_registration');
    if (tableExists) {
      console.log('Table event_registration already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'event_registration',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'eventId', type: 'varchar', length: '255' },
          { name: 'userId', type: 'varchar', length: '255' },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'event_registration',
      new TableIndex({ name: 'idx_event_user_unique', columnNames: ['eventId', 'userId'], isUnique: true }),
    );

    await queryRunner.createForeignKey(
      'event_registration',
      new TableForeignKey({
        columnNames: ['eventId'],
        referencedTableName: 'event',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'event_registration',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('event_registration');
  }
}
