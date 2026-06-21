-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Custom Schema "public"
CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "categoryId" TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    barcode TEXT,
    "buyPrice" BIGINT NOT NULL,
    "sellPrice" BIGINT NOT NULL,
    stock BIGINT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 3. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 4. Create Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 5. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    no TEXT NOT NULL UNIQUE,
    date BIGINT NOT NULL,
    "customerId" TEXT,
    subtotal BIGINT NOT NULL,
    discount BIGINT NOT NULL,
    tax BIGINT NOT NULL,
    total BIGINT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "amountPaid" BIGINT NOT NULL,
    change BIGINT NOT NULL,
    note TEXT,
    status TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);

-- 6. Create Transaction Items Table
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id TEXT PRIMARY KEY,
    "transactionId" TEXT REFERENCES public.transactions(id) ON DELETE CASCADE,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    price BIGINT NOT NULL,
    qty BIGINT NOT NULL,
    discount BIGINT NOT NULL,
    subtotal BIGINT NOT NULL
);

-- 7. Create Users Table (Custom users table for offline public)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 8. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'POS System',
    "storeAddress" TEXT NOT NULL DEFAULT 'Jl. Contoh Alamat No. 123',
    "storePhone" TEXT NOT NULL DEFAULT '08123456789',
    "taxPercentage" BIGINT NOT NULL DEFAULT 0,
    "qrisImage" TEXT,
    "updatedAt" BIGINT NOT NULL
);

-- Set Row Level Security (RLS) to PUBLIC for testing purposes
-- WARNING: In a production environment, you MUST secure these tables using Supabase Auth policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow public access" ON public.categories;
DROP POLICY IF EXISTS "Allow public access" ON public.products;
DROP POLICY IF EXISTS "Allow public access" ON public.customers;
DROP POLICY IF EXISTS "Allow public access" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public access" ON public.transactions;
DROP POLICY IF EXISTS "Allow public access" ON public.transaction_items;
DROP POLICY IF EXISTS "Allow public access" ON public.users;
DROP POLICY IF EXISTS "Allow public access" ON public.settings;

-- Re-create policies with WITH CHECK for full INSERT/UPDATE/UPSERT support
CREATE POLICY "Allow public access" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Explicitly grant table permissions to anon role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- 9. Create Dining Tables Entity
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

-- 10. Create Customer Orders Table
CREATE TABLE IF NOT EXISTS public.customer_orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount BIGINT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('qris', 'bank_transfer')),
    payment_proof TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending_confirmation', 'preparing', 'delivery', 'finished', 'rejected')),
    verified_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at BIGINT,
    notes TEXT,
    table_id TEXT REFERENCES public.tables(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 11. Create Customer Order Items Table
CREATE TABLE IF NOT EXISTS public.customer_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    price BIGINT NOT NULL,
    subtotal BIGINT NOT NULL
);

-- 12. Add maxFileSize and bank_accounts columns to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "maxFileSize" BIGINT DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_accounts TEXT DEFAULT '[]';

-- Enable Row Level Security (RLS)
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;

-- Setup public access policies
DROP POLICY IF EXISTS "Allow public access" ON public.tables;
CREATE POLICY "Allow public access" ON public.tables FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access" ON public.customer_orders;
CREATE POLICY "Allow public access" ON public.customer_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access" ON public.customer_order_items;
CREATE POLICY "Allow public access" ON public.customer_order_items FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions to new tables
GRANT ALL ON public.tables TO anon, authenticated;
GRANT ALL ON public.customer_orders TO anon, authenticated;
GRANT ALL ON public.customer_order_items TO anon, authenticated;

-- Enable Realtime replication for customer_orders
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
