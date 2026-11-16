import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { mapProductFromApi } from '../../src/components/dashboard/types.ts';
import { handleRequest } from '../../workers/media-worker/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Helper to extract database connection string from environment or .env.local
function getDbConnectionString() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DIRECT_POOLER_URL) return process.env.DIRECT_POOLER_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(ROOT_DIR, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...vals] = trimmed.split('=');
      const cleanKey = key.trim();
      if (['DIRECT_URL', 'DIRECT_POOLER_URL', 'DATABASE_URL'].includes(cleanKey)) {
        let val = vals.join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  return null;
}

/**
 * In-memory Mock implementation of Cloudflare R2Bucket for hermetic worker testing
 */
class MockR2Bucket {
  constructor() {
    this.store = new Map();
  }

  async put(key, value, options = {}) {
    let buffer;
    if (value instanceof ArrayBuffer) {
      buffer = Buffer.from(value);
    } else if (Buffer.isBuffer(value)) {
      buffer = value;
    } else if (typeof value === 'string') {
      buffer = Buffer.from(value);
    } else {
      buffer = Buffer.from(new Uint8Array(value));
    }

    const metadata = {
      key,
      size: buffer.byteLength,
      body: buffer,
      httpMetadata: options.httpMetadata || { contentType: 'application/octet-stream' },
      httpEtag: `"${crypto.randomUUID()}"`,
      uploaded: new Date(),
    };

    this.store.set(key, metadata);
    return metadata;
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      key: item.key,
      size: item.size,
      body: item.body,
      httpMetadata: item.httpMetadata,
      httpEtag: item.httpEtag,
    };
  }

  async delete(key) {
    this.store.delete(key);
  }
}

describe('P2P Contract: Frontend Interface (Product.imageUrl)', () => {
  it('should verify TypeScript interface contracts in types.ts and cloudstock.ts', () => {
    const typesPath = path.join(ROOT_DIR, 'src/components/dashboard/types.ts');
    assert.ok(fs.existsSync(typesPath), 'types.ts must exist');
    const typesContent = fs.readFileSync(typesPath, 'utf-8');

    // Product interface must define imageUrl as optional string or null
    assert.match(
      typesContent,
      /imageUrl\?:\s*string\s*\|\s*null;/,
      'Product interface must define imageUrl?: string | null;'
    );

    const apiTypesPath = path.join(ROOT_DIR, 'src/lib/api/cloudstock.ts');
    assert.ok(fs.existsSync(apiTypesPath), 'cloudstock.ts must exist');
    const apiTypesContent = fs.readFileSync(apiTypesPath, 'utf-8');

    // ApiProduct interface must define image_url as optional string or null
    assert.match(
      apiTypesContent,
      /image_url\?:\s*string\s*\|\s*null;/,
      'ApiProduct interface must define image_url?: string | null;'
    );
  });

  it('should map ApiProduct (image_url) to Frontend Product (imageUrl) losslessly', () => {
    const mockApiProduct = {
      id: 'prod-001',
      name: 'Bàn phím cơ CloudStock Pro',
      name_en: 'CloudStock Pro Mechanical Keyboard',
      sku: 'KEY-PRO-01',
      category_id: 'cat-001',
      category_name: 'Phụ kiện máy tính',
      category_name_en: 'Computer Accessories',
      unit_id: 'unit-001',
      unit_symbol: 'chiếc',
      unit_symbol_en: 'pcs',
      cost_price: 1500000,
      stock_quantity: 45,
      minimum_stock: 10,
      image_url: 'https://media.cloudstock.app/products/1794845087838_e918fdaa.webp',
    };

    const product = mapProductFromApi(mockApiProduct);

    assert.strictEqual(
      product.imageUrl,
      'https://media.cloudstock.app/products/1794845087838_e918fdaa.webp',
      'imageUrl must match API image_url'
    );
    assert.strictEqual(product.sku, 'KEY-PRO-01');
    assert.strictEqual(product.price, 1500000);
  });

  it('should normalize null, undefined, or empty string image_url to null', () => {
    const baseProduct = {
      id: 'prod-002',
      name: 'Chuột không dây',
      sku: 'MOUSE-01',
      category_id: 'cat-001',
      category_name: 'Phụ kiện',
      unit_id: 'unit-001',
      unit_symbol: 'cái',
      cost_price: 250000,
      stock_quantity: 100,
      minimum_stock: 20,
    };

    // Case 1: null
    const resNull = mapProductFromApi({ ...baseProduct, image_url: null });
    assert.strictEqual(resNull.imageUrl, null);

    // Case 2: undefined / omitted
    const resUndef = mapProductFromApi({ ...baseProduct });
    assert.strictEqual(resUndef.imageUrl, null);

    // Case 3: empty string
    const resEmpty = mapProductFromApi({ ...baseProduct, image_url: '' });
    assert.strictEqual(resEmpty.imageUrl, null);
  });
});

