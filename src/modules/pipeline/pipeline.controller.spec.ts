import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

describe('PipelineController', () => {
  let controller: PipelineController;
  let service: {
    getLatestRun: jest.Mock;
    startInBackground: jest.Mock;
    runFullPipeline: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getLatestRun: jest.fn(),
      startInBackground: jest.fn(),
      runFullPipeline: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [{ provide: PipelineService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PipelineController);
  });

  it('GET /pipeline/latest throws 404 when no run exists', async () => {
    service.getLatestRun.mockResolvedValue(null);
    await expect(controller.latest()).rejects.toThrow(NotFoundException);
  });

  it('GET /pipeline/latest returns the shaped run when one exists', async () => {
    service.getLatestRun.mockResolvedValue({
      id: 1,
      date: '2026-07-25',
      status: 'success',
    });
    const result = await controller.latest();
    expect(result).toMatchObject({ id: 1, status: 'success' });
  });

  it('POST /pipeline/run starts a background run and returns immediately', async () => {
    service.startInBackground.mockResolvedValue({ id: 2, status: 'running' });
    const result = await controller.trigger();
    expect(service.startInBackground).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 2, status: 'running' });
  });

  it('GET /pipeline/cron awaits the full run and returns its final status', async () => {
    service.runFullPipeline.mockResolvedValue({ id: 3, status: 'success' });
    const result = await controller.cron();
    expect(service.runFullPipeline).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 3, status: 'success' });
  });
});
