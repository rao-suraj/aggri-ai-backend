import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/configuration';

export interface SummarizeInput {
  headline: string;
  snippets: string[];
}

interface GroqChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Thin client around Groq's OpenAI-compatible chat completions endpoint,
 * used for Phase 4 summarization (higher-volume, simpler transformation
 * task than the Gemini sanity-check).
 *
 * No mock/fallback mode: missing key fails startup, failed calls throw.
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async summarize(input: SummarizeInput): Promise<string> {
    const { apiKey, model, baseUrl } = this.configService.get('groq', {
      infer: true,
    });

    const prompt = this.buildPrompt(input);

    let content: string | undefined;
    try {
      const response = await firstValueFrom(
        this.http.post<GroqChatCompletionResponse>(
          `${baseUrl}/chat/completions`,
          {
            model,
            temperature: 0.3,
            max_tokens: 200,
            messages: [
              {
                role: 'system',
                content:
                  'You write short, neutral, factual news summaries. No opinions, no sensationalism.',
              },
              { role: 'user', content: prompt },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      content = response.data.choices?.[0]?.message?.content;
    } catch (error) {
      this.logger.error(
        `Groq summarization request failed for "${input.headline}": ${
          (error as Error).message
        }`,
      );
      throw new InternalServerErrorException(
        'Groq summarization request failed',
      );
    }

    if (!content) {
      throw new InternalServerErrorException('Groq returned an empty response');
    }

    return content.trim();
  }

  private buildPrompt(input: SummarizeInput): string {
    return [
      `Headline: ${input.headline}`,
      '',
      'Source snippets:',
      ...input.snippets.map((s, i) => `${i + 1}. ${s}`),
      '',
      'Write a neutral, factual 2-3 sentence summary of this story for a daily',
      'news briefing. Do not editorialize. Do not mention the sources by name.',
    ].join('\n');
  }
}
