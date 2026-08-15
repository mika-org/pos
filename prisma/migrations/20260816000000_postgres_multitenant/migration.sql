-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'kasir');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "products" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "barcode" TEXT,
    "buyPrice" BIGINT NOT NULL,
    "sellPrice" BIGINT NOT NULL,
    "stock" BIGINT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "customers" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "customerId" TEXT,
    "subtotal" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL,
    "tax" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "amountPaid" BIGINT NOT NULL,
    "change" BIGINT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "qty" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL,
    "subtotal" BIGINT NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "settings" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'POS System',
    "storeAddress" TEXT NOT NULL DEFAULT '-',
    "storePhone" TEXT NOT NULL DEFAULT '-',
    "taxPercentage" BIGINT NOT NULL DEFAULT 0,
    "qrisImage" TEXT,
    "maxFileSize" BIGINT NOT NULL DEFAULT 5,
    "bank_accounts" TEXT NOT NULL DEFAULT '[]',
    "xendit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "xendit_environment" TEXT NOT NULL DEFAULT 'development',
    "xendit_secret_key_encrypted" TEXT,
    "xendit_callback_token_encrypted" TEXT,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "tables" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "customer_orders" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_proof" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "xendit_payment_request_id" TEXT,
    "status" TEXT NOT NULL,
    "verified_by" TEXT,
    "verified_at" BIGINT,
    "notes" TEXT,
    "table_id" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "customer_order_items" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "price" BIGINT NOT NULL,
    "subtotal" BIGINT NOT NULL,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("tenantId","id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "qr_string" TEXT,
    "failure_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_deleted_idx" ON "users"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "categories_tenantId_deleted_idx" ON "categories"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "products_tenantId_categoryId_idx" ON "products"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "products_tenantId_deleted_idx" ON "products"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "customers_tenantId_deleted_idx" ON "customers"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_deleted_idx" ON "suppliers"("tenantId", "deleted");

-- CreateIndex
CREATE INDEX "transactions_tenantId_date_idx" ON "transactions"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tenantId_no_key" ON "transactions"("tenantId", "no");

-- CreateIndex
CREATE INDEX "transaction_items_tenantId_transactionId_idx" ON "transaction_items"("tenantId", "transactionId");

-- CreateIndex
CREATE INDEX "tables_tenantId_status_idx" ON "tables"("tenantId", "status");

-- CreateIndex
CREATE INDEX "customer_orders_tenantId_status_created_at_idx" ON "customer_orders"("tenantId", "status", "created_at");

-- CreateIndex
CREATE INDEX "customer_orders_xendit_payment_request_id_idx" ON "customer_orders"("xendit_payment_request_id");

-- CreateIndex
CREATE INDEX "customer_order_items_tenantId_order_id_idx" ON "customer_order_items"("tenantId", "order_id");

-- CreateIndex
CREATE INDEX "stored_files_tenantId_kind_idx" ON "stored_files"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_request_id_key" ON "payment_attempts"("provider_request_id");

-- CreateIndex
CREATE INDEX "payment_attempts_tenantId_status_idx" ON "payment_attempts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_tenantId_reference_id_key" ON "payment_attempts"("tenantId", "reference_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "categories"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_tenantId_transactionId_fkey" FOREIGN KEY ("tenantId", "transactionId") REFERENCES "transactions"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_tenantId_table_id_fkey" FOREIGN KEY ("tenantId", "table_id") REFERENCES "tables"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_tenantId_order_id_fkey" FOREIGN KEY ("tenantId", "order_id") REFERENCES "customer_orders"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_tenantId_product_id_fkey" FOREIGN KEY ("tenantId", "product_id") REFERENCES "products"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
