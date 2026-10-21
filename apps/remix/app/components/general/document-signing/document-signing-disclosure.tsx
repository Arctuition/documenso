import { cn } from '@documenso/ui/lib/utils';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { HTMLAttributes } from 'react';
import { Link } from 'react-router';

export type DocumentSigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

// ArcSite: link to ArcSite's terms instead of Documenso's signature disclosure.
const DEFAULT_DISCLOSURE_URL = 'https://www.arcsite.com/legal/terms';

const DISCLOSURE_URLS: Record<string, string> = {
  fr: 'https://www.arcsite.com/modalites-et-conditions',
};

export const DocumentSigningDisclosure = ({ className, ...props }: DocumentSigningDisclosureProps) => {
  const { i18n } = useLingui();

  const disclosureUrl = DISCLOSURE_URLS[i18n.locale] ?? DEFAULT_DISCLOSURE_URL;

  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props}>
      <Trans>
        By proceeding with your electronic signature, you acknowledge and consent that it will be used to sign the given
        document and holds the same legal validity as a handwritten signature. By completing the electronic signing
        process, you affirm your understanding and acceptance of these conditions.
      </Trans>
      <span className="mt-2 block">
        <Trans>
          Read the full{' '}
          <Link className="text-documenso-700 underline" to={disclosureUrl} target="_blank">
            signature disclosure
          </Link>
          .
        </Trans>
      </span>
    </p>
  );
};
