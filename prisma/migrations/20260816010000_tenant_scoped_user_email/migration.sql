-- Email dapat dipakai kembali pada tenant berbeda, tetapi tetap unik di dalam satu tenant.
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
