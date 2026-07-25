import { mapWithConcurrency } from './concurrency.util';

describe('mapWithConcurrency', () => {
  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const seen: number[] = [];

    await mapWithConcurrency(items, 5, (item) => {
      seen.push(item);
      return Promise.resolve();
    });

    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('never runs more than `concurrency` workers at once', async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(items, 4, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it('resolves immediately for an empty list without calling worker', async () => {
    const worker = jest.fn();
    await mapWithConcurrency([], 5, worker);
    expect(worker).not.toHaveBeenCalled();
  });

  it('clamps concurrency to the number of items when concurrency is larger', async () => {
    const items = [1, 2, 3];
    const worker = jest.fn().mockResolvedValue(undefined);
    await mapWithConcurrency(items, 100, worker);
    expect(worker).toHaveBeenCalledTimes(3);
  });

  it('continues processing remaining items even if one worker call throws synchronously inside a caught block', async () => {
    // mapWithConcurrency itself does not swallow errors - callers are
    // expected to catch inside `worker` (as ScoringService/SummarizationService do).
    const results: string[] = [];
    await mapWithConcurrency(['a', 'b', 'c'], 2, (item) => {
      try {
        if (item === 'b') throw new Error('boom');
        results.push(item);
      } catch {
        results.push('b-failed');
      }
      return Promise.resolve();
    });
    expect(results.sort()).toEqual(['a', 'b-failed', 'c']);
  });
});
