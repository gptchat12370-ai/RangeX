import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateDeploymentTracking1735701000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create deployment_environment table for tracking AWS ephemeral deployments
    await queryRunner.createTable(
      new Table({
        name: 'deployment_environment',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'scenarioVersionId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'deploymentName',
            type: 'varchar',
            length: '128',
            isNullable: false,
            comment: 'Human-readable deployment name',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'DEPLOYING'",
            comment: 'DEPLOYING, DEPLOYED, PARKED, FAILED, FULL_TEARDOWN',
          },
          {
            name: 'gatewayEndpoint',
            type: 'varchar',
            length: '256',
            isNullable: true,
            comment: 'Gateway proxy public endpoint (changes on unpark)',
          },
          {
            name: 'ecrRepositoryPrefix',
            type: 'varchar',
            length: '256',
            isNullable: true,
            comment: 'ECR repository prefix for this deployment',
          },
          {
            name: 'gatewayTaskArn',
            type: 'text',
            isNullable: true,
            comment: 'ECS task ARN for gateway proxy',
          },
          {
            name: 'machineTaskArns',
            type: 'json',
            isNullable: true,
            comment: 'JSON array of machine task ARNs',
          },
          {
            name: 'entrypointsConfig',
            type: 'json',
            isNullable: true,
            comment: 'Entrypoints connection strings (stable across park/unpark)',
          },
          {
            name: 'vpcEndpointIds',
            type: 'json',
            isNullable: true,
            comment: 'VPC endpoint IDs created for this deployment (deleted on park)',
          },
          {
            name: 'infraStackName',
            type: 'varchar',
            length: '128',
            isNullable: true,
            comment: 'CloudFormation/Terraform stack name (if FULL_TEARDOWN mode)',
          },
          {
            name: 'deployedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'parkedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
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

    // Add foreign key to scenario_version
    await queryRunner.createForeignKey(
      'deployment_environment',
      new TableForeignKey({
        columnNames: ['scenarioVersionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'scenario_version',
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes for quick lookups
    await queryRunner.query(`
      CREATE INDEX idx_deployment_version ON deployment_environment(scenarioVersionId)
    `);
    
    await queryRunner.query(`
      CREATE INDEX idx_deployment_status ON deployment_environment(status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('deployment_environment');
  }
}
