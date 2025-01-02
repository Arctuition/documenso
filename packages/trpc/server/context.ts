import type { User } from '@prisma/client';
import { z } from 'zod';

import { getServerSession } from '@documenso/lib/next-auth/get-server-session';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import type { CreateNextContextOptions, NextApiRequest } from './adapters/next';

type CreateTrpcContext = CreateNextContextOptions & {
  requestSource: 'apiV1' | 'apiV2' | 'app';
};

/**
 * Todo: Delete
 */
export const createTrpcContext = async ({
  req,
  res,
  requestSource,
}: Omit<CreateTrpcContext, 'info'>): Promise<TrpcContext> => {
  const { session, user } = await getServerSession({ req, res });

  const metadata: ApiRequestMetadata = {
    requestMetadata: extractNextApiRequestMetadata(req),
    source: requestSource,
    auth: null,
  };

  const teamId = z.coerce
    .number()
    .optional()
    .catch(() => undefined)
    .parse(req.headers['x-team-id']);

  if (!session) {
    return {
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  if (!user) {
    return {
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  return {
    session,
    user,
    teamId,
    req,
    metadata,
  };
};

export type TrpcContext = (
  | {
      session: null;
      user: null;
    }
  | {
      session: unknown;
      user: User;
    }
) & {
  teamId: number | undefined;
  req: Request | NextApiRequest;
  metadata: ApiRequestMetadata;
};
