import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
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
}
