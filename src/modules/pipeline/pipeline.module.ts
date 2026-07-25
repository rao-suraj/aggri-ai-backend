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
import { PipelineScheduler } from './pipeline.scheduler';
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
  providers: [PipelineService, PipelineScheduler],
  exports: [PipelineService],
})
export class PipelineModule {}
