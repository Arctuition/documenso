import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';

export interface UpdateAuthenticatorsOptions {
  userId: string;
  passkeyId: string;
  name: string;
  requestMetadata?: RequestMetadata;
}

export const updatePasskey = async ({
  userId,
  passkeyId,
  name,
  requestMetadata,
}: UpdateAuthenticatorsOptions) => {
  const passkey = await prisma.passkey.findFirstOrThrow({
    where: {
      id: passkeyId,
      userId,
    },
  });

  if (passkey.name === name) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.passkey.update({
      where: {
        id: passkeyId,
        userId,
      },
      data: {
        name,
        updatedAt: new Date(),
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.PASSKEY_UPDATED,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });
};
