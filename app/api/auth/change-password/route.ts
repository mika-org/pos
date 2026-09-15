import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPasswordValidationError, hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { destroySession, getSession } from '@/lib/session';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !['super_admin', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Akses Super Admin atau admin diperlukan' }, { status: 403 });
  }

  const parsed = ChangePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data perubahan password tidak valid' }, { status: 400 });
  }

  const validationError = getPasswordValidationError(parsed.data.newPassword);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { id: session.userId, role: session.role, deleted: false },
    select: { id: true, password: true },
  });
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password))) {
    return NextResponse.json({ error: 'Password saat ini salah' }, { status: 401 });
  }
  if (await verifyPassword(parsed.data.newPassword, user.password)) {
    return NextResponse.json({ error: 'Password baru harus berbeda dari password saat ini' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(parsed.data.newPassword), updatedAt: BigInt(Date.now()) },
  });
  await destroySession();

  return NextResponse.json({ ok: true, loginRequired: true });
}
