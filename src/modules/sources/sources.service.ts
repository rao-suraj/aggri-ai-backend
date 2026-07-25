import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_SOURCE_SEEDS } from '../../database/seeds/sources.seed';
import { Source } from '../../entities';

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  findAll(): Promise<Source[]> {
    return this.sourceRepository.find({ order: { tier: 'ASC', name: 'ASC' } });
  }

  findActive(): Promise<Source[]> {
    return this.sourceRepository.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Idempotently ensures the default seed feeds exist. Safe to call on every
   * boot: existing rows (matched by rss_url) are left untouched, only
   * missing ones are inserted.
   */
  async ensureDefaultSeeds(): Promise<void> {
    for (const seed of DEFAULT_SOURCE_SEEDS) {
      const existing = await this.sourceRepository.findOne({
        where: { rssUrl: seed.rssUrl },
      });
      if (!existing) {
        await this.sourceRepository.save(
          this.sourceRepository.create({
            name: seed.name,
            rssUrl: seed.rssUrl,
            tier: seed.tier,
            active: true,
          }),
        );
        this.logger.log(`Seeded source "${seed.name}"`);
      }
    }
  }

  async markFetchResult(
    sourceId: number,
    status: 'ok' | 'error',
  ): Promise<void> {
    await this.sourceRepository.update(sourceId, {
      lastFetchStatus: status,
      lastFetchedAt: new Date(),
    });
  }
}
