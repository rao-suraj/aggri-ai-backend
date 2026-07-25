import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AppDatabaseModule } from './database/database.module';
import { ClusteringModule } from './modules/clustering/clustering.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { NewsModule } from './modules/news/news.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { SourcesModule } from './modules/sources/sources.module';
import { SummarizationModule } from './modules/summarization/summarization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    AppDatabaseModule,
    SourcesModule,
    IngestionModule,
    ClusteringModule,
    ScoringModule,
    RankingModule,
    SummarizationModule,
    PipelineModule,
    NewsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
