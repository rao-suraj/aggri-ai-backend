import { config } from 'dotenv';
import * as mssql from 'mssql';

const nodeEnv = process.env.NODE_ENV ?? 'development';
config({ path: `.env.${nodeEnv}` });
config();

/**
 * SQL Server (unlike Postgres/MySQL) needs its target database created
 * before TypeORM can connect to it. `npm run db:create` connects to the
 * server's default `master` database and creates ours if missing - safe to
 * run repeatedly.
 */
async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName) throw new Error('DB_NAME is not set');

  const pool = await mssql.connect({
    server: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'master',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    },
  });

  await pool
    .request()
    .query(
      `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}') CREATE DATABASE [${dbName}];`,
    );

  console.log(`Database "${dbName}" is ready.`);
  await pool.close();
}

main().catch((error) => {
  console.error('Failed to create database:', error);
  process.exit(1);
});
