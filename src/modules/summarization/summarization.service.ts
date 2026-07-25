import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterArticle, DailyRanking } from '../../entities';
import { GroqService } from '../ai/groq.service';

export interface SummarizationResult {
  date: string;
  summarized: number;
  failed: number;
}

const MAX_SNIPPETS_FOR_SUMMARY = 5;

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);

  constructor(
    @InjectRepository(DailyRanking)
    private readonly rankingRepository: Repository<DailyRanking>,
    @InjectRepository(ClusterArticle)
    private readonly clusterArticleRepository: Repository<ClusterArticle>,
    private readonly groqService: GroqService,
  ) {}

  /**
   * Phase 4 (summarization half): for each of the day's ranked stories,
   * makes one Groq call for a neutral 2-3 line summary. Kept separate from
   * RankingService so the prompt/summary can be regenerated without
   * recomputing ranks.
   */
  async summarizeForDate(date: string): Promise<SummarizationResult> {
    const rankings = await this.rankingRepository.find({
      where: { date },
      order: { rank: 'ASC' },
      relations: ['cluster'],
    });

    let summarized = 0;
    let failed = 0;

    for (const ranking of rankings) {
      try {
        const links = await this.clusterArticleRepository.find({
          where: { clusterId: ranking.clusterId },
          relations: ['article'],
          take: MAX_SNIPPETS_FOR_SUMMARY,
        });
        const snippets = links.map((l) => l.article.body || l.article.title);

        const summary = await this.groqService.summarize({
          headline: ranking.cluster.primaryHeadline,
          snippets,
        });

        await this.rankingRepository.update(ranking.id, {
          summaryText: summary,
        });
        summarized += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Summarization failed for ranking ${ranking.id} (cluster ${ranking.clusterId}): ${
            (error as Error).message
          }`,
        );
      }
    }

    return { date, summarized, failed };
  }
}
