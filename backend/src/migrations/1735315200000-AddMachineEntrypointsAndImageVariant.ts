import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMachineEntrypointsAndImageVariant1735315200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if imageVariantId already exists
    const table = await queryRunner.getTable('machine');
    const imageVariantIdColumn = table?.findColumnByName('imageVariantId');
    
    if (!imageVariantIdColumn) {
      // Add imageVariantId column for platform library image tracking
      await queryRunner.addColumn(
        'machine',
        new TableColumn({
          name: 'imageVariantId',
          type: 'char',
          length: '36',
          isNullable: true,
          comment: 'Reference to platform library image variant',
        })
      );
    }

    const entrypointsColumn = table?.findColumnByName('entrypoints');
    if (!entrypointsColumn) {
      // Add entrypoints JSON column for structured port/access management
      await queryRunner.addColumn(
        'machine',
        new TableColumn({
          name: 'entrypoints',
          type: 'json',
          isNullable: true,
          comment: 'Array of entrypoints defining how solvers access this machine (protocol, containerPort, exposedToSolver, description)',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('machine', 'entrypoints');
    await queryRunner.dropColumn('machine', 'imageVariantId');
  }
}
