import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddPerMachineSecurityGroups1767609600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('machine_security_groups');
    if (tableExists) {
      console.log('Table machine_security_groups already exists, skipping creation');
      return;
    }

    // Create machine_security_groups table
    await queryRunner.createTable(
      new Table({
        name: 'machine_security_groups',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'machineId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'machineName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'networkGroup',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'securityGroupId',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'AWS security group ID (sg-xxxxx)',
          },
          {
            name: 'securityGroupName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'allowedIngressSources',
            type: 'json',
            isNullable: true,
            comment: 'List of allowed source machine IDs or CIDR blocks',
          },
          {
            name: 'allowedEgressTargets',
            type: 'json',
            isNullable: true,
            comment: 'List of allowed destination machine IDs or CIDR blocks',
          },
          {
            name: 'exposedPorts',
            type: 'json',
            isNullable: true,
            comment: 'List of ports exposed to solver via gateway proxy',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['creating', 'active', 'deleting', 'deleted', 'failed'],
            default: "'creating'",
          },
          {
            name: 'awsMetadata',
            type: 'json',
            isNullable: true,
            comment: 'AWS-specific metadata (VPC ID, rules, etc)',
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
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'machine_security_groups',
      new TableIndex({
        name: 'idx_machine_sg_session',
        columnNames: ['sessionId'],
      }),
    );

    await queryRunner.createIndex(
      'machine_security_groups',
      new TableIndex({
        name: 'idx_machine_sg_machine',
        columnNames: ['machineId'],
      }),
    );

    await queryRunner.createIndex(
      'machine_security_groups',
      new TableIndex({
        name: 'idx_machine_sg_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'machine_security_groups',
      new TableIndex({
        name: 'idx_machine_sg_aws_id',
        columnNames: ['securityGroupId'],
      }),
    );

    // Add foreign key to environment_sessions
    await queryRunner.createForeignKey(
      'machine_security_groups',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'environment_session',
        onDelete: 'CASCADE',
      }),
    );

    console.log('✅ Created machine_security_groups table with indexes and foreign keys');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('machine_security_groups');
    if (!tableExists) {
      return;
    }

    await queryRunner.dropTable('machine_security_groups', true);
    console.log('✅ Dropped machine_security_groups table');
  }
}
