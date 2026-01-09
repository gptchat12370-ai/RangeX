import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddArtifactHashesToScenarioVersion1766931442744 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add artifactHashes column (JSON)
        await queryRunner.addColumn('scenario_version', new TableColumn({
            name: 'artifactHashes',
            type: 'json',
            isNullable: true,
        }));

        // Add submittedHash column (VARCHAR)
        await queryRunner.addColumn('scenario_version', new TableColumn({
            name: 'submittedHash',
            type: 'varchar',
            length: '64',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('scenario_version', 'submittedHash');
        await queryRunner.dropColumn('scenario_version', 'artifactHashes');
    }

}
