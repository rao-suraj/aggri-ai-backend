import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RawArticle } from '../../entities';
import { SourcesService } from '../sources/sources.service';
import { IngestionService } from './ingestion.service';
import { RssParserProvider } from './rss-parser.provider';

describe('IngestionService', () => {
  let service: IngestionService;
  let articleRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let sourcesService: { findActive: jest.Mock; markFetchResult: jest.Mock };
  let rssParser: { parseURL: jest.Mock };

  const source = {
    id: 1,
    name: 'BBC News',
    rssUrl: 'https://example.com/rss.xml',
    tier: 'wire',
    active: true,
  };

  beforeEach(async () => {
    articleRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((entity) => entity),
    };
    sourcesService = {
      findActive: jest.fn().mockResolvedValue([source]),
      markFetchResult: jest.fn(),
    };
    rssParser = { parseURL: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: getRepositoryToken(RawArticle), useValue: articleRepo },
        { provide: SourcesService, useValue: sourcesService },
        { provide: RssParserProvider, useValue: rssParser },
      ],
    }).compile();

    service = moduleRef.get(IngestionService);
  });

  it('inserts new articles and skips ones without a title or link', async () => {
    rssParser.parseURL.mockResolvedValue({
      items: [
        {
          title: 'Headline one',
          link: 'https://x.com/1',
          isoDate: '2026-07-25T05:00:00.000Z',
        },
        { title: '', link: 'https://x.com/2' },
        { title: 'No link here' },
      ],
    });
    articleRepo.findOne.mockResolvedValue(null);

    const result = await service.ingestAll();

    expect(result.sourcesOk).toBe(1);
    expect(result.sourcesFailed).toBe(0);
    expect(result.articlesInserted).toBe(1);
    expect(result.articlesSkipped).toBe(2);
    expect(articleRepo.save).toHaveBeenCalledTimes(1);
    expect(sourcesService.markFetchResult).toHaveBeenCalledWith(1, 'ok');
  });

  it('skips articles whose content hash already exists (dedup)', async () => {
    rssParser.parseURL.mockResolvedValue({
      items: [{ title: 'Already seen', link: 'https://x.com/1' }],
    });
    articleRepo.findOne.mockResolvedValue({ id: 99 });

    const result = await service.ingestAll();

    expect(result.articlesInserted).toBe(0);
    expect(result.articlesSkipped).toBe(1);
    expect(articleRepo.save).not.toHaveBeenCalled();
  });

  it('produces the same content hash for the same source+title on repeated runs', async () => {
    rssParser.parseURL.mockResolvedValue({
      items: [{ title: 'Stable Headline', link: 'https://x.com/1' }],
    });
    articleRepo.findOne.mockResolvedValue(null);
    await service.ingestAll();

    const firstCallArgs = articleRepo.create.mock.calls[0][0];
    articleRepo.create.mockClear();
    articleRepo.findOne.mockResolvedValue(null);
    await service.ingestAll();
    const secondCallArgs = articleRepo.create.mock.calls[0][0];

    expect(firstCallArgs.contentHash).toBe(secondCallArgs.contentHash);
  });

  it('continues to other sources and marks status "error" when one feed fails', async () => {
    const secondSource = { ...source, id: 2, name: 'Failing Feed' };
    sourcesService.findActive.mockResolvedValue([source, secondSource]);
    rssParser.parseURL
      .mockResolvedValueOnce({
        items: [{ title: 'OK', link: 'https://x.com/ok' }],
      })
      .mockRejectedValueOnce(new Error('feed down'));
    articleRepo.findOne.mockResolvedValue(null);

    const result = await service.ingestAll();

    expect(result.sourcesOk).toBe(1);
    expect(result.sourcesFailed).toBe(1);
    expect(sourcesService.markFetchResult).toHaveBeenCalledWith(1, 'ok');
    expect(sourcesService.markFetchResult).toHaveBeenCalledWith(2, 'error');
  });
});
