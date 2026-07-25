import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SourceTier } from '../common/enums/source-tier.enum';
import { RawArticle } from './raw-article.entity';

@Entity({ name: 'sources' })
export class Source {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Index({ unique: true })
  @Column({ name: 'rss_url', type: 'varchar', length: 1000 })
  rssUrl: string;

  @Column({ type: 'varchar', length: 20 })
  tier: SourceTier;

  @Column({ type: 'bit', default: true })
  active: boolean;

  @Column({
    name: 'last_fetch_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  lastFetchStatus: 'ok' | 'error' | null;

  @Column({ name: 'last_fetched_at', type: 'datetime2', nullable: true })
  lastFetchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;

  @OneToMany(() => RawArticle, (article) => article.source)
  articles: RawArticle[];
}
