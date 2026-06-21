-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Custom Schema "public"
CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON SCHEMA public TO publictgres, service_role;

-- 1. Create Categories Table
CREATE TABLE public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 2. Create Products Table
CREATE TABLE public.products (
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
CREATE TABLE public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 4. Create Suppliers Table
CREATE TABLE public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

-- 5. Create Transactions Table
CREATE TABLE public.transactions (
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
CREATE TABLE public.transaction_items (
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
CREATE TABLE public.users (
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
CREATE TABLE public.settings (
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

CREATE POLICY "Allow public access" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.customers FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.transaction_items FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.settings FOR ALL USING (true);

-- Explicitly grant table permissions to anon role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
