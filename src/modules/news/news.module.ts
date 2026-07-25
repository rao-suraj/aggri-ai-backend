import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterArticle, DailyRanking, StoryCluster } from '../../entities';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyRanking, StoryCluster, ClusterArticle]),
  ],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
