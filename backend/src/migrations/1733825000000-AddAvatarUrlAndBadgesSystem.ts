import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAvatarUrlAndBadgesSystem1733825000000 implements MigrationInterface {
    name = 'AddAvatarUrlAndBadgesSystem1733825000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add avatarUrl to team table if not exists
        const hasAvatarUrl = await queryRunner.hasColumn('team', 'avatarUrl');
        if (!hasAvatarUrl) {
            await queryRunner.query(`
                ALTER TABLE team 
                ADD COLUMN avatarUrl VARCHAR(500) NULL
            `);
        }

        // Create badge table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS badge (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT NULL,
                iconUrl VARCHAR(500) NULL,
                badgeType ENUM('user', 'team') NOT NULL DEFAULT 'user',
                createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            )
        `);

        // Create badge_requirement table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS badge_requirement (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                badgeId VARCHAR(36) NOT NULL,
                requirementType ENUM('challenges_completed', 'points_earned', 'streak_days', 'team_rank', 'scenarios_created') NOT NULL,
                requiredValue INT NOT NULL,
                FOREIGN KEY (badgeId) REFERENCES badge(id) ON DELETE CASCADE,
                INDEX IDX_badge_requirement_badgeId (badgeId)
            )
        `);

        // Create user_badge table (earned badges by users)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS user_badge (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                userId VARCHAR(36) NOT NULL,
                badgeId VARCHAR(36) NOT NULL,
                earnedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
                FOREIGN KEY (badgeId) REFERENCES badge(id) ON DELETE CASCADE,
                UNIQUE KEY UK_user_badge (userId, badgeId),
                INDEX IDX_user_badge_userId (userId),
                INDEX IDX_user_badge_badgeId (badgeId)
            )
        `);

        // Create team_badge table (earned badges by teams)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS team_badge (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                teamId VARCHAR(36) NOT NULL,
                badgeId VARCHAR(36) NOT NULL,
                earnedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                FOREIGN KEY (teamId) REFERENCES team(id) ON DELETE CASCADE,
                FOREIGN KEY (badgeId) REFERENCES badge(id) ON DELETE CASCADE,
                UNIQUE KEY UK_team_badge (teamId, badgeId),
                INDEX IDX_team_badge_teamId (teamId),
                INDEX IDX_team_badge_badgeId (badgeId)
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS team_badge`);
        await queryRunner.query(`DROP TABLE IF EXISTS user_badge`);
        await queryRunner.query(`DROP TABLE IF EXISTS badge_requirement`);
        await queryRunner.query(`DROP TABLE IF EXISTS badge`);
        await queryRunner.query(`ALTER TABLE team DROP COLUMN IF EXISTS avatarUrl`);
    }
}
