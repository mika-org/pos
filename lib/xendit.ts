import 'server-only';

const XENDIT_API = 'https://api.xendit.co/v3/payment_requests';
const API_VERSION = '2024-11-11';

export interface XenditPaymentRequest {
  payment_request_id: string;
  reference_id: string;
  status: string;
  request_amount: number;
  actions?: Array<{
    type: string;
    descriptor: string;
    value: string;
  }>;
}

function headers(secretKey: string) {
  return {
    authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    'content-type': 'application/json',
    'api-version': API_VERSION,
  };
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error_code || `Xendit HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload as XenditPaymentRequest;
}

export async function createXenditQris(secretKey: string, referenceId: string, amount: number) {
  const response = await fetch(XENDIT_API, {
    method: 'POST',
    headers: headers(secretKey),
    body: JSON.stringify({
      reference_id: referenceId,
      type: 'PAY',
      country: 'ID',
      currency: 'IDR',
      request_amount: amount,
      capture_method: 'AUTOMATIC',
      channel_code: 'QRIS',
      description: `Pembayaran POS ${referenceId}`,
      metadata: { order_reference: referenceId },
    }),
    cache: 'no-store',
  });
  return parseResponse(response);
}

export async function getXenditPayment(secretKey: string, paymentRequestId: string) {
  const response = await fetch(`${XENDIT_API}/${encodeURIComponent(paymentRequestId)}`, {
    headers: headers(secretKey),
    cache: 'no-store',
  });
  return parseResponse(response);
}

export function findQrString(payment: XenditPaymentRequest) {
  return payment.actions?.find((action) => action.descriptor === 'QR_STRING')?.value
    || payment.actions?.find((action) => action.type === 'PRESENT_TO_CUSTOMER')?.value
    || null;
}
