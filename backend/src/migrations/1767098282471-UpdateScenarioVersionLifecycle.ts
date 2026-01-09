import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateScenarioVersionLifecycle1767098282471 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns already exist before adding them
        const table = await queryRunner.getTable('scenario_version');
        if (!table) {
            throw new Error('scenario_version table not found');
        }

        const existingColumns = table.columns.map(col => col.name);
        const columnsToAdd: Array<{ name: string; definition: string }> = [
            { name: 'runtimeManifest', definition: "ADD COLUMN runtimeManifest JSON NULL COMMENT 'AWS runtime manifest'" },
            { name: 'buildLogs', definition: "ADD COLUMN buildLogs TEXT NULL COMMENT 'ECR build pipeline logs'" },
            { name: 'publishedAt', definition: "ADD COLUMN publishedAt DATETIME NULL COMMENT 'When marked PUBLISHED'" }
        ];

        const newColumns = columnsToAdd.filter(col => !existingColumns.includes(col.name));

        if (newColumns.length > 0) {
            const alterStatements = newColumns.map(col => col.definition).join(',\n            ');
            await queryRunner.query(`
                ALTER TABLE scenario_version 
                ${alterStatements}
            `);
        }

        // Update existing status values to new enum format (case-insensitive update)
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'DRAFT' WHERE LOWER(status) = 'draft'
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'SUBMITTED' WHERE LOWER(status) IN ('submitted', 'pending approval')
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'APPROVED' WHERE LOWER(status) = 'approved'
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'ARCHIVED' WHERE LOWER(status) = 'archived'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('scenario_version');
        if (!table) {
            return;
        }

        const existingColumns = table.columns.map(col => col.name);
        const columnsToRemove = ['runtimeManifest', 'buildLogs', 'publishedAt'];
        const columnsToDelete = columnsToRemove.filter(col => existingColumns.includes(col));

        if (columnsToDelete.length > 0) {
            const dropStatements = columnsToDelete.map(col => `DROP COLUMN ${col}`).join(',\n            ');
            await queryRunner.query(`
                ALTER TABLE scenario_version 
                ${dropStatements}
            `);
        }

        // Revert status values
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'draft' WHERE status = 'DRAFT'
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'submitted' WHERE status = 'SUBMITTED'
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'approved' WHERE status = 'APPROVED'
        `);
        await queryRunner.query(`
            UPDATE scenario_version SET status = 'archived' WHERE status = 'ARCHIVED'
        `);
    }
}
