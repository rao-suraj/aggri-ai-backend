import { ExecutionContext } from '@nestjs/common';
import { CronAuthGuard } from './cron-auth.guard';

function contextWithAuthHeader(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('CronAuthGuard', () => {
  const originalSecret = process.env.CRON_SECRET;
  let guard: CronAuthGuard;

  beforeEach(() => {
    guard = new CronAuthGuard();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('rejects when CRON_SECRET is not configured at all', () => {
    delete process.env.CRON_SECRET;
    expect(guard.canActivate(contextWithAuthHeader('Bearer anything'))).toBe(
      false,
    );
  });

  it('rejects when the Authorization header is missing', () => {
    process.env.CRON_SECRET = 'the-secret';
    expect(guard.canActivate(contextWithAuthHeader(undefined))).toBe(false);
  });

  it('rejects when the Authorization header does not match', () => {
    process.env.CRON_SECRET = 'the-secret';
    expect(guard.canActivate(contextWithAuthHeader('Bearer wrong'))).toBe(
      false,
    );
  });

  it('accepts when the Authorization header matches Bearer <CRON_SECRET>', () => {
    process.env.CRON_SECRET = 'the-secret';
    expect(guard.canActivate(contextWithAuthHeader('Bearer the-secret'))).toBe(
      true,
    );
  });
});
