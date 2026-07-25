import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineRun } from '../../entities';
import { ClusteringService } from '../clustering/clustering.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { RankingService } from '../ranking/ranking.service';
import { ScoringService } from '../scoring/scoring.service';
import { SourcesService } from '../sources/sources.service';
import { SummarizationService } from '../summarization/summarization.service';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectRepository(PipelineRun)
    private readonly pipelineRunRepository: Repository<PipelineRun>,
    private readonly ingestionService: IngestionService,
    private readonly clusteringService: ClusteringService,
    private readonly scoringService: ScoringService,
    private readonly rankingService: RankingService,
    private readonly summarizationService: SummarizationService,
    private readonly sourcesService: SourcesService,
  ) {}

  /**
   * Runs the full daily flow end to end:
   * Ingestion -> Clustering -> Scoring -> Ranking -> Summarization.
   * Any stage may throw; the run is recorded as "failed" with the error
   * message rather than left half-written, so /pipeline/latest always
   * reflects an honest status for the frontend's PIPELINE OK/DOWN indicator.
   */
  async runFullPipeline(
    date: string = todayDateString(),
  ): Promise<PipelineRun> {
    const run = await this.pipelineRunRepository.save(
      this.pipelineRunRepository.create({
        date,
        startedAt: new Date(),
        status: 'running',
      }),
    );

    try {
      const ingestion = await this.ingestionService.ingestAll();
      const clustering = await this.clusteringService.clusterPendingArticles();
      const scoring = await this.scoringService.scoreClustersForDate(date);
      const ranking = await this.rankingService.rankForDate(date);
      const summarization =
        await this.summarizationService.summarizeForDate(date);

      const allSources = await this.sourcesService.findAll();

      await this.pipelineRunRepository.update(run.id, {
        finishedAt: new Date(),
        status: 'success',
        sourcesTotal: allSources.length,
        sourcesOk: ingestion.sourcesOk,
        articlesIngested: ingestion.articlesInserted,
        clustersTotal:
          clustering.newClusters + clustering.joinedExisting > 0
            ? clustering.newClusters + clustering.joinedExisting
            : scoring.scored + scoring.failed,
        clustersScored: scoring.scored,
        storiesRanked: ranking.ranked,
        geminiCalls: scoring.scored,
        groqCalls: summarization.summarized,
      });

      this.logger.log(
        `Pipeline run ${run.id} for ${date} completed: ${ranking.ranked} stories ranked`,
      );
    } catch (error) {
      await this.pipelineRunRepository.update(run.id, {
        finishedAt: new Date(),
        status: 'failed',
        errorMessage: (error as Error).message,
      });
      this.logger.error(
        `Pipeline run ${run.id} for ${date} failed: ${(error as Error).message}`,
      );
      throw error;
    }

    return this.pipelineRunRepository.findOneByOrFail({ id: run.id });
  }

  async getLatestRun(): Promise<PipelineRun | null> {
    return this.pipelineRunRepository.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
  }
}
