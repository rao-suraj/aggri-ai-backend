import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/configuration';
import { IngestionService } from '../ingestion/ingestion.service';
import { PipelineService } from './pipeline.service';

/**
 * NOT CURRENTLY WIRED UP - the app runs as a Vercel serverless function,
 * which doesn't keep a process alive between requests, so this in-process
 * CronJob ticker never fires reliably in that environment. It is commented
 * out of the DI graph in pipeline.module.ts and app.module.ts
 * (ScheduleModule.forRoot() is disabled there too). Scheduling is instead
 * done via Vercel Cron Jobs (see /vercel.json) hitting the guarded
 * GET /pipeline/cron route on PipelineController.
 *
 * Kept here, uninstantiated, in case this project is ever deployed to an
 * always-on host again - re-enable by uncommenting the two spots above.
 *
 * Registers the two scheduled jobs described in the implementation plan:
 * - an hourly ingestion-only job that keeps RawArticle fresh throughout the day
 * - a once-daily full-pipeline job (clustering -> scoring -> ranking -> summarization)
 *
 * Cron expressions are read from config (env-driven) rather than hardcoded
 * in decorators, so they can differ per environment without a code change.
 */
@Injectable()
export class PipelineScheduler implements OnModuleInit {
  private readonly logger = new Logger(PipelineScheduler.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly ingestionService: IngestionService,
    private readonly pipelineService: PipelineService,
  ) {}

  onModuleInit(): void {
    const { ingestionCron, pipelineCron } = this.configService.get('pipeline', {
      infer: true,
    });

    const ingestionJob = new CronJob(ingestionCron, () => {
      this.logger.log('Running scheduled ingestion-only job');
      this.ingestionService.ingestAll().catch((error) => {
        this.logger.error(
          `Scheduled ingestion failed: ${(error as Error).message}`,
        );
      });
    });
    this.schedulerRegistry.addCronJob('hourly-ingestion', ingestionJob);
    ingestionJob.start();

    const pipelineJob = new CronJob(pipelineCron, () => {
      this.logger.log('Running scheduled full pipeline');
      this.pipelineService.runFullPipeline().catch((error) => {
        this.logger.error(
          `Scheduled pipeline run failed: ${(error as Error).message}`,
        );
      });
    });
    this.schedulerRegistry.addCronJob('daily-pipeline', pipelineJob);
    pipelineJob.start();

    this.logger.log(
      `Scheduled jobs registered: ingestion="${ingestionCron}", pipeline="${pipelineCron}"`,
    );
  }
}
