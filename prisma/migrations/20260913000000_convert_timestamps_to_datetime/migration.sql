-- AlterTable: Convert users timestamps to TIMESTAMP(3)
ALTER TABLE "users" 
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert categories timestamps to TIMESTAMP(3)
ALTER TABLE "categories" 
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert products timestamps to TIMESTAMP(3)
ALTER TABLE "products" 
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert customers timestamps to TIMESTAMP(3)
ALTER TABLE "customers" 
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert suppliers timestamps to TIMESTAMP(3)
ALTER TABLE "suppliers" 
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert transactions timestamps to TIMESTAMP(3)
ALTER TABLE "transactions" 
  ALTER COLUMN "date" TYPE TIMESTAMP(3) USING CASE WHEN "date" > 0 THEN to_timestamp("date"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "date" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING CASE WHEN "createdAt" > 0 THEN to_timestamp("createdAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert settings timestamp to TIMESTAMP(3)
ALTER TABLE "settings" 
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING CASE WHEN "updatedAt" > 0 THEN to_timestamp("updatedAt"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert tables timestamps to TIMESTAMP(3)
ALTER TABLE "tables" 
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING CASE WHEN "created_at" > 0 THEN to_timestamp("created_at"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING CASE WHEN "updated_at" > 0 THEN to_timestamp("updated_at"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Convert customer_orders timestamps to TIMESTAMP(3)
ALTER TABLE "customer_orders" 
  ALTER COLUMN "verified_at" TYPE TIMESTAMP(3) USING CASE WHEN "verified_at" IS NOT NULL AND "verified_at" > 0 THEN to_timestamp("verified_at"::double precision / 1000) ELSE NULL END,
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING CASE WHEN "created_at" > 0 THEN to_timestamp("created_at"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING CASE WHEN "updated_at" > 0 THEN to_timestamp("updated_at"::double precision / 1000) ELSE CURRENT_TIMESTAMP END,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
