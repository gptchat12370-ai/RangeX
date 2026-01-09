import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import {
  entities,
  Scenario,
  ScenarioVersion,
  EnvironmentSession,
  EnvironmentMachine,
  Playlist,
  CareerPath,
  CareerPathItem,
  PlaylistItem,
  Team,
  TeamMember,
  UsageDaily,
  AuditLog,
  Asset,
} from '../src/entities';

// Utility script to wipe demo data (intro lab, playlists, career paths, teams, sessions, assets, usage, audit logs)
// Safe to run in local/dev only.

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: entities as unknown as any[],
    synchronize: false,
  });
  await ds.initialize();
  await ds.query('SET FOREIGN_KEY_CHECKS=0');

  const scenarioRepo = ds.getRepository(Scenario);
  const versionRepo = ds.getRepository(ScenarioVersion);
  const sessionRepo = ds.getRepository(EnvironmentSession);
  const machineRepo = ds.getRepository(EnvironmentMachine);
  const playlistRepo = ds.getRepository(Playlist);
  const playlistItemRepo = ds.getRepository(PlaylistItem);
  const careerRepo = ds.getRepository(CareerPath);
  const careerItemRepo = ds.getRepository(CareerPathItem);
  const teamRepo = ds.getRepository(Team);
  const teamMemberRepo = ds.getRepository(TeamMember);
  const usageRepo = ds.getRepository(UsageDaily);
  const auditRepo = ds.getRepository(AuditLog);
  const assetRepo = ds.getRepository(Asset);

  // Delete sessions and machines
  await machineRepo.createQueryBuilder().delete().where('1=1').execute();
  await sessionRepo.createQueryBuilder().delete().where('1=1').execute();

  // Delete versions/scenarios (including intro-lab)
  await versionRepo.createQueryBuilder().delete().where('1=1').execute();
  await scenarioRepo.createQueryBuilder().delete().where('1=1').execute();

  // Playlists & career paths
  await playlistItemRepo.createQueryBuilder().delete().where('1=1').execute();
  await playlistRepo.createQueryBuilder().delete().where('1=1').execute();
  await careerItemRepo.createQueryBuilder().delete().where('1=1').execute();
  await careerRepo.createQueryBuilder().delete().where('1=1').execute();

  // Teams
  await teamMemberRepo.createQueryBuilder().delete().where('1=1').execute();
  await teamRepo.createQueryBuilder().delete().where('1=1').execute();

  // Usage and audit logs
  await usageRepo.createQueryBuilder().delete().where('1=1').execute();
  await auditRepo.createQueryBuilder().delete().where('1=1').execute();

  // Assets metadata (note: does not remove files on disk)
  await assetRepo.createQueryBuilder().delete().where('1=1').execute();

  console.log('Cleanup complete (scenarios, versions, sessions, playlists, career paths, teams, usage, audit, assets).');
  await ds.query('SET FOREIGN_KEY_CHECKS=1');
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
