import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { CompletedField } from '@documenso/lib/types/fields';
import { getDocumentDataUrlForPdfViewer } from '@documenso/lib/utils/envelope-download';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { FieldType, RecipientRole } from '@prisma/client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import { DocumentSigningAttachmentsPopover } from '~/components/general/document-signing/document-signing-attachments-popover';
import { DocumentSigningAutoSign } from '~/components/general/document-signing/document-signing-auto-sign';
import { DocumentSigningCheckboxField } from '~/components/general/document-signing/document-signing-checkbox-field';
import { DocumentSigningDateField } from '~/components/general/document-signing/document-signing-date-field';
import { DocumentSigningDropdownField } from '~/components/general/document-signing/document-signing-dropdown-field';
import { DocumentSigningEmailField } from '~/components/general/document-signing/document-signing-email-field';
import { DocumentSigningInitialsField } from '~/components/general/document-signing/document-signing-initials-field';
import { DocumentSigningNameField } from '~/components/general/document-signing/document-signing-name-field';
import { DocumentSigningNumberField } from '~/components/general/document-signing/document-signing-number-field';
import { DocumentSigningRadioField } from '~/components/general/document-signing/document-signing-radio-field';
import { DocumentSigningSignatureField } from '~/components/general/document-signing/document-signing-signature-field';
import { DocumentSigningTextField } from '~/components/general/document-signing/document-signing-text-field';
import PDFViewerLazy from '~/components/general/pdf-viewer/pdf-viewer-lazy';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningNextField } from './document-signing-next-field';
import { DocumentSigningRecipientProvider } from './document-signing-recipient-provider';

type DocumentSigningBranding = {
  brandingEnabled: boolean;
  brandingLogo: string;
};

export type DocumentSigningPageViewV1Props = {
  recipient: RecipientWithFields;
  document: DocumentAndSender;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
  /**
   * The dictatable next recipient, computed server-side over the FULL
   * recipient list — must not be re-derived from the role-scoped
   * `allRecipients`.
   */
  nextRecipient?: Pick<Recipient, 'name' | 'email'>;
  branding: DocumentSigningBranding;
  includeSenderDetails: boolean;
};

