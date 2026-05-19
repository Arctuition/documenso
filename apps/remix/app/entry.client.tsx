import { StrictMode, startTransition, useEffect } from 'react';

import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import * as Sentry from '@sentry/react-router';
import posthog from 'posthog-js';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';
import { env } from '@documenso/lib/utils/env';
import { dynamicActivate } from '@documenso/lib/utils/i18n';

const sentryDsn = env('NEXT_PUBLIC_SENTRY_DSN');

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: env('NODE_ENV') ?? 'development',
    integrations: [Sentry.reactRouterTracingIntegration()],
    tracesSampleRate: Number(env('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE') ?? '0.1'),
  });
}

function PosthogInit() {
  const postHogConfig = extractPostHogConfig();

  useEffect(() => {
    if (postHogConfig) {
      posthog.init(postHogConfig.key, {
        api_host: postHogConfig.host,
        capture_exceptions: true,
      });
    }
  }, []);

  return null;
}

async function main() {
  const locale = detect(fromHtmlTag('lang')) || 'en';

  await dynamicActivate(locale);

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <HydratedRouter />
        </I18nProvider>

        <PosthogInit />
      </StrictMode>,
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
