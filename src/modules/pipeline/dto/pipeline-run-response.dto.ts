import { Expose } from 'class-transformer';

export class PipelineRunResponseDto {
  @Expose()
  id: number;

  @Expose()
  date: string;

  @Expose()
  startedAt: Date;

  @Expose()
  finishedAt: Date | null;

  @Expose()
  status: string;

  @Expose()
  sourcesTotal: number;

  @Expose()
  sourcesOk: number;

  @Expose()
  articlesIngested: number;

  @Expose()
  clustersTotal: number;

  @Expose()
  clustersScored: number;

  @Expose()
  storiesRanked: number;

  @Expose()
  geminiCalls: number;

  @Expose()
  groqCalls: number;

  @Expose()
  errorMessage: string | null;
}
