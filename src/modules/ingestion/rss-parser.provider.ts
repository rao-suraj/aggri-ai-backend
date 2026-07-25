import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

export interface FeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
}

/**
 * Thin wrapper around `rss-parser` so IngestionService can depend on an
 * injectable, mockable interface instead of instantiating the library
 * directly (which would make unit testing the ingestion flow require real
 * network calls).
 */
@Injectable()
export class RssParserProvider {
  private readonly parser = new Parser({ timeout: 15000 });

  async parseURL(url: string): Promise<{ items: FeedItem[] }> {
    return this.parser.parseURL(url);
  }
}
