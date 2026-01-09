import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionIdToSessionSecurityGroup1736065000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if sessionId column exists
    const table = await queryRunner.getTable('session_security_groups');
    const sessionIdColumn = table?.findColumnByName('sessionId');

    if (!sessionIdColumn) {
      await queryRunner.query(`
        ALTER TABLE \`session_security_groups\` 
        ADD \`sessionId\` varchar(36) NOT NULL AFTER \`id\`
      `);
      console.log('✅ Added sessionId column to session_security_groups table');
    } else {
      console.log('⚠️ sessionId column already exists in session_security_groups table');
    }

    // Add foreign key constraint if it doesn't exist
    const foreignKeys = table?.foreignKeys || [];
    const fkExists = foreignKeys.some(fk => fk.columnNames.includes('sessionId'));

    if (!fkExists && !sessionIdColumn) {
      await queryRunner.query(`
        ALTER TABLE \`session_security_groups\`
        ADD CONSTRAINT \`FK_session_security_groups_session\`
        FOREIGN KEY (\`sessionId\`) REFERENCES \`environment_sessions\`(\`id\`) ON DELETE CASCADE
      `);
      console.log('✅ Added foreign key constraint for sessionId');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    const table = await queryRunner.getTable('session_security_groups');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.includes('sessionId'));
    
    if (foreignKey) {
      await queryRunner.dropForeignKey('session_security_groups', foreignKey);
    }

    // Drop column
    await queryRunner.query(`
      ALTER TABLE \`session_security_groups\` DROP COLUMN \`sessionId\`
    `);
  }
}
