import { useLayoutEffect, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useRevalidator } from 'react-router';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningDateFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string | null;
  timezone?: string | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningDateField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
  onSignField,
  onUnsignField,
}: DocumentSigningDateFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const localDateString = convertToLocalSystemFormat(field.customText, dateFormat, timezone);
  const isDifferentTime = field.inserted && localDateString !== field.customText;
  const tooltipText = _(
    msg`"${field.customText}" will appear on the document as it has a timezone of "${timezone || ''}".`,
  );

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const dateTextRef = useRef<HTMLParagraphElement>(null);
  const placeholderRef = useRef<HTMLParagraphElement>(null);
  const placeholderContainerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(1);
  const [placeholderFontSize, setPlaceholderFontSize] = useState(1);

  useLayoutEffect(() => {
    if (!dateTextRef.current || !containerRef.current || !field.inserted) {
      return;
    }

    const adjustTextSize = () => {
      const container = containerRef.current;
      const text = dateTextRef.current;

      if (!container || !text) {
        return;
      }

      let size = 1;
      text.style.fontSize = `${size}rem`;

      while (
        (text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight) &&
        size > 0.2
      ) {
        size -= 0.05;
        text.style.fontSize = `${size}rem`;
      }

      setFontSize(size);
    };

    const resizeObserver = new ResizeObserver(adjustTextSize);
    resizeObserver.observe(containerRef.current);

    adjustTextSize();

    return () => resizeObserver.disconnect();
  }, [field.inserted, localDateString]);

  // Adjust placeholder text size to fit container
  useLayoutEffect(() => {
    if (!placeholderRef.current || !placeholderContainerRef.current || field.inserted) {
      return;
    }

    const adjustPlaceholderSize = () => {
      const container = placeholderContainerRef.current;
      const text = placeholderRef.current;

      if (!container || !text) {
        return;
      }

      let size = 1;
      text.style.fontSize = `${size}rem`;

      while (
        (text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight) &&
        size > 0.2
      ) {
        size -= 0.05;
        text.style.fontSize = `${size}rem`;
      }

      setPlaceholderFontSize(size);
    };

    const resizeObserver = new ResizeObserver(adjustPlaceholderSize);
    resizeObserver.observe(placeholderContainerRef.current);

    adjustPlaceholderSize();

    return () => resizeObserver.disconnect();
  }, [field.inserted]);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Date"
      tooltipText={isDifferentTime ? tooltipText : undefined}
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <div
          ref={placeholderContainerRef}
          className="flex h-full w-full items-center justify-center p-2"
        >
          <p
            ref={placeholderRef}
            className="group-hover:text-primary text-muted-foreground w-full overflow-hidden text-center leading-tight duration-200 group-hover:text-yellow-300"
            style={{ fontSize: `${placeholderFontSize}rem` }}
          >
            <Trans>Date</Trans>
          </p>
        </div>
      )}

      {field.inserted && (
        <div ref={containerRef} className="flex h-full w-full items-center">
          <p
            ref={dateTextRef}
            style={{ fontSize: `${fontSize}rem` }}
            className={cn('text-muted-foreground dark:text-background/80 w-full duration-200', {
              'text-left': parsedFieldMeta?.textAlign === 'left',
              'text-center': !parsedFieldMeta?.textAlign || parsedFieldMeta?.textAlign === 'center',
              'text-right': parsedFieldMeta?.textAlign === 'right',
            })}
          >
            {localDateString}
          </p>
        </div>
      )}
    </DocumentSigningFieldContainer>
  );
};
