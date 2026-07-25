import { SourceTier } from '../../common/enums/source-tier.enum';

/**
 * Default seed list of free, public RSS feeds.
 *
 * Note: Reuters, AP, PTI and ANI (named in the PRD as example trusted
 * sources) no longer publish free public RSS feeds as of 2026 - they were
 * discontinued/paywalled. This list substitutes comparable, verified-working
 * free feeds across the same three trust tiers. Every URL here was checked
 * to return HTTP 200 at seed-authoring time. Revisit via the `sources`
 * table (or re-run the seed) as feeds change.
 */
export interface SourceSeedEntry {
  name: string;
  rssUrl: string;
  tier: SourceTier;
}

export const DEFAULT_SOURCE_SEEDS: SourceSeedEntry[] = [
  // Wire tier - broad, multi-region correspondent networks
  {
    name: 'BBC News - World',
    rssUrl: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    tier: SourceTier.WIRE,
  },
  {
    name: 'Al Jazeera - All',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    tier: SourceTier.WIRE,
  },
  {
    name: 'DW - All English',
    rssUrl: 'https://rss.dw.com/xml/rss-en-all',
    tier: SourceTier.WIRE,
  },
  {
    name: 'NPR - News',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    tier: SourceTier.WIRE,
  },

  // Major tier - large national/international outlets
  {
    name: 'The Guardian - World',
    rssUrl: 'https://www.theguardian.com/world/rss',
    tier: SourceTier.MAJOR,
  },
  {
    name: 'New York Times - World',
    rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    tier: SourceTier.MAJOR,
  },
  {
    name: 'Sky News - World',
    rssUrl: 'https://feeds.skynews.com/feeds/rss/world.xml',
    tier: SourceTier.MAJOR,
  },
  {
    name: 'Wall Street Journal - World News',
    rssUrl: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    tier: SourceTier.MAJOR,
  },
  {
    name: 'The Hindu - National',
    rssUrl: 'https://www.thehindu.com/news/national/feeder/default.rss',
    tier: SourceTier.MAJOR,
  },
  {
    name: 'Hindustan Times - India News',
    rssUrl: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
    tier: SourceTier.MAJOR,
  },

  // Regional tier
  {
    name: 'Times of India',
    rssUrl: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    tier: SourceTier.REGIONAL,
  },
  {
    name: 'Indian Express - India',
    rssUrl: 'https://indianexpress.com/section/india/feed/',
    tier: SourceTier.REGIONAL,
  },
];
