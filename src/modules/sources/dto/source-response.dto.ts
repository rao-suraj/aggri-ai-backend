import { Expose } from 'class-transformer';

export class SourceResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  tier: string;

  @Expose()
  active: boolean;

  @Expose()
  lastFetchStatus: string | null;

  @Expose()
  lastFetchedAt: Date | null;
}
