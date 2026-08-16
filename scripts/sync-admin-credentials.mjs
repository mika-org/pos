import nextEnv from '@next/env';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
}

async function syncUser({ email, password, role, tenantId, defaultId, name }) {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { role, tenantId, OR: [{ email: normalizedEmail }, { id: defaultId }] },
  });
  const values = {
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    role,
    tenantId,
    deleted: false,
    updatedAt: BigInt(Date.now()),
  };

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: values });
    return;
  }

  await prisma.user.create({
    data: { id: defaultId, name, createdAt: BigInt(Date.now()), ...values },
  });
}

try {
  const tenantSlug = required('DEFAULT_TENANT_SLUG');
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} tidak ditemukan; jalankan db:seed terlebih dahulu`);

  await syncUser({
    email: required('SUPER_ADMIN_EMAIL'),
    password: required('SUPER_ADMIN_PASSWORD'),
    role: 'super_admin',
    tenantId: null,
    defaultId: 'user_super_admin',
    name: 'Super Admin',
  });
  await syncUser({
    email: required('TENANT_ADMIN_EMAIL'),
    password: required('TENANT_ADMIN_PASSWORD'),
    role: 'admin',
    tenantId: tenant.id,
    defaultId: 'user_tenant_admin',
    name: 'Admin RestoFlow',
  });

  console.log('Kredensial Super Admin dan admin tenant telah disinkronkan dari .env.');
} finally {
  await prisma.$disconnect();
}
