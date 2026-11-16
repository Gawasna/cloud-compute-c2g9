-- Migration: Add image_url to public.products table
-- Pattern: Expand phase of Expand-Contract pattern (zero-downtime, backward-compatible)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url varchar(500) DEFAULT NULL;

COMMENT ON COLUMN public.products.image_url IS 'Product image URL (Cloudflare R2 or local static WebP asset path)';
