import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { RawArticle, Source } from '../../entities';
import { SourcesService } from '../sources/sources.service';
import { RssParserProvider } from './rss-parser.provider';

export interface IngestionResult {
  sourcesTotal: number;
  sourcesOk: number;
  sourcesFailed: number;
  articlesFetched: number;
  articlesInserted: number;
  articlesSkipped: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(RawArticle)
    private readonly articleRepository: Repository<RawArticle>,
    private readonly sourcesService: SourcesService,
    private readonly rssParser: RssParserProvider,
  ) {}

  /**
   * Fingerprint used to detect "have we already saved this exact headline
   * from this source" - scoped per-source so that two different outlets
   * covering the same event with similar titles are NOT deduped here
   * (that cross-source grouping is Clustering's job, not Ingestion's).
   */
  private computeContentHash(sourceId: number, title: string): string {
    const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
    return createHash('sha256')
      .update(`${sourceId}:${normalized}`)
      .digest('hex');
  }

  async ingestAll(): Promise<IngestionResult> {
    const sources = await this.sourcesService.findActive();
    const result: IngestionResult = {
      sourcesTotal: sources.length,
      sourcesOk: 0,
      sourcesFailed: 0,
      articlesFetched: 0,
      articlesInserted: 0,
      articlesSkipped: 0,
    };

    for (const source of sources) {
      try {
        const { fetched, inserted, skipped } = await this.ingestSource(source);
        result.articlesFetched += fetched;
        result.articlesInserted += inserted;
        result.articlesSkipped += skipped;
        result.sourcesOk += 1;
        await this.sourcesService.markFetchResult(source.id, 'ok');
      } catch (error) {
        result.sourcesFailed += 1;
        await this.sourcesService.markFetchResult(source.id, 'error');
        this.logger.error(
          `Ingestion failed for source "${source.name}" (${source.rssUrl}): ${
            (error as Error).message
          }`,
        );
        // Intentionally swallow so one bad feed doesn't stop the whole run.
      }
    }

    return result;
  }

  private async ingestSource(
    source: Source,
  ): Promise<{ fetched: number; inserted: number; skipped: number }> {
    const feed = await this.rssParser.parseURL(source.rssUrl);
    const items = feed.items ?? [];

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const title = item.title?.trim();
      const link = item.link?.trim();
      if (!title || !link) {
        skipped += 1;
        continue;
      }

      const contentHash = this.computeContentHash(source.id, title);
      const existing = await this.articleRepository.findOne({
        where: { contentHash },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
      await this.articleRepository.save(
        this.articleRepository.create({
          sourceId: source.id,
          title,
          body: item.contentSnippet ?? item.content ?? null,
          url: link,
          publishedAt,
          contentHash,
          clusterId: null,
        }),
      );
      inserted += 1;
    }

    return { fetched: items.length, inserted, skipped };
  }
}
