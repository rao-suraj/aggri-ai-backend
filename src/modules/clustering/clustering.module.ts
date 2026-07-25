import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterArticle, RawArticle, StoryCluster } from '../../entities';
import { ClusteringService } from './clustering.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawArticle, StoryCluster, ClusterArticle]),
  ],
  providers: [ClusteringService],
  exports: [ClusteringService],
})
export class ClusteringModule {}
