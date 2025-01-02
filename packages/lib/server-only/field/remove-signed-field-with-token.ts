'use server';

import { DocumentStatus, SigningStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type RemovedSignedFieldWithTokenOptions = {
  token: string;
  fieldId: number;
  requestMetadata?: RequestMetadata;
};

export const removeSignedFieldWithToken = async ({
  token,
  fieldId,
  requestMetadata,
}: RemovedSignedFieldWithTokenOptions) => {
  const field = await prisma.field.findFirstOrThrow({
    where: {
      id: fieldId,
      recipient: {
        token,
      },
    },
    include: {
      document: true,
      recipient: true,
    },
  });

  const { document, recipient } = field;

  if (!document) {
    throw new Error(`Document not found for field ${field.id}`);
  }

  if (document.status !== DocumentStatus.PENDING) {
    throw new Error(`Document ${document.id} must be pending`);
  }

  if (recipient?.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  // Unreachable code based on the above query but we need to satisfy TypeScript
  if (field.recipientId === null) {
    throw new Error(`Field ${fieldId} has no recipientId`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.field.update({
      where: {
        id: field.id,
      },
      data: {
        customText: '',
        inserted: false,
      },
    });

    await tx.signature.deleteMany({
      where: {
        fieldId: field.id,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
        documentId: document.id,
        user: {
          name: recipient?.name,
          email: recipient?.email,
        },
        requestMetadata,
        data: {
          field: field.type,
          fieldId: field.secondaryId,
        },
      }),
    });
  });
};
