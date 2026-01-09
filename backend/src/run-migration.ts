/**
 * Database Migration Script
 * Adds fields for two-type asset system and Docker integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const runMigration = async () => {
  console.log('🔧 Starting database migration...\n');

  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME || 'rangex_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'rangex',
    multipleStatements: true,
  });

  console.log('✅ Connected to database:', process.env.DB_DATABASE);

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-asset-system-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('\n📝 Executing migration...\n');
    const [results] = await connection.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');

    // Verify new columns
    console.log('🔍 Verifying new columns...\n');
    const [columns] = await connection.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME, 
        COLUMN_TYPE, 
        IS_NULLABLE, 
        COLUMN_DEFAULT,
        COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('scenario_version', 'scenario_asset')
        AND COLUMN_NAME IN (
          'dockerComposePath', 
          'ecrImagesPushed', 
          'embeddedAssetsDeleted', 
          'fargateTaskDefinition',
          'assetLocation',
          'minioPath',
          'deletedFromMinio'
        )
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    console.log('New columns added:');
    console.table(columns);

    console.log('\n✅ Migration verification complete!');
    console.log('\n📊 Summary:');
    console.log('   - scenario_version: +4 fields (dockerComposePath, ecrImagesPushed, embeddedAssetsDeleted, fargateTaskDefinition)');
    console.log('   - scenario_asset: +3 fields (assetLocation, minioPath, deletedFromMinio)');
    console.log('   - Indexes created for performance optimization');
    console.log('\n🎉 Database is ready for the new asset system!\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigration()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
