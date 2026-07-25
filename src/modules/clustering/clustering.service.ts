import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { ClusterArticle, RawArticle, StoryCluster } from '../../entities';
import { extractKeywords, guessTopic, jaccardSimilarity } from './keyword.util';

export interface ClusteringResult {
  processed: number;
  newClusters: number;
  joinedExisting: number;
}

interface OpenClusterEntry {
  clusterId: number;
  keywords: Set<string>;
  lastPublishedAt: Date;
}

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  constructor(
    @InjectRepository(RawArticle)
    private readonly articleRepository: Repository<RawArticle>,
    @InjectRepository(StoryCluster)
    private readonly clusterRepository: Repository<StoryCluster>,
    @InjectRepository(ClusterArticle)
    private readonly clusterArticleRepository: Repository<ClusterArticle>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Groups all unclustered RawArticle rows into StoryCluster rows (creating
   * new clusters or joining existing "open" ones from the rolling time
   * window), per Phase 2 of the implementation plan.
   */
  async clusterPendingArticles(): Promise<ClusteringResult> {
    const pending = await this.articleRepository.find({
      where: { clusterId: IsNull() },
      order: { publishedAt: 'ASC' },
    });

    const result: ClusteringResult = {
      processed: 0,
      newClusters: 0,
      joinedExisting: 0,
    };
    if (pending.length === 0) return result;

    const { clusterWindowHours, clusterSimilarityThreshold } =
      this.configService.get('pipeline', { infer: true });
    const windowMs = clusterWindowHours * 60 * 60 * 1000;
    const earliestPublish = pending[0].publishedAt;
    const since = new Date(earliestPublish.getTime() - windowMs);

    const openClusters = await this.loadOpenClusters(since);
    const touchedClusterIds = new Set<number>(openClusters.keys());

    for (const article of pending) {
      const keywords = new Set(extractKeywords(article.title));
      const match = this.findBestMatch(
        article,
        keywords,
        openClusters,
        windowMs,
        clusterSimilarityThreshold,
      );

      if (match) {
        await this.joinCluster(
          article,
          match.clusterId,
          keywords,
          openClusters,
        );
        result.joinedExisting += 1;
      } else {
        const cluster = await this.createCluster(
          article,
          keywords,
          openClusters,
        );
        touchedClusterIds.add(cluster.id);
        result.newClusters += 1;
      }
      result.processed += 1;
    }

    await this.recomputeCorroboration(Array.from(touchedClusterIds));
    return result;
  }

  private async loadOpenClusters(
    since: Date,
  ): Promise<Map<number, OpenClusterEntry>> {
    const recentLinks = await this.clusterArticleRepository.find({
      where: { article: { publishedAt: MoreThanOrEqual(since) } },
      relations: ['article'],
    });

    const openClusters = new Map<number, OpenClusterEntry>();
    for (const link of recentLinks) {
      const entry = openClusters.get(link.clusterId) ?? {
        clusterId: link.clusterId,
        keywords: new Set<string>(),
        lastPublishedAt: link.article.publishedAt,
      };
      for (const kw of extractKeywords(link.article.title))
        entry.keywords.add(kw);
      if (link.article.publishedAt > entry.lastPublishedAt) {
        entry.lastPublishedAt = link.article.publishedAt;
      }
      openClusters.set(link.clusterId, entry);
    }
    return openClusters;
  }

  private findBestMatch(
    article: RawArticle,
    keywords: Set<string>,
    openClusters: Map<number, OpenClusterEntry>,
    windowMs: number,
    threshold: number,
  ): { clusterId: number; score: number } | null {
    let best: { clusterId: number; score: number } | null = null;

    for (const entry of openClusters.values()) {
      const gap = Math.abs(
        article.publishedAt.getTime() - entry.lastPublishedAt.getTime(),
      );
      if (gap > windowMs) continue;

      const score = jaccardSimilarity(keywords, entry.keywords);
      if (score >= threshold && (!best || score > best.score)) {
        best = { clusterId: entry.clusterId, score };
      }
    }
    return best;
  }

  private async joinCluster(
    article: RawArticle,
    clusterId: number,
    keywords: Set<string>,
    openClusters: Map<number, OpenClusterEntry>,
  ): Promise<void> {
    await this.clusterArticleRepository.save(
      this.clusterArticleRepository.create({
        clusterId,
        articleId: article.id,
      }),
    );
    await this.articleRepository.update(article.id, { clusterId });

    const entry = openClusters.get(clusterId);
    if (entry) {
      for (const kw of keywords) entry.keywords.add(kw);
      if (article.publishedAt > entry.lastPublishedAt) {
        entry.lastPublishedAt = article.publishedAt;
      }
    }
  }

  private async createCluster(
    article: RawArticle,
    keywords: Set<string>,
    openClusters: Map<number, OpenClusterEntry>,
  ): Promise<StoryCluster> {
    const dateStr = article.publishedAt.toISOString().slice(0, 10);
    const cluster = await this.clusterRepository.save(
      this.clusterRepository.create({
        date: dateStr,
        primaryHeadline: article.title,
        representativeArticleId: article.id,
        topic: guessTopic(article.title),
      }),
    );

    await this.clusterArticleRepository.save(
      this.clusterArticleRepository.create({
        clusterId: cluster.id,
        articleId: article.id,
      }),
    );
    await this.articleRepository.update(article.id, { clusterId: cluster.id });

    openClusters.set(cluster.id, {
      clusterId: cluster.id,
      keywords,
      lastPublishedAt: article.publishedAt,
    });

    return cluster;
  }

  private async recomputeCorroboration(clusterIds: number[]): Promise<void> {
    for (const clusterId of clusterIds) {
      const links = await this.clusterArticleRepository.find({
        where: { clusterId },
        relations: ['article'],
      });
      const distinctSources = new Set(links.map((l) => l.article.sourceId));
      await this.clusterRepository.update(clusterId, {
        corroborationCount: distinctSources.size,
      });
    }
  }
}
