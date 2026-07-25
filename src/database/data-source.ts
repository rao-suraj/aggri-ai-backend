import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  ClusterArticle,
  DailyRanking,
  PipelineRun,
  RawArticle,
  Source,
  StoryCluster,
} from '../entities';

const nodeEnv = process.env.NODE_ENV ?? 'development';
config({ path: `.env.${nodeEnv}` });
config(); // fallback to .env if present

/**
 * Standalone DataSource used by the TypeORM CLI for generating and running
 * migrations (`npm run migration:generate` / `npm run migration:run`).
 * The running application itself gets its connection via DatabaseModule.
 */
export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
  entities: [
    Source,
    RawArticle,
    StoryCluster,
    ClusterArticle,
    DailyRanking,
    PipelineRun,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
