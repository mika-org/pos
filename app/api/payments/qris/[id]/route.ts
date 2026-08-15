import { NextRequest, NextResponse } from 'next/server';
import { decryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getXenditPayment } from '@/lib/xendit';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenantContext(request);
  if (!tenant.tenantId) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  const { id } = await context.params;
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { tenantId: tenant.tenantId, providerRequestId: id },
  });
  if (!attempt) return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 });
  if (attempt.mode !== 'xendit') return NextResponse.json({ status: attempt.status, paid: false, mode: attempt.mode });

  const settings = await prisma.storeSettings.findUnique({
    where: { tenantId_id: { tenantId: tenant.tenantId, id: 'default' } },
  });
  if (!settings?.xenditSecretKeyEncrypted) {
    return NextResponse.json({ error: 'Konfigurasi Xendit tidak tersedia' }, { status: 409 });
  }
  try {
    const payment = await getXenditPayment(decryptSecret(settings.xenditSecretKeyEncrypted), id);
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: payment.status } });
    return NextResponse.json({ status: payment.status, paid: payment.status === 'SUCCEEDED', mode: 'xendit' });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Gagal memeriksa pembayaran',
      status: attempt.status,
      paid: attempt.status === 'SUCCEEDED',
    }, { status: 502 });
  }
}
