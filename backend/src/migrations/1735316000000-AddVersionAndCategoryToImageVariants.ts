import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVersionAndCategoryToImageVariants1735316000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add version column
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'version',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    // Add imageCategory column
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'imageCategory',
        type: 'varchar',
        length: '50',
        default: "'library'",
      }),
    );

    // Add index for faster filtering
    await queryRunner.query(`CREATE INDEX idx_image_variant_category ON image_variants(imageCategory)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_image_variant_category ON image_variants`);
    await queryRunner.dropColumn('image_variants', 'imageCategory');
    await queryRunner.dropColumn('image_variants', 'version');
  }
}
