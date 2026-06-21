-- Migration: Enable Realtime & Seed Initial Data
-- Run after: 20260622000000_initial_schema.sql

-- ============================================================
-- 1. Enable Realtime replication for customer_orders
--    (wrapped in DO block so it's safe to re-run)
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
EXCEPTION
  WHEN OTHERS THEN
    -- Already added — safe to ignore
    NULL;
END $$;

-- ============================================================
-- 2. Seed initial dummy categories (IF NOT EXISTS)
-- ============================================================
INSERT INTO public.categories (id, name, "createdAt", "updatedAt", deleted)
VALUES
  ('cat_makanan',    'Makanan',   1718985600000, 1718985600000, false),
  ('cat_minuman',    'Minuman',   1718985600000, 1718985600000, false),
  ('cat_snack',      'Snack',     1718985600000, 1718985600000, false),
  ('cat_paket',      'Paket Hemat', 1718985600000, 1718985600000, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Seed initial dummy products (IF NOT EXISTS)
-- ============================================================
INSERT INTO public.products (id, name, "categoryId", barcode, "buyPrice", "sellPrice", stock, "imageUrl", "createdAt", "updatedAt", deleted)
VALUES
  ('prod_nasi_goreng',    'Nasi Goreng Spesial',   'cat_makanan',  '8990001000001', 12000, 20000, 50, NULL, 1718985600000, 1718985600000, false),
  ('prod_mie_goreng',     'Mie Goreng Pedas',       'cat_makanan',  '8990001000002', 10000, 17000, 40, NULL, 1718985600000, 1718985600000, false),
  ('prod_ayam_bakar',     'Ayam Bakar Madu',        'cat_makanan',  '8990001000003', 18000, 30000, 30, NULL, 1718985600000, 1718985600000, false),
  ('prod_gado_gado',      'Gado-Gado Komplit',      'cat_makanan',  '8990001000004', 11000, 18000, 35, NULL, 1718985600000, 1718985600000, false),
  ('prod_soto_ayam',      'Soto Ayam Kampung',      'cat_makanan',  '8990001000005', 13000, 22000, 25, NULL, 1718985600000, 1718985600000, false),
  ('prod_es_teh',         'Es Teh Manis',           'cat_minuman',  '8990001000010', 2000,  7000,  100, NULL, 1718985600000, 1718985600000, false),
  ('prod_es_jeruk',       'Es Jeruk Peras',         'cat_minuman',  '8990001000011', 4000,  10000, 80, NULL,  1718985600000, 1718985600000, false),
  ('prod_jus_alpukat',    'Jus Alpukat Susu',       'cat_minuman',  '8990001000012', 8000,  18000, 40, NULL,  1718985600000, 1718985600000, false),
  ('prod_kopi_hitam',     'Kopi Hitam',             'cat_minuman',  '8990001000013', 3000,  8000,  60, NULL,  1718985600000, 1718985600000, false),
  ('prod_thai_tea',       'Thai Tea Original',      'cat_minuman',  '8990001000014', 6000,  15000, 50, NULL,  1718985600000, 1718985600000, false),
  ('prod_pisang_goreng',  'Pisang Goreng Crispy',   'cat_snack',    '8990001000020', 3000,  8000,  60, NULL,  1718985600000, 1718985600000, false),
  ('prod_kentang_goreng', 'Kentang Goreng Keju',    'cat_snack',    '8990001000021', 7000,  15000, 45, NULL,  1718985600000, 1718985600000, false),
  ('prod_cireng',         'Cireng Isi Bumbu Rujak', 'cat_snack',    '8990001000022', 5000,  12000, 55, NULL,  1718985600000, 1718985600000, false),
  ('prod_paket_makan_a',  'Paket Makan A (Nasi + Lauk + Minum)', 'cat_paket', '8990001000030', 18000, 32000, 30, NULL, 1718985600000, 1718985600000, false),
  ('prod_paket_makan_b',  'Paket Makan B (Mie + Minum)',         'cat_paket', '8990001000031', 13000, 25000, 30, NULL, 1718985600000, 1718985600000, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Seed initial dining tables (IF NOT EXISTS)
-- ============================================================
INSERT INTO public.tables (id, name, status, created_at, updated_at)
VALUES
  ('meja_01', 'Meja 01', 'active', 1718985600000, 1718985600000),
  ('meja_02', 'Meja 02', 'active', 1718985600000, 1718985600000),
  ('meja_03', 'Meja 03', 'active', 1718985600000, 1718985600000),
  ('meja_04', 'Meja 04', 'active', 1718985600000, 1718985600000),
  ('meja_05', 'Meja 05', 'active', 1718985600000, 1718985600000),
  ('meja_06', 'Meja 06', 'active', 1718985600000, 1718985600000),
  ('meja_07', 'Meja 07', 'active', 1718985600000, 1718985600000),
  ('meja_08', 'Meja 08', 'active', 1718985600000, 1718985600000)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Seed default settings row (IF NOT EXISTS)
-- ============================================================
INSERT INTO public.settings (id, "storeName", "storeAddress", "storePhone", "taxPercentage", "updatedAt", "maxFileSize", bank_accounts)
VALUES (
  'default',
  'RestoFlow POS',
  'Jl. Merdeka No. 1, Jakarta Pusat',
  '021-5550123',
  11,
  1718985600000,
  5,
  '[{"bankName":"BCA","accountNumber":"1234567890","accountName":"RestoFlow Store"},{"bankName":"Mandiri","accountNumber":"0987654321","accountName":"RestoFlow Store"}]'
)
ON CONFLICT (id) DO NOTHING;
