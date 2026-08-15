import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
import { lookup } from 'node:dns/promises';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const sourceUrl = process.env.SUPABASE_SOURCE_URL?.replace(/\/$/, '');
const sourceKey = process.env.SUPABASE_SOURCE_SECRET_KEY
  || process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SOURCE_ANON_KEY;
const tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'restoflow';
const pageSize = 500;

const tables = [
  'users', 'categories', 'customers', 'suppliers', 'products', 'tables', 'settings',
  'transactions', 'transaction_items', 'customer_orders', 'customer_order_items',
];

function required(value, name) {
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
}

function sourceHeaders(extra = {}) {
  const key = required(
    sourceKey,
    'SUPABASE_SOURCE_SECRET_KEY, SUPABASE_SOURCE_SERVICE_ROLE_KEY, atau SUPABASE_SOURCE_ANON_KEY',
  );
  const headers = { apikey: key, ...extra };
  // Key generasi baru bukan JWT dan cukup dikirim sebagai apikey.
  if (!key.startsWith('sb_secret_') && !key.startsWith('sb_publishable_')) {
    headers.authorization = `Bearer ${key}`;
  }
  return headers;
}

function errorDetails(error) {
  const messages = [];
  let current = error;
  while (current && typeof current === 'object') {
    const message = current.message || current.code;
    if (message && !messages.includes(message)) messages.push(message);
    current = current.cause;
  }
  return messages.join(' -> ') || String(error);
}

async function validateSourceConnection() {
  const configuredUrl = required(sourceUrl, 'SUPABASE_SOURCE_URL');
  let parsed;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error('SUPABASE_SOURCE_URL bukan URL yang valid');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('SUPABASE_SOURCE_URL harus menggunakan http atau https');
  }

  try {
    await lookup(parsed.hostname);
  } catch (error) {
    if (error?.code === 'ENOTFOUND') {
      throw new Error(
        `Host Supabase ${parsed.hostname} tidak ditemukan di DNS (NXDOMAIN). `
        + 'Periksa project ref pada Supabase Dashboard; project mungkin salah, dihapus, atau belum dipulihkan.',
      );
    }
    throw new Error(`DNS Supabase gagal: ${errorDetails(error)}`);
  }

  required(
    sourceKey,
    'SUPABASE_SOURCE_SECRET_KEY, SUPABASE_SOURCE_SERVICE_ROLE_KEY, atau SUPABASE_SOURCE_ANON_KEY',
  );
  if (!process.env.SUPABASE_SOURCE_SECRET_KEY && !process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY) {
    console.warn(
      'Peringatan: SUPABASE_SOURCE_SECRET_KEY/SUPABASE_SOURCE_SERVICE_ROLE_KEY belum diisi. '
      + 'Anon key hanya dapat membaca row yang diizinkan policy RLS dan hasil migrasi mungkin tidak lengkap.',
    );
  }
}

