/* eslint-disable @typescript-eslint/no-explicit-any */

import { hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toJsonSafe } from '@/lib/serialization';
import { materializeDataFields } from '@/lib/storage';
import { resolveTenantContext } from '@/lib/tenant-context';

const TABLES = {
  users: 'user', products: 'product', categories: 'category', customers: 'customer',
  suppliers: 'supplier', transactions: 'transaction', transaction_items: 'transactionItem',
  settings: 'storeSettings', tables: 'diningTable', customer_orders: 'customerOrder',
  customer_order_items: 'customerOrderItem',
} as const;

type TableName = keyof typeof TABLES;
type DataFilter = { field: unknown; operator: unknown; value: unknown };
const PUBLIC_READ = new Set<TableName>(['products', 'categories', 'settings', 'tables']);
const ADMIN_WRITE = new Set<TableName>(['users', 'products', 'categories', 'customers', 'suppliers', 'settings', 'tables']);
const AUTH_WRITE = new Set<TableName>(['transactions', 'transaction_items', 'customer_orders', 'customer_order_items']);
const FILTER_OPERATORS = new Set(['eq', 'in', 'gt', 'gte', 'lt', 'lte']);
const RESERVED_QUERY_FIELDS = new Set(['tenantId', 'tenant_id', 'tenant', 'password']);

const FIELD_MAP: Partial<Record<TableName, Record<string, string>>> = {
  settings: { bank_accounts: 'bankAccounts' },
  tables: { created_at: 'createdAt', updated_at: 'updatedAt' },
  customer_orders: {
    customer_name: 'customerName', customer_email: 'customerEmail', total_amount: 'totalAmount',
    payment_method: 'paymentMethod', payment_proof: 'paymentProof', payment_status: 'paymentStatus',
    xendit_payment_request_id: 'xenditPaymentRequestId', verified_by: 'verifiedBy',
    verified_at: 'verifiedAt', table_id: 'tableId', created_at: 'createdAt', updated_at: 'updatedAt',
  },
  customer_order_items: { order_id: 'orderId', product_id: 'productId' },
};

const BIGINT_FIELDS: Partial<Record<TableName, Set<string>>> = {
  users: new Set(['createdAt', 'updatedAt']),
  products: new Set(['buyPrice', 'sellPrice', 'stock', 'createdAt', 'updatedAt']),
  categories: new Set(['createdAt', 'updatedAt']), customers: new Set(['createdAt', 'updatedAt']),
  suppliers: new Set(['createdAt', 'updatedAt']),
  transactions: new Set(['date', 'subtotal', 'discount', 'tax', 'total', 'amountPaid', 'change', 'createdAt', 'updatedAt']),
  transaction_items: new Set(['price', 'qty', 'discount', 'subtotal']),
  settings: new Set(['taxPercentage', 'maxFileSize', 'updatedAt']), tables: new Set(['createdAt', 'updatedAt']),
  customer_orders: new Set(['totalAmount', 'verifiedAt', 'createdAt', 'updatedAt']),
  customer_order_items: new Set(['quantity', 'price', 'subtotal']),
};

