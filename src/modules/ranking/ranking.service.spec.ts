import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyRanking, StoryCluster } from '../../entities';
import { RankingService } from './ranking.service';

describe('RankingService', () => {
  let service: RankingService;
  let clusterRepo: { find: jest.Mock };
  let rankingRepo: { delete: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    clusterRepo = { find: jest.fn() };
    rankingRepo = {
      delete: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((entity) => entity),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: getRepositoryToken(StoryCluster), useValue: clusterRepo },
        { provide: getRepositoryToken(DailyRanking), useValue: rankingRepo },
        {
          provide: ConfigService,
          useValue: { get: () => ({ rankingTopN: 20 }) },
        },
      ],
    }).compile();

    service = moduleRef.get(RankingService);
  });

  it('clears existing rankings for the date before inserting new ones', async () => {
    clusterRepo.find.mockResolvedValue([{ id: 1, finalScore: 90 }]);
    await service.rankForDate('2026-07-25');
    expect(rankingRepo.delete).toHaveBeenCalledWith({ date: '2026-07-25' });
  });

  it('assigns sequential ranks 1..N in score order', async () => {
    clusterRepo.find.mockResolvedValue([
      { id: 1, finalScore: 94 },
      { id: 2, finalScore: 91 },
      { id: 3, finalScore: 80 },
    ]);

    const result = await service.rankForDate('2026-07-25');

    expect(rankingRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        clusterId: 1,
        rank: 1,
        date: '2026-07-25',
        summaryText: '',
      }),
    );
    expect(rankingRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ clusterId: 2, rank: 2 }),
    );
    expect(rankingRepo.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ clusterId: 3, rank: 3 }),
    );
    expect(result).toEqual({ date: '2026-07-25', ranked: 3 });
  });

  it('queries clusters ordered by final_score descending, capped at top N', async () => {
    clusterRepo.find.mockResolvedValue([]);
    await service.rankForDate('2026-07-25');
    expect(clusterRepo.find).toHaveBeenCalledWith({
      where: { date: '2026-07-25' },
      order: { finalScore: 'DESC' },
      take: 20,
    });
  });
});
