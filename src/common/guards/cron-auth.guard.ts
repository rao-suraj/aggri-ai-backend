import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

/**
 * Protects routes that Vercel Cron invokes (e.g. GET /pipeline/cron).
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on every
 * cron-triggered request, using the `CRON_SECRET` environment variable set
 * on the project - see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * This guard just checks that header matches our own copy of the secret,
 * read directly from process.env (not ConfigService) so it stays usable
 * even for routes hit before/outside normal request-scoped DI resolution.
 *
 * Fails closed: if CRON_SECRET isn't configured at all, every request is
 * rejected rather than the guard silently accepting anything.
 */
@Injectable()
export class CronAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    return authHeader === `Bearer ${secret}`;
  }
}
