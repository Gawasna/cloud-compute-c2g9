import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from workers/media-worker/scripts
const REPO_ROOT = path.resolve(__dirname, '../../..');
const IMAGES_DIR = path.join(REPO_ROOT, 'public/images/products');
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cloudstock-product-media';

const isDryRun = process.argv.includes('--dry-run');

console.log('=== CloudStock Product Media R2 Sync ===');
console.log('Target Bucket:', BUCKET_NAME);
console.log('Source Directory:', IMAGES_DIR);
console.log('Mode:', isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE SYNC');

if (!fs.existsSync(IMAGES_DIR)) {
  console.error(`Error: Source directory does not exist: ${IMAGES_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg'));
console.log(`Discovered ${files.length} media assets ready for synchronization.\n`);

let successCount = 0;
let failCount = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const localPath = path.join(IMAGES_DIR, file);
  const r2Key = `products/${file}`;
  const contentType = file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const cacheControl = 'public, max-age=31536000, immutable';

  const cmd = `npx wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file "${localPath}" --content-type "${contentType}" --cache-control "${cacheControl}"`;

  console.log(`[${i + 1}/${files.length}] Syncing: ${r2Key}`);

  if (isDryRun) {
    console.log(`  [DRY-RUN] ${cmd}`);
    successCount++;
    continue;
  }

  try {
    execSync(cmd, {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    console.log(`  -> Uploaded successfully to R2 (${BUCKET_NAME}/${r2Key})`);
    successCount++;
  } catch (error) {
    console.error(`  -> Failed to upload ${r2Key}:`, error.stderr || error.message);
    failCount++;
  }
}

console.log('\n=== SYNC SUMMARY ===');
console.log(`Total: ${files.length}`);
console.log(`Success: ${successCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  console.log('\nNOTE: If error code 10042 occurs, please ensure Cloudflare R2 is enabled on your Cloudflare Dashboard.');
  process.exit(1);
}
