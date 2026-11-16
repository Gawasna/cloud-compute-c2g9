import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.DIRECT_URL || process.env.DIRECT_POOLER_URL || process.env.DATABASE_URL;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function applyMigrations() {
  await client.connect();
  console.log('Connected to database.');

  const mig1 = fs.readFileSync(path.resolve('supabase/migrations/20261117000000_add_product_image_url.sql'), 'utf-8');
  console.log('Applying 20261117000000_add_product_image_url.sql...');
  await client.query(mig1);
  console.log('Mig 1 applied successfully.');

  const mig2 = fs.readFileSync(path.resolve('supabase/migrations/20261117010000_seed_product_images.sql'), 'utf-8');
  console.log('Applying 20261117010000_seed_product_images.sql...');
  const res2 = await client.query(mig2);
  console.log(`Mig 2 applied successfully (Updated ${res2.rowCount} rows).`);

  const check = await client.query('select count(*)::int as with_image from public.products where image_url is not null and deleted_at is null');
  console.log(`Verification: ${check.rows[0].with_image} active products now have image_url!`);

  await client.end();
}

applyMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
