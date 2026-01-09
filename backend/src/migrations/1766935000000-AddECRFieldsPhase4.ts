import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddECRFieldsPhase41766935000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add ECR promotion fields to machine table
    await queryRunner.addColumn(
      'machine',
      new TableColumn({
        name: 'ecrUri',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'machine',
      new TableColumn({
        name: 'ecrDigest',
        type: 'varchar',
        length: '71',
        isNullable: true,
        comment: 'SHA256 digest from ECR (sha256:...)',
      }),
    );

    await queryRunner.addColumn(
      'machine',
      new TableColumn({
        name: 'taskDefinitionArn',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'ECS task definition ARN',
      }),
    );

    // Add promotedAt field to scenario_version table
    await queryRunner.addColumn(
      'scenario_version',
      new TableColumn({
        name: 'promotedAt',
        type: 'datetime',
        isNullable: true,
        comment: 'Timestamp when images were promoted to ECR',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration
    await queryRunner.dropColumn('machine', 'ecrUri');
    await queryRunner.dropColumn('machine', 'ecrDigest');
    await queryRunner.dropColumn('machine', 'taskDefinitionArn');
    await queryRunner.dropColumn('scenario_version', 'promotedAt');
  }
}
