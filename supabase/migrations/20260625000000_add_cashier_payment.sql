-- Migration: Add cashier payment method to customer_orders CHECK constraint
-- Run this in your Supabase SQL Editor to update constraint for 'cashier' method.

ALTER TABLE public.customer_orders DROP CONSTRAINT IF EXISTS customer_orders_payment_method_check;
ALTER TABLE public.customer_orders ADD CONSTRAINT customer_orders_payment_method_check CHECK (payment_method IN ('qris', 'bank_transfer', 'cashier'));
