import { prisma } from '@documenso/prisma';

export type DeleteTeamPendingOptions = {
  userId: string;
  pendingTeamId: number;
};

export const deleteTeamPending = async ({ userId, pendingTeamId }: DeleteTeamPendingOptions) => {
  await prisma.teamPending.delete({
    where: {
      id: pendingTeamId,
      ownerUserId: userId,
    },
  });
};
