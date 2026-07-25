import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SourcesService } from '../../modules/sources/sources.service';

/**
 * Standalone seed runner: `npm run seed`.
 * Boots the full Nest application context (so config/env validation and the
 * real DB connection are used - no separate "test" DB logic) purely to
 * invoke SourcesService.ensureDefaultSeeds(), then exits.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const sourcesService = app.get(SourcesService);
  await sourcesService.ensureDefaultSeeds();

  console.log('Default source seeds ensured.');
  await app.close();
}

run().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
