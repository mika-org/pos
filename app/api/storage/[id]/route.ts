import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });

  if (!file.isPublic) {
    const session = await getSession();
    if (!session || (session.role !== 'super_admin' && session.tenantId !== file.tenantId)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
  }

  return new NextResponse(file.data, {
    headers: {
      'content-type': file.mimeType,
      'content-length': String(file.size),
      'content-disposition': `inline; filename="${file.filename.replaceAll('"', '')}"`,
      'cache-control': file.isPublic ? 'public, max-age=86400' : 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
