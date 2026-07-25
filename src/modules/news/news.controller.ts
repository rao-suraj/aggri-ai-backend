import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { StoryDetailDto } from './dto/story-detail.dto';
import { StoryListItemDto } from './dto/story-list-item.dto';
import { NewsService } from './news.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertValidDate(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new BadRequestException('date must be in YYYY-MM-DD format');
  }
}

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('today')
  async today(): Promise<StoryListItemDto[]> {
    return this.newsService.getRankingForDate(todayDateString());
  }

  @Get('dates')
  async dates(): Promise<string[]> {
    return this.newsService.getAvailableDates();
  }

  @Get('story/:id')
  async story(@Param('id', ParseIntPipe) id: number): Promise<StoryDetailDto> {
    return this.newsService.getClusterDetail(id);
  }

  @Get(':date')
  async byDate(@Param('date') date: string): Promise<StoryListItemDto[]> {
    assertValidDate(date);
    return this.newsService.getRankingForDate(date);
  }
}
