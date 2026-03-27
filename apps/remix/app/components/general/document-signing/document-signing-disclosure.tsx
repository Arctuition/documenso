import type { HTMLAttributes } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { cn } from '@documenso/ui/lib/utils';

export type DocumentSigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

const DISCLOSURE_URLS: Record<string, string> = {
  fr: 'https://www.arcsite.com/modalites-et-conditions',
};

export const DocumentSigningDisclosure = ({
  className,
  ...props
}: DocumentSigningDisclosureProps) => {
  const { i18n } = useLingui();

  const disclosureUrl = DISCLOSURE_URLS[i18n.locale] ?? 'https://www.arcsite.com/legal/terms';

  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props}>
      <Trans>
        By proceeding with your electronic signature, you acknowledge and consent that it will be
        used to sign the given document and holds the same legal validity as a handwritten
        signature. By completing the electronic signing process, you affirm your understanding and
        acceptance of these conditions.
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
