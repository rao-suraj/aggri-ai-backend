import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StoryCluster } from './story-cluster.entity';

@Entity({ name: 'daily_rankings' })
@Index(['date', 'rank'], { unique: true })
export class DailyRanking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StoryCluster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: StoryCluster;

  @Column({ name: 'cluster_id' })
  clusterId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int' })
  rank: number;

  @Column({ name: 'summary_text', type: 'nvarchar', length: 'max' })
  summaryText: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;
}
