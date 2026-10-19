import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  status: 'active' | 'disabled';
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminUserPage {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
}

const ROLE_OPTIONS = [
  ['', 'All roles'],
  ['patient', 'Patient'],
  ['doctor', 'Doctor'],
  ['clinic_staff', 'Clinic staff'],
  ['support_agent', 'Support'],
  ['operations_staff', 'Operations'],
  ['finance_staff', 'Finance'],
  ['platform_admin', 'Platform admin'],
] as const;

const PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export function AdminUsersPage() {
  usePageTitle('Users');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const users = useQuery({
    queryKey: ['admin', 'users', { search: debouncedSearch, role, page }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (role) params.set('role', role);
      return apiRequest<AdminUserPage>(`/admin/users?${params}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

  const totalPages = users.data ? Math.max(1, Math.ceil(users.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Every view of this list is recorded in the audit log."
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search by email</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by email (starts with)…"
            maxLength={100}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-10 text-[0.95rem] hover:border-rose focus-visible:border-coral-ink"
          />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">Filter by role</span>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[0.95rem] hover:border-rose focus-visible:border-coral-ink"
          >
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card className="mt-6 overflow-hidden">
        {users.isError && (
          <div className="p-6">
            <Alert tone="error">We could not load users. Please try again.</Alert>
          </div>
        )}
        {users.isPending && (
          <div className="flex flex-col gap-3 p-6" role="status">
            <span className="sr-only">Loading users…</span>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        )}
        {users.data && users.data.items.length === 0 && (
          <div className="p-10 text-center">
            <p className="font-semibold">No users match these filters</p>
            <p className="mt-1 text-sm text-ink-muted">
              Try a shorter email prefix or a different role.
            </p>
          </div>
        )}
        {users.data && users.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">
                Users, page {users.data.page} of {totalPages}
              </caption>
              <thead className="border-b border-line bg-sand/70 text-xs tracking-wide text-ink-muted uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Roles
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Joined
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Last sign-in
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-canvas">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold">{user.fullName}</p>
                      <p className="text-ink-muted">{user.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r}>{r.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={user.status === 'active' ? 'success' : 'warning'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {dateFormat.format(new Date(user.createdAt))}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {user.lastLoginAt ? dateFormat.format(new Date(user.lastLoginAt)) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {users.data && users.data.total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            Page {users.data.page} of {totalPages} · {users.data.total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
