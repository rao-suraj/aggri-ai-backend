import { Test } from '@nestjs/testing';
import { SourceTier } from '../../common/enums/source-tier.enum';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

describe('SourcesController', () => {
  let controller: SourcesController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'BBC News',
          tier: SourceTier.WIRE,
          active: true,
          lastFetchStatus: 'ok',
          lastFetchedAt: new Date('2026-07-25T07:00:00Z'),
          rssUrl: 'https://example.com/rss.xml',
        },
      ]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [{ provide: SourcesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(SourcesController);
  });

  it('returns sources shaped by SourceResponseDto (excluding rssUrl)', async () => {
    const result = await controller.findAll();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'BBC News',
      tier: SourceTier.WIRE,
    });
    expect(
      (result[0] as unknown as Record<string, unknown>).rssUrl,
    ).toBeUndefined();
  });
});
