import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClusterArticle, DailyRanking } from '../../entities';
import { GroqService } from '../ai/groq.service';
import { SummarizationService } from './summarization.service';

describe('SummarizationService', () => {
  let service: SummarizationService;
  let rankingRepo: { find: jest.Mock; update: jest.Mock };
  let clusterArticleRepo: { find: jest.Mock };
  let groqService: { summarize: jest.Mock };

  const ranking = {
    id: 10,
    clusterId: 1,
    date: '2026-07-25',
    rank: 1,
    summaryText: '',
    cluster: { id: 1, primaryHeadline: 'Reserve Bank holds repo rate steady' },
  };

  beforeEach(async () => {
    rankingRepo = { find: jest.fn(), update: jest.fn() };
    clusterArticleRepo = { find: jest.fn().mockResolvedValue([]) };
    groqService = { summarize: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SummarizationService,
        { provide: getRepositoryToken(DailyRanking), useValue: rankingRepo },
        {
          provide: getRepositoryToken(ClusterArticle),
          useValue: clusterArticleRepo,
        },
        { provide: GroqService, useValue: groqService },
      ],
    }).compile();

    service = moduleRef.get(SummarizationService);
  });

  it('writes the generated summary back onto the ranking row', async () => {
    rankingRepo.find.mockResolvedValue([ranking]);
    groqService.summarize.mockResolvedValue('A neutral 2-3 line summary.');

    const result = await service.summarizeForDate('2026-07-25');

    expect(groqService.summarize).toHaveBeenCalledWith(
      expect.objectContaining({ headline: ranking.cluster.primaryHeadline }),
    );
    expect(rankingRepo.update).toHaveBeenCalledWith(10, {
      summaryText: 'A neutral 2-3 line summary.',
    });
    expect(result).toEqual({ date: '2026-07-25', summarized: 1, failed: 0 });
  });

  it('records a failure and continues when Groq throws for one story', async () => {
    const ranking2 = { ...ranking, id: 11, clusterId: 2 };
    rankingRepo.find.mockResolvedValue([ranking, ranking2]);
    groqService.summarize
      .mockRejectedValueOnce(new Error('groq down'))
      .mockResolvedValueOnce('Second summary.');

    const result = await service.summarizeForDate('2026-07-25');

    expect(result).toEqual({ date: '2026-07-25', summarized: 1, failed: 1 });
    expect(rankingRepo.update).toHaveBeenCalledTimes(1);
  });
});
