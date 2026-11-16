-- Migration: Seed/Backfill image_url for existing 31 products
-- Pattern: Migrate/Backfill phase of Expand-Contract pattern
-- All 31 WebP images are stored in Cloudflare R2 bucket cloudstock-product-media and served via cc-media-worker.

UPDATE public.products p
SET image_url = t.img_path
FROM (
  VALUES
    ('ACC-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ACC-001.webp'),
    ('ACC-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ACC-002.webp'),
    ('ACC-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ACC-003.webp'),
    ('ACC-004', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ACC-004.webp'),
    ('APP-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/APP-001.webp'),
    ('APP-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/APP-002.webp'),
    ('APP-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/APP-003.webp'),
    ('APP-004', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/APP-004.webp'),
    ('APP-005', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/APP-005.webp'),
    ('ELE-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-001.webp'),
    ('ELE-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-002.webp'),
    ('ELE-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-003.webp'),
    ('ELE-004', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-004.webp'),
    ('ELE-005', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-005.webp'),
    ('ELE-006', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-006.webp'),
    ('ELE-007', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-007.webp'),
    ('ELE-008', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/ELE-008.webp'),
    ('HOM-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/HOM-001.webp'),
    ('HOM-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/HOM-002.webp'),
    ('HOM-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/HOM-003.webp'),
    ('HOM-004', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/HOM-004.webp'),
    ('HOM-005', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/HOM-005.webp'),
    ('IP18', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/IP18.webp'),
    ('NET-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/NET-001.webp'),
    ('NET-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/NET-002.webp'),
    ('NET-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/NET-003.webp'),
    ('OFF-001', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/OFF-001.webp'),
    ('OFF-002', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/OFF-002.webp'),
    ('OFF-003', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/OFF-003.webp'),
    ('OFF-004', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/OFF-004.webp'),
    ('OFF-005', 'https://cc-media-worker.hunglepy05.workers.dev/media/products/OFF-005.webp')
) AS t(sku, img_path)
WHERE p.sku = t.sku AND p.deleted_at IS NULL;
