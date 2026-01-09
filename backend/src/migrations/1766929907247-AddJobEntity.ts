import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class AddJobEntity1766929907247 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'job',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'uuid',
                    },
                    {
                        name: 'type',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '50',
                        default: "'pending'",
                        isNullable: false,
                    },
                    {
                        name: 'payload',
                        type: 'json',
                        isNullable: false,
                    },
                    {
                        name: 'attempts',
                        type: 'int',
                        default: 0,
                        isNullable: false,
                    },
                    {
                        name: 'error',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'result',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'startedAt',
                        type: 'datetime',
                        isNullable: true,
                    },
                    {
                        name: 'completedAt',
                        type: 'datetime',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false,
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                        isNullable: false,
                    },
                ],
            }),
            true,
        );

        // Create indexes for performance
        await queryRunner.createIndex(
            'job',
            new TableIndex({
                name: 'IDX_job_status',
                columnNames: ['status'],
            }),
        );

        await queryRunner.createIndex(
            'job',
            new TableIndex({
                name: 'IDX_job_type',
                columnNames: ['type'],
            }),
        );

        await queryRunner.createIndex(
            'job',
            new TableIndex({
                name: 'IDX_job_status_type',
                columnNames: ['status', 'type'],
            }),
        );

        await queryRunner.createIndex(
            'job',
            new TableIndex({
                name: 'IDX_job_createdAt',
                columnNames: ['createdAt'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('job');
    }

}
