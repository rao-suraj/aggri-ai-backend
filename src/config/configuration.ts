export interface AppConfig {
  nodeEnv: string;
  port: number;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
    synchronize: boolean;
    logging: boolean;
  };
  gemini: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  groq: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  pipeline: {
    ingestionCron: string;
    pipelineCron: string;
    clusterWindowHours: number;
    clusterSimilarityThreshold: number;
    rankingTopN: number;
    corroborationCap: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  db: {
    host: process.env.DB_HOST ?? '',
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? '',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    baseUrl:
      process.env.GEMINI_API_BASE_URL ??
      'https://generativelanguage.googleapis.com/v1beta',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    baseUrl: process.env.GROQ_API_BASE_URL ?? 'https://api.groq.com/openai/v1',
  },
  pipeline: {
    ingestionCron: process.env.INGESTION_CRON ?? '0 0 * * * *',
    pipelineCron: process.env.PIPELINE_CRON ?? '0 0 17 * * *',
    clusterWindowHours: parseInt(process.env.CLUSTER_WINDOW_HOURS ?? '12', 10),
    clusterSimilarityThreshold: parseFloat(
      process.env.CLUSTER_SIMILARITY_THRESHOLD ?? '0.4',
    ),
    rankingTopN: parseInt(process.env.RANKING_TOP_N ?? '20', 10),
    corroborationCap: parseInt(process.env.CORROBORATION_CAP ?? '5', 10),
  },
});
