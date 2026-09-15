import crypto from 'crypto';
import QRCode from 'qrcode';

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
  qrImage?: string;
  invoiceNumber?: string;
  rawResponse?: any;
  error?: string;
}

export interface DokuStatusResponse {
  success: boolean;
  status: string; // 'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED'
  paid: boolean;
  invoiceNumber?: string;
  amount?: number;
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
 * - For POST/PUT with body: includes Digest:base64(sha256(body))
 * - For GET without body: Digest line is omitted
 */
export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  body?: string;
  secretKey: string;
}): { signature: string; digest: string } {
  const hasBody = typeof params.body === 'string' && params.body.length > 0;

  let digest = '';
  let componentSignature =
    `Client-Id:${params.clientId}\n` +
    `Request-Id:${params.requestId}\n` +
    `Request-Timestamp:${params.requestTimestamp}\n` +
    `Request-Target:${params.requestTarget}`;

  if (hasBody) {
    digest = crypto
      .createHash('sha256')
      .update(params.body!, 'utf8')
      .digest('base64');
    componentSignature += `\nDigest:${digest}`;
  }

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
 * Initiate DOKU Checkout Payment session and generate dynamic QR Code
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

  const executePost = async (useSpecificQris: boolean) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const paymentConfig: Record<string, any> = {
      payment_due_date: 60, // 60 minutes
    };

    if (useSpecificQris) {
      paymentConfig.payment_method_types = ['QRIS'];
    }

    const payload = {
      order: {
        invoice_number: request.orderId,
        amount: Math.round(request.amount),
        callback_url: request.callbackUrl || undefined,
        auto_redirect: true,
      },
      payment: paymentConfig,
      customer: {
        name: request.customerName || 'Pelanggan Resto',
        email: request.customerEmail || 'customer@viorepos.com',
      },
      additional_info: {
        integration_partner: 'ViorePos',
        tenant_id: config.clientId,
      },
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

    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  try {
    // 1. Try with QRIS channel restriction first
    let { res, data } = await executePost(true);

    // 2. If DOKU reports PAYMENT CHANNEL IS INACTIVE, fall back to unrestricted channels
    const isChannelInactive =
      !res.ok &&
      JSON.stringify(data).toLowerCase().includes('payment channel is inactive');

    if (isChannelInactive) {
      console.warn(
        `[DOKU] Specific QRIS channel inactive for client ${config.clientId}. Retrying with full checkout methods.`
      );
      const fallback = await executePost(false);
      res = fallback.res;
      data = fallback.data;
    }

    if (res.ok && data?.response?.payment?.url) {
      const paymentUrl = data.response.payment.url as string;

      // Generate inline visual QR Code Data URL so customer / cashier can scan immediately
      let qrImage = '';
      try {
        qrImage = await QRCode.toDataURL(paymentUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
      } catch (qrErr) {
        console.warn('Failed to generate QR Code data URL from paymentUrl:', qrErr);
      }

      return {
        success: true,
        paymentUrl,
        qrImage,
        invoiceNumber: request.orderId,
        rawResponse: data,
      };
    } else {
      const errorMsg =
        data?.error?.message ||
        data?.message?.[0] ||
        data?.message ||
        `HTTP ${res.status}: Gagal membuat pembayaran DOKU`;
      return {
        success: false,
        error: Array.isArray(errorMsg) ? errorMsg.join(', ') : String(errorMsg),
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

/**
 * Check DOKU Order / Transaction status using official Jokul GET endpoint
 */
export async function checkDokuOrderStatus(
  invoiceNumber: string,
  configOverride?: Partial<DokuConfig>
): Promise<DokuStatusResponse> {
  const config = { ...getActiveDokuConfig(), ...configOverride };
  const baseUrl = config.isProduction
    ? 'https://api.doku.com'
    : 'https://api-sandbox.doku.com';

  const requestTarget = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const requestId = `req_status_${Date.now()}`;
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const { signature } = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    secretKey: config.secretKey,
  });

  try {
    const res = await fetch(`${baseUrl}${requestTarget}`, {
      method: 'GET',
      headers: {
        'Client-Id': config.clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        'Signature': signature,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.transaction?.status) {
      const txStatus = String(data.transaction.status).toUpperCase();
      const isPaid = txStatus === 'SUCCESS';
      return {
        success: true,
        status: txStatus,
        paid: isPaid,
        invoiceNumber,
        amount: data?.order?.amount ? Number(data.order.amount) : undefined,
        rawResponse: data,
      };
    } else {
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        `HTTP ${res.status}: Gagal memeriksa status pesanan DOKU`;
      return {
        success: false,
        status: 'UNKNOWN',
        paid: false,
        invoiceNumber,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : String(errorMsg),
        rawResponse: data,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'ERROR',
      paid: false,
      invoiceNumber,
      error: err?.message || 'Koneksi status DOKU gagal',
    };
  }
}
