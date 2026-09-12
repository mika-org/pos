import 'server-only';

import { prisma } from '@/lib/prisma';

const DATA_URL = /^data:([^;,]+);base64,([\s\S]+)$/;

export async function persistDataUrl(
  tenantId: string,
  value: unknown,
  kind: string,
  isPublic: boolean,
) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return value;
  const match = value.match(DATA_URL);
  if (!match) throw new Error('Format data URL tidak valid');

  const mimeType = match[1].toLowerCase();
  const data = Buffer.from(match[2], 'base64');
  if (data.length > 15 * 1024 * 1024) throw new Error('Ukuran file melebihi batas storage 15 MB');

  const extension = mimeType === 'application/pdf'
    ? 'pdf'
    : mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const file = await prisma.storedFile.create({
    data: {
      tenantId,
      kind,
      filename: `${kind}-${Date.now()}.${extension}`,
      mimeType,
      size: data.length,
      data,
      isPublic,
    },
    select: { id: true },
  });

  return `/api/storage/${file.id}`;
}

export async function materializeDataFields(
  table: string,
  tenantId: string,
  input: Record<string, unknown>,
) {
  const output = { ...input };
  if (table === 'products' && output.imageUrl) {
    output.imageUrl = await persistDataUrl(tenantId, output.imageUrl, 'product', true);
  }
  if (table === 'settings' && output.qrisImage) {
    output.qrisImage = await persistDataUrl(tenantId, output.qrisImage, 'qris', true);
  }
  if (table === 'customer_orders' && output.payment_proof && output.payment_proof !== 'cashier') {
    output.payment_proof = await persistDataUrl(tenantId, output.payment_proof, 'payment-proof', false);
  }
  return output;
}
