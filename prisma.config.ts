import nextEnv from '@next/env';
import { defineConfig } from 'prisma/config';

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // `prisma generate` tidak memerlukan koneksi database. Mengakses process.env
    // secara langsung membuat install/build CI tetap dapat melakukan generate;
    // command database dan runtime tetap memerlukan DATABASE_URL yang valid.
    url: process.env.DATABASE_URL ?? '',
  },
});
