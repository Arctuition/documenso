import { useMemo } from 'react';

import { useLingui } from '@lingui/react';
import { type Field, type Recipient } from '@prisma/client';
import { useNavigate } from 'react-router';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';

import { DocumentSigningCompleteDialog } from './document-signing-complete-dialog';

export type DocumentSigningFormProps = {
  document: DocumentAndSender;
  recipient: Recipient;
  fields: Field[];
  redirectUrl?: string | null;
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
};

export const DocumentSigningNextField = ({
  document,
  recipient,
  fields,
  redirectUrl,
  isRecipientsTurn,
  allRecipients = [],
}: DocumentSigningFormProps) => {
  const { _ } = useLingui();

  const navigate = useNavigate();
  const analytics = useAnalytics();

  const {
    mutateAsync: completeDocumentWithToken,
    isPending,
    isSuccess,
  } = trpc.recipient.completeDocumentWithToken.useMutation();

  // Keep the loading state going if successful since the redirect may take some time.
  const isSubmitting = isPending || isSuccess;

  const fieldsRequiringValidation = useMemo(
    () => fields.filter(isFieldUnsignedAndRequired),
    [fields],
  );

  const fieldsValidated = () => {
    validateFieldsInserted(fieldsRequiringValidation);
  };

  const completeDocument = async (
    authOptions?: TRecipientActionAuth,
    nextSigner?: { email: string; name: string },
  ) => {
    const payload = {
      token: recipient.token,
      documentId: document.id,
      authOptions,
      ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
    };

    await completeDocumentWithToken(payload);

    analytics.capture('App: Recipient has completed signing', {
      signerId: recipient.id,
      documentId: document.id,
      timestamp: new Date().toISOString(),
    });

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      await navigate(`/sign/${recipient.token}/complete`);
    }
  };

  const nextRecipient = useMemo(() => {
    if (
      !document.documentMeta?.signingOrder ||
      document.documentMeta.signingOrder !== 'SEQUENTIAL'
    ) {
      return undefined;
    }

    const sortedRecipients = allRecipients.sort((a, b) => {
      // Sort by signingOrder first (nulls last), then by id
      if (a.signingOrder === null && b.signingOrder === null) return a.id - b.id;
      if (a.signingOrder === null) return 1;
      if (b.signingOrder === null) return -1;
      if (a.signingOrder === b.signingOrder) return a.id - b.id;
      return a.signingOrder - b.signingOrder;
    });

    const currentIndex = sortedRecipients.findIndex((r) => r.id === recipient.id);
    return currentIndex !== -1 && currentIndex < sortedRecipients.length - 1
      ? sortedRecipients[currentIndex + 1]
      : undefined;
  }, [document.documentMeta?.signingOrder, allRecipients, recipient.id]);

  return (
    <div className={cn()}>
      <DocumentSigningCompleteDialog
        isSubmitting={isSubmitting}
        documentTitle={document.title}
        fields={fields}
        fieldsValidated={fieldsValidated}
        disabled={!isRecipientsTurn}
        onSignatureComplete={async (nextSigner) => {
          await completeDocument(undefined, nextSigner);
        }}
        role={recipient.role}
        allowDictateNextSigner={nextRecipient && document.documentMeta?.allowDictateNextSigner}
        defaultNextSigner={
          nextRecipient ? { name: nextRecipient.name, email: nextRecipient.email } : undefined
        }
      />
    </div>
  );
};
