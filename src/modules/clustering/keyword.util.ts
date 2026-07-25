import { removeStopwords } from 'stopword';

/**
 * Extracts "important words" from a headline: lowercase, strip punctuation,
 * remove English filler words (the, a, said, after, ...) via the `stopword`
 * package, and drop very short leftover tokens.
 */
export function extractKeywords(title: string): string[] {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return removeStopwords(tokens).filter((token) => token.length > 2);
}

/**
 * Jaccard similarity: size of the intersection divided by size of the
 * union of two keyword sets. Returns 0 for two empty sets (no basis to
 * consider them the same story).
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  ECONOMY: [
    'inflation',
    'rate',
    'repo',
    'gdp',
    'economy',
    'economic',
    'fiscal',
    'budget',
    'tax',
  ],
  MARKETS: [
    'stock',
    'stocks',
    'shares',
    'market',
    'markets',
    'nasdaq',
    'ipo',
    'earnings',
    'merger',
    'quarter',
  ],
  TECH: [
    'tech',
    'technology',
    'app',
    'ai',
    'software',
    'chip',
    'startup',
    'cyber',
    'data',
  ],
  HEALTH: [
    'health',
    'hospital',
    'vaccine',
    'disease',
    'outbreak',
    'medical',
    'covid',
  ],
  WORLD: [
    'ceasefire',
    'war',
    'un',
    'summit',
    'treaty',
    'diplomat',
    'border',
    'refugee',
  ],
  POLITICS: [
    'election',
    'parliament',
    'minister',
    'president',
    'government',
    'senate',
    'vote',
    'bill',
  ],
  SPORTS: ['match', 'tournament', 'championship', 'cup', 'league', 'olympic'],
};

/**
 * Lightweight keyword-based topic guess for display purposes (the UI shows
 * a topic badge per story). This is a heuristic, not part of the scoring
 * pipeline - safe to revisit/replace with an AI classifier later without
 * affecting trust scoring.
 */
export function guessTopic(title: string): string {
  const lower = title.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return 'GENERAL';
}
