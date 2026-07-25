import { Controller, Get } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SourceResponseDto } from './dto/source-response.dto';
import { SourcesService } from './sources.service';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  async findAll(): Promise<SourceResponseDto[]> {
    const sources = await this.sourcesService.findAll();
    return plainToInstance(SourceResponseDto, sources, {
      excludeExtraneousValues: true,
    });
  }
}
