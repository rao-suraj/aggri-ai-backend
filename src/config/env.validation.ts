import * as Joi from 'joi';

/**
 * Strict schema for all environment variables the application needs.
 *
 * Per product decision: there is no "mock mode" for the AI providers.
 * If GEMINI_API_KEY or GROQ_API_KEY are missing, the app must fail fast
 * at startup rather than silently degrade.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database (SQL Server)
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(1433),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_ENCRYPT: Joi.boolean().default(false),
  DB_TRUST_SERVER_CERTIFICATE: Joi.boolean().default(true),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // AI providers - required, no fallback/mock mode allowed
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-flash-lite-latest'),
  GEMINI_API_BASE_URL: Joi.string().default(
    'https://generativelanguage.googleapis.com/v1beta',
  ),

  GROQ_API_KEY: Joi.string().required(),
  GROQ_MODEL: Joi.string().default('llama-3.3-70b-versatile'),
  GROQ_API_BASE_URL: Joi.string().default('https://api.groq.com/openai/v1'),

  // Pipeline tuning
  INGESTION_CRON: Joi.string().default('0 0 * * * *'),
  PIPELINE_CRON: Joi.string().default('0 0 17 * * *'),
  CLUSTER_WINDOW_HOURS: Joi.number().default(12),
  CLUSTER_SIMILARITY_THRESHOLD: Joi.number().min(0).max(1).default(0.4),
  RANKING_TOP_N: Joi.number().default(20),
  CORROBORATION_CAP: Joi.number().default(5),
  SCORING_CONCURRENCY: Joi.number().default(10),
  SUMMARIZATION_CONCURRENCY: Joi.number().default(5),
});
