const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
  });

  console.log('Connected to database');

  // Helper to check if column exists
  async function columnExists(table, column) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_DATABASE, table, column]
    );
    return rows[0].count > 0;
  }

  try {
    // Add Machine columns
    const machineColumns = [
      'envVars', 'command', 'entrypoint', 'dependsOn', 'healthcheck',
      'networkAliases', 'solverHints', 'attackerBootstrap', 'composeExtensions'
    ];
    
    for (const col of machineColumns) {
      if (!(await columnExists('machine', col))) {
        await connection.query(`ALTER TABLE machine ADD COLUMN ${col} JSON NULL`);
        console.log(`  ✓ Added machine.${col}`);
      } else {
        console.log(`  - machine.${col} already exists`);
      }
    }

    // Add ScenarioVersion columns
    if (!(await columnExists('scenario_version', 'runtimeManifest'))) {
      await connection.query(`ALTER TABLE scenario_version ADD COLUMN runtimeManifest JSON NULL`);
      console.log('  ✓ Added scenario_version.runtimeManifest');
    }
    
    if (!(await columnExists('scenario_version', 'buildLogs'))) {
      await connection.query(`ALTER TABLE scenario_version ADD COLUMN buildLogs TEXT NULL`);
      console.log('  ✓ Added scenario_version.buildLogs');
    }
    
    if (!(await columnExists('scenario_version', 'publishedAt'))) {
      await connection.query(`ALTER TABLE scenario_version ADD COLUMN publishedAt DATETIME NULL`);
      console.log('  ✓ Added scenario_version.publishedAt');
    }

    // Update status values
    await connection.query(`UPDATE scenario_version SET status = 'DRAFT' WHERE LOWER(status) = 'draft'`);
    await connection.query(`UPDATE scenario_version SET status = 'SUBMITTED' WHERE LOWER(status) IN ('pending_approval', 'pending approval')`);
    await connection.query(`UPDATE scenario_version SET status = 'APPROVED' WHERE LOWER(status) = 'approved'`);
    await connection.query(`UPDATE scenario_version SET status = 'ARCHIVED' WHERE LOWER(status) = 'archived'`);
    console.log('  ✓ Updated status values to uppercase');

    console.log('\n✅ Phase 2-3 migrations executed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigrations().catch(console.error);
