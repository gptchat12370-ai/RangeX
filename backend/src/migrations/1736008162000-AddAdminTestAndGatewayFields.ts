import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAdminTestAndGatewayFields1736008162000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check and add admin test tracking fields to scenario_version
    const scenarioVersionTable = await queryRunner.getTable('scenario_version');
    
    if (scenarioVersionTable && !scenarioVersionTable.findColumnByName('lastAdminTestId')) {
      await queryRunner.addColumn(
        'scenario_version',
        new TableColumn({
          name: 'lastAdminTestId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        })
      );
    }

    if (scenarioVersionTable && !scenarioVersionTable.findColumnByName('lastAdminTestStatus')) {
      await queryRunner.addColumn(
        'scenario_version',
        new TableColumn({
          name: 'lastAdminTestStatus',
          type: 'varchar',
          length: '24',
          default: "'none'",
        })
      );
    }

    if (scenarioVersionTable && !scenarioVersionTable.findColumnByName('publishingBlocked')) {
      await queryRunner.addColumn(
        'scenario_version',
        new TableColumn({
          name: 'publishingBlocked',
          type: 'boolean',
          default: false,
        })
      );
    }

    // Check and add gateway IP field to environment_session
    const sessionTable = await queryRunner.getTable('environment_session');
    
    if (sessionTable && !sessionTable.findColumnByName('gatewayIp')) {
      await queryRunner.addColumn(
        'environment_session',
        new TableColumn({
          name: 'gatewayIp',
          type: 'varchar',
          length: '45',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('scenario_version', 'lastAdminTestId');
    await queryRunner.dropColumn('scenario_version', 'lastAdminTestStatus');
    await queryRunner.dropColumn('scenario_version', 'publishingBlocked');
    await queryRunner.dropColumn('environment_session', 'gatewayIp');
  }
}
