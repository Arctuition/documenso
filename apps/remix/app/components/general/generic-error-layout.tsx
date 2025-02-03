import type { MessageDescriptor } from '@lingui/core';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { useOptionalCurrentTeam } from '~/providers/team';

export type GenericErrorLayoutProps = {
  children?: React.ReactNode;
  errorCode?: number;
};

export const ErrorLayoutCodes: Record<
  number,
  { subHeading: MessageDescriptor; heading: MessageDescriptor; message: MessageDescriptor }
> = {
  404: {
    subHeading: msg`404 Page not found`,
    heading: msg`Oops! Something went wrong.`,
    message: msg`The page you are looking for was moved, removed, renamed or might never have existed.`,
  },
  500: {
    subHeading: msg`500 Internal Server Error`,
    heading: msg`Oops! Something went wrong.`,
    message: msg`An unexpected error occurred.`,
  },
};

export const GenericErrorLayout = ({ children, errorCode }: GenericErrorLayoutProps) => {
  const navigate = useNavigate();
  const { _ } = useLingui();

  const team = useOptionalCurrentTeam();

  const { subHeading, heading, message } =
    ErrorLayoutCodes[errorCode || 404] ?? ErrorLayoutCodes[404];

  return (
    <div className={cn('relative max-w-[100vw] overflow-hidden')}>
      <div className="absolute -inset-24 -z-10">
        <motion.div
          className="flex h-full w-full items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8, transition: { duration: 0.5, delay: 0.5 } }}
        >
          <img
            src={backgroundPattern}
            alt="background pattern"
            className="-ml-[50vw] -mt-[15vh] h-full scale-100 object-cover md:scale-100 lg:scale-[100%] dark:contrast-[70%] dark:invert dark:sepia"
            style={{
              mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            }}
          />
        </motion.div>
      </div>

      <div className="container mx-auto flex h-full min-h-screen items-center justify-center px-6 py-32">
        <div>
          <p className="text-muted-foreground font-semibold">{_(subHeading)}</p>

          <h1 className="mt-3 text-2xl font-bold md:text-3xl">{_(heading)}</h1>

          <p className="text-muted-foreground mt-4 text-sm">{_(message)}</p>

          <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
            <Button
              variant="ghost"
              className="w-32"
              onClick={() => {
                void navigate(-1);
              }}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              <Trans>Go Back</Trans>
            </Button>

            <Button asChild>
              <Link to={formatDocumentsPath(team?.url)}>
                <Trans>Documents</Trans>
              </Link>
            </Button>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
