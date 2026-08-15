import nextEnv from '@next/env';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

try {
  const slug = process.env.DEFAULT_TENANT_SLUG || 'restoflow';
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!tenant) throw new Error(`Tenant ${slug} tidak ditemukan`);

  const [categories, products, tables, users, settings, files, attempts, migrations, superAdmin, tenantAdmin] = await Promise.all([
    prisma.category.count({ where: { tenantId: tenant.id } }),
    prisma.product.count({ where: { tenantId: tenant.id } }),
    prisma.diningTable.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id, deleted: false } }),
    prisma.storeSettings.count({ where: { tenantId: tenant.id } }),
    prisma.storedFile.count({ where: { tenantId: tenant.id } }),
    prisma.paymentAttempt.count({ where: { tenantId: tenant.id } }),
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    prisma.user.findFirst({
      where: { tenantId: null, email: process.env.SUPER_ADMIN_EMAIL?.toLowerCase(), role: 'super_admin', deleted: false },
      select: { email: true, password: true },
    }),
    prisma.user.findFirst({
      where: { tenantId: tenant.id, email: process.env.TENANT_ADMIN_EMAIL?.toLowerCase(), role: 'admin', deleted: false },
      select: { email: true, password: true },
    }),
  ]);

  const superAdminPasswordValid = Boolean(
    superAdmin && process.env.SUPER_ADMIN_PASSWORD
    && superAdmin.password
    && await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD, superAdmin.password),
  );
  const tenantAdminPasswordValid = Boolean(
    tenantAdmin && process.env.TENANT_ADMIN_PASSWORD
    && tenantAdmin.password
    && await bcrypt.compare(process.env.TENANT_ADMIN_PASSWORD, tenantAdmin.password),
  );

  console.log({
    database: new URL(process.env.DATABASE_URL).pathname.slice(1),
    tenant,
    counts: { categories, products, tables, users, settings, files, attempts },
    appliedMigrations: migrations[0]?.count ?? 0,
    accounts: {
      superAdmin: { email: superAdmin?.email, passwordValid: superAdminPasswordValid },
      tenantAdmin: { email: tenantAdmin?.email, passwordValid: tenantAdminPasswordValid },
    },
  });

  if (!superAdminPasswordValid || !tenantAdminPasswordValid) {
    throw new Error('Verifikasi kredensial seed gagal');
  }
} finally {
  await prisma.$disconnect();
}
