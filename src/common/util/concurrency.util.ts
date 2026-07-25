/**
 * Runs `worker` over every item in `items`, at most `concurrency` at a time,
 * and resolves once all have settled (success or failure - `worker` is
 * expected to catch/report its own errors, since callers generally want a
 * per-item success/failure count rather than the whole batch rejecting on
 * the first error).
 *
 * Used by ScoringService/SummarizationService so a day's worth of external
 * AI calls (which can be in the hundreds - real RSS feed volume is much
 * higher than a few dozen a day) don't run one-at-a-time. A sequential
 * `for` loop over ~700 Gemini calls at 1-2s each would take 20+ minutes;
 * with a concurrency of e.g. 10 that drops to a couple of minutes.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runOne()));
}
