import { StrictMode, startTransition, useEffect } from 'react';

import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import { init, replayIntegration } from '@sentry/remix';
import posthog from 'posthog-js';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';
import { dynamicActivate } from '@documenso/lib/utils/i18n';

init({
  dsn: 'https://973333d14254e6acb47056431ab6532c@o302832.ingest.us.sentry.io/4509218931081216',

  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
});

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
