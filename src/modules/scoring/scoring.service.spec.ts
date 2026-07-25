import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SourceTier } from '../../common/enums/source-tier.enum';
import { ClusterArticle, StoryCluster } from '../../entities';
import { GeminiService } from '../ai/gemini.service';
import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  let service: ScoringService;
  let clusterRepo: { find: jest.Mock; update: jest.Mock };
  let clusterArticleRepo: { find: jest.Mock };
  let geminiService: { sanityCheck: jest.Mock };

  const cluster: StoryCluster = {
    id: 1,
    date: '2026-07-25',
    primaryHeadline: 'Reserve Bank holds repo rate steady',
    topic: 'ECONOMY',
    representativeArticle: null,
    representativeArticleId: 1,
    corroborationCount: 7,
    credibilityScore: 0,
    corroborationScore: 0,
    aiFlagScore: 0,
    aiFlagsRaw: null,
    finalScore: 0,
    highestTier: null,
    createdAt: new Date(),
    clusterArticles: [],
  };

  function linksWithTiers(tiers: SourceTier[]): Partial<ClusterArticle>[] {
    return tiers.map((tier, i) => ({
      id: i,
      clusterId: 1,
      articleId: i,
      article: {
        id: i,
        title: 'headline',
        body: 'snippet body',
        source: { tier },
      },
    })) as unknown as Partial<ClusterArticle>[];
  }

  beforeEach(async () => {
    clusterRepo = { find: jest.fn(), update: jest.fn() };
    clusterArticleRepo = { find: jest.fn() };
    geminiService = { sanityCheck: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: getRepositoryToken(StoryCluster), useValue: clusterRepo },
        {
          provide: getRepositoryToken(ClusterArticle),
          useValue: clusterArticleRepo,
        },
        { provide: GeminiService, useValue: geminiService },
        {
          provide: ConfigService,
          useValue: { get: () => ({ corroborationCap: 5 }) },
        },
      ],
    }).compile();

    service = moduleRef.get(ScoringService);
  });

  it('assigns wire-level credibility when at least one wire source contributed', async () => {
    clusterRepo.find.mockResolvedValue([cluster]);
    clusterArticleRepo.find.mockResolvedValue(
      linksWithTiers([SourceTier.REGIONAL, SourceTier.MAJOR, SourceTier.WIRE]),
    );
    geminiService.sanityCheck.mockResolvedValue({
      sensational: false,
      missing_attribution: false,
      contradicts_other_sources: false,
    });

    await service.scoreClustersForDate('2026-07-25');

    expect(clusterRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        highestTier: SourceTier.WIRE,
        credibilityScore: 1.0,
      }),
    );
  });

  it('caps corroboration score at 1 once corroborationCap is reached', async () => {
    clusterRepo.find.mockResolvedValue([{ ...cluster, corroborationCount: 7 }]);
    clusterArticleRepo.find.mockResolvedValue(
      linksWithTiers([SourceTier.WIRE]),
    );
    geminiService.sanityCheck.mockResolvedValue({
      sensational: false,
      missing_attribution: false,
      contradicts_other_sources: false,
    });

    await service.scoreClustersForDate('2026-07-25');

    expect(clusterRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ corroborationScore: 1 }),
    );
  });

  it('applies a penalty to the ai flag score for each true flag', async () => {
    clusterRepo.find.mockResolvedValue([cluster]);
    clusterArticleRepo.find.mockResolvedValue(
      linksWithTiers([SourceTier.WIRE]),
    );
    geminiService.sanityCheck.mockResolvedValue({
      sensational: true,
      missing_attribution: true,
      contradicts_other_sources: false,
    });

    await service.scoreClustersForDate('2026-07-25');

    // base 1.0 - 2 * 0.3 = 0.4
    expect(clusterRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ aiFlagScore: 0.4 }),
    );
  });

  it('computes final_score as the weighted sum scaled to 0-100', async () => {
    clusterRepo.find.mockResolvedValue([{ ...cluster, corroborationCount: 5 }]);
    clusterArticleRepo.find.mockResolvedValue(
      linksWithTiers([SourceTier.WIRE]),
    );
    geminiService.sanityCheck.mockResolvedValue({
      sensational: false,
      missing_attribution: false,
      contradicts_other_sources: false,
    });

    await service.scoreClustersForDate('2026-07-25');

    // credibility=1.0, corroboration=1.0 (5/5 cap), ai=1.0 -> (0.4+0.4+0.2)*100 = 100
    expect(clusterRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ finalScore: 100 }),
    );
  });

  it('continues scoring remaining clusters when one fails', async () => {
    const cluster2 = { ...cluster, id: 2 };
    clusterRepo.find.mockResolvedValue([cluster, cluster2]);
    clusterArticleRepo.find.mockResolvedValue(
      linksWithTiers([SourceTier.WIRE]),
    );
    geminiService.sanityCheck
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockResolvedValueOnce({
        sensational: false,
        missing_attribution: false,
        contradicts_other_sources: false,
      });

    const result = await service.scoreClustersForDate('2026-07-25');

    expect(result.scored).toBe(1);
    expect(result.failed).toBe(1);
  });
});
