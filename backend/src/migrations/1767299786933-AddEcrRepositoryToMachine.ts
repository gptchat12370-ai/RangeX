import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEcrRepositoryToMachine1767299786933 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('machine');
        if (!table) {
            throw new Error('Machine table not found');
        }

        const columnExists = table.columns.some(col => col.name === 'ecrRepository');
        if (!columnExists) {
            await queryRunner.addColumn(
                'machine',
                new TableColumn({
                    name: 'ecrRepository',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                    comment: 'ECR repository name with tag (e.g., rangex/web-dvwa:scenario-abc123)',
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('machine');
        if (!table) {
            return;
        }

        const columnExists = table.columns.some(col => col.name === 'ecrRepository');
        if (columnExists) {
            await queryRunner.dropColumn('machine', 'ecrRepository');
        }
    }

}
