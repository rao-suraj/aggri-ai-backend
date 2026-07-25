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

  @Post('run')
  @HttpCode(202)
  async trigger(): Promise<PipelineRunResponseDto> {
    const run = await this.pipelineService.runFullPipeline();
    return plainToInstance(PipelineRunResponseDto, run, {
      excludeExtraneousValues: true,
    });
  }
}
