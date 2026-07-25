import { HttpService } from '@nestjs/axios';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { GroqService } from './groq.service';

describe('GroqService', () => {
  let service: GroqService;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GroqService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              apiKey: 'test-key',
              model: 'llama-3.3-70b-versatile',
              baseUrl: 'https://groq.example.com',
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(GroqService);
  });

  it('returns trimmed summary content', async () => {
    httpService.post.mockReturnValue(
      of({
        data: { choices: [{ message: { content: '  A neutral summary.  ' } }] },
      }),
    );

    const summary = await service.summarize({
      headline: 'Test headline',
      snippets: ['snippet 1', 'snippet 2'],
    });

    expect(summary).toBe('A neutral summary.');
    expect(httpService.post).toHaveBeenCalledWith(
      'https://groq.example.com/chat/completions',
      expect.objectContaining({ model: 'llama-3.3-70b-versatile' }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('throws when the HTTP call fails', async () => {
    httpService.post.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(
      service.summarize({ headline: 'H', snippets: [] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when the response has no content', async () => {
    httpService.post.mockReturnValue(of({ data: { choices: [] } }));

    await expect(
      service.summarize({ headline: 'H', snippets: [] }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
