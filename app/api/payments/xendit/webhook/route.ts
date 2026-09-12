import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { decryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

function matches(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const token = request.headers.get('x-callback-token') || '';
  const payload = await request.json().catch(() => null);
  const requestId = payload?.payment_request_id || payload?.data?.payment_request_id;
  const status = payload?.status || payload?.data?.status;
  if (!requestId || !status) return NextResponse.json({ error: 'Payload webhook tidak valid' }, { status: 400 });

  const attempt = await prisma.paymentAttempt.findUnique({ where: { providerRequestId: String(requestId) } });
  if (!attempt) return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 });
  const settings = await prisma.storeSettings.findUnique({
    where: { tenantId_id: { tenantId: attempt.tenantId, id: 'default' } },
  });
  if (!settings?.xenditCallbackTokenEncrypted || !matches(token, decryptSecret(settings.xenditCallbackTokenEncrypted))) {
    return NextResponse.json({ error: 'Token callback tidak valid' }, { status: 401 });
  }
  await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: String(status) } });
  return NextResponse.json({ ok: true });
}
