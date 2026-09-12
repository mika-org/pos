import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { encryptSecret } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { resolveTenantContext } from '@/lib/tenant-context';

const SettingsSchema = z.object({
  enabled: z.boolean(),
  environment: z.enum(['development', 'production']).default('development'),
  secretKey: z.string().trim().optional(),
  callbackToken: z.string().trim().optional(),
  clearSecret: z.boolean().optional(),
  clearCallbackToken: z.boolean().optional(),
});

async function requireTenantAdmin(request: NextRequest) {
  const context = await resolveTenantContext(request);
  if (!context.tenantId || context.session?.role !== 'admin') return null;
  return context;
}

export async function GET(request: NextRequest) {
  const context = await requireTenantAdmin(request);
  if (!context) return NextResponse.json({ error: 'Akses admin tenant diperlukan' }, { status: 403 });
  const tenantId = context.tenantId!;
  const settings = await prisma.storeSettings.findUnique({
    where: { tenantId_id: { tenantId, id: 'default' } },
  });
  return NextResponse.json({
    enabled: settings?.xenditEnabled ?? false,
    environment: settings?.xenditEnvironment ?? 'development',
    configured: Boolean(settings?.xenditSecretKeyEncrypted),
    callbackConfigured: Boolean(settings?.xenditCallbackTokenEncrypted),
  });
}

export async function POST(request: NextRequest) {
  const context = await requireTenantAdmin(request);
  if (!context) return NextResponse.json({ error: 'Akses admin tenant diperlukan' }, { status: 403 });
  const tenantId = context.tenantId!;
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Konfigurasi Xendit tidak valid' }, { status: 400 });

  const update: Record<string, unknown> = {
    xenditEnabled: parsed.data.enabled,
    xenditEnvironment: parsed.data.environment,
    updatedAt: BigInt(Date.now()),
  };
  if (parsed.data.clearSecret) update.xenditSecretKeyEncrypted = null;
  else if (parsed.data.secretKey) update.xenditSecretKeyEncrypted = encryptSecret(parsed.data.secretKey);
  if (parsed.data.clearCallbackToken) update.xenditCallbackTokenEncrypted = null;
  else if (parsed.data.callbackToken) update.xenditCallbackTokenEncrypted = encryptSecret(parsed.data.callbackToken);

  await prisma.storeSettings.upsert({
    where: { tenantId_id: { tenantId, id: 'default' } },
    update,
    create: {
      tenantId,
      id: 'default',
      storeName: 'POS System', storeAddress: '-', storePhone: '-',
      updatedAt: BigInt(Date.now()),
      ...update,
    },
  });
  const saved = await prisma.storeSettings.findUnique({
    where: { tenantId_id: { tenantId, id: 'default' } },
  });
  return NextResponse.json({
    ok: true,
    enabled: saved?.xenditEnabled,
    configured: Boolean(saved?.xenditSecretKeyEncrypted),
    callbackConfigured: Boolean(saved?.xenditCallbackTokenEncrypted),
  });
}
