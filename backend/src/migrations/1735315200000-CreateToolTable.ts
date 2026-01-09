import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateToolTable1735315200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tool',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'version',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'installCommand',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'iconUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'packageName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'packageManager',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'usageCount',
            type: 'int',
            default: 0,
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

    // Add index on name for faster lookups
    await queryRunner.query(`CREATE INDEX idx_tool_name ON tool(name)`);
    
    // Add index on category
    await queryRunner.query(`CREATE INDEX idx_tool_category ON tool(category)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tool');
  }
}
