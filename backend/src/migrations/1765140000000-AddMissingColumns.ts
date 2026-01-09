import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddMissingColumns1765140000000 implements MigrationInterface {
    name = 'AddMissingColumns1765140000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // helper to add column if missing
        const addCol = async (table: string, column: TableColumn) => {
            const has = await queryRunner.hasColumn(table, column.name);
            if (!has) {
                await queryRunner.addColumn(table, column);
            }
        };

        await addCol('scenario_version', new TableColumn({ name: 'submittedAt', type: 'datetime', isNullable: true }));
        await addCol('scenario_version', new TableColumn({ name: 'approvedAt', type: 'datetime', isNullable: true }));
        await addCol('scenario_version', new TableColumn({ name: 'approvedByUserId', type: 'varchar', length: '255', isNullable: true }));
        await addCol('scenario_version', new TableColumn({ name: 'rejectedAt', type: 'datetime', isNullable: true }));
        await addCol('scenario_version', new TableColumn({ name: 'rejectReason', type: 'text', isNullable: true }));
        await addCol('scenario_version', new TableColumn({ name: 'isFeatured', type: 'tinyint', default: 0, isNullable: false }));
        await addCol('scenario_version', new TableColumn({ name: 'isArchived', type: 'tinyint', default: 0, isNullable: false }));

        await addCol('environment_session', new TableColumn({ name: 'costAccumulatedRm', type: 'decimal', precision: 12, scale: 2, default: 0, isNullable: false }));
        await addCol('environment_session', new TableColumn({ name: 'softLimitWarned', type: 'tinyint', default: 0, isNullable: false }));

        await addCol('usage_daily', new TableColumn({ name: 'vcpuCostRm', type: 'decimal', precision: 12, scale: 2, default: 0, isNullable: false }));
        await addCol('usage_daily', new TableColumn({ name: 'memoryCostRm', type: 'decimal', precision: 12, scale: 2, default: 0, isNullable: false }));

        await addCol('user', new TableColumn({ name: 'avatarUrl', type: 'varchar', length: '255', isNullable: true }));
        await addCol('user', new TableColumn({ name: 'lastLoginAt', type: 'datetime', isNullable: true }));
        await addCol('user', new TableColumn({ name: 'lastIp', type: 'varchar', length: '64', isNullable: true }));
        await addCol('user', new TableColumn({ name: 'passwordUpdatedAt', type: 'datetime', isNullable: true }));

        await addCol('registry_credential', new TableColumn({ name: 'lastUsedAt', type: 'datetime', isNullable: true }));
        await addCol('registry_credential', new TableColumn({ name: 'lastTestedAt', type: 'datetime', isNullable: true }));
        await addCol('registry_credential', new TableColumn({ name: 'status', type: 'varchar', length: '32', default: `'unknown'`, isNullable: false }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const dropCol = async (table: string, columnName: string) => {
            const has = await queryRunner.hasColumn(table, columnName);
            if (has) {
                await queryRunner.dropColumn(table, columnName);
            }
        };

        await dropCol('registry_credential', 'status');
        await dropCol('registry_credential', 'lastTestedAt');
        await dropCol('registry_credential', 'lastUsedAt');

        await dropCol('user', 'passwordUpdatedAt');
        await dropCol('user', 'lastIp');
        await dropCol('user', 'lastLoginAt');
        await dropCol('user', 'avatarUrl');

        await dropCol('usage_daily', 'memoryCostRm');
        await dropCol('usage_daily', 'vcpuCostRm');

        await dropCol('environment_session', 'softLimitWarned');
        await dropCol('environment_session', 'costAccumulatedRm');

        await dropCol('scenario_version', 'isArchived');
        await dropCol('scenario_version', 'isFeatured');
        await dropCol('scenario_version', 'rejectReason');
        await dropCol('scenario_version', 'rejectedAt');
        await dropCol('scenario_version', 'approvedByUserId');
        await dropCol('scenario_version', 'approvedAt');
        await dropCol('scenario_version', 'submittedAt');
    }
}
