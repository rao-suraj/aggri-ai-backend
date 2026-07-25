import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyRanking, StoryCluster } from '../../entities';
import { RankingService } from './ranking.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoryCluster, DailyRanking])],
  providers: [RankingService],
  exports: [RankingService],
})
export class RankingModule {}
