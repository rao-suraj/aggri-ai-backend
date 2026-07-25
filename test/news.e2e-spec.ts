import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { SourceTier } from '../src/common/enums/source-tier.enum';
import { ClusterArticle, DailyRanking, StoryCluster } from '../src/entities';
import { NewsModule } from '../src/modules/news/news.module';

/**
 * HTTP-level e2e test for the News API. Exercises the real Nest routing,
 * global ValidationPipe, and DTO serialization, but swaps the TypeORM
 * repositories for in-memory fakes via DI overrides - this suite runs
 * anywhere (no live SQL Server needed). For a full DB-backed run, spin up
 * `docker-compose up` in the backend root and run migrations first (see
 * README), then point NODE_ENV at an environment with a real connection.
 */
describe('News API (e2e)', () => {
  let app: INestApplication<App>;

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

  const rankingRepoMock = {
    find: jest.fn().mockResolvedValue([ranking]),
    findOne: jest.fn().mockResolvedValue(ranking),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ date: '2026-07-25' }]),
    }),
  };

  const clusterArticleRepoMock = {
    find: jest.fn().mockResolvedValue([
      {
        article: {
          url: 'https://reuters.com/story',
          source: { name: 'Reuters', tier: SourceTier.WIRE },
        },
      },
    ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NewsModule],
    })
      .overrideProvider(getRepositoryToken(DailyRanking))
      .useValue(rankingRepoMock)
      .overrideProvider(getRepositoryToken(StoryCluster))
      .useValue({})
      .overrideProvider(getRepositoryToken(ClusterArticle))
      .useValue(clusterArticleRepoMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /news/today returns the ranked list for today', async () => {
    const res = await request(app.getHttpServer())
      .get('/news/today')
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      rank: 1,
      headline: 'Reserve Bank holds repo rate steady',
      score: 94,
      sourceCount: 7,
    });
  });

  it('GET /news/dates returns available dates', async () => {
    const res = await request(app.getHttpServer())
      .get('/news/dates')
      .expect(200);
    expect(res.body).toEqual(['2026-07-25']);
  });

  it('GET /news/story/:id returns full detail with breakdown and sources', async () => {
    const res = await request(app.getHttpServer())
      .get('/news/story/1')
      .expect(200);
    expect(res.body.breakdown).toHaveLength(3);
    expect(res.body.sources).toEqual([
      {
        name: 'Reuters',
        tier: SourceTier.WIRE,
        url: 'https://reuters.com/story',
      },
    ]);
  });

  it('GET /news/story/:id 400s on a non-numeric id', async () => {
    await request(app.getHttpServer())
      .get('/news/story/not-a-number')
      .expect(400);
  });

  it('GET /news/:date validates YYYY-MM-DD format', async () => {
    await request(app.getHttpServer()).get('/news/not-a-date').expect(400);
  });

  it('GET /news/:date returns 200 for a well-formed date', async () => {
    const res = await request(app.getHttpServer())
      .get('/news/2026-07-24')
      .expect(200);
    expect(res.body).toHaveLength(1);
  });
});
