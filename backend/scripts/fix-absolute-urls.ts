import { DataSource } from 'typeorm';

/**
 * Migration script to convert absolute avatar URLs to relative URLs
 * 
 * Problem: Database has URLs like:
 *   "http://10.112.95.18:3000/api/assets/file/users/xxx/avatar.jpg"
 * 
 * Solution: Convert to relative URLs:
 *   "/api/assets/file/users/xxx/avatar.jpg"
 * 
 * This ensures images work regardless of which network IP is used (localhost, 10.x.x.x, 192.168.x.x, etc.)
 */

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'rangex_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'rangex',
});

async function fixAvatarUrls() {
  console.log('Connecting to database...');
  await dataSource.initialize();
  
  console.log('Fetching users with absolute avatar URLs...');
  const users = await dataSource.query(`
    SELECT id, email, avatarUrl 
    FROM user 
    WHERE avatarUrl LIKE 'http://%/api/assets/file/%'
       OR avatarUrl LIKE 'https://%/api/assets/file/%'
  `);
  
  console.log(`Found ${users.length} users with absolute avatar URLs`);
  
  let updated = 0;
  for (const user of users) {
    // Extract the relative part: /api/assets/file/...
    const match = user.avatarUrl.match(/(\/api\/assets\/file\/.+)/);
    if (match) {
      const relativeUrl = match[1];
      console.log(`Updating user ${user.email}:`);
      console.log(`  OLD: ${user.avatarUrl}`);
      console.log(`  NEW: ${relativeUrl}`);
      
      await dataSource.query(
        'UPDATE user SET avatarUrl = ? WHERE id = ?',
        [relativeUrl, user.id]
      );
      updated++;
    }
  }
  
  console.log(`\n✅ Updated ${updated} avatar URLs to relative format`);
  
  // Also fix scenario cover images
  console.log('\nFetching scenario versions with absolute cover image URLs...');
  const scenarios = await dataSource.query(`
    SELECT id, title, coverImageUrl 
    FROM scenario_version 
    WHERE coverImageUrl LIKE 'http://%/api/assets/file/%'
       OR coverImageUrl LIKE 'https://%/api/assets/file/%'
  `);
  
  console.log(`Found ${scenarios.length} scenarios with absolute cover image URLs`);
  
  let scenariosUpdated = 0;
  for (const scenario of scenarios) {
    const match = scenario.coverImageUrl.match(/(\/api\/assets\/file\/.+)/);
    if (match) {
      const relativeUrl = match[1];
      console.log(`Updating scenario ${scenario.title}:`);
      console.log(`  OLD: ${scenario.coverImageUrl}`);
      console.log(`  NEW: ${relativeUrl}`);
      
      await dataSource.query(
        'UPDATE scenario_version SET coverImageUrl = ? WHERE id = ?',
        [relativeUrl, scenario.id]
      );
      scenariosUpdated++;
    }
  }
  
  console.log(`\n✅ Updated ${scenariosUpdated} scenario cover image URLs to relative format`);
  
  // Fix team logos
  console.log('\nFetching teams with absolute logo URLs...');
  const teams = await dataSource.query(`
    SELECT id, name, avatarUrl 
    FROM team 
    WHERE avatarUrl LIKE 'http://%/api/assets/file/%'
       OR avatarUrl LIKE 'https://%/api/assets/file/%'
  `);
  
  console.log(`Found ${teams.length} teams with absolute logo URLs`);
  
  let teamsUpdated = 0;
  for (const team of teams) {
    const match = team.avatarUrl.match(/(\/api\/assets\/file\/.+)/);
    if (match) {
      const relativeUrl = match[1];
      console.log(`Updating team ${team.name}:`);
      console.log(`  OLD: ${team.avatarUrl}`);
      console.log(`  NEW: ${relativeUrl}`);
      
      await dataSource.query(
        'UPDATE team SET avatarUrl = ? WHERE id = ?',
        [relativeUrl, team.id]
      );
      teamsUpdated++;
    }
  }
  
  console.log(`\n✅ Updated ${teamsUpdated} team logo URLs to relative format`);
  
  console.log('\n🎉 Migration complete!');
  console.log(`Total updates: ${updated + scenariosUpdated + teamsUpdated}`);
  
  await dataSource.destroy();
}

fixAvatarUrls()
  .then(() => {
    console.log('\n✅ Success! All URLs are now relative and network-independent.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
