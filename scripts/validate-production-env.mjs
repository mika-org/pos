import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const requiredKeys = ['DATABASE_URL', 'SESSION_SECRET', 'FIELD_ENCRYPTION_KEY'];
const missing = requiredKeys.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Environment wajib belum diisi di .env: ${missing.join(', ')}`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  throw new Error('DATABASE_URL harus berupa PostgreSQL connection string');
}
if (process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET minimal 32 karakter');
}

const encryptionKey = process.env.FIELD_ENCRYPTION_KEY;
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encryptionKey) || Buffer.from(encryptionKey, 'base64').length !== 32) {
  throw new Error('FIELD_ENCRYPTION_KEY harus berupa Base64 dari key 32-byte');
}

console.log('Environment production valid.');
