import { NextRequest, NextResponse } from 'next/server';
import { decryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getXenditPayment } from '@/lib/xendit';
import { checkDokuOrderStatus } from '@/lib/doku';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenantContext(request);
  if (!tenant.tenantId) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  const { id } = await context.params;
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { tenantId: tenant.tenantId, providerRequestId: id },
  });
  if (!attempt) return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 });

  // 1. Handle DOKU Payment Mode
  if (attempt.mode === 'doku') {
    if (attempt.status === 'SUCCEEDED') {
      return NextResponse.json({ status: 'SUCCEEDED', paid: true, mode: 'doku' });
    }

    try {
      const dokuStatus = await checkDokuOrderStatus(attempt.providerRequestId || attempt.referenceId);
      if (dokuStatus.success && dokuStatus.paid) {
        // Payment has been verified
        await prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED' },
        });

        // If this order corresponds to a customer_order, update it too
        try {
          await prisma.customerOrder.updateMany({
            where: { tenantId: tenant.tenantId, id: attempt.referenceId },
            data: {
              status: 'preparing',
              verifiedAt: new Date(),
              notes: 'DOKU QRIS Payment Verified',
            },
          });
        } catch (dbErr) {
          console.warn('[DOKU Status] Could not update customer order status:', dbErr);
        }

        return NextResponse.json({ status: 'SUCCEEDED', paid: true, mode: 'doku' });
      }

      return NextResponse.json({
        status: dokuStatus.status || attempt.status,
        paid: false,
        mode: 'doku',
      });
    } catch (error: any) {
      return NextResponse.json({
        error: error?.message || 'Gagal memeriksa status pembayaran DOKU',
        status: attempt.status,
        paid: false,
        mode: 'doku',
      });
    }
  }

  // 2. Handle Xendit Payment Mode
  if (attempt.mode === 'xendit') {
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

  return NextResponse.json({ status: attempt.status, paid: false, mode: attempt.mode });
}
