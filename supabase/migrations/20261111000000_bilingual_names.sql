-- CloudStock: preserve original Vietnamese names and add curated English labels.
-- Run once in Supabase SQL Editor, after Phase 5/6 migrations.
-- Non-destructive: existing IDs, SKUs, quantities and movement history remain unchanged.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_en varchar(160);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_en varchar(100);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS name_en varchar(60);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS symbol_en varchar(20);

-- Translate only verified reference-data values. New/unknown labels remain NULL for manual review.
UPDATE public.categories SET name_en = CASE name
 WHEN 'Điện tử' THEN 'Electronics'
 WHEN 'Thời trang' THEN 'Fashion'
 WHEN 'Gia dụng' THEN 'Home Appliances'
 WHEN 'Văn phòng phẩm' THEN 'Stationery'
 ELSE name_en END
WHERE name IN ('Điện tử','Thời trang','Gia dụng','Văn phòng phẩm') AND name_en IS NULL;
UPDATE public.units SET
 name_en = CASE name WHEN 'Cái' THEN 'Piece' WHEN 'Quyển' THEN 'Book' WHEN 'Ram' THEN 'Ream' ELSE name_en END,
 symbol_en = CASE name WHEN 'Cái' THEN 'pc' WHEN 'Quyển' THEN 'book' WHEN 'Ram' THEN 'ream' ELSE symbol_en END
WHERE name IN ('Cái','Quyển','Ram') AND (name_en IS NULL OR symbol_en IS NULL);

-- Optional indexes for bilingual substring search (enable pg_trgm if your project permits it).
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS products_name_en_trgm_idx ON public.products USING gin (name_en gin_trgm_ops) WHERE deleted_at IS NULL;

-- Inspect untranslated data; supply accurate English translations via the admin UI/API.
-- SELECT sku, name, name_en FROM public.products WHERE deleted_at IS NULL AND NULLIF(trim(name_en),'') IS NULL;
