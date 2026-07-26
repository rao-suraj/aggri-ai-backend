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
      CREATE TABLE \`sources\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(200) NOT NULL,
        \`rss_url\` VARCHAR(500) NOT NULL,
        \`tier\` VARCHAR(20) NOT NULL,
        \`active\` BOOLEAN NOT NULL DEFAULT true,
        \`last_fetch_status\` VARCHAR(20) NULL,
        \`last_fetched_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_sources_rss_url\` ON \`sources\` (\`rss_url\`);`,
    );

    await queryRunner.query(`
      CREATE TABLE \`raw_articles\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`source_id\` INT NOT NULL,
        \`title\` VARCHAR(1000) NOT NULL,
        \`body\` TEXT NULL,
        \`url\` VARCHAR(2000) NOT NULL,
        \`published_at\` DATETIME NOT NULL,
        \`fetched_at\` DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        \`content_hash\` VARCHAR(64) NOT NULL,
        \`cluster_id\` INT NULL,
        CONSTRAINT \`FK_raw_articles_source\` FOREIGN KEY (\`source_id\`) REFERENCES \`sources\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_raw_articles_content_hash\` ON \`raw_articles\` (\`content_hash\`);`,
    );

    await queryRunner.query(`
      CREATE TABLE \`story_clusters\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`date\` DATE NOT NULL,
        \`primary_headline\` VARCHAR(1000) NOT NULL,
        \`topic\` VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
        \`representative_article_id\` INT NULL,
        \`corroboration_count\` INT NOT NULL DEFAULT 0,
        \`credibility_score\` FLOAT NOT NULL DEFAULT 0,
        \`corroboration_score\` FLOAT NOT NULL DEFAULT 0,
        \`ai_flag_score\` FLOAT NOT NULL DEFAULT 0,
        \`ai_flags\` TEXT NULL,
        \`final_score\` FLOAT NOT NULL DEFAULT 0,
        \`highest_tier\` VARCHAR(20) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        CONSTRAINT \`FK_story_clusters_representative_article\` FOREIGN KEY (\`representative_article_id\`) REFERENCES \`raw_articles\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await queryRunner.query(
      `CREATE INDEX \`IDX_story_clusters_date\` ON \`story_clusters\` (\`date\`);`,
    );

    // raw_articles.cluster_id -> story_clusters, added after story_clusters
    // exists to break the circular reference between the two tables.
    await queryRunner.query(`
      ALTER TABLE \`raw_articles\`
      ADD CONSTRAINT \`FK_raw_articles_cluster\` FOREIGN KEY (\`cluster_id\`) REFERENCES \`story_clusters\`(\`id\`) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE \`cluster_articles\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`cluster_id\` INT NOT NULL,
        \`article_id\` INT NOT NULL,
        CONSTRAINT \`FK_cluster_articles_cluster\` FOREIGN KEY (\`cluster_id\`) REFERENCES \`story_clusters\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_cluster_articles_article\` FOREIGN KEY (\`article_id\`) REFERENCES \`raw_articles\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE \`daily_rankings\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`cluster_id\` INT NOT NULL,
        \`date\` DATE NOT NULL,
        \`rank\` INT NOT NULL,
        \`summary_text\` TEXT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        CONSTRAINT \`FK_daily_rankings_cluster\` FOREIGN KEY (\`cluster_id\`) REFERENCES \`story_clusters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_daily_rankings_date_rank\` ON \`daily_rankings\` (\`date\`, \`rank\`);`,
    );

    await queryRunner.query(`
      CREATE TABLE \`pipeline_runs\` (
        \`id\` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`date\` DATE NOT NULL,
        \`started_at\` DATETIME NOT NULL,
        \`finished_at\` DATETIME NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'running',
        \`sources_total\` INT NOT NULL DEFAULT 0,
        \`sources_ok\` INT NOT NULL DEFAULT 0,
        \`articles_ingested\` INT NOT NULL DEFAULT 0,
        \`clusters_total\` INT NOT NULL DEFAULT 0,
        \`clusters_scored\` INT NOT NULL DEFAULT 0,
        \`stories_ranked\` INT NOT NULL DEFAULT 0,
        \`gemini_calls\` INT NOT NULL DEFAULT 0,
        \`groq_calls\` INT NOT NULL DEFAULT 0,
        \`error_message\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`pipeline_runs\`;`);
    await queryRunner.query(`DROP TABLE \`daily_rankings\`;`);
    await queryRunner.query(`DROP TABLE \`cluster_articles\`;`);
    await queryRunner.query(
      `ALTER TABLE \`raw_articles\` DROP FOREIGN KEY \`FK_raw_articles_cluster\`;`,
    );
    await queryRunner.query(`DROP TABLE \`story_clusters\`;`);
    await queryRunner.query(`DROP TABLE \`raw_articles\`;`);
    await queryRunner.query(`DROP TABLE \`sources\`;`);
  }
}
