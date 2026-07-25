import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterArticle, StoryCluster } from '../../entities';
import { AiModule } from '../ai/ai.module';
import { ScoringService } from './scoring.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoryCluster, ClusterArticle]), AiModule],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
