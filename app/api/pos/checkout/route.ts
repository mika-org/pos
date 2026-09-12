import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { resolveTenantContext } from '@/lib/tenant-context';

type CheckoutProduct = {
  id: string;
  name: string;
  sellPrice: bigint;
  stock: bigint;
};

const CheckoutSchema = z.object({
  hold: z.boolean().default(false),
  paymentReferenceId: z.string().min(3).max(100).optional(),
  xenditPaymentRequestId: z.string().min(3).max(200).optional(),
  transaction: z.object({
    id: z.string().min(1), no: z.string().min(1), date: z.number().int(), customerId: z.string().nullable().optional(),
    discount: z.number().min(0), paymentMethod: z.string(), amountPaid: z.number().min(0), note: z.string().nullable().optional(),
  }),
  items: z.array(z.object({
    id: z.string().min(1), productId: z.string().min(1), qty: z.number().int().min(1), discount: z.number().min(0),
  })).min(1).max(200),
});

export async function POST(request: NextRequest) {
  const context = await resolveTenantContext(request);
  if (!context.tenantId || !context.session || !['admin', 'kasir'].includes(context.session.role)) {
    return NextResponse.json({ error: 'Login kasir diperlukan' }, { status: 401 });
  }
  const parsed = CheckoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data checkout tidak valid' }, { status: 400 });
  const { transaction, items, hold, paymentReferenceId, xenditPaymentRequestId } = parsed.data;
  const tenantId = context.tenantId;
  const productIds = [...new Set(items.map((item) => item.productId))];
  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, id: { in: productIds }, deleted: false },
      select: { id: true, name: true, sellPrice: true, stock: true },
    }) as Promise<CheckoutProduct[]>,
    prisma.storeSettings.findUnique({
      where: { tenantId_id: { tenantId, id: 'default' } },
      select: { taxPercentage: true },
    }) as Promise<{ taxPercentage: bigint } | null>,
  ]);
  if (products.length !== productIds.length) return NextResponse.json({ error: 'Produk checkout tidak lengkap' }, { status: 409 });
  const productMap = new Map<string, CheckoutProduct>(products.map((product: CheckoutProduct) => [product.id, product]));
  const insufficientStock = !hold
    ? items.find((item) => productMap.get(item.productId)!.stock < BigInt(item.qty))
    : undefined;
  if (insufficientStock) {
    return NextResponse.json({ error: `Stok ${productMap.get(insufficientStock.productId)!.name} tidak cukup` }, { status: 409 });
  }
  let subtotal = BigInt(0);
  const normalizedItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const gross = product.sellPrice * BigInt(item.qty);
    const discount = BigInt(Math.round(item.discount));
    const lineSubtotal = gross > discount ? gross - discount : BigInt(0);
    subtotal += lineSubtotal;
    return { ...item, product, discount, subtotal: lineSubtotal };
  });
  const globalDiscount = BigInt(Math.round(transaction.discount));
  const afterDiscount = subtotal > globalDiscount ? subtotal - globalDiscount : BigInt(0);
  const tax = hold ? BigInt(0) : (afterDiscount * (settings?.taxPercentage || BigInt(0)) + BigInt(50)) / BigInt(100);
  const total = afterDiscount + tax;
  const amountPaid = BigInt(Math.round(transaction.amountPaid));
  if (!hold && amountPaid < total) return NextResponse.json({ error: 'Uang pembayaran kurang' }, { status: 409 });
  if (!hold && transaction.paymentMethod === 'QRIS') {
    if (!paymentReferenceId) {
      return NextResponse.json({ error: 'Referensi pembayaran QRIS tidak ditemukan' }, { status: 409 });
    }
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { tenantId_referenceId: { tenantId, referenceId: paymentReferenceId } },
    });
    if (!attempt || attempt.amount !== total) {
      return NextResponse.json({ error: 'Nominal atau referensi pembayaran QRIS tidak cocok' }, { status: 409 });
    }
    if (attempt.mode === 'xendit' && (
      attempt.status !== 'SUCCEEDED'
      || !xenditPaymentRequestId
      || attempt.providerRequestId !== xenditPaymentRequestId
    )) {
      return NextResponse.json({ error: 'Pembayaran Xendit belum diterima' }, { status: 409 });
    }
  }
  const now = BigInt(Date.now());

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          tenantId, id: transaction.id, no: transaction.no, date: BigInt(transaction.date),
          customerId: transaction.customerId || null, subtotal, discount: globalDiscount, tax, total,
          paymentMethod: hold ? '-' : transaction.paymentMethod, amountPaid: hold ? BigInt(0) : amountPaid,
          change: hold ? BigInt(0) : amountPaid - total, note: transaction.note || null,
          status: hold ? 'hold' : 'completed', userId: context.session!.userId, createdAt: now, updatedAt: now,
        },
      });
      for (const item of normalizedItems) {
        await tx.transactionItem.create({
          data: {
            tenantId, id: item.id, transactionId: transaction.id, productId: item.productId,
            productName: item.product.name, price: item.product.sellPrice, qty: BigInt(item.qty),
            discount: item.discount, subtotal: item.subtotal,
          },
        });
        if (!hold) {
          await tx.product.update({
            where: { tenantId_id: { tenantId, id: item.productId } },
            data: { stock: { decrement: BigInt(item.qty) }, updatedAt: now },
          });
        }
      }
    });
    return NextResponse.json({ ok: true, totals: { subtotal: Number(subtotal), tax: Number(tax), total: Number(total) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout gagal' }, { status: 409 });
  }
}
