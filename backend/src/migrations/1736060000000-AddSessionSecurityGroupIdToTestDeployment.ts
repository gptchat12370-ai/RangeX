import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSessionSecurityGroupIdToTestDeployment1736060000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('test_deployment');
    
    if (table && !table.findColumnByName('sessionSecurityGroupId')) {
      await queryRunner.addColumn(
        'test_deployment',
        new TableColumn({
          name: 'sessionSecurityGroupId',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
      console.log('✅ Added sessionSecurityGroupId column to test_deployment table');
    } else {
      console.log('⏭️  sessionSecurityGroupId column already exists in test_deployment table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('test_deployment');
    
    if (table && table.findColumnByName('sessionSecurityGroupId')) {
      await queryRunner.dropColumn('test_deployment', 'sessionSecurityGroupId');
    }
  }
}
