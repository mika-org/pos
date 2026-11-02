import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const BASE_URL = 'http://localhost:3200';
const prisma = new PrismaClient();

async function runE2E() {
  console.log('=== STARTING HTTP E2E API TESTS (PORT 3200) ===');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failures++;
    }
  }

  let sessionCookie = '';

  try {
    // 1. Test Login WITHOUT tenantSlug (verifying our login fallback fix)
    console.log('\n--- 1. Testing Auth Login ---');
    const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.TENANT_ADMIN_EMAIL,
        password: process.env.TENANT_ADMIN_PASSWORD,
      }),
    });
    const loginData1 = await loginRes1.json();
    assert(loginRes1.ok && loginData1.user?.role === 'admin', 'Login without tenantSlug succeeds with fallback to default tenant');

    const setCookieHeader = loginRes1.headers.get('set-cookie');
    if (setCookieHeader) {
      sessionCookie = setCookieHeader.split(';')[0];
    }
    assert(sessionCookie.includes('pos_session='), 'pos_session cookie returned');

    // 2. Test Session Endpoint
    console.log('\n--- 2. Testing Auth Session ---');
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: sessionCookie },
    });
    const sessionData = await sessionRes.json();
    assert(sessionRes.ok && sessionData.user?.email === process.env.TENANT_ADMIN_EMAIL.toLowerCase(), 'Session valid and authenticated');

    // 3. Test /api/data to fetch products
    console.log('\n--- 3. Testing /api/data Products Fetch ---');
    const productsRes = await fetch(`${BASE_URL}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        table: 'products',
        operation: 'select',
        filters: [{ field: 'deleted', operator: 'eq', value: false }],
      }),
    });
    const productsData = await productsRes.json();
    assert(productsRes.ok && Array.isArray(productsData.data) && productsData.data.length > 0, `Fetched ${productsData.data?.length} products via /api/data`);

    const testProduct = productsData.data[0];
    const initialStock = Number(testProduct.stock);

    // 4. Test POS Checkout with real HTTP call (using ISO string date like frontend sends)
    console.log('\n--- 4. Testing POS Checkout (/api/pos/checkout) ---');
    const txId = `e2e_tx_${Date.now()}`;
    const txNo = `TRX-E2E-${Date.now()}`;
    const qty = 2;
    const price = Number(testProduct.sellPrice);
    const subtotal = price * qty;
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;
    const amountPaid = total + 5000;

    const checkoutPayload = {
      hold: false,
      transaction: {
        id: txId,
        no: txNo,
        date: new Date().toISOString(), // The exact format that previously failed!
        subtotal,
        discount: 0,
        tax,
        total,
        paymentMethod: 'Tunai',
        amountPaid,
        change: amountPaid - total,
        status: 'completed',
      },
      items: [
        {
          id: `item_${Date.now()}`,
          productId: testProduct.id,
          productName: testProduct.name,
          price,
          qty,
          discount: 0,
          subtotal,
        },
      ],
    };

    const checkoutRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify(checkoutPayload),
    });
    const checkoutResult = await checkoutRes.json();
    assert(checkoutRes.ok && checkoutResult.ok === true, `POS Checkout completed successfully: ${JSON.stringify(checkoutResult)}`);

    // Verify stock decremented
    const dbProduct = await prisma.product.findUnique({
      where: { tenantId_id: { tenantId: sessionData.user.tenantId, id: testProduct.id } },
    });
    assert(Number(dbProduct.stock) === initialStock - qty, `Stock decremented from ${initialStock} to ${dbProduct.stock}`);

    // 5. Test POS Hold Bill
    console.log('\n--- 5. Testing POS Hold Bill (/api/pos/checkout) ---');
    const holdTxId = `e2e_hold_${Date.now()}`;
    const holdPayload = {
      hold: true,
      transaction: {
        id: holdTxId,
        no: `HLD-E2E-${Date.now()}`,
        date: new Date().toISOString(),
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        paymentMethod: '-',
        amountPaid: 0,
        change: 0,
        status: 'hold',
      },
      items: [
        {
          id: `hold_item_${Date.now()}`,
          productId: testProduct.id,
          productName: testProduct.name,
          price,
          qty,
          discount: 0,
          subtotal,
        },
      ],
    };

    const holdRes = await fetch(`${BASE_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify(holdPayload),
    });
    const holdResult = await holdRes.json();
    assert(holdRes.ok && holdResult.ok === true, `POS Hold Bill completed successfully`);

    // 6. Test Public Customer Order (/api/public/orders)
    console.log('\n--- 6. Testing Public Customer Order (/api/public/orders) ---');
    const publicOrderId = `e2e_order_${Date.now()}`;
    const publicOrderRes = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': sessionData.user.tenantSlug,
      },
      body: JSON.stringify({
        orderId: publicOrderId,
        customerName: 'Customer Test E2E',
        customerEmail: 'customer.test@example.com',
        tableId: null,
        paymentMethod: 'cashier',
        paymentProof: 'cashier',
        notes: 'Order takeaway E2E',
        items: [{ productId: testProduct.id, quantity: 1 }],
      }),
    });
    const publicOrderData = await publicOrderRes.json();
    assert(publicOrderRes.ok && publicOrderData.order?.id === publicOrderId, `Public Order created: ${publicOrderData.order?.id}`);

    // 7. Cleanup
    console.log('\n--- 7. Cleanup E2E Records ---');
    await prisma.transactionItem.deleteMany({ where: { transactionId: { in: [txId, holdTxId] } } });
    await prisma.transaction.deleteMany({ where: { id: { in: [txId, holdTxId] } } });
    await prisma.customerOrderItem.deleteMany({ where: { orderId: publicOrderId } });
    await prisma.customerOrder.deleteMany({ where: { id: publicOrderId } });
    await prisma.product.update({
      where: { tenantId_id: { tenantId: sessionData.user.tenantId, id: testProduct.id } },
      data: { stock: BigInt(initialStock) },
    });
    console.log('🧹 Cleaned up temporary E2E records and restored stock.');

  } catch (err) {
    console.error('E2E error:', err);
    failures++;
  } finally {
    await prisma.$disconnect();
  }

  if (failures === 0) {
    console.log('\n🎉 ALL HTTP E2E TESTS PASSED SUCCESSFULLY! (0 failures)');
  } else {
    console.error(`\n❌ ${failures} E2E TESTS FAILED!`);
    process.exit(1);
  }
}

void runE2E();

