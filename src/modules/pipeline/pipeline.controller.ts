import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CronAuthGuard } from '../../common/guards/cron-auth.guard';
import { PipelineRunResponseDto } from './dto/pipeline-run-response.dto';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('latest')
  async latest(): Promise<PipelineRunResponseDto> {
    const run = await this.pipelineService.getLatestRun();
    if (!run) {
      throw new NotFoundException('No pipeline runs recorded yet');
    }
    return plainToInstance(PipelineRunResponseDto, run, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Kicks off a full pipeline run and returns immediately (the run row is
   * created synchronously with status "running") - it does not wait for
   * completion. Real RSS feed volume routinely produces hundreds of
   * clusters to score/summarize in a single run, so blocking an HTTP
   * request on that isn't practical. Poll GET /pipeline/latest for progress.
   */
  @Post('run')
  @HttpCode(202)
  async trigger(): Promise<PipelineRunResponseDto> {
    const run = await this.pipelineService.startInBackground();
    return plainToInstance(PipelineRunResponseDto, run, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Called on a schedule by Vercel Cron (see /vercel.json `crons`), which
   * always invokes cron routes with GET. Guarded by CronAuthGuard so only
   * requests carrying the `CRON_SECRET` Vercel attaches automatically can
   * trigger it - see cron-auth.guard.ts.
   *
   * Unlike POST /pipeline/run, this awaits the full run rather than firing
   * it in the background: on a serverless platform there is no guarantee
   * an unawaited promise survives past the response, so the function must
   * stay alive (bounded by vercel.json's `maxDuration`) until the pipeline
   * actually finishes. runFullPipeline() already runs ingestion first
   * (see pipeline.service.ts), so this single route replaces both the old
   * hourly ingestion-only cron and the daily full-pipeline cron.
   */
  @Get('cron')
  @UseGuards(CronAuthGuard)
  async cron(): Promise<PipelineRunResponseDto> {
    const run = await this.pipelineService.runFullPipeline();
    return plainToInstance(PipelineRunResponseDto, run, {
      excludeExtraneousValues: true,
    });
  }
}
