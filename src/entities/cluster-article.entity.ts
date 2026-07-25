import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RawArticle } from './raw-article.entity';
import { StoryCluster } from './story-cluster.entity';

@Entity({ name: 'cluster_articles' })
export class ClusterArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StoryCluster, (cluster) => cluster.clusterArticles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cluster_id' })
  cluster: StoryCluster;

  @Column({ name: 'cluster_id' })
  clusterId: number;

  @ManyToOne(() => RawArticle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article: RawArticle;

  @Column({ name: 'article_id' })
  articleId: number;
}
