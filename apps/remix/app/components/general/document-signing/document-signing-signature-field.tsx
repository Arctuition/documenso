import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useIsMobile } from '@documenso/lib/client-only/hooks/use-is-mobile';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldFitText } from '@documenso/ui/components/field/field-fit-text';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRevalidator } from 'react-router';

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { useRequiredDocumentSigningContext } from './document-signing-provider';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

type SignatureFieldState = 'empty' | 'signed-image' | 'signed-text';

export type DocumentSigningSignatureFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const DocumentSigningSignatureField = ({
  field,
  onSignField,
  onUnsignField,
  typedSignatureEnabled,
  // ArcSite: uploaded signatures are always disabled.
  uploadSignatureEnabled: _uploadSignatureEnabled,
  drawSignatureEnabled,
}: DocumentSigningSignatureFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();
  const analytics = useAnalytics();

  const { recipient } = useDocumentSigningRecipientContext();

  const optionsRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();

  const {
    fullName,
    signature: providedSignature,
    setSignature: setProvidedSignature,
  } = useRequiredDocumentSigningContext();

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { signature } = field;

  // ArcSite: keep the loader up until the revalidated field carries the new signature.
  const [isSigning, setIsSigning] = useState(false);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isSigning;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSignatureBottomSheet, setShowSignatureBottomSheet] = useState(false);
  const [showSignatureOptionsPopover, setShowSignatureOptionsPopover] = useState(false);
  const [showSignatureOptionsSheet, setShowSignatureOptionsSheet] = useState(false);
  const [localSignature, setLocalSignature] = useState<string | null>(null);

  // Dismiss the desktop options popover when clicking outside of it.
  useEffect(() => {
    if (!showSignatureOptionsPopover) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowSignatureOptionsPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSignatureOptionsPopover]);

  // Reset once the field's signature changes.
  useEffect(() => {
    setIsSigning(false);
  }, [signature?.id]);

  const openSignatureInput = () => {
    if (isMobile) {
      setShowSignatureBottomSheet(true);
    } else {
      setShowSignatureModal(true);
    }
  };

  const state = useMemo<SignatureFieldState>(() => {
    if (!field.inserted) {
      return 'empty';
    }

    if (signature?.signatureImageAsBase64) {
      return 'signed-image';
    }

    return 'signed-text';
  }, [field.inserted, signature?.signatureImageAsBase64]);

  const onPreSign = () => {
    // Reuse a signature already provided for another field.
    if (!providedSignature) {
      openSignatureInput();
      return false;
    }

    return true;
  };
  /**
   * When the user clicks the sign button in the dialog where they enter their signature.
   */
  const onDialogSignClick = () => {
    setShowSignatureModal(false);
    setShowSignatureBottomSheet(false);

    if (!localSignature) {
      return;
    }

    setProvidedSignature(localSignature);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, localSignature),
      actionTarget: field.type,
    });
  };

  const onSign = async (authOptions?: TRecipientActionAuth, signature?: string) => {
    try {
      const value = signature || providedSignature;

      if (!value) {
        openSignatureInput();
        return;
      }

      // ArcSite: "Change" re-signs an inserted field, so clear the old signature first.
      if (field.inserted) {
        const removePayload: TRemovedSignedFieldWithTokenMutationSchema = {
          token: recipient.token,
          fieldId: field.id,
        };

        if (onUnsignField) {
          await onUnsignField(removePayload);
        } else {
          await removeSignedFieldWithToken(removePayload);
        }
      }

      const isTypedSignature = !value.startsWith('data:image');

      if (isTypedSignature && typedSignatureEnabled === false) {
        toast({
          title: _(msg`Error`),
          description: _(msg`Typed signatures are not allowed. Please draw your signature.`),
          variant: 'destructive',
        });

        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: !isTypedSignature,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        setIsSigning(true);
        await signFieldWithToken(payload);
      }

      await revalidate();
    } catch (err) {
      setIsSigning(false);

      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      analytics.captureException(err, {
        source: 'signing',
        location: 'sign_field',
        fieldType: field.type,
        recipientId: field.recipientId,
      });

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  // ArcSite: clicking a signed field shows Change / Clear options instead of removing it.
  const onSignedFieldClick = () => {
    if (isMobile) {
      setShowSignatureOptionsSheet(true);
    } else {
      setShowSignatureOptionsPopover(true);
    }
  };

  const onChangeSignature = () => {
    setShowSignatureOptionsPopover(false);
    setShowSignatureOptionsSheet(false);
    setLocalSignature(null);

    openSignatureInput();
  };

  const onRemove = async () => {
    setShowSignatureOptionsPopover(false);
    setShowSignatureOptionsSheet(false);

    // Keep the provided signature so it can be reapplied when signing again.
    setLocalSignature(null);

    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      } else {
        await removeSignedFieldWithToken(payload);
      }

      await revalidate();
    } catch (err) {
      console.error(err);

      analytics.captureException(err, {
        source: 'signing',
        location: 'remove_field',
        fieldType: field.type,
        recipientId: field.recipientId,
      });

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the signature.`),
        variant: 'destructive',
      });
    }
  };

  // Position the desktop options popover above the field.
  useLayoutEffect(() => {
    if (isMobile || !showSignatureOptionsPopover || !optionsRef.current || !fieldRef.current) {
      return;
    }

    const fieldElement = fieldRef.current.closest('.field-card-container') ?? fieldRef.current;
    const fieldRect = fieldElement.getBoundingClientRect();

    optionsRef.current.style.left = `${fieldRect.left + fieldRect.width / 2}px`;
    // ArcSite: 10px above the field card (v1.10 used -60 from a ref placed lower inside the field).
    optionsRef.current.style.top = `${fieldRect.top - 10}px`;
    optionsRef.current.style.transform = 'translate(-50%, -100%)';
  }, [isMobile, showSignatureOptionsPopover]);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onSignedFieldClick}
      type="Signature"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background">
          <Loader className="h-5 w-5 animate-spin text-primary md:h-8 md:w-8" />
        </div>
      )}

      {state === 'empty' && (
        <FieldFitText
          maxFontSize={2}
          minFontSize={0.8}
          step={0.1}
          containerClassName="p-2"
          className="w-full overflow-hidden text-center font-signature text-muted-foreground leading-tight duration-200 group-hover:text-primary group-hover:text-recipient-green"
        >
          <Trans>Signature</Trans>
        </FieldFitText>
      )}

      {state === 'signed-image' && signature?.signatureImageAsBase64 && (
        <img
          src={signature.signatureImageAsBase64}
          alt={`Signature for ${recipient.name}`}
          className="h-full w-full object-contain"
        />
      )}

      {/* ArcSite: keep typed signatures on one line, shrunk to fit small fields instead of overflowing. */}
      {state === 'signed-text' && (
        <FieldFitText
          maxFontSize={2}
          minFontSize={0.3}
          refitKey={signature?.typedSignature}
          containerClassName="px-1"
          className="whitespace-nowrap text-center font-signature text-muted-foreground leading-tight duration-200"
        >
          {signature?.typedSignature}
        </FieldFitText>
      )}

      {/* Desktop: Change / Clear options above the signed field. */}
      <div ref={fieldRef} className="relative">
        {!isMobile &&
          showSignatureOptionsPopover &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={optionsRef}
              className="fixed z-[9999] min-w-[120px] rounded-md border border-blue-200 border-dashed bg-white p-0 shadow-md"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  className="px-6 py-3 text-center transition-colors hover:bg-gray-50"
                  onClick={onChangeSignature}
                >
                  <span className="text-foreground">
                    <Trans>Change</Trans>
                  </span>
                </button>

                <div className="border-gray-200 border-t" />

                <button
                  type="button"
                  className="px-6 py-3 text-center transition-colors hover:bg-gray-50"
                  onClick={async () => await onRemove()}
                >
                  <span className="text-destructive">
                    <Trans>Clear</Trans>
                  </span>
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>

      {/* Mobile: Change / Clear options sheet. */}
      <Sheet open={isMobile && showSignatureOptionsSheet} onOpenChange={setShowSignatureOptionsSheet}>
        <SheetContent
          position="bottom"
          size="sm"
          className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] [&>button]:hidden"
        >
          <div className="flex flex-col">
            <button
              type="button"
              className="py-4 text-center text-base transition-colors hover:bg-gray-50"
              onClick={onChangeSignature}
            >
              <span className="text-foreground">
                <Trans>Change</Trans>
              </span>
            </button>

            <div className="border-gray-200 border-t" />

            <button
              type="button"
              className="py-4 text-center text-base transition-colors hover:bg-gray-50"
              onClick={async () => await onRemove()}
            >
              <span className="text-destructive">
                <Trans>Clear</Trans>
              </span>
            </button>

            <div className="border-gray-200 border-t" />

            <button
              type="button"
              className="py-4 text-center text-base transition-colors hover:bg-gray-50"
              onClick={() => setShowSignatureOptionsSheet(false)}
            >
              <span className="text-foreground">
                <Trans>Cancel</Trans>
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent>
          <DialogTitle>
            <Trans>
              Sign as {recipient.name} <div className="h-5 text-muted-foreground">({recipient.email})</div>
            </Trans>
          </DialogTitle>

          <SignaturePad
            className="mt-2"
            fullName={fullName}
            value={localSignature ?? ''}
            onChange={({ value }) => setLocalSignature(value)}
            typedSignatureEnabled={typedSignatureEnabled}
            uploadSignatureEnabled={false}
            drawSignatureEnabled={drawSignatureEnabled}
          />

          <DocumentSigningDisclosure />

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="flex-1"
                variant="secondary"
                onClick={() => {
                  setShowSignatureModal(false);
                  setLocalSignature(null);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button type="button" className="flex-1" disabled={!localSignature} onClick={() => onDialogSignClick()}>
                <Trans>Sign</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile: signature input sheet. */}
      <Sheet open={showSignatureBottomSheet} onOpenChange={setShowSignatureBottomSheet}>
        {/* The middle scrolls; the actions stay pinned above the home indicator. */}
        <SheetContent
          position="bottom"
          size="xl"
          className="flex flex-col gap-0 rounded-t-2xl px-0 pt-2 pb-0 [&>button]:hidden"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/20" />

          <div className="shrink-0 px-4 pb-2">
            <h2 className="truncate font-semibold text-lg">
              <Trans>Sign as {recipient.name}</Trans>
            </h2>
            <p className="truncate text-muted-foreground text-sm">{recipient.email}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <SignaturePad
              fullName={fullName}
              value={localSignature ?? ''}
              onChange={({ value }) => setLocalSignature(value)}
              typedSignatureEnabled={typedSignatureEnabled}
              uploadSignatureEnabled={false}
              drawSignatureEnabled={drawSignatureEnabled}
              contentClassName="aspect-[3/2]"
            />

            <DocumentSigningDisclosure className="mt-4" />
          </div>

          <div className="flex shrink-0 gap-2 border-gray-200 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="h-11 w-full text-base"
              disabled={!localSignature}
              onClick={() => onDialogSignClick()}
            >
              <Trans>Sign</Trans>
            </Button>
            <Button
              type="button"
              className="h-11 w-full text-base"
              variant="secondary"
              onClick={() => {
                setShowSignatureBottomSheet(false);
                setLocalSignature(null);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </DocumentSigningFieldContainer>
  );
};
