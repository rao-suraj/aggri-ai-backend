export class StoryListItemDto {
  rank: number;
  clusterId: number;
  headline: string;
  summary: string;
  topic: string;
  publishedAt: Date;
  tier: string;
  score: number;
  sourceCount: number;
  aiFlagged: boolean;
  aiFlagCount: number;
}
