import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTestDeploymentTable1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS test_deployment (
        id VARCHAR(36) PRIMARY KEY,
        scenarioVersionId VARCHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        progress JSON NULL,
        ecsTaskArns JSON NULL,
        networkInterfaces JSON NULL,
        estimatedCostPerHour DECIMAL(10, 4) NULL,
        startedAt DATETIME NULL,
        completedAt DATETIME NULL,
        cleanedAt DATETIME NULL,
        errorMessage TEXT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_test_deployment_version 
          FOREIGN KEY (scenarioVersionId) REFERENCES scenario_version(id) ON DELETE CASCADE,
        INDEX idx_version (scenarioVersionId),
        INDEX idx_status (status),
        INDEX idx_created (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS test_deployment;`);
  }
}
