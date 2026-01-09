import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { User } from '../src/entities';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User],
  synchronize: false,
});

async function main() {
  await dataSource.initialize();
  console.log('✅ Connected to database\n');
  
  const userRepo = dataSource.getRepository(User);
  
  // Get all users
  const users = await userRepo.find();
  console.log(`📊 Total users: ${users.length}\n`);
  
  for (const user of users) {
    console.log(`User: ${user.email}`);
    console.log(`  - Display Name: ${user.displayName}`);
    console.log(`  - Active: ${user.isActive}`);
    console.log(`  - Solver: ${user.roleSolver}`);
    console.log(`  - Creator: ${user.roleCreator}`);
    console.log(`  - Admin: ${user.roleAdmin}`);
    console.log('');
  }
  
  await dataSource.destroy();
}

main().catch(console.error);
