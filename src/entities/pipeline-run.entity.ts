import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PipelineRunStatus = 'running' | 'success' | 'failed';

/**
 * Records one execution of the full daily pipeline (ingestion -> clustering
 * -> scoring -> ranking -> summarization). Powers the frontend's stats bar
 * ("INGESTED 1,284", "FEEDS LIVE 14/15", "LAST RUN 17:00", etc.) without the
 * frontend needing to know anything about the pipeline's internals.
 */
@Entity({ name: 'pipeline_runs' })
export class PipelineRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: PipelineRunStatus;

  @Column({ name: 'sources_total', type: 'int', default: 0 })
  sourcesTotal: number;

  @Column({ name: 'sources_ok', type: 'int', default: 0 })
  sourcesOk: number;

  @Column({ name: 'articles_ingested', type: 'int', default: 0 })
  articlesIngested: number;

  @Column({ name: 'clusters_total', type: 'int', default: 0 })
  clustersTotal: number;

  @Column({ name: 'clusters_scored', type: 'int', default: 0 })
  clustersScored: number;

  @Column({ name: 'stories_ranked', type: 'int', default: 0 })
  storiesRanked: number;

  @Column({ name: 'gemini_calls', type: 'int', default: 0 })
  geminiCalls: number;

  @Column({ name: 'groq_calls', type: 'int', default: 0 })
  groqCalls: number;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
