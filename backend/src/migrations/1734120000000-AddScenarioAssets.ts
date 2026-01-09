import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddScenarioAssets1734120000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to scenario_version
    const hasCoverImageUrl = await queryRunner.hasColumn('scenario_version', 'coverImageUrl');
    if (!hasCoverImageUrl) {
      await queryRunner.addColumn('scenario_version', new TableColumn({
        name: 'coverImageUrl',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }));
    }

    const hasTags = await queryRunner.hasColumn('scenario_version', 'tags');
    if (!hasTags) {
      await queryRunner.addColumn('scenario_version', new TableColumn({
        name: 'tags',
        type: 'json',
        isNullable: true,
      }));
    }

    // Add columns to docker_image
    const dockerImageTableExists = await queryRunner.hasTable('docker_image');
    if (dockerImageTableExists) {
      const hasEcrUrl = await queryRunner.hasColumn('docker_image', 'ecrUrl');
      if (!hasEcrUrl) {
        await queryRunner.addColumn('docker_image', new TableColumn({
          name: 'ecrUrl',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }));
      }

      const hasIsCustom = await queryRunner.hasColumn('docker_image', 'isCustom');
      if (!hasIsCustom) {
        await queryRunner.addColumn('docker_image', new TableColumn({
          name: 'isCustom',
          type: 'boolean',
          default: false,
        }));
      }

      const hasCreatorId = await queryRunner.hasColumn('docker_image', 'creatorId');
      if (!hasCreatorId) {
        await queryRunner.addColumn('docker_image', new TableColumn({
          name: 'creatorId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        }));
      }
    }

    // Add columns to question
    const questionTableExists = await queryRunner.hasTable('question');
    if (questionTableExists) {
      const hasCaseSensitive = await queryRunner.hasColumn('question', 'caseSensitive');
      if (!hasCaseSensitive) {
        await queryRunner.addColumn('question', new TableColumn({
          name: 'caseSensitive',
          type: 'boolean',
          default: false,
        }));
      }

      const hasAcceptableAnswers = await queryRunner.hasColumn('question', 'acceptableAnswers');
      if (!hasAcceptableAnswers) {
        await queryRunner.addColumn('question', new TableColumn({
          name: 'acceptableAnswers',
          type: 'json',
          isNullable: true,
        }));
      }
    }

    // Create scenario_asset table if it doesn't exist
    const scenarioAssetExists = await queryRunner.hasTable('scenario_asset');
    if (!scenarioAssetExists) {
      await queryRunner.createTable(
        new Table({
          name: 'scenario_asset',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'scenarioVersionId',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'assetType',
              type: 'enum',
              enum: ['tool', 'script', 'file', 'wordlist'],
              isNullable: false,
            },
            {
              name: 'fileName',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'fileUrl',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'fileSize',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'uploadedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      // Add foreign key
      await queryRunner.createForeignKey(
        'scenario_asset',
        new TableForeignKey({
          columnNames: ['scenarioVersionId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'scenario_version',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop scenario_asset table
    await queryRunner.dropTable('scenario_asset', true);

    // Drop columns from scenario_version
    await queryRunner.dropColumn('scenario_version', 'coverImageUrl');
    await queryRunner.dropColumn('scenario_version', 'tags');

    // Drop columns from docker_image
    const dockerImageTableExists = await queryRunner.hasTable('docker_image');
    if (dockerImageTableExists) {
      await queryRunner.dropColumn('docker_image', 'ecrUrl');
      await queryRunner.dropColumn('docker_image', 'isCustom');
      await queryRunner.dropColumn('docker_image', 'creatorId');
    }

    // Drop columns from question
    const questionTableExists = await queryRunner.hasTable('question');
    if (questionTableExists) {
      await queryRunner.dropColumn('question', 'caseSensitive');
      await queryRunner.dropColumn('question', 'acceptableAnswers');
    }
  }
}
