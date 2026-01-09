import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class ExtendTeams1765145000000 implements MigrationInterface {
    name = 'ExtendTeams1765145000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const addCol = async (table: string, column: TableColumn) => {
            const has = await queryRunner.hasColumn(table, column.name);
            if (!has) {
                await queryRunner.addColumn(table, column);
            }
        };
        await addCol('team', new TableColumn({ name: 'motto', type: 'varchar', length: '120', isNullable: true }));
        await addCol('team', new TableColumn({ name: 'country', type: 'varchar', length: '120', isNullable: true }));
        await addCol('team', new TableColumn({ name: 'ownerUserId', type: 'varchar', length: '36', isNullable: true }));
        await addCol('team', new TableColumn({ name: 'maxMembers', type: 'int', default: 10 }));
        await addCol('team', new TableColumn({ name: 'openTeam', type: 'tinyint', default: 0 }));
        await addCol('team', new TableColumn({ name: 'registrationsOpen', type: 'tinyint', default: 1 }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const dropCol = async (table: string, column: string) => {
            const has = await queryRunner.hasColumn(table, column);
            if (has) {
                await queryRunner.dropColumn(table, column);
            }
        };
        await dropCol('team', 'registrationsOpen');
        await dropCol('team', 'openTeam');
        await dropCol('team', 'maxMembers');
        await dropCol('team', 'ownerUserId');
        await dropCol('team', 'country');
        await dropCol('team', 'motto');
    }
}
