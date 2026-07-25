# Aggri-AI Backend

NestJS + TypeORM (SQL Server) backend implementing the Aggri-AI MVP pipeline:

```
[Scheduler] -> [Ingestion] -> [Clustering] -> [Scoring] -> [Ranking] -> [Summarization] -> [Database] -> [API]
```

Collects the day's news from free RSS feeds, groups duplicate coverage of the
same event, scores each story for trustworthiness (source tier +
corroboration + an AI sanity check), and produces a daily top-20 ranking with
neutral AI-generated summaries. See `../doc/aggri-ai-prd.md` and
`../doc/aggri-ai-mvp-plan.md` for the full product/implementation spec this
was built against.

## Stack

- NestJS 11 + TypeORM 0.3 (`mssql` driver)
- SQL Server (via Docker for local dev)
- Gemini 2.5 Flash - Phase 3 AI sanity-check (sensationalism / missing
  attribution / contradiction flags)
- Groq (Llama 3.3 70B) - Phase 4 summarization
- `@nestjs/schedule` for cron jobs (no separate queue infra)
- `rss-parser` for feed ingestion, `stopword` for keyword extraction

## Requirements

- Node.js 20+
- Docker (for local SQL Server) - or your own reachable SQL Server instance
- A Gemini API key and a Groq API key (both have generous free tiers - see
  the PRD). **The app fails fast at startup if either is missing** - there is
  intentionally no mock/fallback mode.

## Setup

```bash
npm install

# 1. Start SQL Server locally
docker compose up -d

# 2. Copy env template and fill in your API keys
cp .env.example .env.development
# edit .env.development: set GEMINI_API_KEY and GROQ_API_KEY at minimum.
# DB_* defaults already match docker-compose.yml.

# 3. Create the database (SQL Server needs this done once, unlike Postgres/MySQL)
npm run db:create

# 4. Run migrations
npm run migration:run

# 5. Seed the default RSS sources (idempotent, safe to re-run)
npm run seed

# 6. Start the app
npm run start:dev
```

The API listens on `http://localhost:3000` by default. Health check:
`GET /health`.

## Environments

`NODE_ENV` selects which env file is loaded (`.env.development`,
`.env.staging`, `.env.production`) - see `src/app.module.ts` /
`src/config/env.validation.ts`. All variables are validated with Joi at
startup; the process exits immediately if a required variable (DB
connection, `GEMINI_API_KEY`, `GROQ_API_KEY`) is missing or malformed.

`.env.test` holds dummy values used only by the e2e test module and is not
required for unit tests (which mock all dependencies and never boot
`ConfigModule`).

Never set `DB_SYNCHRONIZE=true` outside of local development - use
migrations for staging/production schema changes.

## Pipeline

Two scheduled jobs (`src/modules/pipeline/pipeline.scheduler.ts`), both
cron-expressions driven by config (`INGESTION_CRON`, `PIPELINE_CRON`):

- **Hourly ingestion-only job** - keeps `raw_articles` fresh throughout the
  day without re-running the heavier clustering/scoring/ranking stages.
- **Once-daily full pipeline** - ingestion -> clustering -> scoring ->
  ranking -> summarization, in order. Recorded as a `PipelineRun` row so the
  frontend's stats bar can show ingested/clustered/scored/ranked counts,
  feeds-live ratio, and last-run time without knowing anything about the
  pipeline internals.

You can also trigger a full run manually:

```bash
curl -X POST http://localhost:3000/pipeline/run
```

### Design notes / deviations from the plan doc worth knowing about

- **RSS sources**: Reuters, AP, PTI and ANI (named as examples in the PRD)
  no longer publish free public RSS feeds. `src/database/seeds/sources.seed.ts`
  substitutes comparable, verified-working free feeds (BBC, Al Jazeera, DW,
  NPR, Guardian, NYT, Sky News, WSJ, The Hindu, Hindustan Times, Times of
  India, Indian Express) across the same three trust tiers. Edit the
  `sources` table (or the seed file + re-run `npm run seed`) to change this.
- **Content hash** is scoped per-source (`sha256(sourceId:normalizedTitle)`),
  not global - this is what makes re-running ingestion idempotent ("have I
  already saved this exact headline from this source") without accidentally
  merging different outlets' coverage of the same event at the ingestion
  stage; that cross-source grouping is Clustering's job.
- **Topic badges** (ECONOMY/TECH/INDIA/... shown in the UI) are a lightweight
  keyword-heuristic (`src/modules/clustering/keyword.util.ts#guessTopic`),
  not part of the trust-scoring pipeline. Safe to replace with an AI
  classifier later without touching scoring/ranking.
- **Scoring runs on every cluster for the day** (not just a top-N candidate
  pool), per the plan doc's Phase 3 "one Gemini call per cluster" / "every
  cluster has a final score" wording. At the MVP's expected daily volume
  (~200 clusters) this is nowhere near Gemini's free-tier ceiling.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/news/today` | Today's ranked stories (list view) |
| GET | `/news/dates` | All dates with a completed ranking (for the archive picker) |
| GET | `/news/:date` | Ranked stories for a historical date (`YYYY-MM-DD`) |
| GET | `/news/story/:id` | Full detail for one story: score breakdown, contributing sources, plain-English trust explanation |
| GET | `/sources` | All configured RSS sources and their tier/status |
| GET | `/pipeline/latest` | Most recent pipeline run's stats (for the stats bar) |
| POST | `/pipeline/run` | Manually trigger a full pipeline run |

## Testing

```bash
npm test          # unit tests - all dependencies mocked, no DB/network needed
npm run test:cov  # with coverage
npm run test:e2e  # HTTP-level e2e - repositories overridden via DI, no live DB needed
```

Unit tests cover every service (ingestion, clustering, scoring, ranking,
summarization, news, sources, pipeline orchestration) and the Gemini/Groq
clients, including failure paths (one bad RSS feed, a failed AI call) to
verify the pipeline degrades gracefully rather than aborting entirely.

e2e tests boot the real Nest HTTP stack (routing, global `ValidationPipe`,
DTO serialization) with TypeORM repositories swapped for in-memory fakes via
`overrideProvider`, so they run anywhere without SQL Server installed. For a
true DB-integration run: `docker compose up -d`, run migrations against
`.env.test`, then point a full-`AppModule` e2e suite at it (not included by
default to keep `npm run test:e2e` infra-free for CI).

## Migrations

Written by hand in `src/database/migrations/` (kept in sync with
`src/entities/`) rather than auto-generated, since `migration:generate`
needs a live DB connection to diff against and this repo should be usable
before anyone has SQL Server running.

```bash
npm run migration:run       # apply
npm run migration:revert    # roll back the last one
npm run migration:generate  # diff entities against a live DB (once you have one)
```