async function readTable(table) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${required(sourceUrl, 'SUPABASE_SOURCE_URL')}/rest/v1/${table}?select=*`, {
      headers: sourceHeaders({ range: `${offset}-${offset + pageSize - 1}` }),
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function persistAsset(tenantId, value, kind, isPublic) {
  if (!value || value === 'cashier' || value.startsWith('/api/storage/')) return value;
  let mimeType;
  let data;

  const dataUrl = value.match(/^data:([^;,]+);base64,(.+)$/s);
  if (dataUrl) {
    mimeType = dataUrl[1].toLowerCase();
    data = Buffer.from(dataUrl[2], 'base64');
  } else if (/^https?:\/\//i.test(value)) {
    try {
      const headers = value.startsWith(sourceUrl) && sourceKey
        ? sourceHeaders()
        : {};
      const response = await fetch(value, { headers });
      if (!response.ok) return value;
      mimeType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
      data = Buffer.from(await response.arrayBuffer());
    } catch {
      return value;
    }
  } else {
    return value;
  }

  if (!data || data.length > 15 * 1024 * 1024) return value;
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const file = await prisma.storedFile.create({
    data: { tenantId, kind, filename: `${kind}-${Date.now()}.${extension}`, mimeType, size: data.length, data, isPublic },
    select: { id: true },
  });
  return `/api/storage/${file.id}`;
}

const bigint = (value, fallback = 0) => BigInt(value ?? fallback);

async function importRows(tenantId, data) {
  const counts = {};

  for (const row of data.users) {
    const email = String(row.email).toLowerCase();
    const existing = await prisma.user.findFirst({ where: { tenantId, email } });
    if (existing?.role === 'super_admin') continue;
    const values = {
      tenantId, name: row.name || email, email, password: row.password || null,
      role: row.role === 'admin' ? 'admin' : 'kasir',
      createdAt: bigint(row.createdAt, Date.now()), updatedAt: bigint(row.updatedAt, Date.now()),
      deleted: Boolean(row.deleted),
    };
    if (existing) await prisma.user.update({ where: { id: existing.id }, data: values });
    else await prisma.user.create({ data: { id: String(row.id), ...values } });
  }
  counts.users = data.users.length;

  for (const row of data.categories) {
    await prisma.category.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } },
      update: { name: row.name, updatedAt: bigint(row.updatedAt), deleted: Boolean(row.deleted) },
      create: { tenantId, id: String(row.id), name: row.name, createdAt: bigint(row.createdAt), updatedAt: bigint(row.updatedAt), deleted: Boolean(row.deleted) },
    });
  }
  counts.categories = data.categories.length;

  for (const table of ['customers', 'suppliers']) {
    const delegate = prisma[table.slice(0, -1)];
    for (const row of data[table]) {
      const values = {
        name: row.name, phone: row.phone || '', address: row.address || null,
        createdAt: bigint(row.createdAt), updatedAt: bigint(row.updatedAt), deleted: Boolean(row.deleted),
      };
      await delegate.upsert({
        where: { tenantId_id: { tenantId, id: String(row.id) } },
        update: values,
        create: { tenantId, id: String(row.id), ...values },
      });
    }
    counts[table] = data[table].length;
  }

  for (const row of data.products) {
    const imageUrl = await persistAsset(tenantId, row.imageUrl, 'product', true);
    const values = {
      name: row.name, categoryId: String(row.categoryId), barcode: row.barcode || null,
      buyPrice: bigint(row.buyPrice), sellPrice: bigint(row.sellPrice), stock: bigint(row.stock), imageUrl,
      createdAt: bigint(row.createdAt), updatedAt: bigint(row.updatedAt), deleted: Boolean(row.deleted),
    };
    await prisma.product.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.products = data.products.length;

  for (const row of data.tables) {
    const values = { name: row.name, status: row.status || 'active', createdAt: bigint(row.created_at), updatedAt: bigint(row.updated_at) };
    await prisma.diningTable.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.tables = data.tables.length;

  for (const row of data.settings) {
    const qrisImage = await persistAsset(tenantId, row.qrisImage, 'qris', true);
    const values = {
      storeName: row.storeName || 'POS System', storeAddress: row.storeAddress || '-', storePhone: row.storePhone || '-',
      taxPercentage: bigint(row.taxPercentage), qrisImage, maxFileSize: bigint(row.maxFileSize, 5),
      bankAccounts: typeof row.bank_accounts === 'string' ? row.bank_accounts : JSON.stringify(row.bank_accounts || []),
      updatedAt: bigint(row.updatedAt, Date.now()),
    };
    await prisma.storeSettings.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id || 'default') } }, update: values,
      create: { tenantId, id: String(row.id || 'default'), ...values },
    });
  }
  counts.settings = data.settings.length;

  for (const row of data.transactions) {
    const values = {
      no: row.no, date: bigint(row.date), customerId: row.customerId || null, subtotal: bigint(row.subtotal),
      discount: bigint(row.discount), tax: bigint(row.tax), total: bigint(row.total), paymentMethod: row.paymentMethod,
      amountPaid: bigint(row.amountPaid), change: bigint(row.change), note: row.note || null, status: row.status,
      userId: row.userId || null, createdAt: bigint(row.createdAt), updatedAt: bigint(row.updatedAt),
    };
    await prisma.transaction.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.transactions = data.transactions.length;

  for (const row of data.transaction_items) {
    const values = {
      transactionId: String(row.transactionId), productId: String(row.productId), productName: row.productName,
      price: bigint(row.price), qty: bigint(row.qty), discount: bigint(row.discount), subtotal: bigint(row.subtotal),
    };
    await prisma.transactionItem.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.transaction_items = data.transaction_items.length;

  for (const row of data.customer_orders) {
    const paymentProof = await persistAsset(tenantId, row.payment_proof, 'payment-proof', false);
    const values = {
      customerName: row.customer_name, customerEmail: row.customer_email, totalAmount: bigint(row.total_amount),
      paymentMethod: row.payment_method, paymentProof: paymentProof || 'legacy', paymentStatus: row.payment_status || 'pending',
      xenditPaymentRequestId: row.xendit_payment_request_id || null, status: row.status,
      verifiedBy: row.verified_by || null, verifiedAt: row.verified_at == null ? null : bigint(row.verified_at),
      notes: row.notes || null, tableId: row.table_id || null, createdAt: bigint(row.created_at), updatedAt: bigint(row.updated_at),
    };
    await prisma.customerOrder.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.customer_orders = data.customer_orders.length;

  for (const row of data.customer_order_items) {
    const product = await prisma.product.findUnique({ where: { tenantId_id: { tenantId, id: String(row.product_id) } } });
    if (!product) {
      console.warn(`Lewati customer_order_items ${row.id}: product ${row.product_id} tidak ditemukan`);
      continue;
    }
    const values = {
      orderId: String(row.order_id), productId: String(row.product_id), quantity: bigint(row.quantity),
      price: bigint(row.price), subtotal: bigint(row.subtotal),
    };
    await prisma.customerOrderItem.upsert({
      where: { tenantId_id: { tenantId, id: String(row.id) } }, update: values,
      create: { tenantId, id: String(row.id), ...values },
    });
  }
  counts.customer_order_items = data.customer_order_items.length;
  return counts;
}

async function main() {
  console.log(`Membaca Supabase ${sourceUrl}...`);
  await validateSourceConnection();
  const data = {};
  for (const table of tables) {
    data[table] = await readTable(table);
    console.log(`${table}: ${data[table].length} row`);
  }
  if (dryRun) {
    console.log('Dry-run selesai; PostgreSQL tidak diubah.');
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} belum ada. Jalankan npm run db:seed terlebih dahulu.`);
  const counts = await importRows(tenant.id, data);
  console.log('Migrasi Supabase -> PostgreSQL selesai:', counts);
}

main()
  .catch((error) => {
    console.error('Migrasi gagal:', errorDetails(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