function fieldName(table: TableName, field: string) { return FIELD_MAP[table]?.[field] || field; }
function coerceValue(table: TableName, field: string, value: unknown) {
  if (value == null) return value;
  if (BIGINT_FIELDS[table]?.has(field)) {
    if (Array.isArray(value)) return value.map((item) => BigInt(String(item)));
    return BigInt(String(value));
  }
  return value;
}
function translateData(table: TableName, value: Record<string, unknown>) {
  const translated: Record<string, unknown> = {};
  for (const [legacyKey, item] of Object.entries(value)) {
    if (legacyKey === 'tenantId') continue;
    const key = fieldName(table, legacyKey);
    translated[key] = coerceValue(table, key, item);
  }
  return translated;
}
function reverseRow(table: TableName, source: any): any {
  if (!source || typeof source !== 'object') return source;
  const reverse = Object.fromEntries(Object.entries(FIELD_MAP[table] || {}).map(([legacy, key]) => [key, legacy]));
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'tenantId' || key === 'password' || key.includes('Encrypted')) continue;
    if (key === 'product' && table === 'customer_order_items') { output.products = value; continue; }
    output[reverse[key] || key] = value;
  }
  if (table === 'settings') output.xenditConfigured = Boolean(source.xenditSecretKeyEncrypted);
  return output;
}
function canReadPublicOrder(table: TableName, filters: any[]) {
  if (table === 'customer_orders') return filters.some((filter) => filter.field === 'id' && filter.operator === 'eq');
  if (table === 'customer_order_items') return filters.some((filter) => filter.field === 'order_id' && filter.operator === 'eq');
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const table = body.table as TableName;
    const operation = String(body.operation || 'select');
    const filters: DataFilter[] = Array.isArray(body.filters) ? body.filters : [];
    if (!(table in TABLES)) return NextResponse.json({ error: 'Tabel tidak diizinkan' }, { status: 400 });
    if (filters.some((filter) => (
      !filter || typeof filter !== 'object'
      || !FILTER_OPERATORS.has(String(filter.operator))
      || RESERVED_QUERY_FIELDS.has(String(filter.field))
      || String(filter.field).includes('Encrypted')
    ))) {
      return NextResponse.json({ error: 'Filter data tidak diizinkan' }, { status: 400 });
    }
    if (body.order && RESERVED_QUERY_FIELDS.has(String(body.order.field))) {
      return NextResponse.json({ error: 'Urutan data tidak diizinkan' }, { status: 400 });
    }

    const context = await resolveTenantContext(request);
    if (!context.tenantId) return NextResponse.json({ error: 'Tenant tidak ditemukan atau nonaktif' }, { status: 404 });
    if (context.session?.role === 'super_admin') {
      return NextResponse.json({ error: 'Gunakan API Super Admin untuk akses lintas tenant' }, { status: 403 });
    }
    const isRead = operation === 'select';
    if (context.isPublic && isRead && !PUBLIC_READ.has(table) && !canReadPublicOrder(table, filters)) {
      return NextResponse.json({ error: 'Akses publik ditolak' }, { status: 403 });
    }
    if (context.isPublic && !isRead) return NextResponse.json({ error: 'Login diperlukan' }, { status: 401 });
    if (!isRead) {
      const role = context.session?.role;
      const allowed = (role === 'admin' && ADMIN_WRITE.has(table)) || (Boolean(role) && AUTH_WRITE.has(table));
      if (!allowed) return NextResponse.json({ error: 'Hak akses tidak cukup' }, { status: 403 });
    }
    if (table === 'users' && context.session?.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin tenant yang dapat mengelola pengguna' }, { status: 403 });
    }

    const delegate = (prisma as any)[TABLES[table]];
    const where: Record<string, any> = { tenantId: context.tenantId };
    for (const filter of filters) {
      const field = fieldName(table, String(filter.field));
      const value = coerceValue(table, field, filter.value);
      const operator = String(filter.operator);
      if (operator === 'eq') where[field] = value;
      else {
        const current = typeof where[field] === 'object' && where[field] ? where[field] : {};
        where[field] = { ...current, [operator]: value };
      }
    }
    // Tenant dari sesi/header selalu menjadi batas akhir dan tidak dapat dioverride oleh filter klien.
    where.tenantId = context.tenantId;

    if (operation === 'select') {
      const include = table === 'customer_order_items' && String(body.select).includes('products')
        ? { product: { select: { name: true } } } : undefined;
      const query = {
        where, ...(include ? { include } : {}),
        ...(body.order ? { orderBy: { [fieldName(table, body.order.field)]: body.order.ascending ? 'asc' : 'desc' } } : {}),
        ...(body.limit ? { take: Math.min(Math.max(Number(body.limit), 1), 2000) } : {}),
      };
      const result = body.single ? await delegate.findFirst(query) : await delegate.findMany(query);
      if (body.single && !result) {
        return NextResponse.json({ data: null, error: { message: 'Data tidak ditemukan', code: 'PGRST116' } });
      }
      const rows = Array.isArray(result) ? result.map((row) => reverseRow(table, row)) : reverseRow(table, result);
      return NextResponse.json({ data: toJsonSafe(rows), error: null });
    }

    const rawValues = Array.isArray(body.values) ? body.values : [body.values];
    if (rawValues.some((value: unknown) => !value || typeof value !== 'object')) {
      return NextResponse.json({ error: 'Payload data tidak valid' }, { status: 400 });
    }
    const prepared: Record<string, unknown>[] = [];
    for (const rawValue of rawValues) {
      const stored = await materializeDataFields(table, context.tenantId, rawValue);
      const data = translateData(table, stored);
      delete data.tenantId;
      if (table === 'users' && typeof data.password === 'string') {
        if (!data.password) delete data.password;
        else if (!data.password.startsWith('$2')) data.password = await hash(data.password, 12);
      }
      if (table === 'users' && !['admin', 'kasir'].includes(String(data.role))) {
        return NextResponse.json({ error: 'Role pengguna tidak valid' }, { status: 400 });
      }
      prepared.push(data);
    }

    if (operation === 'insert') {
      for (const data of prepared) await delegate.create({ data: { ...data, tenantId: context.tenantId } });
    } else if (operation === 'update') {
      if (filters.length === 0) return NextResponse.json({ error: 'Update memerlukan filter' }, { status: 400 });
      await delegate.updateMany({ where, data: prepared[0] });
    } else if (operation === 'upsert') {
      for (const data of prepared) {
        const id = String(data.id || 'default');
        const exists = await delegate.findFirst({ where: { tenantId: context.tenantId, id } });
        if (exists) await delegate.updateMany({ where: { tenantId: context.tenantId, id }, data });
        else await delegate.create({ data: { ...data, id, tenantId: context.tenantId } });
      }
    } else if (operation === 'delete') {
      if (filters.length === 0) return NextResponse.json({ error: 'Delete memerlukan filter' }, { status: 400 });
      await delegate.deleteMany({ where });
    } else {
      return NextResponse.json({ error: 'Operasi tidak didukung' }, { status: 400 });
    }
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error('Database API error:', error);
    const message = error instanceof Error ? error.message : 'Operasi database gagal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
