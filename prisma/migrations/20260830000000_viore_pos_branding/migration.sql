UPDATE "tenants"
SET "name" = 'Viore Pos', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'RestoFlow POS';

UPDATE "settings"
SET
  "storeName" = 'Viore Pos',
  "bank_accounts" = REPLACE("bank_accounts", 'RestoFlow Store', 'Viore Store'),
  "updatedAt" = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
WHERE "storeName" = 'RestoFlow POS'
   OR "bank_accounts" LIKE '%RestoFlow Store%';

UPDATE "users"
SET
  "name" = 'Admin Viore Pos',
  "updatedAt" = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
WHERE "name" = 'Admin RestoFlow';
