import { useIsMobile } from '@documenso/lib/client-only/hooks/use-is-mobile';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { useMemo, useState } from 'react';

import { DocumentSigningCompleteDialog } from './document-signing-complete-dialog';

export type DocumentSigningNextFieldProps = {
  documentTitle: string;
  recipient: Pick<Recipient, 'name' | 'email' | 'role' | 'token'>;
  fields: Field[];
  isRecipientsTurn: boolean;
  isSubmitting: boolean;
  allowDictateNextSigner?: boolean;
  nextRecipient?: Pick<Recipient, 'name' | 'email'>;
  completeDocument: (options: {
    accessAuthOptions?: TRecipientAccessAuth;
    nextSigner?: { email: string; name: string };
  }) => Promise<void>;
};

/**
 * ArcSite: compact "Next field (n)" / "Finish" button for the fixed signing header,
 * replacing the signing sidebar.
 */
export const DocumentSigningNextField = ({
  documentTitle,
  recipient,
  fields,
  isRecipientsTurn,
  isSubmitting,
  allowDictateNextSigner,
  nextRecipient,
  completeDocument,
}: DocumentSigningNextFieldProps) => {
  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

  const isMobile = useIsMobile();

  const fieldsRequiringValidation = useMemo(() => fields.filter(isFieldUnsignedAndRequired), [fields]);

  const uninsertedFields = useMemo(
    () => sortFieldsByPosition(fieldsRequiringValidation.filter((field) => !field.inserted)),
    [fieldsRequiringValidation],
  );

  const fieldsValidated = () => {
    setValidateUninsertedFields(true);
    validateFieldsInserted(fieldsRequiringValidation);
  };

  return (
    <div>
      {validateUninsertedFields && uninsertedFields[0] && (
        <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
          {isMobile ? <Trans>Tap to insert field</Trans> : <Trans>Click to insert field</Trans>}
        </FieldToolTip>
      )}

      <DocumentSigningCompleteDialog
        isSubmitting={isSubmitting}
        documentTitle={documentTitle}
        fields={fields}
        fieldsValidated={fieldsValidated}
        disabled={!isRecipientsTurn}
        onSignatureComplete={async (nextSigner, accessAuthOptions) =>
          completeDocument({ nextSigner, accessAuthOptions })
        }
        recipient={recipient}
        allowDictateNextSigner={nextRecipient && allowDictateNextSigner}
        defaultNextSigner={nextRecipient ? { name: nextRecipient.name, email: nextRecipient.email } : undefined}
        buttonSize="default"
        buttonClassName="text-xs md:text-base"
        position="center"
      />
    </div>
  );
};
