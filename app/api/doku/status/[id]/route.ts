import { NextRequest, NextResponse } from 'next/server';
import { checkDokuOrderStatus } from '@/lib/doku';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const result = await checkDokuOrderStatus(id);

    // If payment succeeded, also update customer_orders in Supabase/PostgreSQL
    if (result.success && result.paid) {
      try {
        await supabase
          .from('customer_orders')
          .update({
            status: 'preparing',
            verified_at: new Date(),
            notes: 'DOKU QRIS Payment Confirmed',
            updated_at: new Date(),
          })
          .eq('id', id);
      } catch (dbErr) {
        console.warn('Could not auto-update customer_orders:', dbErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to check DOKU status' },
      { status: 500 }
    );
  }
}
