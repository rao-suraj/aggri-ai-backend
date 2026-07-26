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
- Gemini (`gemini-flash-latest` alias, currently resolves to `gemini-3.6-flash`)
  - Phase 3 AI sanity-check (sensationalism / missing attribution /
    contradiction flags)
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

The app runs as a Vercel serverless function (zero-config NestJS support -
see `vercel.json`), which does not stay alive between requests. Because of
that, scheduling is done by **Vercel Cron Jobs** calling a guarded HTTP
route, not by an in-process ticker:

- `vercel.json`'s `crons` entry calls `GET /pipeline/cron` once a day.
  That route (`pipeline.controller.ts`) is protected by `CronAuthGuard`,
  which checks the `Authorization: Bearer <CRON_SECRET>` header Vercel
  automatically attaches to cron-triggered requests - set `CRON_SECRET` to
  the same random value in both your `.env` file and the Vercel project's
  environment variables.
- That single route runs the full `ingestion -> clustering -> scoring ->
  ranking -> summarization` flow (`PipelineService.runFullPipeline`, which
  already starts with ingestion) and **awaits it to completion** before
  responding, since a serverless function can't reliably keep running work
  in the background after it responds. Make sure `vercel.json`'s
  `functions."src/main.ts".maxDuration` (currently 800s) comfortably covers
  a real run's duration for your plan (800s requires Pro; Hobby is capped
  at 300s) - check recent `PipelineRun.startedAt`/`finishedAt` gaps and
  raise/lower as needed.
- The old in-process scheduler (`src/modules/pipeline/pipeline.scheduler.ts`,
  `@nestjs/schedule`'s `ScheduleModule.forRoot()` in `app.module.ts`, and its
  provider registration in `pipeline.module.ts`) is commented out rather
  than deleted, in case this project ever moves back to an always-on host -
  it previously ran an hourly ingestion-only job plus this same daily full
  pipeline job as two separate in-process cron ticks.

You can also trigger a full run manually (unguarded, for local/ops use).
This returns immediately (202, run status `running`) rather than blocking
until the whole pipeline finishes - poll `/pipeline/latest` for
progress/completion:

```bash
curl -X POST http://localhost:3000/pipeline/run
curl http://localhost:3000/pipeline/latest
```

Note this manual trigger's fire-and-forget background execution has the
same "may be killed after the response is sent" risk as any unawaited work
on a serverless platform - it hasn't been reworked, since it's not on the
cron path. Prefer `GET /pipeline/cron` (with the `CRON_SECRET` header) if
you need a manual run that's guaranteed to actually finish:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/pipeline/cron
```

Scoring and summarization run with bounded concurrency
(`SCORING_CONCURRENCY`, default 10; `SUMMARIZATION_CONCURRENCY`, default 5)
rather than one Gemini/Groq call at a time - real RSS feed volume across a
dozen sources routinely produces 200-700+ clusters/day (far more than a
handful), and a sequential loop of that many AI calls would take 20+
minutes. With concurrency 10, a ~280-cluster run completes in well under a
minute.

### Design notes / deviations from the plan doc worth knowing about

- **Gemini model name**: the plan doc specifies "Gemini 2.5 Flash". As of
  this writing, calling `models/gemini-2.5-flash:generateContent` with a
  freshly created API key returns `404 "This model ... is no longer
  available to new users"`, even though it still appears in `GET /models`.
  `GEMINI_MODEL` defaults to `gemini-flash-lite-latest` instead - a
  Google-managed alias for the current recommended lightweight flash model
  (resolved to `gemini-3.5-flash-lite` at time of testing). This was picked
  over the plain `gemini-flash-latest` alias (`gemini-3.6-flash`)
  specifically because the "flash" tier now does agentic-style internal
  "thinking" by default - fine for judgment-heavy work, but pure overhead
  for this step's simple 3-field boolean classification (300+ extra
  "thinking tokens" and multiple extra seconds of latency per call in
  testing, with no difference in output quality for this task). The
  lite/no-thinking variant scored a real 278-cluster day's worth of
  clusters in well under a minute with a 100% success rate. Override
  `GEMINI_MODEL` in your env file if you need a pinned version.
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
