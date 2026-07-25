import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawArticle } from '../../entities';
import { SourcesModule } from '../sources/sources.module';
import { IngestionService } from './ingestion.service';
import { RssParserProvider } from './rss-parser.provider';

@Module({
  imports: [TypeOrmModule.forFeature([RawArticle]), SourcesModule],
  providers: [IngestionService, RssParserProvider],
  exports: [IngestionService],
})
export class IngestionModule {}
