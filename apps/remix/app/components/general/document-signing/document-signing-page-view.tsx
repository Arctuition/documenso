import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { FieldType, RecipientRole } from '@prisma/client';
import { useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { CompletedField } from '@documenso/lib/types/fields';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentSigningAutoSign } from '~/components/general/document-signing/document-signing-auto-sign';
import { DocumentSigningCheckboxField } from '~/components/general/document-signing/document-signing-checkbox-field';
import { DocumentSigningDateField } from '~/components/general/document-signing/document-signing-date-field';
import { DocumentSigningDropdownField } from '~/components/general/document-signing/document-signing-dropdown-field';
import { DocumentSigningEmailField } from '~/components/general/document-signing/document-signing-email-field';
import { DocumentSigningForm } from '~/components/general/document-signing/document-signing-form';
import { DocumentSigningInitialsField } from '~/components/general/document-signing/document-signing-initials-field';
import { DocumentSigningNameField } from '~/components/general/document-signing/document-signing-name-field';
import { DocumentSigningNumberField } from '~/components/general/document-signing/document-signing-number-field';
import { DocumentSigningRadioField } from '~/components/general/document-signing/document-signing-radio-field';
import { DocumentSigningSignatureField } from '~/components/general/document-signing/document-signing-signature-field';
import { DocumentSigningTextField } from '~/components/general/document-signing/document-signing-text-field';
import { DocumentReadOnlyFields } from '~/components/general/document/document-read-only-fields';

import { DocumentSigningRecipientProvider } from './document-signing-recipient-provider';

export type DocumentSigningPageViewProps = {
  recipient: RecipientWithFields;
  document: DocumentAndSender;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
};

export const DocumentSigningPageView = ({
  recipient,
  document,
  fields,
  completedFields,
  isRecipientsTurn,
  allRecipients = [],
}: DocumentSigningPageViewProps) => {
  const { documentData, documentMeta } = document;

  const [selectedSignerId, setSelectedSignerId] = useState<number | null>(allRecipients?.[0]?.id);
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation(
    DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  );

  const shouldUseTeamDetails =
    document.teamId && document.team?.teamGlobalSettings?.includeSenderDetails === false;

  let senderName = document.user.name ?? '';
  let senderEmail = `(${document.user.email})`;

  if (shouldUseTeamDetails) {
    senderName = document.team?.name ?? '';
    senderEmail = document.team?.teamEmail?.email ? `(${document.team.teamEmail.email})` : '';
  }

  const selectedSigner = allRecipients?.find((r) => r.id === selectedSignerId);

  // Auto-sign date fields when the component mounts
  useEffect(() => {
    const autoSignDateFields = async () => {
      // Only proceed if it's the recipient's turn
      if (!isRecipientsTurn) return;

      // Find all date fields that haven't been inserted yet
      const dateFields = fields.filter((field) => field.type === FieldType.DATE && !field.inserted);

      // If there are no date fields to sign, return
      if (dateFields.length === 0) return;

      try {
        // Sign each date field
        await Promise.all(
          dateFields.map(async (field) => {
            await signFieldWithToken({
              token: recipient.token,
              fieldId: field.id,
              value: documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
            });
          }),
        );

        // Revalidate to refresh the UI
        await revalidate();
      } catch (error) {
        console.error('Error auto-signing date fields:', error);

        toast({
          title: 'Error',
          description: 'Failed to automatically sign date fields.',
          variant: 'destructive',
        });
      }
    };

    autoSignDateFields().catch(console.error);
  }, [
    fields,
    recipient.token,
    signFieldWithToken,
    revalidate,
    toast,
    isRecipientsTurn,
    documentMeta?.dateFormat,
  ]);

  return (
    <DocumentSigningRecipientProvider recipient={recipient} targetSigner={selectedSigner ?? null}>
      <div className="mx-auto w-full max-w-screen-xl">
        <h1
          className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
          title={document.title}
        >
          {document.title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6">
          <div className="max-w-[50ch]">
            <span className="text-muted-foreground">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () =>
                  document.teamId && !shouldUseTeamDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to view this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to view this document</Trans>
                  ),
                )
                .with(RecipientRole.SIGNER, () => 'You are invited to sign this document')
                .with(RecipientRole.APPROVER, () => 'You are invited to sign this document')
                .with(RecipientRole.ASSISTANT, () =>
                  document.teamId && !shouldUseTeamDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to assist this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to assist this document</Trans>
                  ),
                )
                .otherwise(() => null)}
            </span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
          <Card
            className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
            gradient
          >
            <CardContent className="p-2">
              <PDFViewer key={documentData.id} documentData={documentData} document={document} />
            </CardContent>
          </Card>

          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <DocumentSigningForm
              document={document}
              recipient={recipient}
              fields={fields}
              redirectUrl={recipient.redirectUrl ?? documentMeta?.redirectUrl}
              isRecipientsTurn={isRecipientsTurn}
              allRecipients={allRecipients}
              setSelectedSignerId={setSelectedSignerId}
            />
          </div>
        </div>

        <DocumentReadOnlyFields fields={completedFields} />

        {recipient.role !== RecipientRole.ASSISTANT && (
          <DocumentSigningAutoSign recipient={recipient} fields={fields} />
        )}

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields
            .filter(
              (field) =>
                recipient.role !== RecipientRole.ASSISTANT ||
                field.recipientId === selectedSigner?.id,
            )
            .map((field) =>
              match(field.type)
                .with(FieldType.SIGNATURE, () => (
                  <DocumentSigningSignatureField
                    key={field.id}
                    field={field}
                    typedSignatureEnabled={documentMeta?.typedSignatureEnabled}
                    uploadSignatureEnabled={documentMeta?.uploadSignatureEnabled}
                    drawSignatureEnabled={documentMeta?.drawSignatureEnabled}
                  />
                ))
                .with(FieldType.INITIALS, () => (
                  <DocumentSigningInitialsField key={field.id} field={field} />
                ))
                .with(FieldType.NAME, () => (
                  <DocumentSigningNameField key={field.id} field={field} />
                ))
                .with(FieldType.DATE, () => (
                  <DocumentSigningDateField
                    key={field.id}
                    field={field}
                    dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                    timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  />
                ))
                .with(FieldType.EMAIL, () => (
                  <DocumentSigningEmailField key={field.id} field={field} />
                ))
                .with(FieldType.TEXT, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningTextField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.NUMBER, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningNumberField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.RADIO, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZRadioFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningRadioField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.CHECKBOX, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZCheckboxFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningCheckboxField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.DROPDOWN, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZDropdownFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningDropdownField key={field.id} field={fieldWithMeta} />;
                })
                .otherwise(() => null),
            )}
        </ElementVisible>
      </div>
    </DocumentSigningRecipientProvider>
  );
};
