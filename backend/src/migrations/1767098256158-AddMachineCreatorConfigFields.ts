import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMachineCreatorConfigFields1767098256158 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns already exist before adding them
        const table = await queryRunner.getTable('machine');
        if (!table) {
            throw new Error('Machine table not found');
        }

        const columnsToAdd = [
            'envVars', 'command', 'entrypoint', 'dependsOn', 'healthcheck',
            'networkAliases', 'solverHints', 'attackerBootstrap', 'composeExtensions'
        ];

        const comments: Record<string, string> = {
            envVars: 'Additional environment variables',
            command: 'Container command override',
            entrypoint: 'Entrypoint override',
            dependsOn: 'Machine dependencies',
            healthcheck: 'Healthcheck configuration',
            networkAliases: 'Local compose network aliases',
            solverHints: 'Hints shown to solvers (creator-specified)',
            attackerBootstrap: 'Attacker bootstrap config (role=attacker only)',
            composeExtensions: 'Local-only compose extensions (allowlisted)'
        };

        const existingColumns = table.columns.map(col => col.name);
        const newColumns = columnsToAdd.filter(col => !existingColumns.includes(col));

        if (newColumns.length > 0) {
            const alterStatements = newColumns.map(col => {
                return `ADD COLUMN ${col} JSON NULL COMMENT '${comments[col]}'`;
            }).join(',\n            ');

            await queryRunner.query(`
                ALTER TABLE machine 
                ${alterStatements}
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('machine');
        if (!table) {
            return;
        }

        const columnsToRemove = [
            'envVars', 'command', 'entrypoint', 'dependsOn', 'healthcheck',
            'networkAliases', 'solverHints', 'attackerBootstrap', 'composeExtensions'
        ];

        const existingColumns = table.columns.map(col => col.name);
        const columnsToDelete = columnsToRemove.filter(col => existingColumns.includes(col));

        if (columnsToDelete.length > 0) {
            const dropStatements = columnsToDelete.map(col => `DROP COLUMN ${col}`).join(',\n            ');
            await queryRunner.query(`
                ALTER TABLE machine 
                ${dropStatements}
            `);
        }
    }

}
