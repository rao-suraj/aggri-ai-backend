import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterArticle, DailyRanking } from '../../entities';
import { AiModule } from '../ai/ai.module';
import { SummarizationService } from './summarization.service';

@Module({
  imports: [TypeOrmModule.forFeature([DailyRanking, ClusterArticle]), AiModule],
  providers: [SummarizationService],
  exports: [SummarizationService],
})
export class SummarizationModule {}
