'use server';

import { prisma } from '@documenso/prisma';

export type GetSubscriptionsByUserIdOptions = {
  userId: string;
};

export const getSubscriptionsByUserId = async ({ userId }: GetSubscriptionsByUserIdOptions) => {
  return await prisma.subscription.findMany({
    where: {
      userId,
    },
  });
};
