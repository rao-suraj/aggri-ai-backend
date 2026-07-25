import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceTier } from '../../common/enums/source-tier.enum';
import {
  AiSanityFlags,
  ClusterArticle,
  DailyRanking,
  StoryCluster,
} from '../../entities';

export interface StoryListItem {
  rank: number;
  clusterId: number;
  headline: string;
  summary: string;
  topic: string;
  publishedAt: Date;
  tier: SourceTier;
  score: number;
  sourceCount: number;
  aiFlagged: boolean;
  aiFlagCount: number;
}

export interface ScoreBreakdownItem {
  label: string;
  value: number;
  weightPct: number;
  note: string;
}

export interface ContributingSource {
  name: string;
  tier: SourceTier;
  url: string;
}

export interface StoryDetail extends StoryListItem {
  breakdown: ScoreBreakdownItem[];
  sources: ContributingSource[];
  aiFlags: AiSanityFlags | null;
  plainEnglish: string;
}

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(DailyRanking)
    private readonly rankingRepository: Repository<DailyRanking>,
    @InjectRepository(StoryCluster)
    private readonly clusterRepository: Repository<StoryCluster>,
    @InjectRepository(ClusterArticle)
    private readonly clusterArticleRepository: Repository<ClusterArticle>,
  ) {}

  async getRankingForDate(date: string): Promise<StoryListItem[]> {
    const rankings = await this.rankingRepository.find({
      where: { date },
      order: { rank: 'ASC' },
      relations: ['cluster', 'cluster.representativeArticle'],
    });

    return rankings.map((r) => this.toListItem(r));
  }

  async getAvailableDates(): Promise<string[]> {
    const rows = await this.rankingRepository
      .createQueryBuilder('r')
      .select('DISTINCT r.date', 'date')
      .orderBy('r.date', 'DESC')
      .getRawMany<{ date: string }>();
    return rows.map((r) => r.date);
  }

  async getClusterDetail(clusterId: number): Promise<StoryDetail> {
    const ranking = await this.rankingRepository.findOne({
      where: { clusterId },
      relations: ['cluster', 'cluster.representativeArticle'],
    });
    if (!ranking) {
      throw new NotFoundException(
        `No ranked story found for cluster ${clusterId}`,
      );
    }

    const listItem = this.toListItem(ranking);

    const links = await this.clusterArticleRepository.find({
      where: { clusterId },
      relations: ['article', 'article.source'],
    });

    const sources: ContributingSource[] = links.map((l) => ({
      name: l.article.source.name,
      tier: l.article.source.tier,
      url: l.article.url,
    }));

    const cluster = ranking.cluster;
    const aiFlags = parseAiFlags(cluster.aiFlagsRaw);

    const breakdown: ScoreBreakdownItem[] = [
      {
        label: 'SOURCE TIER',
        value: cluster.credibilityScore,
        weightPct: cluster.credibilityScore * 100,
        note: `Highest tier present: ${cluster.highestTier ?? 'unknown'} (weight 0.4)`,
      },
      {
        label: 'CORROBORATION',
        value: cluster.corroborationScore,
        weightPct: cluster.corroborationScore * 100,
        note: `${cluster.corroborationCount} independent newsroom(s) reported this (weight 0.4)`,
      },
      {
        label: 'AI SANITY CHECK',
        value: cluster.aiFlagScore,
        weightPct: cluster.aiFlagScore * 100,
        note:
          aiFlags && Object.values(aiFlags).some(Boolean)
            ? 'Penalty applied - Gemini flagged a concern (weight 0.2)'
            : 'No flags raised on tone, attribution or contradiction (weight 0.2)',
      },
    ];

    const plainEnglish = this.buildPlainEnglish(
      listItem,
      cluster.highestTier as SourceTier,
    );

    return { ...listItem, breakdown, sources, aiFlags, plainEnglish };
  }

  private toListItem(ranking: DailyRanking): StoryListItem {
    const cluster = ranking.cluster;
    const aiFlags = parseAiFlags(cluster.aiFlagsRaw);
    const aiFlagCount = aiFlags
      ? [
          aiFlags.sensational,
          aiFlags.missing_attribution,
          aiFlags.contradicts_other_sources,
        ].filter(Boolean).length
      : 0;

    return {
      rank: ranking.rank,
      clusterId: cluster.id,
      headline: cluster.primaryHeadline,
      summary: ranking.summaryText,
      topic: cluster.topic,
      publishedAt:
        cluster.representativeArticle?.publishedAt ?? cluster.createdAt,
      tier: (cluster.highestTier as SourceTier) ?? SourceTier.REGIONAL,
      score: Math.round(cluster.finalScore),
      sourceCount: cluster.corroborationCount,
      aiFlagged: aiFlagCount > 0,
      aiFlagCount,
    };
  }

  private buildPlainEnglish(item: StoryListItem, tier: SourceTier): string {
    const newsroomWord = item.sourceCount === 1 ? 'newsroom' : 'newsrooms';
    if (tier === SourceTier.WIRE) {
      return `Reported by ${item.sourceCount} independent ${newsroomWord}, including at least one wire-tier source.`;
    }
    if (tier === SourceTier.MAJOR) {
      return `Reported by ${item.sourceCount} independent ${newsroomWord}, led by major national outlets.`;
    }
    return `Reported by ${item.sourceCount} independent ${newsroomWord} - regional coverage only, treat with caution.`;
  }
}

function parseAiFlags(raw: string | null): AiSanityFlags | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<AiSanityFlags>;
  return {
    sensational: Boolean(parsed.sensational),
    missing_attribution: Boolean(parsed.missing_attribution),
    contradicts_other_sources: Boolean(parsed.contradicts_other_sources),
  };
}
