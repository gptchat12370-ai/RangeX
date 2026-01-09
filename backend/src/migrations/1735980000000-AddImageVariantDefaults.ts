import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageVariantDefaults1735980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add defaultAllowSolverEntry - determines if machines from this variant allow external solver access
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'defaultAllowSolverEntry',
        type: 'boolean',
        default: false,
        isNullable: true,
      }),
    );

    // Add defaultNetworkGroup - default network isolation group for this variant
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'defaultNetworkGroup',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Default network group: attacker, dmz, internal, mgmt, isolated',
      }),
    );

    // Add defaultNetworkEgressPolicy - controls outbound connectivity
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'defaultNetworkEgressPolicy',
        type: 'enum',
        enum: ['none', 'session-only', 'internet'],
        isNullable: true,
        comment: 'none=no outbound, session-only=only to other machines, internet=full egress',
      }),
    );

    // Add defaultHealthcheck - JSON defining health check configuration
    await queryRunner.addColumn(
      'image_variants',
      new TableColumn({
        name: 'defaultHealthcheck',
        type: 'json',
        isNullable: true,
        comment: 'Default ECS health check config: {command, interval, timeout, retries, startPeriod}',
      }),
    );

    // Update existing defaultEntrypoints to have proper comment
    await queryRunner.query(`
      ALTER TABLE image_variants 
      MODIFY COLUMN defaultEntrypoints JSON 
      COMMENT 'Default entrypoints auto-populated for machines: [{protocol, port, allowSolverAccess, description}]'
    `);

    // Create index for network group filtering
    await queryRunner.query(`CREATE INDEX idx_image_variant_network_group ON image_variants(defaultNetworkGroup)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_image_variant_network_group ON image_variants`);
    await queryRunner.dropColumn('image_variants', 'defaultHealthcheck');
    await queryRunner.dropColumn('image_variants', 'defaultNetworkEgressPolicy');
    await queryRunner.dropColumn('image_variants', 'defaultNetworkGroup');
    await queryRunner.dropColumn('image_variants', 'defaultAllowSolverEntry');
  }
}
