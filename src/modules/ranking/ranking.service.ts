import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { DailyRanking, StoryCluster } from '../../entities';

export interface RankingResult {
  date: string;
  ranked: number;
}

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    @InjectRepository(StoryCluster)
    private readonly clusterRepository: Repository<StoryCluster>,
    @InjectRepository(DailyRanking)
    private readonly rankingRepository: Repository<DailyRanking>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Phase 4 (ranking half): `SELECT TOP N * FROM StoryCluster WHERE date = @today
   * ORDER BY final_score DESC`, then (re)writes DailyRanking rows 1..N for
   * that date. Existing rows for the date are cleared first so re-running
   * the pipeline for the same day doesn't leave stale ranks behind.
   * Summary text is left empty here - SummarizationService fills it in
   * afterwards so it can be re-run independently.
   */
  async rankForDate(date: string): Promise<RankingResult> {
    const { rankingTopN } = this.configService.get('pipeline', { infer: true });

    const topClusters = await this.clusterRepository.find({
      where: { date },
      order: { finalScore: 'DESC' },
      take: rankingTopN,
    });

    await this.rankingRepository.delete({ date });

    let rank = 1;
    for (const cluster of topClusters) {
      await this.rankingRepository.save(
        this.rankingRepository.create({
          clusterId: cluster.id,
          date,
          rank,
          summaryText: '',
        }),
      );
      rank += 1;
    }

    this.logger.log(`Ranked ${topClusters.length} stories for ${date}`);
    return { date, ranked: topClusters.length };
  }
}