export const DocumentSigningPageViewV1 = ({
  recipient,
  document,
  fields,
  completedFields,
  isRecipientsTurn,
  allRecipients = [],
  nextRecipient,
  includeSenderDetails,
  // ArcSite: the compact header has no branding logo.
  branding: _branding,
}: DocumentSigningPageViewV1Props) => {
  const { documentData, documentMeta } = document;

  const { t } = useLingui();

  const { derivedRecipientAccessAuth, user: authUser } = useRequiredDocumentSigningAuthContext();

  const hasAuthenticator = authUser?.twoFactorEnabled
    ? authUser.twoFactorEnabled && authUser.email === recipient.email
    : false;

  const [selectedSignerId] = useState<number | null>(allRecipients?.[0]?.id);

  // ArcSite: offset the document by the fixed header's real height instead of a fixed margin.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;

    if (!header) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => setHeaderHeight(header.offsetHeight));
    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation(
    DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  );

  const {
    mutateAsync: completeDocumentWithToken,
    isPending,
    isSuccess,
  } = trpc.recipient.completeDocumentWithToken.useMutation();

  // Keep the loading state going if successful since the redirect may take some time.
  const isSubmitting = isPending || isSuccess;

  // ArcSite: auto-sign this recipient's date fields once when the page opens. Runs only on mount so a
  // date the recipient removes is not signed again.
  useEffect(() => {
    if (!isRecipientsTurn) {
      return;
    }

    const dateFields = fields.filter((field) => field.type === FieldType.DATE && !field.inserted);

    if (dateFields.length === 0) {
      return;
    }

    const autoSignDateFields = async () => {
      try {
        await Promise.all(
          dateFields.map(async (field) =>
            signFieldWithToken({
              token: recipient.token,
              fieldId: field.id,
              value: documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
            }),
          ),
        );

        await revalidate();
      } catch (err) {
        console.error('Error auto-signing date fields:', err);

        toast({
          title: t`Error`,
          description: t`Failed to automatically sign date fields.`,
          variant: 'destructive',
        });
      }
    };

    void autoSignDateFields();
  }, []);

  const completeDocument = async (options: {
    accessAuthOptions?: TRecipientAccessAuth;
    nextSigner?: { email: string; name: string };
  }) => {
    const { accessAuthOptions, nextSigner } = options;

    const payload = {
      token: recipient.token,
      documentId: document.id,
      accessAuthOptions,
      ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
    };

    await completeDocumentWithToken(payload);

    const redirectUrl = recipient.redirectUrl || documentMeta?.redirectUrl;

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = `/sign/${recipient.token}/complete`;
    }
  };

  let senderName = document.user.name ?? '';
  let senderEmail = `(${document.user.email})`;

  if (includeSenderDetails) {
    senderName = document.team?.name ?? '';
    senderEmail = document.team?.teamEmail?.email ? `(${document.team.teamEmail.email})` : '';
  }

  const selectedSigner = allRecipients?.find((r) => r.id === selectedSignerId);
  const targetSigner = recipient.role === RecipientRole.ASSISTANT && selectedSigner ? selectedSigner : null;

  return (
    <DocumentSigningRecipientProvider recipient={recipient} targetSigner={targetSigner}>
      {/* ArcSite: fixed compact header with a "Next field" button instead of the signing sidebar. */}
      <div className="mx-auto w-full max-w-screen-xl pt-0">
        <div ref={headerRef} className="fixed top-0 left-0 z-40 w-full border-gray-200 border-b bg-background shadow">
          <div className="mx-auto flex w-full max-w-screen-xl flex-row items-center justify-between gap-3 px-3 py-3 md:px-6 md:py-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <h1
                className="block w-full truncate font-semibold text-base sm:text-lg md:text-2xl lg:text-3xl"
                title={document.title}
              >
                {document.title}
              </h1>

              <span className="mt-1 block max-w-[50ch] truncate text-muted-foreground text-xs md:text-sm">
                {match(recipient.role)
                  .with(RecipientRole.VIEWER, () =>
                    includeSenderDetails ? (
                      <Trans>
                        <span className="truncate" title={senderName}>
                          {senderName} {senderEmail}
                        </span>{' '}
                        on behalf of "{document.team?.name}" has invited you to view this document
                      </Trans>
                    ) : (
                      <Trans>
                        <span className="truncate" title={senderName}>
                          {senderName} {senderEmail}
                        </span>{' '}
                        has invited you to view this document
                      </Trans>
                    ),
                  )
                  .with(RecipientRole.SIGNER, () => <Trans>You are invited to sign this document</Trans>)
                  .with(RecipientRole.APPROVER, () => <Trans>You are invited to approve this document</Trans>)
                  .with(RecipientRole.ASSISTANT, () =>
                    includeSenderDetails ? (
                      <Trans>
                        <span className="truncate" title={senderName}>
                          {senderName} {senderEmail}
                        </span>{' '}
                        on behalf of "{document.team?.name}" has invited you to assist this document
                      </Trans>
                    ) : (
                      <Trans>
                        <span className="truncate" title={senderName}>
                          {senderName} {senderEmail}
                        </span>{' '}
                        has invited you to assist this document
                      </Trans>
                    ),
                  )
                  .otherwise(() => null)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-x-2">
              <DocumentSigningAttachmentsPopover envelopeId={document.envelopeId} token={recipient.token} />

              <DocumentSigningNextField
                documentTitle={document.title}
                recipient={recipient}
                fields={fields}
                isRecipientsTurn={isRecipientsTurn}
                isSubmitting={isSubmitting}
                allowDictateNextSigner={documentMeta?.allowDictateNextSigner}
                nextRecipient={nextRecipient}
                completeDocument={completeDocument}
              />
            </div>
          </div>
        </div>

        <div
          className="w-full pt-[84px] md:pt-[104px] lg:pt-[108px]"
          style={headerHeight ? { paddingTop: headerHeight + 12 } : undefined}
        >
          <PDFViewerLazy
            key={document.envelopeItems[0]?.id}
            data={getDocumentDataUrlForPdfViewer({
              envelopeId: document.envelopeId,
              envelopeItemId: document.envelopeItems[0]?.id,
              documentDataId: document.envelopeItems[0]?.documentData.id,
              version: 'current',
              token: recipient.token,
              presignToken: undefined,
            })}
            scrollParentRef="window"
          />
        </div>

        <DocumentReadOnlyFields
          documentMeta={documentMeta || undefined}
          fields={completedFields}
          showRecipientTooltip={true}
        />

        {recipient.role !== RecipientRole.ASSISTANT && (
          <DocumentSigningAutoSign recipient={recipient} fields={fields} />
        )}

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields
            .filter((field) => recipient.role !== RecipientRole.ASSISTANT || field.recipientId === selectedSigner?.id)
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
                .with(FieldType.INITIALS, () => <DocumentSigningInitialsField key={field.id} field={field} />)
                .with(FieldType.NAME, () => <DocumentSigningNameField key={field.id} field={field} />)
                .with(FieldType.DATE, () => (
                  <DocumentSigningDateField
                    key={field.id}
                    field={field}
                    dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                    timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  />
                ))
                .with(FieldType.EMAIL, () => <DocumentSigningEmailField key={field.id} field={field} />)
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
