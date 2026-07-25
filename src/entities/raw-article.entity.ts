import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Source } from './source.entity';

@Entity({ name: 'raw_articles' })
@Index(['contentHash'], { unique: true })
export class RawArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Source, (source) => source.articles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: Source;

  @Column({ name: 'source_id' })
  sourceId: number;

  @Column({ type: 'nvarchar', length: 1000 })
  title: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 2000 })
  url: string;

  @Column({ name: 'published_at', type: 'datetime2' })
  publishedAt: Date;

  @CreateDateColumn({ name: 'fetched_at', type: 'datetime2' })
  fetchedAt: Date;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;

  @Column({ name: 'cluster_id', type: 'int', nullable: true })
  clusterId: number | null;
}
