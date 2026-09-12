import { NextRequest, NextResponse } from 'next/server';
import { createDokuCheckout, getActiveDokuConfig } from '@/lib/doku';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, customerName, customerEmail, configOverride } = body;

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: 'orderId dan amount wajib diisi' },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;
    const callbackUrl = `${origin}/order?status=doku_callback&orderId=${orderId}`;

    const result = await createDokuCheckout(
      {
        orderId,
        amount: Number(amount),
        customerName: customerName || 'Pelanggan',
        customerEmail: customerEmail || 'customer@viorepos.com',
        callbackUrl,
      },
      configOverride
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating DOKU payment session:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = getActiveDokuConfig();
  return NextResponse.json({
    status: 'online',
    clientId: config.clientId,
    isProduction: config.isProduction,
    tenantStatus: 'active',
  });
}
