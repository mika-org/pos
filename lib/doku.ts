import crypto from 'crypto';

export interface DokuConfig {
  clientId: string;
  secretKey: string;
  apiKey?: string;
  publicKey?: string;
  isProduction?: boolean;
}

export interface DokuPaymentRequest {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  callbackUrl?: string;
}

export interface DokuPaymentResponse {
  success: boolean;
  paymentUrl?: string;
  invoiceNumber?: string;
  rawResponse?: any;
  error?: string;
}

/**
 * Get active DOKU configuration from environment variables or fallback values
 */
export function getActiveDokuConfig(): DokuConfig {
  return {
    clientId: process.env.DOKU_CLIENT_ID || 'BRN-0232-1788668958800',
    secretKey: process.env.DOKU_SECRET_KEY || 'SK-ePUnXcEg73lttDKzMQS5',
    apiKey: process.env.DOKU_API_KEY || 'doku_key_ad4e81ce69f3459c815eae45ba7d8183',
    publicKey: process.env.DOKU_PUBLIC_KEY || '',
    isProduction: process.env.DOKU_IS_PRODUCTION === 'true',
  };
}

/**
 * Generate DOKU Jokul Signature according to official specification
 * Signature format: HMACSHA256=base64(hmac_sha256(rawSignature, secretKey))
 */
export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  body: string;
  secretKey: string;
}): { signature: string; digest: string } {
  // 1. Calculate Digest: base64 of SHA256 of body
  const digest = crypto
    .createHash('sha256')
    .update(params.body, 'utf8')
    .digest('base64');

  // 2. Prepare component signature string
  const componentSignature = 
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${params.requestTarget}\n` +
    `Digest:${digest}`;

  // 3. Calculate HMAC-SHA256 using Secret Key
  const hmac = crypto
    .createHmac('sha256', params.secretKey)
    .update(componentSignature, 'utf8')
    .digest('base64');

  return {
    signature: `HMACSHA256=${hmac}`,
    digest,
  };
}

/**
 * Initiate DOKU Checkout Payment session
 */
export async function createDokuCheckout(
  request: DokuPaymentRequest,
  configOverride?: Partial<DokuConfig>
): Promise<DokuPaymentResponse> {
  const config = { ...getActiveDokuConfig(), ...configOverride };
  const baseUrl = config.isProduction
    ? 'https://api.doku.com'
    : 'https://api-sandbox.doku.com';

  const requestTarget = '/checkout/v1/payment';
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const payload = {
    order: {
      invoice_number: request.orderId,
      amount: Math.round(request.amount),
      callback_url: request.callbackUrl || undefined,
      auto_redirect: true,
    },
    payment: {
      payment_due_date: 60, // 60 minutes
    },
    customer: {
      name: request.customerName || 'Pelanggan Resto',
      email: request.customerEmail || 'customer@viorepos.com',
    },
    additional_info: {
      integration_partner: 'ViorePos',
      tenant_id: config.clientId,
    }
  };

  const bodyStr = JSON.stringify(payload);
  const { signature, digest } = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    body: bodyStr,
    secretKey: config.secretKey,
  });

  try {
    const res = await fetch(`${baseUrl}${requestTarget}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': config.clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        'Signature': signature,
        'Digest': digest,
      },
      body: bodyStr,
    });

    const data = await res.json();

    if (res.ok && data?.response?.payment?.url) {
      return {
        success: true,
        paymentUrl: data.response.payment.url,
        invoiceNumber: request.orderId,
        rawResponse: data,
      };
    } else {
      // In sandbox mode or if DOKU returns specific message
      const errorMsg = data?.error?.message || data?.message || `HTTP ${res.status}: Gagal membuat pembayaran DOKU`;
      return {
        success: false,
        error: errorMsg,
        rawResponse: data,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Koneksi ke DOKU API gagal',
    };
  }
}
