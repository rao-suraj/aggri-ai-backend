import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SourceTier } from '../../common/enums/source-tier.enum';
import { ClusterArticle, DailyRanking, StoryCluster } from '../../entities';
import { NewsService } from './news.service';

describe('NewsService', () => {
  let service: NewsService;
  let rankingRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let clusterArticleRepo: { find: jest.Mock };

  const cluster: Partial<StoryCluster> = {
    id: 1,
    primaryHeadline: 'Reserve Bank holds repo rate steady',
    topic: 'ECONOMY',
    representativeArticle: {
      publishedAt: new Date('2026-07-25T07:14:00Z'),
    } as any,
    corroborationCount: 7,
    credibilityScore: 1,
    corroborationScore: 1,
    aiFlagScore: 1,
    aiFlagsRaw: JSON.stringify({
      sensational: false,
      missing_attribution: false,
      contradicts_other_sources: false,
    }),
    finalScore: 94,
    highestTier: SourceTier.WIRE,
    createdAt: new Date('2026-07-25T07:14:00Z'),
  };

  const ranking: Partial<DailyRanking> = {
    id: 1,
    clusterId: 1,
    date: '2026-07-25',
    rank: 1,
    summaryText: 'A neutral summary.',
    cluster: cluster as StoryCluster,
  };

  beforeEach(async () => {
    rankingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    clusterArticleRepo = { find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(DailyRanking), useValue: rankingRepo },
        { provide: getRepositoryToken(StoryCluster), useValue: {} },
        {
          provide: getRepositoryToken(ClusterArticle),
          useValue: clusterArticleRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(NewsService);
  });

  it('maps rankings for a date into story list items ordered by rank', async () => {
    rankingRepo.find.mockResolvedValue([ranking]);

    const result = await service.getRankingForDate('2026-07-25');

    expect(result).toEqual([
      expect.objectContaining({
        rank: 1,
        clusterId: 1,
        headline: 'Reserve Bank holds repo rate steady',
        score: 94,
        sourceCount: 7,
        tier: SourceTier.WIRE,
        aiFlagged: false,
        aiFlagCount: 0,
      }),
    ]);
  });

  it('marks aiFlagged true and counts flags when any sanity flag is true', async () => {
    const flaggedRanking = {
      ...ranking,
      cluster: {
        ...cluster,
        aiFlagsRaw: JSON.stringify({
          sensational: true,
          missing_attribution: true,
          contradicts_other_sources: false,
        }),
      },
    };
    rankingRepo.find.mockResolvedValue([flaggedRanking]);

    const result = await service.getRankingForDate('2026-07-25');

    expect(result[0].aiFlagged).toBe(true);
    expect(result[0].aiFlagCount).toBe(2);
  });

  it('throws NotFoundException when no ranking exists for the cluster', async () => {
    rankingRepo.findOne.mockResolvedValue(null);
    await expect(service.getClusterDetail(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('builds a full detail view with breakdown and sources', async () => {
    rankingRepo.findOne.mockResolvedValue(ranking);
    clusterArticleRepo.find.mockResolvedValue([
      {
        article: {
          url: 'https://reuters.com/story',
          source: { name: 'Reuters', tier: SourceTier.WIRE },
        },
      },
      {
        article: {
          url: 'https://bbc.com/story',
          source: { name: 'BBC', tier: SourceTier.MAJOR },
        },
      },
    ]);

    const detail = await service.getClusterDetail(1);

    expect(detail.sources).toEqual([
      {
        name: 'Reuters',
        tier: SourceTier.WIRE,
        url: 'https://reuters.com/story',
      },
      { name: 'BBC', tier: SourceTier.MAJOR, url: 'https://bbc.com/story' },
    ]);
    expect(detail.breakdown).toHaveLength(3);
    expect(detail.breakdown[0].label).toBe('SOURCE TIER');
    expect(detail.plainEnglish).toContain('wire-tier source');
  });

  it('returns distinct available dates ordered descending', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ date: '2026-07-25' }, { date: '2026-07-24' }]),
    };
    rankingRepo.createQueryBuilder.mockReturnValue(qb);

    const dates = await service.getAvailableDates();
    expect(dates).toEqual(['2026-07-25', '2026-07-24']);
  });
});
