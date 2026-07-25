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
  let clusteringService: { clusterPendingArticles: jest.Mock };
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

    expect(runRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'success', storiesRanked: 20 }),
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
