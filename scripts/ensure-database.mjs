import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const target = new URL(process.env.DATABASE_URL);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) throw new Error('Nama database tujuan tidak aman');

const adminUrl = new URL(target);
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('schema');
const prisma = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });

try {
  const [databaseRows, roleRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${databaseName}') AS "exists"`),
    prisma.$queryRawUnsafe('SELECT rolcreatedb AS "canCreateDatabase", rolsuper AS "isSuperuser" FROM pg_roles WHERE rolname = current_user'),
  ]);
  const exists = databaseRows[0].exists;
  const role = roleRows[0];
  console.log({ databaseName, exists, ...role });

  if (!exists && process.argv.includes('--create')) {
    if (!role.canCreateDatabase && !role.isSuperuser) throw new Error('Role PostgreSQL tidak memiliki hak CREATEDB');
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    console.log(`Database ${databaseName} berhasil dibuat.`);
  }
} finally {
  await prisma.$disconnect();
}
