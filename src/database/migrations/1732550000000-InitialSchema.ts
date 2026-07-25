import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written initial schema migration (not auto-generated: TypeORM's
 * `migration:generate` needs a live DB connection to diff against, which
 * isn't available in every environment this repo is cloned into). Mirrors
 * the entities in src/entities exactly. Keep both in sync if you change one.
 */
export class InitialSchema1732550000000 implements MigrationInterface {
  name = 'InitialSchema1732550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE [sources] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [name] NVARCHAR(200) NOT NULL,
        [rss_url] VARCHAR(1000) NOT NULL,
        [tier] VARCHAR(20) NOT NULL,
        [active] BIT NOT NULL CONSTRAINT [DF_sources_active] DEFAULT 1,
        [last_fetch_status] VARCHAR(20) NULL,
        [last_fetched_at] DATETIME2 NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_sources_created_at] DEFAULT SYSUTCDATETIME()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX [IDX_sources_rss_url] ON [sources] ([rss_url]);`,
    );

    await queryRunner.query(`
      CREATE TABLE [raw_articles] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [source_id] INT NOT NULL,
        [title] NVARCHAR(1000) NOT NULL,
        [body] NVARCHAR(MAX) NULL,
        [url] VARCHAR(2000) NOT NULL,
        [published_at] DATETIME2 NOT NULL,
        [fetched_at] DATETIME2 NOT NULL CONSTRAINT [DF_raw_articles_fetched_at] DEFAULT SYSUTCDATETIME(),
        [content_hash] VARCHAR(64) NOT NULL,
        [cluster_id] INT NULL,
        CONSTRAINT [FK_raw_articles_source] FOREIGN KEY ([source_id]) REFERENCES [sources]([id]) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX [IDX_raw_articles_content_hash] ON [raw_articles] ([content_hash]);`,
    );

    await queryRunner.query(`
      CREATE TABLE [story_clusters] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [date] DATE NOT NULL,
        [primary_headline] NVARCHAR(1000) NOT NULL,
        [topic] VARCHAR(40) NOT NULL CONSTRAINT [DF_story_clusters_topic] DEFAULT 'GENERAL',
        [representative_article_id] INT NULL,
        [corroboration_count] INT NOT NULL CONSTRAINT [DF_story_clusters_corr_count] DEFAULT 0,
        [credibility_score] FLOAT NOT NULL CONSTRAINT [DF_story_clusters_cred] DEFAULT 0,
        [corroboration_score] FLOAT NOT NULL CONSTRAINT [DF_story_clusters_corr_score] DEFAULT 0,
        [ai_flag_score] FLOAT NOT NULL CONSTRAINT [DF_story_clusters_ai_flag] DEFAULT 0,
        [ai_flags] NVARCHAR(MAX) NULL,
        [final_score] FLOAT NOT NULL CONSTRAINT [DF_story_clusters_final] DEFAULT 0,
        [highest_tier] VARCHAR(20) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_story_clusters_created_at] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_story_clusters_representative_article] FOREIGN KEY ([representative_article_id]) REFERENCES [raw_articles]([id]) ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX [IDX_story_clusters_date] ON [story_clusters] ([date]);`,
    );

    // raw_articles.cluster_id -> story_clusters, added after story_clusters
    // exists to break the circular reference between the two tables.
    await queryRunner.query(`
      ALTER TABLE [raw_articles]
      ADD CONSTRAINT [FK_raw_articles_cluster] FOREIGN KEY ([cluster_id]) REFERENCES [story_clusters]([id]) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE [cluster_articles] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [cluster_id] INT NOT NULL,
        [article_id] INT NOT NULL,
        CONSTRAINT [FK_cluster_articles_cluster] FOREIGN KEY ([cluster_id]) REFERENCES [story_clusters]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_cluster_articles_article] FOREIGN KEY ([article_id]) REFERENCES [raw_articles]([id]) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [daily_rankings] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [cluster_id] INT NOT NULL,
        [date] DATE NOT NULL,
        [rank] INT NOT NULL,
        [summary_text] NVARCHAR(MAX) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_daily_rankings_created_at] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_daily_rankings_cluster] FOREIGN KEY ([cluster_id]) REFERENCES [story_clusters]([id]) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX [IDX_daily_rankings_date_rank] ON [daily_rankings] ([date], [rank]);`,
    );

    await queryRunner.query(`
      CREATE TABLE [pipeline_runs] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [date] DATE NOT NULL,
        [started_at] DATETIME2 NOT NULL,
        [finished_at] DATETIME2 NULL,
        [status] VARCHAR(20) NOT NULL CONSTRAINT [DF_pipeline_runs_status] DEFAULT 'running',
        [sources_total] INT NOT NULL CONSTRAINT [DF_pipeline_runs_sources_total] DEFAULT 0,
        [sources_ok] INT NOT NULL CONSTRAINT [DF_pipeline_runs_sources_ok] DEFAULT 0,
        [articles_ingested] INT NOT NULL CONSTRAINT [DF_pipeline_runs_articles] DEFAULT 0,
        [clusters_total] INT NOT NULL CONSTRAINT [DF_pipeline_runs_clusters_total] DEFAULT 0,
        [clusters_scored] INT NOT NULL CONSTRAINT [DF_pipeline_runs_clusters_scored] DEFAULT 0,
        [stories_ranked] INT NOT NULL CONSTRAINT [DF_pipeline_runs_stories_ranked] DEFAULT 0,
        [gemini_calls] INT NOT NULL CONSTRAINT [DF_pipeline_runs_gemini_calls] DEFAULT 0,
        [groq_calls] INT NOT NULL CONSTRAINT [DF_pipeline_runs_groq_calls] DEFAULT 0,
        [error_message] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_pipeline_runs_created_at] DEFAULT SYSUTCDATETIME()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE [pipeline_runs];`);
    await queryRunner.query(`DROP TABLE [daily_rankings];`);
    await queryRunner.query(`DROP TABLE [cluster_articles];`);
    await queryRunner.query(
      `ALTER TABLE [raw_articles] DROP CONSTRAINT [FK_raw_articles_cluster];`,
    );
    await queryRunner.query(`DROP TABLE [story_clusters];`);
    await queryRunner.query(`DROP TABLE [raw_articles];`);
    await queryRunner.query(`DROP TABLE [sources];`);
  }
}
