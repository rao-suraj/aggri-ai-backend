import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClusterArticle, RawArticle, StoryCluster } from '../../entities';
import { ClusteringService } from './clustering.service';

describe('ClusteringService', () => {
  let service: ClusteringService;
  let articleRepo: {
    find: jest.Mock;
    update: jest.Mock;
  };
  let clusterRepo: { save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let clusterArticleRepo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const baseTime = new Date('2026-07-25T06:00:00.000Z');

  function article(overrides: Partial<RawArticle>): RawArticle {
    return {
      id: 1,
      sourceId: 1,
      title: 'Default title',
      body: null,
      url: 'https://x.com',
      publishedAt: baseTime,
      fetchedAt: baseTime,
      contentHash: 'hash',
      clusterId: null,
      ...overrides,
    } as RawArticle;
  }

  beforeEach(async () => {
    articleRepo = { find: jest.fn(), update: jest.fn() };
    clusterRepo = {
      save: jest.fn((entity) => Promise.resolve({ id: 100, ...entity })),
      create: jest.fn((entity) => entity),
      update: jest.fn(),
    };
    clusterArticleRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((entity) => entity),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ClusteringService,
        { provide: getRepositoryToken(RawArticle), useValue: articleRepo },
        { provide: getRepositoryToken(StoryCluster), useValue: clusterRepo },
        {
          provide: getRepositoryToken(ClusterArticle),
          useValue: clusterArticleRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              clusterWindowHours: 12,
              clusterSimilarityThreshold: 0.4,
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ClusteringService);
  });

  it('does nothing when there are no pending articles', async () => {
    articleRepo.find.mockResolvedValue([]);
    const result = await service.clusterPendingArticles();
    expect(result).toEqual({ processed: 0, newClusters: 0, joinedExisting: 0 });
    expect(clusterRepo.save).not.toHaveBeenCalled();
  });

  it('creates a new cluster for the first article', async () => {
    const a1 = article({ id: 1, title: 'Reserve Bank holds repo rate steady' });
    articleRepo.find.mockResolvedValue([a1]);

    const result = await service.clusterPendingArticles();

    expect(result.newClusters).toBe(1);
    expect(result.joinedExisting).toBe(0);
    expect(clusterRepo.save).toHaveBeenCalledTimes(1);
    expect(articleRepo.update).toHaveBeenCalledWith(1, { clusterId: 100 });
  });

  it('groups two similar headlines from different sources into one cluster', async () => {
    const a1 = article({
      id: 1,
      sourceId: 1,
      title: 'Reserve Bank holds repo rate steady for third review',
      publishedAt: baseTime,
    });
    const a2 = article({
      id: 2,
      sourceId: 2,
      title: 'Reserve Bank keeps repo rate steady in third review',
      publishedAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
    });
    articleRepo.find.mockResolvedValue([a1, a2]);

    const result = await service.clusterPendingArticles();

    expect(result.newClusters).toBe(1);
    expect(result.joinedExisting).toBe(1);
    expect(clusterArticleRepo.save).toHaveBeenCalledTimes(2);
  });

  it('creates separate clusters for unrelated headlines', async () => {
    const a1 = article({ id: 1, title: 'Reserve Bank holds repo rate steady' });
    const a2 = article({
      id: 2,
      title: 'Metro Phase 4 corridor opens ahead of schedule',
      publishedAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
    });
    articleRepo.find.mockResolvedValue([a1, a2]);

    const result = await service.clusterPendingArticles();

    expect(result.newClusters).toBe(2);
    expect(result.joinedExisting).toBe(0);
  });

  it('does not join articles published outside the time window', async () => {
    const a1 = article({ id: 1, title: 'Reserve Bank holds repo rate steady' });
    const a2 = article({
      id: 2,
      title: 'Reserve Bank holds repo rate steady',
      publishedAt: new Date(baseTime.getTime() + 13 * 60 * 60 * 1000), // 13h later, window is 12h
    });
    articleRepo.find.mockResolvedValue([a1, a2]);

    const result = await service.clusterPendingArticles();

    expect(result.newClusters).toBe(2);
    expect(result.joinedExisting).toBe(0);
  });

  it('recomputes corroboration_count as the distinct source count', async () => {
    const a1 = article({
      id: 1,
      sourceId: 1,
      title: 'Reserve Bank holds repo rate steady',
    });
    const a2 = article({
      id: 2,
      sourceId: 2,
      title: 'Reserve Bank holds repo rate steady',
      publishedAt: new Date(baseTime.getTime() + 60 * 1000),
    });
    const a3 = article({
      id: 3,
      sourceId: 1, // same source as a1 - should NOT increase distinct count
      title: 'Reserve Bank holds repo rate steady',
      publishedAt: new Date(baseTime.getTime() + 120 * 1000),
    });
    articleRepo.find.mockResolvedValue([a1, a2, a3]);

    // recomputeCorroboration reloads links with article relation - simulate that
    clusterArticleRepo.find.mockImplementation(
      (query: { where?: { clusterId?: number } }) => {
        if (query?.where?.clusterId === 100) {
          return Promise.resolve([
            { clusterId: 100, articleId: 1, article: a1 },
            { clusterId: 100, articleId: 2, article: a2 },
            { clusterId: 100, articleId: 3, article: a3 },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    await service.clusterPendingArticles();

    expect(clusterRepo.update).toHaveBeenCalledWith(100, {
      corroborationCount: 2,
    });
  });
});
