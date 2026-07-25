import { AiSanityFlags } from '../../../entities';
import { StoryListItemDto } from './story-list-item.dto';

export class ScoreBreakdownItemDto {
  label: string;
  value: number;
  weightPct: number;
  note: string;
}

export class ContributingSourceDto {
  name: string;
  tier: string;
  url: string;
}

export class StoryDetailDto extends StoryListItemDto {
  breakdown: ScoreBreakdownItemDto[];
  sources: ContributingSourceDto[];
  aiFlags: AiSanityFlags | null;
  plainEnglish: string;
}
