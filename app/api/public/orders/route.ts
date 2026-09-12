import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { decryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { persistDataUrl } from '@/lib/storage';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getXenditPayment } from '@/lib/xendit';

const OrderSchema = z.object({
  orderId: z.string().min(6).max(100),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().email().max(200),
  tableId: z.string().max(100).nullable(),
  paymentMethod: z.enum(['qris', 'bank_transfer', 'cashier']),
  paymentProof: z.string().max(22_000_000).optional(),
  xenditPaymentRequestId: z.string().max(200).optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(100) })).min(1).max(100),
});

export async function POST(request: NextRequest) {
  const context = await resolveTenantContext(request);
  if (!context.tenantId) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  const parsed = OrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data pesanan tidak valid' }, { status: 400 });
  const input = parsed.data;

  const ids = [...new Set(input.items.map((item) => item.productId))];
  const [products, settings, diningTable] = await Promise.all([
    prisma.product.findMany({ where: { tenantId: context.tenantId, id: { in: ids }, deleted: false } }),
    prisma.storeSettings.findUnique({ where: { tenantId_id: { tenantId: context.tenantId, id: 'default' } } }),
    input.tableId ? prisma.diningTable.findUnique({ where: { tenantId_id: { tenantId: context.tenantId, id: input.tableId } } }) : null,
  ]);
  if (products.length !== ids.length) return NextResponse.json({ error: 'Salah satu produk tidak tersedia' }, { status: 409 });
  if (input.tableId && (!diningTable || diningTable.status !== 'active')) {
    return NextResponse.json({ error: 'Meja tidak tersedia' }, { status: 409 });
  }
  const productMap = new Map(products.map((product) => [product.id, product]));
  let subtotal = BigInt(0);
  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    if (product.stock < BigInt(item.quantity)) return NextResponse.json({ error: `Stok ${product.name} tidak cukup` }, { status: 409 });
    subtotal += product.sellPrice * BigInt(item.quantity);
  }
  const tax = (subtotal * (settings?.taxPercentage || BigInt(0)) + BigInt(50)) / BigInt(100);
  const total = subtotal + tax;

  let paymentProof = input.paymentMethod === 'cashier' ? 'cashier' : '';
  let paymentStatus = 'pending';
  if (input.paymentMethod === 'qris' && input.xenditPaymentRequestId) {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { tenantId: context.tenantId, providerRequestId: input.xenditPaymentRequestId, referenceId: input.orderId },
    });
    if (!attempt || attempt.amount !== total) return NextResponse.json({ error: 'Referensi Xendit tidak cocok dengan pesanan' }, { status: 409 });
    let status = attempt.status;
    if (status !== 'SUCCEEDED' && settings?.xenditSecretKeyEncrypted) {
      const payment = await getXenditPayment(decryptSecret(settings.xenditSecretKeyEncrypted), input.xenditPaymentRequestId);
      status = payment.status;
      await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status } });
    }
    if (status !== 'SUCCEEDED') return NextResponse.json({ error: 'Pembayaran Xendit belum berhasil' }, { status: 409 });
    paymentProof = `xendit:${input.xenditPaymentRequestId}`;
    paymentStatus = 'paid';
  } else if (input.paymentMethod !== 'cashier') {
    if (!input.paymentProof) return NextResponse.json({ error: 'Bukti pembayaran wajib diunggah' }, { status: 400 });
    paymentProof = String(await persistDataUrl(context.tenantId, input.paymentProof, 'payment-proof', false));
  }

  const now = BigInt(Date.now());
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.customerOrder.create({
        data: {
          tenantId: context.tenantId!, id: input.orderId, customerName: input.customerName,
          customerEmail: input.customerEmail.toLowerCase(), totalAmount: total,
          paymentMethod: input.paymentMethod, paymentProof, paymentStatus,
          xenditPaymentRequestId: input.xenditPaymentRequestId || null,
          status: 'pending_confirmation', tableId: input.tableId, createdAt: now, updatedAt: now,
        },
      });
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        await tx.customerOrderItem.create({
          data: {
            tenantId: context.tenantId!, id: `${input.orderId}-${item.productId}`, orderId: input.orderId,
            productId: item.productId, quantity: BigInt(item.quantity), price: product.sellPrice,
            subtotal: product.sellPrice * BigInt(item.quantity),
          },
        });
      }
      return created;
    });
    return NextResponse.json({ order: { id: order.id, totalAmount: Number(order.totalAmount), status: order.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan pesanan';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
