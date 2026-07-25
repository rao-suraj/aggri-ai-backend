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
   * Runs the full daily flow end to end, awaiting completion:
   * Ingestion -> Clustering -> Scoring -> Ranking -> Summarization.
   * Any stage may throw; the run is recorded as "failed" with the error
   * message rather than left half-written, so /pipeline/latest always
   * reflects an honest status for the frontend's PIPELINE OK/DOWN indicator.
   *
   * This is what the daily cron job calls (a scheduled job has nowhere to
   * "respond" to, so blocking until done is correct there). For the manual
   * HTTP trigger, see `startInBackground` below - awaiting the entire run
   * over HTTP isn't practical once a day's real RSS volume produces
   * hundreds of clusters to score.
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

    await this.executePipeline(run, date);
    return this.pipelineRunRepository.findOneByOrFail({ id: run.id });
  }

  /**
   * Creates the PipelineRun row synchronously (so callers get an id/status
   * back immediately) and kicks off the actual work without awaiting it.
   * Used by `POST /pipeline/run`, which responds 202 Accepted right away;
   * poll `GET /pipeline/latest` for progress/completion.
   */
  async startInBackground(
    date: string = todayDateString(),
  ): Promise<PipelineRun> {
    const run = await this.pipelineRunRepository.save(
      this.pipelineRunRepository.create({
        date,
        startedAt: new Date(),
        status: 'running',
      }),
    );

    // executePipeline already records failures onto the run row itself;
    // swallow the rejection here so an unawaited background run doesn't
    // surface as an unhandled promise rejection.
    void this.executePipeline(run, date).catch(() => undefined);
    return run;
  }

  private async executePipeline(run: PipelineRun, date: string): Promise<void> {
    try {
      const ingestion = await this.ingestionService.ingestAll();
      const clustering = await this.clusteringService.clusterPendingArticles();
      const scoring = await this.scoringService.scoreClustersForDate(date);
      const ranking = await this.rankingService.rankForDate(date);
      const summarization =
        await this.summarizationService.summarizeForDate(date);

      const allSources = await this.sourcesService.findAll();
      const clustersTotal =
        await this.clusteringService.countClustersForDate(date);

      await this.pipelineRunRepository.update(run.id, {
        finishedAt: new Date(),
        status: 'success',
        sourcesTotal: allSources.length,
        sourcesOk: ingestion.sourcesOk,
        articlesIngested: ingestion.articlesInserted,
        clustersTotal,
        clustersScored: scoring.scored,
        storiesRanked: ranking.ranked,
        geminiCalls: scoring.scored,
        groqCalls: summarization.summarized,
      });

      this.logger.log(
        `Pipeline run ${run.id} for ${date} completed: ${ranking.ranked} stories ranked ` +
          `(${clustering.processed} articles clustered, ${scoring.scored}/${scoring.scored + scoring.failed} scored)`,
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
  }

  async getLatestRun(): Promise<PipelineRun | null> {
    return this.pipelineRunRepository.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
  }
}