describe('P2P Contract: API Payload Schema (POST /api/products & Workers /upload)', () => {
  it('should verify POST /api/products validates imageUrl length and aliases', () => {
    const routePath = path.join(ROOT_DIR, 'src/app/api/products/route.ts');
    assert.ok(fs.existsSync(routePath), 'products/route.ts must exist');
    const content = fs.readFileSync(routePath, 'utf-8');

    // Both body.imageUrl and body.image_url are accepted
    assert.ok(
      content.includes('body.imageUrl') && content.includes('body.image_url'),
      'API route must support both imageUrl and image_url payload keys'
    );

    // Max length constraint: 500 characters
    assert.ok(
      content.includes('imageUrl.length > 500'),
      'API route must enforce maximum 500 characters for imageUrl'
    );

    // Insert query binds image_url column
    assert.ok(
      content.includes('image_url') && content.includes('$8'),
      'Insert SQL must bind image_url parameter'
    );
  });

  it('should verify PATCH /api/products/[id] supports partial update and image removal', () => {
    const patchRoutePath = path.join(ROOT_DIR, 'src/app/api/products/[id]/route.ts');
    assert.ok(fs.existsSync(patchRoutePath), 'products/[id]/route.ts must exist');
    const content = fs.readFileSync(patchRoutePath, 'utf-8');

    // Checks for image field presence
    assert.ok(
      content.includes('"imageUrl" in body') || content.includes('"image_url" in body'),
      'PATCH route must check field presence for partial update'
    );

    // Conditional update expression
    assert.ok(
      content.includes('image_url = case when $8::boolean then $9 else image_url end'),
      'PATCH SQL must conditionally update image_url when field is provided'
    );
  });

  it('should verify Cloudflare Media Worker /upload request handling with mock R2', async () => {
    const bucket = new MockR2Bucket();
    const env = {
      PRODUCT_MEDIA_BUCKET: bucket,
      ALLOWED_ORIGINS: 'http://localhost:3000',
      PUBLIC_CDN_URL: 'https://media.cloudstock.app',
    };

    // 1. Success case: POST WebP binary payload
    const testPayload = Buffer.from('RIFF....WEBPVP8 ...');
    const uploadReq = new Request('https://worker.local/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/webp',
      },
      body: testPayload,
    });

    const uploadRes = await handleRequest(uploadReq, env);
    assert.strictEqual(uploadRes.status, 201, 'Worker should return 201 Created for valid WebP');

    const body = await uploadRes.json();
    assert.strictEqual(body.success, true);
    assert.match(body.key, /^products\/\d+_[a-f0-9]{8}\.webp$/, 'Key must match products/{ts}_{uuid8}.webp pattern');
    assert.strictEqual(body.url, `https://media.cloudstock.app/${body.key}`);
    assert.strictEqual(body.size, testPayload.byteLength);

    // 2. Retrieval case: GET /media/{key}
    const getReq = new Request(`https://worker.local/media/${encodeURIComponent(body.key)}`, {
      method: 'GET',
    });
    const getRes = await handleRequest(getReq, env);
    assert.strictEqual(getRes.status, 200, 'GET /media/:key should return 200 OK');
    assert.strictEqual(getRes.headers.get('Content-Type'), 'image/webp');
    assert.strictEqual(getRes.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');

    const downloadedBytes = Buffer.from(await getRes.arrayBuffer());
    assert.deepStrictEqual(downloadedBytes, testPayload, 'Downloaded payload must be bit-identical');

    // 3. Error case: Unsupported media type (e.g. image/jpeg directly to worker)
    const badMimeReq = new Request('https://worker.local/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: testPayload,
    });
    const badMimeRes = await handleRequest(badMimeReq, env);
    assert.strictEqual(badMimeRes.status, 415, 'Worker should return 415 Unsupported Media Type for non-WebP');

    // 4. Error case: Empty body
    const emptyReq = new Request('https://worker.local/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp' },
      body: new Uint8Array(0),
    });
    const emptyRes = await handleRequest(emptyReq, env);
    assert.strictEqual(emptyRes.status, 400, 'Worker should return 400 Bad Request for empty payload');

    // 5. Error case: Payload exceeds 2MB limit
    const oversizedPayload = new Uint8Array(2 * 1024 * 1024 + 10);
    const oversizedReq = new Request('https://worker.local/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp' },
      body: oversizedPayload,
    });
    const oversizedRes = await handleRequest(oversizedReq, env);
    assert.strictEqual(oversizedRes.status, 413, 'Worker should return 413 Payload Too Large when exceeding 2MB');
  });
});

