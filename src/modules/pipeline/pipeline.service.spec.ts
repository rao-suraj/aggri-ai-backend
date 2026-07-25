import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PipelineRun } from '../../entities';
import { ClusteringService } from '../clustering/clustering.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { RankingService } from '../ranking/ranking.service';
import { ScoringService } from '../scoring/scoring.service';
import { SourcesService } from '../sources/sources.service';
import { SummarizationService } from '../summarization/summarization.service';
import { PipelineService } from './pipeline.service';

describe('PipelineService', () => {
  let service: PipelineService;
  let runRepo: {
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findOneByOrFail: jest.Mock;
    findOne: jest.Mock;
  };
  let ingestionService: { ingestAll: jest.Mock };
  let clusteringService: {
    clusterPendingArticles: jest.Mock;
    countClustersForDate: jest.Mock;
  };
  let scoringService: { scoreClustersForDate: jest.Mock };
  let rankingService: { rankForDate: jest.Mock };
  let summarizationService: { summarizeForDate: jest.Mock };
  let sourcesService: { findAll: jest.Mock };

  beforeEach(async () => {
    runRepo = {
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      create: jest.fn((entity) => entity),
      update: jest.fn(),
      findOneByOrFail: jest
        .fn()
        .mockResolvedValue({ id: 1, status: 'success' }),
      findOne: jest.fn(),
    };
    ingestionService = {
      ingestAll: jest.fn().mockResolvedValue({
        sourcesTotal: 13,
        sourcesOk: 13,
        sourcesFailed: 0,
        articlesFetched: 100,
        articlesInserted: 80,
        articlesSkipped: 20,
      }),
    };
    clusteringService = {
      clusterPendingArticles: jest.fn().mockResolvedValue({
        processed: 80,
        newClusters: 40,
        joinedExisting: 40,
      }),
      countClustersForDate: jest.fn().mockResolvedValue(40),
    };
    scoringService = {
      scoreClustersForDate: jest
        .fn()
        .mockResolvedValue({ scored: 40, failed: 0 }),
    };
    rankingService = {
      rankForDate: jest
        .fn()
        .mockResolvedValue({ date: '2026-07-25', ranked: 20 }),
    };
    summarizationService = {
      summarizeForDate: jest
        .fn()
        .mockResolvedValue({ date: '2026-07-25', summarized: 20, failed: 0 }),
    };
    sourcesService = {
      findAll: jest.fn().mockResolvedValue(new Array(13).fill({})),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: getRepositoryToken(PipelineRun), useValue: runRepo },
        { provide: IngestionService, useValue: ingestionService },
        { provide: ClusteringService, useValue: clusteringService },
        { provide: ScoringService, useValue: scoringService },
        { provide: RankingService, useValue: rankingService },
        { provide: SummarizationService, useValue: summarizationService },
        { provide: SourcesService, useValue: sourcesService },
      ],
    }).compile();

    service = moduleRef.get(PipelineService);
  });

  it('runs all five stages in order and records a successful run', async () => {
    await service.runFullPipeline('2026-07-25');

    expect(ingestionService.ingestAll).toHaveBeenCalled();
    expect(clusteringService.clusterPendingArticles).toHaveBeenCalled();
    expect(scoringService.scoreClustersForDate).toHaveBeenCalledWith(
      '2026-07-25',
    );
    expect(rankingService.rankForDate).toHaveBeenCalledWith('2026-07-25');
    expect(summarizationService.summarizeForDate).toHaveBeenCalledWith(
      '2026-07-25',
    );

    expect(clusteringService.countClustersForDate).toHaveBeenCalledWith(
      '2026-07-25',
    );
    expect(runRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: 'success',
        storiesRanked: 20,
        clustersTotal: 40, // distinct clusters, NOT newClusters+joinedExisting (which is 80 articles processed)
      }),
    );
  });

  it('marks the run as failed and rethrows when a stage throws', async () => {
    scoringService.scoreClustersForDate.mockRejectedValue(
      new Error('scoring exploded'),
    );

    await expect(service.runFullPipeline('2026-07-25')).rejects.toThrow(
      'scoring exploded',
    );

    expect(runRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'scoring exploded',
      }),
    );
  });

  it('startInBackground creates the run row and returns immediately without waiting for completion', async () => {
    // Make the pipeline hang so we can prove startInBackground didn't await it.
    let resolveIngestion: () => void = () => undefined;
    ingestionService.ingestAll.mockReturnValue(
      new Promise((resolve) => {
        resolveIngestion = () =>
          resolve({
            sourcesTotal: 13,
            sourcesOk: 13,
            sourcesFailed: 0,
            articlesFetched: 100,
            articlesInserted: 80,
            articlesSkipped: 20,
          });
      }),
    );

    const run = await service.startInBackground('2026-07-25');

    expect(run).toMatchObject({ id: 1, status: 'running' });
    // The background work hasn't resolved yet - update() shouldn't have
    // been called with a final status.
    expect(runRepo.update).not.toHaveBeenCalled();

    resolveIngestion();
    // let the still-running background promise chain flush
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('startInBackground does not throw even if the background run fails', async () => {
    scoringService.scoreClustersForDate.mockRejectedValue(new Error('boom'));

    await expect(
      service.startInBackground('2026-07-25'),
    ).resolves.toMatchObject({
      status: 'running',
    });

    // allow the detached background promise to settle before the test ends
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('getLatestRun returns the most recently started run', async () => {
    runRepo.findOne.mockResolvedValue({ id: 5 });
    const result = await service.getLatestRun();
    expect(runRepo.findOne).toHaveBeenCalledWith({
      where: {},
      order: { startedAt: 'DESC' },
    });
    expect(result).toEqual({ id: 5 });
  });
});
