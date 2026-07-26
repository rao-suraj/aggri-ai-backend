import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { ScheduleModule } from '@nestjs/schedule';
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
    // ScheduleModule.forRoot() is disabled: the app now runs as a Vercel
    // serverless function, which does not keep a process alive between
    // requests, so an in-process cron ticker (@nestjs/schedule + `cron`)
    // never fires reliably. Scheduling is handled by Vercel Cron Jobs
    // (see /vercel.json `crons`) hitting the guarded GET /pipeline/cron
    // route instead (see pipeline.controller.ts). Left commented rather
    // than removed in case this ever moves back to an always-on host.
    // ScheduleModule.forRoot(),
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
