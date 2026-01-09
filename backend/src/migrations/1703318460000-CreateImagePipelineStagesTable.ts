import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateImagePipelineStagesTable1703318460000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'image_pipeline_stages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'image_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'image_tag',
            type: 'varchar',
            length: '128',
          },
          {
            name: 'scenario_id',
            type: 'int',
          },
          {
            name: 'scenario_version_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'creator_user_id',
            type: 'int',
          },
          {
            name: 'current_stage',
            type: 'enum',
            enum: ['local', 'staging', 'review', 'approved', 'production'],
            default: "'local'",
          },
          {
            name: 'local_built_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'staging_uploaded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'staging_minio_path',
            type: 'varchar',
            length: '512',
            isNullable: true,
          },
          {
            name: 'review_started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'review_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'reviewer_user_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'review_comments',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'approver_user_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'production_deployed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'ecr_repository',
            type: 'varchar',
            length: '512',
            isNullable: true,
          },
          {
            name: 'ecr_image_digest',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'security_scan_results',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'auto_promote_eligible',
            type: 'boolean',
            default: false,
          },
          {
            name: 'auto_promoted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in_progress', 'completed', 'rejected', 'error'],
            default: "'pending'",
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
      'image_pipeline_stages',
      new TableIndex({
        name: 'IDX_IMAGE_PIPELINE_SCENARIO',
        columnNames: ['scenario_id'],
      }),
    );

    await queryRunner.createIndex(
      'image_pipeline_stages',
      new TableIndex({
        name: 'IDX_IMAGE_PIPELINE_CREATOR',
        columnNames: ['creator_user_id'],
      }),
    );

    await queryRunner.createIndex(
      'image_pipeline_stages',
      new TableIndex({
        name: 'IDX_IMAGE_PIPELINE_STAGE',
        columnNames: ['current_stage'],
      }),
    );

    await queryRunner.createIndex(
      'image_pipeline_stages',
      new TableIndex({
        name: 'IDX_IMAGE_PIPELINE_STATUS',
        columnNames: ['status'],
      }),
    );

    // Composite index for image lookup
    await queryRunner.createIndex(
      'image_pipeline_stages',
      new TableIndex({
        name: 'IDX_IMAGE_PIPELINE_NAME_TAG',
        columnNames: ['image_name', 'image_tag'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('image_pipeline_stages');
  }
}
