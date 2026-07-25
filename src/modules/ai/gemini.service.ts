import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/configuration';
import { AiSanityFlags } from '../../entities/story-cluster.entity';

export interface SanityCheckInput {
  headline: string;
  snippets: string[];
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * Thin client around the Gemini "generateContent" REST endpoint, used for
 * the Phase 3 AI sanity-check (judgment-heavy task: sensationalism, missing
 * attribution, contradictions between sources).
 *
 * There is intentionally no mock/fallback mode: if the API key is missing
 * the app fails at startup (see env.validation.ts), and if a call fails at
 * runtime it throws so the pipeline run is marked failed rather than
 * silently recording fabricated scores.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async sanityCheck(input: SanityCheckInput): Promise<AiSanityFlags> {
    const { apiKey, model, baseUrl } = this.configService.get('gemini', {
      infer: true,
    });

    const prompt = this.buildPrompt(input);
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    };

    let text: string | undefined;
    try {
      const response = await firstValueFrom(
        this.http.post<GeminiGenerateContentResponse>(url, body),
      );
      text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      this.logger.error(
        `Gemini sanity-check request failed for "${input.headline}": ${
          (error as Error).message
        }`,
      );
      throw new InternalServerErrorException(
        'Gemini sanity-check request failed',
      );
    }

    if (!text) {
      throw new InternalServerErrorException(
        'Gemini returned an empty response',
      );
    }

    return this.parseFlags(text, input.headline);
  }

  private buildPrompt(input: SanityCheckInput): string {
    return [
      'You are a neutral news sanity-checker. Given a news headline and short',
      'snippets from the articles reporting it, return ONLY a JSON object with',
      'exactly these three boolean fields:',
      '{"sensational": boolean, "missing_attribution": boolean, "contradicts_other_sources": boolean}',
      '',
      '- sensational: true if the headline/snippets use exaggerated or emotionally',
      '  manipulative language disproportionate to the facts.',
      '- missing_attribution: true if key claims lack a named source, official, or',
      '  document backing them.',
      '- contradicts_other_sources: true if the snippets conflict with each other on',
      '  material facts (numbers, dates, who said what).',
      '',
      `Headline: ${input.headline}`,
      'Snippets:',
      ...input.snippets.map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');
  }

  private parseFlags(text: string, headline: string): AiSanityFlags {
    try {
      const cleaned = text.trim().replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(cleaned) as Partial<AiSanityFlags>;
      return {
        sensational: Boolean(parsed.sensational),
        missing_attribution: Boolean(parsed.missing_attribution),
        contradicts_other_sources: Boolean(parsed.contradicts_other_sources),
      };
    } catch {
      this.logger.error(
        `Failed to parse Gemini response for "${headline}": ${text}`,
      );
      throw new InternalServerErrorException(
        'Gemini returned a response that could not be parsed as JSON',
      );
    }
  }
}
