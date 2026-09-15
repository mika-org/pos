import nextEnv from '@next/env';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const forcePasswordSync = process.env.SYNC_ADMIN_PASSWORDS === 'true';
const bcryptHashPattern = /^\$2[ab]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

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
    role,
    tenantId,
    deleted: false,
    updatedAt: BigInt(Date.now()),
  };

  if (existing) {
    const shouldUpdatePassword = forcePasswordSync || !existing.password || !bcryptHashPattern.test(existing.password);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...values,
        ...(shouldUpdatePassword ? { password: await bcrypt.hash(password, 12) } : {}),
      },
    });
    return { created: false, passwordUpdated: shouldUpdatePassword };
  }

  await prisma.user.create({
    data: {
      id: defaultId,
      name,
      password: await bcrypt.hash(password, 12),
      createdAt: BigInt(Date.now()),
      ...values,
    },
  });
  return { created: true, passwordUpdated: true };
}

try {
  const tenantSlug = required('DEFAULT_TENANT_SLUG');
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} tidak ditemukan; jalankan db:seed terlebih dahulu`);

  const superAdminResult = await syncUser({
    email: required('SUPER_ADMIN_EMAIL'),
    password: required('SUPER_ADMIN_PASSWORD'),
    role: 'super_admin',
    tenantId: null,
    defaultId: 'user_super_admin',
    name: 'Super Admin',
  });
  const tenantAdminResult = await syncUser({
    email: required('TENANT_ADMIN_EMAIL'),
    password: required('TENANT_ADMIN_PASSWORD'),
    role: 'admin',
    tenantId: tenant.id,
    defaultId: 'user_tenant_admin',
    name: 'Admin Viore Pos',
  });

  console.log({
    mode: forcePasswordSync ? 'force-password-reset-from-env' : 'bootstrap-preserve-database-passwords',
    superAdmin: superAdminResult,
    tenantAdmin: tenantAdminResult,
  });
  if (!forcePasswordSync) {
    console.log('Password akun yang sudah ada dipertahankan. Gunakan SYNC_ADMIN_PASSWORDS=true hanya untuk pemulihan darurat.');
  }
} finally {
  await prisma.$disconnect();
}
