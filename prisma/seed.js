/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const categories = [
  ['cat_makanan', 'Makanan'],
  ['cat_minuman', 'Minuman'],
  ['cat_snack', 'Snack'],
  ['cat_paket', 'Paket Hemat'],
];

const products = [
  ['prod_nasi_goreng', 'Nasi Goreng Spesial', 'cat_makanan', '8990001000001', 12000, 20000, 50],
  ['prod_mie_goreng', 'Mie Goreng Pedas', 'cat_makanan', '8990001000002', 10000, 17000, 40],
  ['prod_ayam_bakar', 'Ayam Bakar Madu', 'cat_makanan', '8990001000003', 18000, 30000, 30],
  ['prod_gado_gado', 'Gado-Gado Komplit', 'cat_makanan', '8990001000004', 11000, 18000, 35],
  ['prod_soto_ayam', 'Soto Ayam Kampung', 'cat_makanan', '8990001000005', 13000, 22000, 25],
  ['prod_es_teh', 'Es Teh Manis', 'cat_minuman', '8990001000010', 2000, 7000, 100],
  ['prod_es_jeruk', 'Es Jeruk Peras', 'cat_minuman', '8990001000011', 4000, 10000, 80],
  ['prod_jus_alpukat', 'Jus Alpukat Susu', 'cat_minuman', '8990001000012', 8000, 18000, 40],
  ['prod_kopi_hitam', 'Kopi Hitam', 'cat_minuman', '8990001000013', 3000, 8000, 60],
  ['prod_thai_tea', 'Thai Tea Original', 'cat_minuman', '8990001000014', 6000, 15000, 50],
  ['prod_pisang_goreng', 'Pisang Goreng Crispy', 'cat_snack', '8990001000020', 3000, 8000, 60],
  ['prod_kentang_goreng', 'Kentang Goreng Keju', 'cat_snack', '8990001000021', 7000, 15000, 45],
  ['prod_cireng', 'Cireng Isi Bumbu Rujak', 'cat_snack', '8990001000022', 5000, 12000, 55],
  ['prod_paket_makan_a', 'Paket Makan A (Nasi + Lauk + Minum)', 'cat_paket', '8990001000030', 18000, 32000, 30],
  ['prod_paket_makan_b', 'Paket Makan B (Mie + Minum)', 'cat_paket', '8990001000031', 13000, 25000, 30],
];

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.startsWith('replace-')) throw new Error(`${name} wajib diisi sebelum seed`);
  return value;
}

async function main() {
  const now = BigInt(Date.now());
  const legacyTime = 1718985600000n;
  const tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'restoflow';
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: 'RestoFlow POS', status: 'active' },
    create: { id: 'tenant_restoflow', slug: tenantSlug, name: 'RestoFlow POS', status: 'active' },
  });

  const superAdminEmail = requireSecret('SUPER_ADMIN_EMAIL').toLowerCase();
  const tenantAdminEmail = requireSecret('TENANT_ADMIN_EMAIL').toLowerCase();
  const [superAdminPassword, tenantAdminPassword] = await Promise.all([
    bcrypt.hash(requireSecret('SUPER_ADMIN_PASSWORD'), 12),
    bcrypt.hash(requireSecret('TENANT_ADMIN_PASSWORD'), 12),
  ]);

  const existingSuperAdmin = await prisma.user.findFirst({ where: { email: superAdminEmail, role: 'super_admin' } });
  if (existingSuperAdmin) {
    await prisma.user.update({ where: { id: existingSuperAdmin.id }, data: { name: 'Super Admin', password: superAdminPassword, tenantId: null, deleted: false, updatedAt: now } });
  } else {
    await prisma.user.create({ data: { id: 'user_super_admin', name: 'Super Admin', email: superAdminEmail, password: superAdminPassword, role: 'super_admin', createdAt: now, updatedAt: now } });
  }
  const existingTenantAdmin = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: tenantAdminEmail } });
  if (existingTenantAdmin) {
    await prisma.user.update({ where: { id: existingTenantAdmin.id }, data: { name: 'Admin RestoFlow', password: tenantAdminPassword, role: 'admin', deleted: false, updatedAt: now } });
  } else {
    await prisma.user.create({ data: { id: 'user_tenant_admin', tenantId: tenant.id, name: 'Admin RestoFlow', email: tenantAdminEmail, password: tenantAdminPassword, role: 'admin', createdAt: now, updatedAt: now } });
  }

  for (const [id, name] of categories) {
    await prisma.category.upsert({
      where: { tenantId_id: { tenantId: tenant.id, id } },
      update: {},
      create: { tenantId: tenant.id, id, name, createdAt: legacyTime, updatedAt: legacyTime, deleted: false },
    });
  }
  for (const [id, name, categoryId, barcode, buyPrice, sellPrice, stock] of products) {
    await prisma.product.upsert({
      where: { tenantId_id: { tenantId: tenant.id, id } },
      update: {},
      create: {
        tenantId: tenant.id, id, name, categoryId, barcode,
        buyPrice: BigInt(buyPrice), sellPrice: BigInt(sellPrice), stock: BigInt(stock),
        createdAt: legacyTime, updatedAt: legacyTime, deleted: false,
      },
    });
  }
  for (let index = 1; index <= 8; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const id = `meja_${suffix}`;
    await prisma.diningTable.upsert({
      where: { tenantId_id: { tenantId: tenant.id, id } },
      update: {},
      create: { tenantId: tenant.id, id, name: `Meja ${suffix}`, status: 'active', createdAt: legacyTime, updatedAt: legacyTime },
    });
  }
  await prisma.storeSettings.upsert({
    where: { tenantId_id: { tenantId: tenant.id, id: 'default' } },
    update: {},
    create: {
      tenantId: tenant.id,
      id: 'default',
      storeName: 'RestoFlow POS',
      storeAddress: 'Jl. Merdeka No. 1, Jakarta Pusat',
      storePhone: '021-5550123',
      taxPercentage: 11n,
      maxFileSize: 5n,
      bankAccounts: JSON.stringify([
        { id: 'seed-bca', bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'RestoFlow Store' },
        { id: 'seed-mandiri', bankName: 'Mandiri', accountNumber: '0987654321', accountHolder: 'RestoFlow Store' },
      ]),
      updatedAt: now,
    },
  });

  console.log(`Seed selesai untuk tenant ${tenant.slug}.`);
  console.log(`Super admin: ${superAdminEmail}`);
  console.log(`Admin tenant: ${tenantAdminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
