import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SourceTier } from '../../common/enums/source-tier.enum';
import { DEFAULT_SOURCE_SEEDS } from '../../database/seeds/sources.seed';
import { Source } from '../../entities';
import { SourcesService } from './sources.service';

describe('SourcesService', () => {
  let service: SourcesService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((entity) => entity),
      update: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: getRepositoryToken(Source), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(SourcesService);
  });

  it('only inserts seeds that do not already exist (idempotent)', async () => {
    repo.findOne.mockResolvedValue({ id: 1 }); // pretend everything exists

    await service.ensureDefaultSeeds();

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.findOne).toHaveBeenCalledTimes(DEFAULT_SOURCE_SEEDS.length);
  });

  it('inserts missing seeds', async () => {
    repo.findOne.mockResolvedValue(null);

    await service.ensureDefaultSeeds();

    expect(repo.save).toHaveBeenCalledTimes(DEFAULT_SOURCE_SEEDS.length);
  });

  it('seeds cover all three trust tiers', () => {
    const tiers = new Set(DEFAULT_SOURCE_SEEDS.map((s) => s.tier));
    expect(tiers).toEqual(
      new Set([SourceTier.WIRE, SourceTier.MAJOR, SourceTier.REGIONAL]),
    );
  });

  it('marks fetch result with a timestamp', async () => {
    await service.markFetchResult(5, 'error');
    expect(repo.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ lastFetchStatus: 'error' }),
    );
  });
});
