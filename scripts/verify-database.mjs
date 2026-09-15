import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const bcryptHashPattern = /^\$2[ab]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

try {
  const slug = process.env.DEFAULT_TENANT_SLUG || 'restoflow';
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!tenant) throw new Error(`Tenant ${slug} tidak ditemukan`);

  const [categories, products, tables, users, settings, files, attempts, migrations, superAdmin, tenantAdmin, passwordAccounts] = await Promise.all([
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
    prisma.user.findMany({
      where: { deleted: false },
      select: { id: true, password: true },
    }),
  ]);

  const invalidPasswordHashCount = passwordAccounts.filter(
    (account) => !account.password || !bcryptHashPattern.test(account.password),
  ).length;
  const superAdminPasswordValid = Boolean(superAdmin?.password && bcryptHashPattern.test(superAdmin.password));
  const tenantAdminPasswordValid = Boolean(tenantAdmin?.password && bcryptHashPattern.test(tenantAdmin.password));

  console.log({
    database: new URL(process.env.DATABASE_URL).pathname.slice(1),
    tenant,
    counts: { categories, products, tables, users, settings, files, attempts },
    appliedMigrations: migrations[0]?.count ?? 0,
    accounts: {
      superAdmin: { email: superAdmin?.email, bcryptHashValid: superAdminPasswordValid },
      tenantAdmin: { email: tenantAdmin?.email, bcryptHashValid: tenantAdminPasswordValid },
    },
    passwordHashes: { checked: passwordAccounts.length, invalid: invalidPasswordHashCount },
  });

  if (!superAdminPasswordValid || !tenantAdminPasswordValid || invalidPasswordHashCount > 0) {
    throw new Error('Verifikasi hash BCrypt akun gagal');
  }
} finally {
  await prisma.$disconnect();
}
