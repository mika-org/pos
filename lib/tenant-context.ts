import 'server-only';

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function resolveTenantContext(request: NextRequest) {
  const session = await getSession();
  if (session?.tenantId) {
    return { session, tenantId: session.tenantId, tenantSlug: session.tenantSlug, isPublic: false };
  }

  const requestedSlug = request.headers.get('x-tenant-slug')
    || request.nextUrl.searchParams.get('tenant')
    || process.env.DEFAULT_TENANT_SLUG;

  if (!requestedSlug) {
    return { session, tenantId: null, tenantSlug: null, isPublic: !session };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: requestedSlug, status: 'active' },
    select: { id: true, slug: true },
  });

  return {
    session,
    tenantId: tenant?.id ?? null,
    tenantSlug: tenant?.slug ?? requestedSlug,
    isPublic: !session,
  };
}
