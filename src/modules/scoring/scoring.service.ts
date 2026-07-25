import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import {
  SOURCE_TIER_WEIGHT,
  SourceTier,
} from '../../common/enums/source-tier.enum';
import { mapWithConcurrency } from '../../common/util/concurrency.util';
import { AiSanityFlags, ClusterArticle, StoryCluster } from '../../entities';
import { GeminiService } from '../ai/gemini.service';

export interface ScoringResult {
  scored: number;
  failed: number;
}

const MAX_SNIPPETS_FOR_AI = 5;
const FLAG_PENALTY = 0.3;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    @InjectRepository(StoryCluster)
    private readonly clusterRepository: Repository<StoryCluster>,
    @InjectRepository(ClusterArticle)
    private readonly clusterArticleRepository: Repository<ClusterArticle>,
    private readonly geminiService: GeminiService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async scoreClustersForDate(date: string): Promise<ScoringResult> {
    const clusters = await this.clusterRepository.find({ where: { date } });
    const { corroborationCap, scoringConcurrency } = this.configService.get(
      'pipeline',
      { infer: true },
    );

    let scored = 0;
    let failed = 0;

    // Real RSS feed volume routinely produces hundreds of clusters/day -
    // far more than a sequential loop of Gemini calls can get through in a
    // reasonable time, so these run with bounded concurrency instead of
    // one at a time (see mapWithConcurrency for why).
    await mapWithConcurrency(clusters, scoringConcurrency, async (cluster) => {
      try {
        await this.scoreCluster(cluster, corroborationCap);
        scored += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Scoring failed for cluster ${cluster.id} ("${cluster.primaryHeadline}"): ${
            (error as Error).message
          }`,
        );
        // Continue scoring the rest of the day's clusters rather than
        // aborting the whole batch on one failure.
      }
    });

    return { scored, failed };
  }

  private async scoreCluster(
    cluster: StoryCluster,
    corroborationCap: number,
  ): Promise<void> {
    const links = await this.clusterArticleRepository.find({
      where: { clusterId: cluster.id },
      relations: ['article', 'article.source'],
    });

    const tiers = links.map((l) => l.article.source.tier);
    const highestTier = this.pickHighestTier(tiers);
    const credibilityScore = SOURCE_TIER_WEIGHT[highestTier];

    const corroborationScore = Math.min(
      cluster.corroborationCount / corroborationCap,
      1,
    );

    const snippets = links
      .slice(0, MAX_SNIPPETS_FOR_AI)
      .map((l) => l.article.body || l.article.title);

    const flags = await this.geminiService.sanityCheck({
      headline: cluster.primaryHeadline,
      snippets,
    });
    const aiFlagScore = this.computeAiFlagScore(flags);

    const finalScore =
      (0.4 * credibilityScore + 0.4 * corroborationScore + 0.2 * aiFlagScore) *
      100;

    await this.clusterRepository.update(cluster.id, {
      highestTier,
      credibilityScore,
      corroborationScore,
      aiFlagScore,
      aiFlagsRaw: JSON.stringify(flags),
      finalScore,
    });
  }

  private pickHighestTier(tiers: SourceTier[]): SourceTier {
    if (tiers.includes(SourceTier.WIRE)) return SourceTier.WIRE;
    if (tiers.includes(SourceTier.MAJOR)) return SourceTier.MAJOR;
    return SourceTier.REGIONAL;
  }

  private computeAiFlagScore(flags: AiSanityFlags): number {
    const trueCount = [
      flags.sensational,
      flags.missing_attribution,
      flags.contradicts_other_sources,
    ].filter(Boolean).length;
    return Math.max(0, 1 - trueCount * FLAG_PENALTY);
  }
}
