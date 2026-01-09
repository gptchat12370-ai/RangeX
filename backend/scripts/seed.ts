import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import {
  entities,
  User,
  SystemSetting,
  Scenario,
  ScenarioVersion,
  Machine,
  ScenarioLimit,
} from '../src/entities';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME || process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  entities: entities as unknown as any[],
  synchronize: true, // seed only; do not use in production CLI
  logging: false,
});

async function ensureSettings(repo: any) {
  const defaults: Record<string, string> = {
    max_active_users: '5',
    max_envs_per_user: '1',
    max_concurrent_envs_global: '5',
    env_default_duration_minutes: '90',
    soft_usage_limit_rm: '250',
    hard_usage_limit_rm: '300',
    fargate_vcpu_price_per_hour_rm: '0.25',
    fargate_memory_price_per_gb_hour_rm: '0.03',
    maintenance_mode: '0',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await repo.findOne({ where: { key } });
    if (!existing) {
      await repo.save(repo.create({ key, value }));
    }
  }
}

async function ensureAdmin(repo: any, email: string, password: string) {
  let user = await repo.findOne({ where: { email } });
  if (!user) {
    const passwordHash = await argon2.hash(password);
    user = repo.create({
      email,
      passwordHash,
      displayName: 'Admin',
      isActive: true,
      roleSolver: true,
      roleCreator: true,
      roleAdmin: true,
    } as Partial<User>);
    await repo.save(user);
    console.log(`Created admin user ${email}`);
  } else {
    console.log(`Admin user ${email} already exists`);
  }
  return user;
}

async function main() {
  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);
  const settingsRepo = dataSource.getRepository(SystemSetting);

  await ensureSettings(settingsRepo);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@rangex.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'E5YX05@dm1nR@n53X';

  const admin = await ensureAdmin(userRepo, adminEmail, adminPassword);
  // No demo scenarios; only seed admin and system settings.

  await dataSource.destroy();
  console.log('Seeding complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
