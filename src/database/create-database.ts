import { config } from 'dotenv';
import * as mysql from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV ?? 'development';
config({ path: `.env.${nodeEnv}` });
config();

/**
 * MySQL (unlike some other engines) needs its target database created
 * before TypeORM can connect to it. `npm run db:create` connects to the
 * server without selecting a database and creates ours if missing - safe to
 * run repeatedly.
 */
async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName) throw new Error('DB_NAME is not set');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  );

  console.log(`Database "${dbName}" is ready.`);
  await connection.end();
}

main().catch((error) => {
  console.error('Failed to create database:', error);
  process.exit(1);
});
