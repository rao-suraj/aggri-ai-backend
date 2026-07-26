import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

/**
 * Explicit Vercel Function entry point.
 *
 * Vercel's zero-config NestJS support (detecting `app.listen()` in
 * src/main.ts and bundling the whole app into one Function automatically)
 * turned out to be unreliable for this project: it first failed to build
 * with an "unmatched-function-pattern" error when maxDuration was set via
 * vercel.json's `functions` key, and once that was removed it built fine
 * but crashed on every request at runtime with:
 *   "No exports found in module /var/task/src/main.js.
 *    Did you forget to export a function or a server?"
 *   Node.js process exited with exit status: 1
 * i.e. Vercel's listener-detection isn't picking up main.ts's app.listen()
 * call at all in this setup.
 *
 * Rather than depend on that auto-detection, this file uses the older,
 * long-established pattern for running NestJS on Vercel: bootstrap Nest
 * once onto an Express instance, cache it across warm invocations (Fluid
 * Compute reuses instances), and forward every request into it via a
 * plain exported handler function - which is definitely picked up
 * correctly, since it's just a standard Vercel Node.js Function.
 *
 * `src/main.ts` (with its own `app.listen()`) is left as-is for local
 * `nest start`/`npm run start:dev` - it is NOT used by Vercel; this file
 * is the only thing Vercel invokes there (see vercel.json's rewrites).
 */

let cachedExpressApp: Express | undefined;

async function bootstrapServer(): Promise<Express> {
  if (!cachedExpressApp) {
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.enableCors();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    await app.init();
    cachedExpressApp = expressApp;
  }

  return cachedExpressApp;
}

export default async function handler(req: Request, res: Response) {
  const expressApp = await bootstrapServer();
  expressApp(req, res);
}
