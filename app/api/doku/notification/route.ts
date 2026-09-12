import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;
    const clientId = headers.get('Client-Id');
    const signature = headers.get('Signature');

    let bodyData: any = {};
    try {
      bodyData = JSON.parse(rawBody);
    } catch {
      // Non-json
    }

    const orderId = bodyData?.order?.invoice_number;
    const transactionStatus = bodyData?.transaction?.status; // e.g. 'SUCCESS'

    console.log(`[DOKU Notification] Order: ${orderId}, Status: ${transactionStatus}`);

    // If order succeeded in DOKU, update status in customer_orders
    if (orderId && transactionStatus === 'SUCCESS') {
      try {
        await supabase
          .from('customer_orders')
          .update({
            status: 'preparing', // Automatically verified and moved to preparing
            verified_at: Date.now(),
            notes: `DOKU Payment Confirmed (${clientId})`,
            updated_at: Date.now()
          })
          .eq('id', orderId);
      } catch (dbErr) {
        console.warn('Could not update customer_orders status:', dbErr);
      }
    }

    // DOKU expects HTTP 200 response to acknowledge receipt
    return NextResponse.json({
      status: 'OK',
      message: 'Notification received successfully',
    });
  } catch (error: any) {
    console.error('Error handling DOKU notification:', error);
    return NextResponse.json(
      { status: 'ERROR', message: error?.message || 'Processing failed' },
      { status: 500 }
    );
  }
}
