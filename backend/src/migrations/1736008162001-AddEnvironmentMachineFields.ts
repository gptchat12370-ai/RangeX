import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnvironmentMachineFields1736008162001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('environment_machine');
    
    if (!table) {
      throw new Error('environment_machine table not found');
    }

    // Add machineId field if it doesn't exist
    if (!table.findColumnByName('machineId')) {
      await queryRunner.addColumn(
        'environment_machine',
        new TableColumn({
          name: 'machineId',
          type: 'varchar',
          length: '36',
          isNullable: true, // Make nullable initially for existing data
        })
      );
    }

    // Add status field if it doesn't exist
    if (!table.findColumnByName('status')) {
      await queryRunner.addColumn(
        'environment_machine',
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '24',
          default: "'starting'",
        })
      );
    }

    // Make taskArn nullable
    const taskArnColumn = table.findColumnByName('taskArn');
    if (taskArnColumn && !taskArnColumn.isNullable) {
      await queryRunner.changeColumn(
        'environment_machine',
        'taskArn',
        new TableColumn({
          name: 'taskArn',
          type: 'varchar',
          length: '200',
          isNullable: true,
        })
      );
    }

    // Make machineTemplateId nullable (backward compatibility)
    const machineTemplateIdColumn = table.findColumnByName('machineTemplateId');
    if (machineTemplateIdColumn && !machineTemplateIdColumn.isNullable) {
      await queryRunner.changeColumn(
        'environment_machine',
        'machineTemplateId',
        new TableColumn({
          name: 'machineTemplateId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('environment_machine', 'machineId');
    await queryRunner.dropColumn('environment_machine', 'status');
    
    // Revert taskArn to non-nullable
    await queryRunner.changeColumn(
      'environment_machine',
      'taskArn',
      new TableColumn({
        name: 'taskArn',
        type: 'varchar',
        length: '200',
        isNullable: false,
      })
    );

    // Revert machineTemplateId to non-nullable
    await queryRunner.changeColumn(
      'environment_machine',
      'machineTemplateId',
      new TableColumn({
        name: 'machineTemplateId',
        type: 'varchar',
        length: '36',
        isNullable: false,
      })
    );
  }
}
