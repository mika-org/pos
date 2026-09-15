import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { decryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { resolveTenantContext } from '@/lib/tenant-context';
import { createXenditQris, findQrString } from '@/lib/xendit';
import { createDokuCheckout, getActiveDokuConfig } from '@/lib/doku';

const RequestSchema = z.object({
  referenceId: z.string().min(3).max(100),
  amount: z.number().int().min(1).max(10_000_000),
});

export async function POST(request: NextRequest) {
  const context = await resolveTenantContext(request);
  if (!context.tenantId) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  const tenantId = context.tenantId;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Nominal atau referensi tidak valid' }, { status: 400 });

  const settings = await prisma.storeSettings.findUnique({
    where: { tenantId_id: { tenantId, id: 'default' } },
  });
  const existing = await prisma.paymentAttempt.findUnique({
    where: { tenantId_referenceId: { tenantId, referenceId: parsed.data.referenceId } },
  });
  if (existing && existing.amount !== BigInt(parsed.data.amount)) {
    return NextResponse.json({ error: 'Nominal referensi pembayaran telah berubah' }, { status: 409 });
  }

  // Reuse existing dynamic QR if already generated and active
  if (existing?.mode === 'doku' && existing.qrString) {
    const qrImage = await QRCode.toDataURL(existing.qrString, { width: 320, margin: 2 });
    return NextResponse.json({
      mode: 'doku',
      paymentRequestId: existing.providerRequestId || existing.referenceId,
      status: existing.status,
      paymentUrl: existing.qrString,
      qrImage,
    });
  }

  if (existing?.mode === 'xendit' && existing.qrString) {
    return NextResponse.json({
      mode: 'xendit',
      paymentRequestId: existing.providerRequestId,
      status: existing.status,
      qrImage: await QRCode.toDataURL(existing.qrString, { width: 320, margin: 2 }),
    });
  }

  const staticFallback = async (warning?: string) => {
    if (!settings?.qrisImage) {
      return NextResponse.json({ error: 'QRIS belum dikonfigurasi untuk tenant ini' }, { status: 422 });
    }
    await prisma.paymentAttempt.upsert({
      where: { tenantId_referenceId: { tenantId, referenceId: parsed.data.referenceId } },
      update: { mode: 'static', status: 'AWAITING_PROOF', failureReason: warning || null },
      create: {
        tenantId,
        referenceId: parsed.data.referenceId,
        amount: BigInt(parsed.data.amount),
        mode: 'static',
        status: 'AWAITING_PROOF',
        failureReason: warning || null,
      },
    });
    return NextResponse.json({ mode: 'static', qrImage: settings.qrisImage, status: 'AWAITING_PROOF', warning });
  };

  // 1. Try DOKU Payment Gateway First
  const dokuConfig = getActiveDokuConfig();
  if (dokuConfig.clientId && dokuConfig.secretKey) {
    try {
      const dokuRes = await createDokuCheckout({
        orderId: parsed.data.referenceId,
        amount: parsed.data.amount,
        customerName: 'Pelanggan Toko',
        customerEmail: 'customer@viorepos.com',
      });

      if (dokuRes.success && dokuRes.paymentUrl) {
        await prisma.paymentAttempt.upsert({
          where: { tenantId_referenceId: { tenantId, referenceId: parsed.data.referenceId } },
          update: {
            providerRequestId: parsed.data.referenceId,
            qrString: dokuRes.paymentUrl,
            status: 'PENDING',
            mode: 'doku',
            failureReason: null,
          },
          create: {
            tenantId,
            referenceId: parsed.data.referenceId,
            amount: BigInt(parsed.data.amount),
            providerRequestId: parsed.data.referenceId,
            qrString: dokuRes.paymentUrl,
            status: 'PENDING',
            mode: 'doku',
          },
        });

        return NextResponse.json({
          mode: 'doku',
          paymentRequestId: parsed.data.referenceId,
          status: 'PENDING',
          paymentUrl: dokuRes.paymentUrl,
          qrImage: dokuRes.qrImage,
        });
      } else {
        console.warn('[QRIS Route] DOKU checkout generation failed:', dokuRes.error);
      }
    } catch (dokuError: any) {
      console.warn('[QRIS Route] DOKU exception:', dokuError?.message);
    }
  }

  // 2. Fall back to Xendit if configured
  if (settings?.xenditEnabled && settings.xenditSecretKeyEncrypted) {
    try {
      const payment = await createXenditQris(
        decryptSecret(settings.xenditSecretKeyEncrypted),
        parsed.data.referenceId,
        parsed.data.amount,
      );
      const qrString = findQrString(payment);
      if (!qrString) throw new Error('Xendit tidak mengembalikan QR string');
      await prisma.paymentAttempt.upsert({
        where: { tenantId_referenceId: { tenantId, referenceId: parsed.data.referenceId } },
        update: {
          providerRequestId: payment.payment_request_id,
          qrString,
          status: payment.status,
          mode: 'xendit',
          failureReason: null,
        },
        create: {
          tenantId,
          referenceId: parsed.data.referenceId,
          amount: BigInt(parsed.data.amount),
          providerRequestId: payment.payment_request_id,
          qrString,
          status: payment.status,
          mode: 'xendit',
        },
      });
      return NextResponse.json({
        mode: 'xendit',
        paymentRequestId: payment.payment_request_id,
        status: payment.status,
        qrImage: await QRCode.toDataURL(qrString, { width: 320, margin: 2 }),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Xendit tidak tersedia';
      return staticFallback(`Xendit tidak tersedia; menggunakan QRIS statis. ${reason}`);
    }
  }

  // 3. Fall back to static QRIS
  return staticFallback();
}
