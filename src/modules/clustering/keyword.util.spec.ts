import { extractKeywords, guessTopic, jaccardSimilarity } from './keyword.util';

describe('extractKeywords', () => {
  it('lowercases, strips punctuation, and removes stopwords', () => {
    const result = extractKeywords(
      'Reserve Bank holds repo rate at 5.75% for third review',
    );
    expect(result).toContain('reserve');
    expect(result).toContain('repo');
    expect(result).not.toContain('the');
    expect(result).not.toContain('at');
    expect(result).not.toContain('for');
  });

  it('drops very short leftover tokens', () => {
    const result = extractKeywords('EU agrees on AI liability rules');
    expect(result).not.toContain('eu'); // length 2, filtered out
    expect(result).toContain('agrees');
    expect(result).toContain('liability');
  });

  it('returns an empty array for an all-stopword title', () => {
    expect(extractKeywords('The a of it')).toEqual([]);
  });
});

describe('jaccardSimilarity', () => {
  it('returns 1 for identical sets', () => {
    const a = new Set(['reserve', 'bank', 'repo']);
    expect(jaccardSimilarity(a, new Set(a))).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    const a = new Set(['reserve', 'bank']);
    const b = new Set(['metro', 'phase']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when either set is empty', () => {
    expect(jaccardSimilarity(new Set(), new Set(['a']))).toBe(0);
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
  });

  it('computes partial overlap correctly', () => {
    const a = new Set(['reserve', 'bank', 'repo', 'rate']);
    const b = new Set(['reserve', 'bank', 'inflation']);
    // intersection = {reserve, bank} = 2, union = {reserve,bank,repo,rate,inflation} = 5
    expect(jaccardSimilarity(a, b)).toBeCloseTo(2 / 5);
  });
});

describe('guessTopic', () => {
  it('matches known topic keywords', () => {
    expect(guessTopic('Reserve Bank holds repo rate steady')).toBe('ECONOMY');
    expect(guessTopic('Chip maker posts record quarter on AI demand')).toBe(
      'MARKETS',
    );
    expect(guessTopic('Parliament committee summons minister')).toBe(
      'POLITICS',
    );
  });

  it('falls back to GENERAL when nothing matches', () => {
    expect(guessTopic('A quiet day in a small town')).toBe('GENERAL');
  });
});
