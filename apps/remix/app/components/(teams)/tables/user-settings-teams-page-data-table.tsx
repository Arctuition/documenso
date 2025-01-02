import { useEffect, useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Link, useSearchParams } from 'react-router';
import { useNavigate } from 'react-router';
import { useLocation } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { trpc } from '@documenso/trpc/react';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { CurrentUserTeamsDataTable } from './current-user-teams-data-table';
import { PendingUserTeamsDataTable } from './pending-user-teams-data-table';

export const UserSettingsTeamsPageDataTable = () => {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const currentTab = searchParams?.get('tab') === 'pending' ? 'pending' : 'active';

  const { data } = trpc.team.findTeamsPending.useQuery(
    {},
    {
      placeholderData: (previousData) => previousData,
    },
  );

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    void navigate(`${pathname}?${params.toString()}`);
  }, [debouncedSearchQuery, pathname, navigate, searchParams]);

  return (
    <div>
      <div className="my-4 flex flex-row items-center justify-between space-x-4">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={_(msg`Search`)}
        />

        <Tabs value={currentTab} className="flex-shrink-0 overflow-x-auto">
          <TabsList>
            <TabsTrigger className="min-w-[60px]" value="active" asChild>
              <Link to={pathname ?? '/'}>
                <Trans>Active</Trans>
              </Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value="pending" asChild>
              <Link to={`${pathname}?tab=pending`}>
                <Trans>Pending</Trans>
                {data && data.count > 0 && (
                  <span className="ml-1 hidden opacity-50 md:inline-block">{data.count}</span>
                )}
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {currentTab === 'pending' ? <PendingUserTeamsDataTable /> : <CurrentUserTeamsDataTable />}
    </div>
  );
};
