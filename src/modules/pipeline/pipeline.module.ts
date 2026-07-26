import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineRun } from '../../entities';
import { ClusteringModule } from '../clustering/clustering.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { RankingModule } from '../ranking/ranking.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SourcesModule } from '../sources/sources.module';
import { SummarizationModule } from '../summarization/summarization.module';
import { PipelineController } from './pipeline.controller';
// import { PipelineScheduler } from './pipeline.scheduler';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PipelineRun]),
    IngestionModule,
    ClusteringModule,
    ScoringModule,
    RankingModule,
    SummarizationModule,
    SourcesModule,
  ],
  controllers: [PipelineController],
  // PipelineScheduler is disabled on serverless (see app.module.ts note) -
  // Vercel Cron calls GET /pipeline/cron on PipelineController instead.
  // The class/file is kept as-is in case this project moves back to an
  // always-on host, where it can be re-enabled by uncommenting both here
  // and in app.module.ts.
  providers: [PipelineService /*, PipelineScheduler */],
  exports: [PipelineService],
})
export class PipelineModule {}
