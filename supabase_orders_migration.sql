-- MIGRATION: Customer Order Submission & Payment Verification
-- Run these commands in your Supabase SQL Editor.

-- 1. Create Dining Tables Entity
CREATE TABLE IF NOT EXISTS public.tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Seed initial tables if they don't exist
INSERT INTO public.tables (id, name, status, created_at, updated_at)
VALUES 
    ('meja_01', 'Meja 01', 'active', 1718985600000, 1718985600000),
    ('meja_02', 'Meja 02', 'active', 1718985600000, 1718985600000),
    ('meja_03', 'Meja 03', 'active', 1718985600000, 1718985600000),
    ('meja_04', 'Meja 04', 'active', 1718985600000, 1718985600000),
    ('meja_05', 'Meja 05', 'active', 1718985600000, 1718985600000)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Customer Orders Table
CREATE TABLE IF NOT EXISTS public.customer_orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount BIGINT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('qris', 'bank_transfer')),
    payment_proof TEXT NOT NULL, -- Stored as Base64 Data URL (JPEG/PNG/PDF)
    status TEXT NOT NULL CHECK (status IN ('pending_confirmation', 'preparing', 'delivery', 'finished', 'rejected')),
    verified_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at BIGINT,
    notes TEXT,
    table_id TEXT REFERENCES public.tables(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 3. Create Customer Order Items Table
CREATE TABLE IF NOT EXISTS public.customer_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    price BIGINT NOT NULL,
    subtotal BIGINT NOT NULL
);

-- 4. Alter Settings Table to include maxFileSize and bank_accounts columns
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "maxFileSize" BIGINT DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_accounts TEXT DEFAULT '[]';

-- 5. Enable Row Level Security (RLS) to allow public access
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;

-- 6. Setup Public Read/Write/Delete Policies
DROP POLICY IF EXISTS "Allow public access" ON public.tables;
CREATE POLICY "Allow public access" ON public.tables FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access" ON public.customer_orders;
CREATE POLICY "Allow public access" ON public.customer_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access" ON public.customer_order_items;
CREATE POLICY "Allow public access" ON public.customer_order_items FOR ALL USING (true) WITH CHECK (true);

-- 7. Grant Permissions to Anon and Authenticated roles
GRANT ALL ON public.tables TO anon, authenticated;
GRANT ALL ON public.customer_orders TO anon, authenticated;
GRANT ALL ON public.customer_order_items TO anon, authenticated;
