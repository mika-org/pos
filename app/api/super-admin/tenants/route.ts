import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { toJsonSafe } from '@/lib/serialization';

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().email().transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(10).max(200),
});

const UpdateSchema = z.object({
  id: z.string().uuid().or(z.string().startsWith('tenant_')),
  name: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

async function authorized() {
  const session = await getSession();
  return session?.role === 'super_admin';
}

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: 'Akses Super Admin diperlukan' }, { status: 403 });
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, products: true, transactions: true, customerOrders: true } },
      settings: { where: { id: 'default' }, select: { xenditEnabled: true, xenditSecretKeyEncrypted: true, storeName: true } },
    },
  });
  return NextResponse.json({
    tenants: toJsonSafe(tenants.map((tenant) => ({
      id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status,
      createdAt: tenant.createdAt, counts: tenant._count,
      storeName: tenant.settings[0]?.storeName || tenant.name,
      xenditEnabled: tenant.settings[0]?.xenditEnabled || false,
      xenditConfigured: Boolean(tenant.settings[0]?.xenditSecretKeyEncrypted),
    }))),
  });
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: 'Akses Super Admin diperlukan' }, { status: 403 });
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tenant tidak valid' }, { status: 400 });
  const now = BigInt(Date.now());
  try {
    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({ data: { name: parsed.data.name, slug: parsed.data.slug } });
      await tx.user.create({
        data: {
          id: crypto.randomUUID(), tenantId: created.id, name: parsed.data.adminName,
          email: parsed.data.adminEmail, password: await hash(parsed.data.adminPassword, 12),
          role: 'admin', createdAt: now, updatedAt: now,
        },
      });
      await tx.storeSettings.create({
        data: {
          tenantId: created.id, id: 'default', storeName: parsed.data.name,
          storeAddress: '-', storePhone: '-', taxPercentage: BigInt(0), maxFileSize: BigInt(5),
          bankAccounts: '[]', updatedAt: now,
        },
      });
      for (let index = 1; index <= 8; index += 1) {
        const suffix = String(index).padStart(2, '0');
        await tx.diningTable.create({
          data: { tenantId: created.id, id: `meja_${suffix}`, name: `Meja ${suffix}`, status: 'active', createdAt: now, updatedAt: now },
        });
      }
      return created;
    });
    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal membuat tenant' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: 'Akses Super Admin diperlukan' }, { status: 403 });
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.name && !parsed.data.status)) {
    return NextResponse.json({ error: 'Perubahan tenant tidak valid' }, { status: 400 });
  }
  const tenant = await prisma.tenant.update({
    where: { id: parsed.data.id },
    data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.status ? { status: parsed.data.status } : {}) },
  });
  return NextResponse.json({ tenant });
}
