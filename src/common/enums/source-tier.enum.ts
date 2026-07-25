export enum SourceTier {
  WIRE = 'wire',
  MAJOR = 'major',
  REGIONAL = 'regional',
}

/**
 * Fixed credibility weight per source tier, used by the scoring stage.
 * A cluster's credibility score is the highest tier weight among its
 * contributing sources (see ScoringService).
 */
export const SOURCE_TIER_WEIGHT: Record<SourceTier, number> = {
  [SourceTier.WIRE]: 1.0,
  [SourceTier.MAJOR]: 0.7,
  [SourceTier.REGIONAL]: 0.4,
};
