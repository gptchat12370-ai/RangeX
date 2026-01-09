import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNetworkTopologyTables1735843200000 implements MigrationInterface {
    name = 'AddNetworkTopologyTables1735843200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add network_group column to machines
        await queryRunner.query(`
            ALTER TABLE machines 
            ADD COLUMN network_group VARCHAR(50) NULL 
            COMMENT 'Network group for security isolation (e.g., dmz, internal, attacker, mgmt)'
        `);

        // Add fargate_task_definition column to machines (for single-container task ARNs)
        await queryRunner.query(`
            ALTER TABLE machines 
            ADD COLUMN fargate_task_definition VARCHAR(255) NULL 
            COMMENT 'ARN of per-machine single-container task definition'
        `);

        // Add network_topology to scenario_versions
        await queryRunner.query(`
            ALTER TABLE scenario_versions 
            ADD COLUMN network_topology JSON NULL 
            COMMENT 'Network isolation configuration: groups, pivot rules, isolation mode'
        `);

        // Create session_network_topology table
        await queryRunner.query(`
            CREATE TABLE session_network_topology (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL,
                machine_name VARCHAR(100) NOT NULL,
                machine_role VARCHAR(50) NULL,
                network_group VARCHAR(50) NULL,
                task_arn VARCHAR(255) NOT NULL,
                private_ip VARCHAR(15) NOT NULL,
                subnet_id VARCHAR(50) NOT NULL,
                security_group_id VARCHAR(50) NOT NULL,
                network_interface_id VARCHAR(50) NULL,
                status ENUM('provisioning', 'running', 'stopped', 'terminated') DEFAULT 'provisioning',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES environment_session(id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_private_ip (private_ip),
                INDEX idx_task_arn (task_arn),
                INDEX idx_security_group_id (security_group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create session_security_groups table (track SGs for cleanup)
        await queryRunner.query(`
            CREATE TABLE session_security_groups (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL,
                network_group VARCHAR(50) NOT NULL,
                security_group_id VARCHAR(50) NOT NULL UNIQUE,
                security_group_name VARCHAR(255) NOT NULL,
                status ENUM('creating', 'active', 'deleting', 'deleted') DEFAULT 'creating',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME NULL,
                FOREIGN KEY (session_id) REFERENCES environment_session(id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_status (status),
                INDEX idx_security_group_id (security_group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create network_pivot_points table (for pivot point rules)
        await queryRunner.query(`
            CREATE TABLE network_pivot_points (
                id VARCHAR(36) PRIMARY KEY,
                scenario_version_id VARCHAR(36) NOT NULL,
                source_network_group VARCHAR(50) NOT NULL,
                target_network_group VARCHAR(50) NOT NULL,
                description TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scenario_version_id) REFERENCES scenario_versions(id) ON DELETE CASCADE,
                INDEX idx_scenario_version (scenario_version_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS network_pivot_points`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_security_groups`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_network_topology`);
        await queryRunner.query(`ALTER TABLE scenario_versions DROP COLUMN network_topology`);
        await queryRunner.query(`ALTER TABLE machines DROP COLUMN fargate_task_definition`);
        await queryRunner.query(`ALTER TABLE machines DROP COLUMN network_group`);
    }
}
