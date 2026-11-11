-- CloudStock: curated English names for the 30 original demo SKUs.
-- Run AFTER 20261111000000_bilingual_names.sql.
-- Safe to repeat: only fills empty English names for an exact SKU + source-name match.
-- Does NOT change the original Vietnamese name, IDs, cost, stock, or movements.
BEGIN;
WITH translations(sku, original_name, english_name) AS (
 VALUES
 ('ELE-001','Chuột không dây Logitech G304','Logitech G304 Wireless Mouse'),
 ('ELE-002','Bàn phím cơ Keychron K2','Keychron K2 Mechanical Keyboard'),
 ('ELE-003','Tai nghe Sony WH-CH520','Sony WH-CH520 Headphones'),
 ('ELE-004','Màn hình Dell 24 inch','Dell 24-inch Monitor'),
 ('ELE-005','Ổ cứng SSD Samsung 1TB','Samsung 1TB SSD'),
 ('ELE-006','Webcam Logitech C270','Logitech C270 Webcam'),
 ('ELE-007','Loa Bluetooth JBL Go','JBL Go Bluetooth Speaker'),
 ('ELE-008','Hub USB-C 6 trong 1','6-in-1 USB-C Hub'),
 ('APP-001','Áo sơ mi nam trắng','Men’s White Dress Shirt'),
 ('APP-002','Áo thun cotton unisex','Unisex Cotton T-Shirt'),
 ('APP-003','Quần jeans nữ dáng suông','Women’s Straight-Leg Jeans'),
 ('APP-004','Áo khoác gió thể thao','Sports Windbreaker Jacket'),
 ('APP-005','Váy xếp ly nữ','Women’s Pleated Skirt'),
 ('HOM-001','Ấm siêu tốc 1.8L','1.8L Electric Kettle'),
 ('HOM-002','Nồi cơm điện 1.8L','1.8L Rice Cooker'),
 ('HOM-003','Bình giữ nhiệt inox 500ml','500ml Stainless Steel Insulated Bottle'),
 ('HOM-004','Đèn bàn LED chống cận','LED Desk Lamp'),
 ('HOM-005','Máy xay sinh tố mini','Mini Blender'),
 ('OFF-001','Sổ tay A5 200 trang','A5 Notebook, 200 Pages'),
 ('OFF-002','Giấy in A4 80gsm','A4 Printing Paper, 80 gsm'),
 ('OFF-003','Bút bi Thiên Long xanh','Thiên Long Blue Ballpoint Pens'),
 ('OFF-004','Bộ bút highlight 6 màu','6-Color Highlighter Set'),
 ('OFF-005','Kẹp tài liệu A4','A4 Document Clip'),
 ('ACC-001','Balo laptop 15.6 inch','15.6-inch Laptop Backpack'),
 ('ACC-002','Túi chống sốc laptop','Padded Laptop Sleeve'),
 ('ACC-003','Cáp sạc USB-C 1m','1m USB-C Charging Cable'),
 ('ACC-004','Sạc dự phòng 10000mAh','10,000mAh Power Bank'),
 ('NET-001','Router Wi-Fi TP-Link AX1800','TP-Link AX1800 Wi-Fi Router'),
 ('NET-002','Switch mạng 8 cổng Gigabit','8-Port Gigabit Network Switch'),
 ('NET-003','Cáp mạng Cat6 3m','3m Cat6 Ethernet Cable')
)
UPDATE public.products p SET name_en = t.english_name
FROM translations t
WHERE p.sku = t.sku AND p.name = t.original_name
  AND NULLIF(btrim(p.name_en), '') IS NULL;

UPDATE public.categories SET name_en = CASE name
 WHEN 'Phụ kiện' THEN 'Accessories'
 WHEN 'Thiết bị mạng' THEN 'Networking Equipment'
 ELSE name_en END
WHERE name IN ('Phụ kiện','Thiết bị mạng')
  AND NULLIF(btrim(name_en), '') IS NULL;

UPDATE public.units SET
 name_en = CASE name
  WHEN 'Bộ' THEN 'Set' WHEN 'Hộp' THEN 'Box' WHEN 'Chiếc' THEN 'Piece' ELSE name_en END,
 symbol_en = CASE name
  WHEN 'Bộ' THEN 'set' WHEN 'Hộp' THEN 'box' WHEN 'Chiếc' THEN 'pc' ELSE symbol_en END
WHERE name IN ('Bộ','Hộp','Chiếc') AND
  (NULLIF(btrim(name_en), '') IS NULL OR NULLIF(btrim(symbol_en), '') IS NULL);
COMMIT;

-- Verify names after running:
-- SELECT sku,name,name_en FROM public.products WHERE deleted_at IS NULL ORDER BY sku;
-- SELECT count(*) AS untranslated FROM public.products
-- WHERE deleted_at IS NULL AND NULLIF(btrim(name_en),'') IS NULL;
