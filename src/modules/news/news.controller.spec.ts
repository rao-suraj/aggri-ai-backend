import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

describe('NewsController', () => {
  let controller: NewsController;
  let service: {
    getRankingForDate: jest.Mock;
    getAvailableDates: jest.Mock;
    getClusterDetail: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getRankingForDate: jest.fn().mockResolvedValue([{ rank: 1 }]),
      getAvailableDates: jest.fn().mockResolvedValue(['2026-07-25']),
      getClusterDetail: jest.fn().mockResolvedValue({ rank: 1, clusterId: 1 }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [{ provide: NewsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(NewsController);
  });

  it("GET /news/today delegates to today's date", async () => {
    const result = await controller.today();
    expect(service.getRankingForDate).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(result).toEqual([{ rank: 1 }]);
  });

  it('GET /news/dates returns available dates', async () => {
    const result = await controller.dates();
    expect(result).toEqual(['2026-07-25']);
  });

  it('GET /news/story/:id returns cluster detail', async () => {
    const result = await controller.story(1);
    expect(service.getClusterDetail).toHaveBeenCalledWith(1);
    expect(result).toEqual({ rank: 1, clusterId: 1 });
  });

  it('GET /news/:date validates the date format', async () => {
    await expect(controller.byDate('not-a-date')).rejects.toThrow(
      BadRequestException,
    );
    expect(service.getRankingForDate).not.toHaveBeenCalled();
  });

  it('GET /news/:date delegates valid dates to the service', async () => {
    const result = await controller.byDate('2026-07-24');
    expect(service.getRankingForDate).toHaveBeenCalledWith('2026-07-24');
    expect(result).toEqual([{ rank: 1 }]);
  });
});
