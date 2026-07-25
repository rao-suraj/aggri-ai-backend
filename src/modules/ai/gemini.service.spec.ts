import { HttpService } from '@nestjs/axios';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  let service: GeminiService;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeminiService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              apiKey: 'test-key',
              model: 'gemini-2.5-flash',
              baseUrl: 'https://gemini.example.com',
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(GeminiService);
  });

  it('parses a well-formed JSON response into flags', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sensational: false,
                      missing_attribution: true,
                      contradicts_other_sources: false,
                    }),
                  },
                ],
              },
            },
          ],
        },
      }),
    );

    const flags = await service.sanityCheck({
      headline: 'Test headline',
      snippets: ['snippet 1'],
    });

    expect(flags).toEqual({
      sensational: false,
      missing_attribution: true,
      contradicts_other_sources: false,
    });
  });

  it('strips markdown code fences before parsing', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"sensational":true,"missing_attribution":false,"contradicts_other_sources":false}\n```',
                  },
                ],
              },
            },
          ],
        },
      }),
    );

    const flags = await service.sanityCheck({ headline: 'H', snippets: [] });
    expect(flags.sensational).toBe(true);
  });

  it('throws when the HTTP call fails', async () => {
    httpService.post.mockReturnValue(
      throwError(() => new Error('network down')),
    );

    await expect(
      service.sanityCheck({ headline: 'H', snippets: [] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when the response cannot be parsed as JSON', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
        },
      }),
    );

    await expect(
      service.sanityCheck({ headline: 'H', snippets: [] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when the response is empty', async () => {
    httpService.post.mockReturnValue(of({ data: {} }));

    await expect(
      service.sanityCheck({ headline: 'H', snippets: [] }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
