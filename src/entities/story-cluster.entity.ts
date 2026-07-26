import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClusterArticle } from './cluster-article.entity';
import { RawArticle } from './raw-article.entity';

export interface AiSanityFlags {
  sensational: boolean;
  missing_attribution: boolean;
  contradicts_other_sources: boolean;
}

@Entity({ name: 'story_clusters' })
@Index(['date'])
export class StoryCluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'primary_headline', type: 'varchar', length: 1000 })
  primaryHeadline: string;

  @Column({ name: 'topic', type: 'varchar', length: 40, default: 'GENERAL' })
  topic: string;

  @ManyToOne(() => RawArticle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'representative_article_id' })
  representativeArticle: RawArticle | null;

  @Column({ name: 'representative_article_id', type: 'int', nullable: true })
  representativeArticleId: number | null;

  @Column({ name: 'corroboration_count', type: 'int', default: 0 })
  corroborationCount: number;

  @Column({ name: 'credibility_score', type: 'float', default: 0 })
  credibilityScore: number;

  @Column({ name: 'corroboration_score', type: 'float', default: 0 })
  corroborationScore: number;

  @Column({ name: 'ai_flag_score', type: 'float', default: 0 })
  aiFlagScore: number;

  @Column({ name: 'ai_flags', type: 'text', nullable: true })
  aiFlagsRaw: string | null;

  @Column({ name: 'final_score', type: 'float', default: 0 })
  finalScore: number;

  @Column({ name: 'highest_tier', type: 'varchar', length: 20, nullable: true })
  highestTier: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @OneToMany(() => ClusterArticle, (ca) => ca.cluster)
  clusterArticles: ClusterArticle[];
}
