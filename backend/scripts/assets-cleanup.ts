import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Asset } from '../src/entities/asset.entity';
import { entities } from '../src/entities';
import * as fs from 'fs';
import * as path from 'path';

// Local-only cleanup: removes orphaned files in ./uploads and can prune DB rows for missing files.
// Run: node -r ts-node/register ./scripts/assets-cleanup.ts [--wipe] [--prune-db]

const uploadDir = path.join(process.cwd(), 'uploads');

async function main() {
  const wipe = process.argv.includes('--wipe');
  const pruneDb = process.argv.includes('--prune-db');
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
  const assetRepo = ds.getRepository(Asset);
  const dbAssets = await assetRepo.find();
  const dbKeys = new Set(dbAssets.map((a) => a.storageKey));

  if (!fs.existsSync(uploadDir)) {
    console.log('uploads dir does not exist, nothing to clean.');
    await ds.destroy();
    return;
  }

  const files = fs.readdirSync(uploadDir);
  let orphaned = 0;
  let missing = 0;
  for (const f of files) {
    if (!dbKeys.has(f)) {
      orphaned++;
      fs.unlinkSync(path.join(uploadDir, f));
    }
  }

  if (pruneDb) {
    const toDelete = dbAssets.filter((a) => !files.includes(a.storageKey));
    for (const asset of toDelete) {
      missing++;
      await assetRepo.delete(asset.id);
    }
  }

  if (wipe) {
    for (const f of fs.readdirSync(uploadDir)) {
      fs.unlinkSync(path.join(uploadDir, f));
    }
    console.log('Wiped all uploaded files.');
  } else {
    console.log(
      `Removed ${orphaned} orphaned files (kept files with DB records).` +
        (pruneDb ? ` Pruned ${missing} DB rows without files.` : ''),
    );
  }

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
