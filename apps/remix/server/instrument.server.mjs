/**
 * Sentry server-side instrumentation.
 *
 * This file MUST be loaded before any other application code so that Sentry
 * can patch the relevant modules (http, etc.). It is loaded via Node's
 * `--import` flag in the `start` script and copied next to `main.js` during
 * the build.
 *
 * Note: env variables are injected at runtime (see `npm run start` which loads
 * them via dotenv), so reading from `process.env` here is safe.
 */
import * as Sentry from '@sentry/react-router';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: true,
  });
}
