import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Resolve environment variables from .env.local if not already injected
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const WORKER_UPLOAD_URL = 'https://cc-media-worker.hunglepy05.workers.dev/upload';
const TEST_SKU = 'P2P-TEST-001';

async function generateTestWebPBuffer() {
  // Generate a valid 64x64 WebP image buffer in memory
  const buffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 16, g: 185, b: 129, alpha: 1 }, // Emerald Green
    },
  })
    .webp({ quality: 85 })
    .toBuffer();

  // Validate RIFF and WEBP header
  const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isRiff || !isWebp) {
    throw new Error('Generated buffer failed RIFF/WEBP header validation');
  }

  return buffer;
}

async function verifyP2PPipeline() {
  console.log('================================================================');
  console.log(' P2P Verification: Frontend Payload <-> Database <-> R2 Bucket');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Step 1: Generate valid in-memory WebP image
  // ---------------------------------------------------------------------------
  console.log('[Step 1/6] Generating valid WebP image in memory...');
  const imageBuffer = await generateTestWebPBuffer();
  console.log(`  -> Generated buffer: ${imageBuffer.length} bytes with valid RIFF/WEBP magic headers.`);

  // ---------------------------------------------------------------------------
  // Step 2: Upload to Cloudflare Media Worker
  // ---------------------------------------------------------------------------
  console.log(`\n[Step 2/6] Uploading image to Cloudflare Media Worker: ${WORKER_UPLOAD_URL}...`);
  const uploadStartTime = Date.now();
  const uploadResp = await fetch(WORKER_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
    },
    body: imageBuffer,
  });

  const uploadDuration = Date.now() - uploadStartTime;
  console.log(`  -> Worker response status: ${uploadResp.status} ${uploadResp.statusText} (${uploadDuration}ms)`);

  if (uploadResp.status !== 201) {
    const errorText = await uploadResp.text();
    throw new Error(`Media Worker upload failed with HTTP ${uploadResp.status}: ${errorText}`);
  }

  const uploadData = await uploadResp.json();
  console.log('  -> Upload response data:', JSON.stringify(uploadData, null, 2));

  if (!uploadData.success || !uploadData.key || !uploadData.url) {
    throw new Error(`Invalid response structure from Media Worker: ${JSON.stringify(uploadData)}`);
  }

  if (!uploadData.key.startsWith('products/') || !uploadData.key.endsWith('.webp')) {
    throw new Error(`Media Worker returned invalid key format: ${uploadData.key} (expected products/*.webp)`);
  }

  console.log(`  -> Verified key format: ${uploadData.key}`);
  console.log(`  -> Received CDN URL: ${uploadData.url}`);

  // ---------------------------------------------------------------------------
  // Step 3: Fetch image from CDN URL / Worker Media Route and confirm 200 OK + WebP
  // ---------------------------------------------------------------------------
  console.log(`\n[Step 3/6] Verifying CDN HTTP GET retrieval...`);
  let getResp;
  let activeCdnUrl = uploadData.url;

  try {
    console.log(`  -> Sending HTTP GET request to: ${activeCdnUrl}`);
    getResp = await fetch(activeCdnUrl);
  } catch (netErr) {
    // If the custom domain (e.g. media.cloudstock.app) has no public DNS record configured yet,
    // fallback to the Media Worker's direct media route to verify R2 persistence
    const fallbackRoute = `https://cc-media-worker.hunglepy05.workers.dev/media/${uploadData.key}`;
    console.log(`  -> Primary CDN URL failed to resolve (${netErr.message}).`);
    console.log(`  -> Verifying via Cloudflare Worker Media endpoint: ${fallbackRoute}`);
    activeCdnUrl = fallbackRoute;
    getResp = await fetch(activeCdnUrl);
  }

  console.log(`  -> CDN GET status: ${getResp.status} ${getResp.statusText}`);
  const contentType = getResp.headers.get('content-type') || '';
  console.log(`  -> Response Content-Type: ${contentType}`);

  if (getResp.status !== 200) {
    throw new Error(`CDN retrieval failed with status ${getResp.status}`);
  }

  if (!contentType.toLowerCase().includes('image/webp')) {
    throw new Error(`CDN retrieval returned unexpected Content-Type: ${contentType} (expected image/webp)`);
  }

  const fetchedBytes = await getResp.arrayBuffer();
  console.log(`  -> Successfully downloaded ${fetchedBytes.byteLength} bytes from R2 via CDN/Worker.`);

  // ---------------------------------------------------------------------------
  // Step 4: Connect to PostgreSQL and Insert Test Product (P2P-TEST-001)
  // ---------------------------------------------------------------------------
  console.log('\n[Step 4/6] Connecting to PostgreSQL Database...');
  const connectionString = process.env.DIRECT_URL || process.env.DIRECT_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database connection string found in environment (DIRECT_URL, DIRECT_POOLER_URL, or DATABASE_URL).');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('  -> Connected to PostgreSQL successfully.');

  try {
    // Retrieve reference category and unit for valid foreign keys
    const catRes = await client.query('SELECT id FROM public.categories LIMIT 1');
    const unitRes = await client.query('SELECT id FROM public.units LIMIT 1');

    if (!catRes.rows.length || !unitRes.rows.length) {
      throw new Error('Database missing prerequisite category or unit records.');
    }

    const categoryId = catRes.rows[0].id;
    const unitId = unitRes.rows[0].id;

    // Ensure clean state before insert
    await client.query('DELETE FROM public.products WHERE sku = $1', [TEST_SKU]);

    console.log(`  -> Inserting test product with SKU: ${TEST_SKU}...`);
    const insertSql = `
      INSERT INTO public.products (
        name,
        name_en,
        sku,
        category_id,
        unit_id,
        cost_price,
        minimum_stock,
        image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const insertValues = [
      'P2P Pipeline Test Product (Automated)',
      'P2P Pipeline Test Product (Automated)',
      TEST_SKU,
      categoryId,
      unitId,
      250000,
      10,
      uploadData.url, // Store the CDN URL from Media Worker
    ];

    const insertRes = await client.query(insertSql, insertValues);
    const insertedProduct = insertRes.rows[0];

    console.log(`  -> Product inserted with ID: ${insertedProduct.id}`);
    console.log(`  -> Stored image_url: ${insertedProduct.image_url}`);

    if (insertedProduct.image_url !== uploadData.url) {
      throw new Error(`Stored image_url mismatch: expected "${uploadData.url}", got "${insertedProduct.image_url}"`);
    }

    // -------------------------------------------------------------------------
    // Step 5: Query Database to verify 100% integrity
    // -------------------------------------------------------------------------
    console.log('\n[Step 5/6] Querying database to verify 100% image_url fidelity...');
    const querySql = `
      SELECT id, name, sku, image_url, created_at, updated_at
      FROM public.products
      WHERE sku = $1 AND deleted_at IS NULL
    `;
    const queryRes = await client.query(querySql, [TEST_SKU]);

    if (queryRes.rowCount !== 1) {
      throw new Error(`Failed to query test product with SKU: ${TEST_SKU}`);
    }

    const verifiedProduct = queryRes.rows[0];
    console.log('  -> Query result:', verifiedProduct);

    if (verifiedProduct.image_url !== uploadData.url) {
      throw new Error(`Integrity check failed: image_url in DB (${verifiedProduct.image_url}) !== expected (${uploadData.url})`);
    }
    console.log('  -> Confirmed: image_url is stored and retrieved with 100% fidelity.');

    // -------------------------------------------------------------------------
    // Step 6: Test Updating image_url = null and Verify Database Update
    // -------------------------------------------------------------------------
    console.log('\n[Step 6/6] Testing update image_url = NULL (Image removal/clearing)...');
    const updateSql = `
      UPDATE public.products
      SET image_url = NULL, updated_at = NOW()
      WHERE sku = $1
      RETURNING id, sku, image_url, updated_at
    `;
    const updateRes = await client.query(updateSql, [TEST_SKU]);

    if (updateRes.rowCount !== 1) {
      throw new Error(`Failed to update test product with SKU: ${TEST_SKU}`);
    }

    const updatedProduct = updateRes.rows[0];
    console.log('  -> Update result:', updatedProduct);

    if (updatedProduct.image_url !== null) {
      throw new Error(`Expected image_url to be null after update, got: ${updatedProduct.image_url}`);
    }

    // Re-query to confirm null persistence
    const recheckRes = await client.query('SELECT image_url FROM public.products WHERE sku = $1', [TEST_SKU]);
    if (recheckRes.rows[0].image_url !== null) {
      throw new Error(`Persistence verification failed: image_url is not null (${recheckRes.rows[0].image_url})`);
    }
    console.log('  -> Confirmed: image_url was successfully cleared to NULL.');
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Ensure test record is always purged
    // -------------------------------------------------------------------------
    console.log('\n[Cleanup] Purging test record from database...');
    const deleteRes = await client.query('DELETE FROM public.products WHERE sku = $1 RETURNING id', [TEST_SKU]);
    console.log(`  -> Deleted test product records: ${deleteRes.rowCount}`);

    const finalCheck = await client.query('SELECT count(*)::int as count FROM public.products WHERE sku = $1', [TEST_SKU]);
    if (finalCheck.rows[0].count === 0) {
      console.log('  -> Verified database is completely clean (0 remaining test records).');
    } else {
      console.warn(`  [Warning] ${finalCheck.rows[0].count} test records still remain!`);
    }

    await client.end();
    console.log('  -> Database connection closed.');
  }

  console.log('\n================================================================');
  console.log(' P2P Verification SUCCESS: Full Pipeline Tested & Verified!');
  console.log('================================================================\n');
}

verifyP2PPipeline().catch((err) => {
  console.error('\n[FATAL ERROR] P2P Verification failed:', err);
  process.exit(1);
});
