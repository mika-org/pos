import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';

const LoginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  tenantSlug: z.string().trim().toLowerCase().optional(),
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email, password, atau tenant tidak valid' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: parsed.data.email,
      deleted: false,
      ...(parsed.data.tenantSlug
        ? { OR: [{ role: 'super_admin' }, { tenant: { slug: parsed.data.tenantSlug } }] }
        : { role: 'super_admin' }),
    },
    include: { tenant: { select: { id: true, slug: true, name: true, status: true } } },
  });

  if (!user?.password || !(await compare(parsed.data.password, user.password))) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
  }
  if (user.role !== 'super_admin' && (!user.tenant || user.tenant.status !== 'active')) {
    return NextResponse.json({ error: 'Tenant sedang dinonaktifkan' }, { status: 403 });
  }

  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug ?? null,
  };
  await createSession(payload);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
      tenantName: user.tenant?.name ?? null,
    },
  });
}