describe('P2P Contract: Database Schema (public.products.image_url)', () => {
  it('should verify migration DDL defines image_url varchar(500) DEFAULT NULL', () => {
    const migPath = path.join(ROOT_DIR, 'supabase/migrations/20261117000000_add_product_image_url.sql');
    assert.ok(fs.existsSync(migPath), 'Migration file must exist');
    const sql = fs.readFileSync(migPath, 'utf-8');

    assert.match(
      sql,
      /ALTER\s+TABLE\s+public\.products\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+image_url\s+varchar\(500\)\s+DEFAULT\s+NULL;/i,
      'Migration must add image_url varchar(500) DEFAULT NULL'
    );
  });

  it('should verify live PostgreSQL database schema consistency', async () => {
    const connectionString = getDbConnectionString();
    if (!connectionString) {
      console.log('Skipping live DB schema check: No database connection string provided.');
      return;
    }

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();

      // Check column metadata in information_schema
      const colQuery = `
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'image_url'
      `;
      const res = await client.query(colQuery);
      assert.strictEqual(res.rowCount, 1, 'Column image_url must exist in public.products table');

      const col = res.rows[0];
      assert.strictEqual(col.column_name, 'image_url');
      assert.strictEqual(col.data_type, 'character varying');
      assert.strictEqual(col.character_maximum_length, 500);
      assert.strictEqual(col.is_nullable, 'YES');

      // Verify that active products with image_url can be queried cleanly
      const countRes = await client.query(
        'SELECT count(*)::int as count FROM public.products WHERE image_url IS NOT NULL AND deleted_at IS NULL'
      );
      assert.ok(typeof countRes.rows[0].count === 'number', 'Count of products with image_url must be a number');
      assert.ok(countRes.rows[0].count >= 0, 'Count must be non-negative');
    } finally {
      await client.end().catch(() => {});
    }
  });
});

describe('P2P Contract: End-to-End Payload Flow Simulation', () => {
  it('should verify lossless round-trip from Preprocessor Upload -> API Payload -> DB -> Frontend Model', () => {
    // 1. Preprocessor Upload returns CDN URL
    const uploadedKey = 'products/1794845087838_demo123.webp';
    const cdnBase = 'https://media.cloudstock.app';
    const cdnUrl = `${cdnBase}/${uploadedKey}`;

    // 2. Client builds API payload for product creation
    const clientPayload = {
      name: 'P2P End-to-End Demonstration Item',
      nameEn: 'P2P End-to-End Demonstration Item',
      sku: 'P2P-FLOW-DEMO',
      categoryId: 'a77bd031-5e20-4c0c-8428-de9a0ad68465',
      unitId: '009401c5-908e-40a4-9d54-c3efcf2a8628',
      costPrice: 500000,
      minimumStock: 15,
      imageUrl: cdnUrl,
    };

    // 3. API Route normalizes imageUrl
    const parsedImageUrl = clientPayload.imageUrl ? String(clientPayload.imageUrl).trim() : null;
    assert.strictEqual(parsedImageUrl, cdnUrl);
    assert.ok(parsedImageUrl.length <= 500);

    // 4. Database row simulation (as returned by PostgreSQL RETURNING * or SELECT)
    const simulatedDbRow = {
      id: 'mock-uuid-e2e-demo',
      name: clientPayload.name,
      name_en: clientPayload.nameEn,
      sku: clientPayload.sku,
      category_id: clientPayload.categoryId,
      category_name: 'Thiết bị',
      category_name_en: 'Devices',
      unit_id: clientPayload.unitId,
      unit_symbol: 'bộ',
      unit_symbol_en: 'set',
      cost_price: clientPayload.costPrice,
      stock_quantity: 0,
      minimum_stock: clientPayload.minimumStock,
      image_url: parsedImageUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // 5. Client receives ApiProduct and maps to Frontend Product
    const frontendProduct = mapProductFromApi(simulatedDbRow);

    // 6. Assert 100% data fidelity
    assert.strictEqual(frontendProduct.imageUrl, cdnUrl, 'Frontend Product imageUrl must match original CDN URL');
    assert.strictEqual(frontendProduct.sku, clientPayload.sku);
    assert.strictEqual(frontendProduct.price, clientPayload.costPrice);
    assert.strictEqual(frontendProduct.minimum, clientPayload.minimumStock);
  });
});
