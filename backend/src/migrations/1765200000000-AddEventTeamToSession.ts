import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventTeamToSession1765200000000 implements MigrationInterface {
  name = 'AddEventTeamToSession1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add eventId column to environment_session table
    await queryRunner.query(`
      ALTER TABLE \`environment_session\` 
      ADD COLUMN \`eventId\` varchar(36) NULL
    `);

    // Add teamId column to environment_session table
    await queryRunner.query(`
      ALTER TABLE \`environment_session\` 
      ADD COLUMN \`teamId\` varchar(36) NULL
    `);

    // Update event table format column to use proper type
    await queryRunner.query(`
      ALTER TABLE \`event\` 
      MODIFY COLUMN \`format\` varchar(24) NOT NULL DEFAULT 'Player vs Player'
    `);

    // Add participatingTeamIds column to event table for team events
    await queryRunner.query(`
      ALTER TABLE \`event\` 
      ADD COLUMN \`participatingTeamIds\` text NULL
    `);

    // Add indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX \`IDX_environment_session_eventId\` 
      ON \`environment_session\` (\`eventId\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_environment_session_teamId\` 
      ON \`environment_session\` (\`teamId\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_environment_session_userId_eventId\` 
      ON \`environment_session\` (\`userId\`, \`eventId\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX \`IDX_environment_session_userId_eventId\` 
      ON \`environment_session\`
    `);

    await queryRunner.query(`
      DROP INDEX \`IDX_environment_session_teamId\` 
      ON \`environment_session\`
    `);

    await queryRunner.query(`
      DROP INDEX \`IDX_environment_session_eventId\` 
      ON \`environment_session\`
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE \`event\` 
      DROP COLUMN \`participatingTeamIds\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`event\` 
      MODIFY COLUMN \`format\` varchar(120) NOT NULL DEFAULT 'standard'
    `);

    await queryRunner.query(`
      ALTER TABLE \`environment_session\` 
      DROP COLUMN \`teamId\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`environment_session\` 
      DROP COLUMN \`eventId\`
    `);
  }
}
