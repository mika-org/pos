import nextEnv from '@next/env';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE FEATURE TESTS ---');
  let failures = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failures++;
    }
  }

  try {
    // 1. Tenant Verification
    const slug = process.env.DEFAULT_TENANT_SLUG || 'restoflow';
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    assert(tenant !== null && tenant.status === 'active', `Tenant '${slug}' active`);

    // 2. Auth Credentials
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'super_admin', email: process.env.SUPER_ADMIN_EMAIL?.toLowerCase(), deleted: false },
    });
    const superAdminValid = superAdmin && await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD, superAdmin.password);
    assert(Boolean(superAdminValid), 'Super Admin credentials valid');

    const tenantAdmin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'admin', email: process.env.TENANT_ADMIN_EMAIL?.toLowerCase(), deleted: false },
    });
    const tenantAdminValid = tenantAdmin && await bcrypt.compare(process.env.TENANT_ADMIN_PASSWORD, tenantAdmin.password);
    assert(Boolean(tenantAdminValid), 'Tenant Admin credentials valid');

    // 3. JWT Session Signing and Verification
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const sessionPayload = {
      userId: tenantAdmin.id,
      email: tenantAdmin.email,
      name: tenantAdmin.name,
      role: tenantAdmin.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };
    const token = await new SignJWT(sessionPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret);
    const { payload: verifiedPayload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    assert(verifiedPayload.email === tenantAdmin.email, 'JWT session creation & verification');

    // 4. Master Data
    const products = await prisma.product.findMany({ where: { tenantId: tenant.id, deleted: false } });
    assert(products.length > 0, `Products found: ${products.length} products`);

    const categories = await prisma.category.findMany({ where: { tenantId: tenant.id, deleted: false } });
    assert(categories.length > 0, `Categories found: ${categories.length} categories`);

    const tables = await prisma.diningTable.findMany({ where: { tenantId: tenant.id } });
    assert(tables.length > 0, `Dining tables found: ${tables.length} tables`);

    // 5. Test POS Checkout Transaction (Cash)
    const testProduct = products[0];
    const initialStock = testProduct.stock;
    const testTxId = `test_tx_${Date.now()}`;
    const testItemId = `test_item_${Date.now()}`;
    const qty = BigInt(2);
    const lineSubtotal = testProduct.sellPrice * qty;
    const settings = await prisma.storeSettings.findUnique({ where: { tenantId_id: { tenantId: tenant.id, id: 'default' } } });
    const tax = (lineSubtotal * (settings?.taxPercentage || BigInt(0)) + BigInt(50)) / BigInt(100);
    const total = lineSubtotal + tax;
    const amountPaid = total + BigInt(10000);
    const change = amountPaid - total;

    // Simulate checkout transaction creation with ISO string date (testing our fix)
    const now = new Date();
    const isoDateString = now.toISOString();
    const txDate = new Date(isoDateString);

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          tenantId: tenant.id,
          id: testTxId,
          no: `TRX-TEST-${Date.now()}`,
          date: txDate,
          subtotal: lineSubtotal,
          discount: BigInt(0),
          tax,
          total,
          paymentMethod: 'Tunai',
          amountPaid,
          change,
          status: 'completed',
          userId: tenantAdmin.id,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.transactionItem.create({
        data: {
          tenantId: tenant.id,
          id: testItemId,
          transactionId: testTxId,
          productId: testProduct.id,
          productName: testProduct.name,
          price: testProduct.sellPrice,
          qty,
          discount: BigInt(0),
          subtotal: lineSubtotal,
        },
      });

      await tx.product.update({
        where: { tenantId_id: { tenantId: tenant.id, id: testProduct.id } },
        data: { stock: { decrement: qty }, updatedAt: now },
      });
    });

    const createdTx = await prisma.transaction.findUnique({
      where: { tenantId_id: { tenantId: tenant.id, id: testTxId } },
      include: { items: true },
    });
    assert(createdTx !== null && createdTx.items.length === 1, 'POS Cash checkout transaction saved');

    const updatedProduct = await prisma.product.findUnique({
      where: { tenantId_id: { tenantId: tenant.id, id: testProduct.id } },
    });
    assert(updatedProduct.stock === initialStock - qty, 'Product stock decremented on checkout');

    // 6. Test POS Hold Bill Transaction
    const holdTxId = `hold_tx_${Date.now()}`;
    const holdItemId = `hold_item_${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          tenantId: tenant.id,
          id: holdTxId,
          no: `HLD-TEST-${Date.now()}`,
          date: new Date(isoDateString),
          subtotal: lineSubtotal,
          discount: BigInt(0),
          tax: BigInt(0),
          total: lineSubtotal,
          paymentMethod: '-',
          amountPaid: BigInt(0),
          change: BigInt(0),
          status: 'hold',
          userId: tenantAdmin.id,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.transactionItem.create({
        data: {
          tenantId: tenant.id,
          id: holdItemId,
          transactionId: holdTxId,
          productId: testProduct.id,
          productName: testProduct.name,
          price: testProduct.sellPrice,
          qty,
          discount: BigInt(0),
          subtotal: lineSubtotal,
        },
      });
    });

    const createdHoldTx = await prisma.transaction.findUnique({
      where: { tenantId_id: { tenantId: tenant.id, id: holdTxId } },
    });
    assert(createdHoldTx !== null && createdHoldTx.status === 'hold', 'POS Hold Bill transaction saved');

    // 7. Test Customer Order (Online / Table Ordering)
    const testOrderId = `order_test_${Date.now()}`;
    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.create({
        data: {
          tenantId: tenant.id,
          id: testOrderId,
          customerName: 'Budi Santoso',
          customerEmail: 'budi@test.local',
          totalAmount: total,
          paymentMethod: 'cashier',
          paymentProof: 'cashier',
          paymentStatus: 'pending',
          status: 'pending_confirmation',
          notes: 'Meja dekat jendela',
          tableId: tables[0].id,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.customerOrderItem.create({
        data: {
          tenantId: tenant.id,
          id: `${testOrderId}-${testProduct.id}`,
          orderId: testOrderId,
          productId: testProduct.id,
          quantity: qty,
          price: testProduct.sellPrice,
          subtotal: lineSubtotal,
        },
      });
      return order;
    });
    assert(createdOrder !== null && createdOrder.status === 'pending_confirmation', 'Customer Order created');

    // Test workflow status transitions
    await prisma.customerOrder.update({
      where: { tenantId_id: { tenantId: tenant.id, id: testOrderId } },
      data: { status: 'preparing', verifiedBy: tenantAdmin.id, verifiedAt: now },
    });
    const preparingOrder = await prisma.customerOrder.findUnique({
      where: { tenantId_id: { tenantId: tenant.id, id: testOrderId } },
    });
    assert(preparingOrder.status === 'preparing', 'Customer Order status transition: preparing');

    await prisma.customerOrder.update({
      where: { tenantId_id: { tenantId: tenant.id, id: testOrderId } },
      data: { status: 'finished' },
    });
    const finishedOrder = await prisma.customerOrder.findUnique({
      where: { tenantId_id: { tenantId: tenant.id, id: testOrderId } },
    });
    assert(finishedOrder.status === 'finished', 'Customer Order status transition: finished');

    // 8. Test Reports Query (transactions + customer_orders within date range)
    const reportTransactions = await prisma.transaction.findMany({
      where: { tenantId: tenant.id, date: { gte: new Date(now.getTime() - 86400000) } },
    });
    assert(reportTransactions.length > 0, `Reports transaction query: found ${reportTransactions.length}`);

    // Cleanup test records
    await prisma.transactionItem.deleteMany({ where: { transactionId: { in: [testTxId, holdTxId] } } });
    await prisma.transaction.deleteMany({ where: { id: { in: [testTxId, holdTxId] } } });
    await prisma.customerOrderItem.deleteMany({ where: { orderId: testOrderId } });
    await prisma.customerOrder.deleteMany({ where: { id: testOrderId } });
    // Restore product stock
    await prisma.product.update({
      where: { tenantId_id: { tenantId: tenant.id, id: testProduct.id } },
      data: { stock: initialStock },
    });
    console.log('🧹 Cleaned up temporary test data.');

  } catch (err) {
    console.error('Test execution error:', err);
    failures++;
  } finally {
    await prisma.$disconnect();
  }

  if (failures === 0) {
    console.log('\n🎉 ALL FEATURE TESTS PASSED SUCCESSFULLY! (0 failures)');
  } else {
    console.error(`\n❌ ${failures} TESTS FAILED!`);
    process.exit(1);
  }
}

void runTests();
