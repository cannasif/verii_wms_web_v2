import type { ReactElement } from 'react';
import type { GridColumn } from './AdvancedDataGrid';
import { useUserDisplayNameDirectory } from '@/hooks/useUserDisplayNameDirectory';
import { getUserDisplayName } from '@/lib/user-display-names';
import { formatProjectDateTime } from '@/lib/project-format';
import i18n from '@/lib/i18n';

export interface AuditableGridRow {
  id: number;
  createdBy?: number | null;
  createdByName?: string | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedByName?: string | null;
  updatedDate?: string | null;
}

type SystemColumnKey = 'id' | 'createdBy' | 'createdDate' | 'updatedBy' | 'updatedDate';
interface SystemColumnOptions {
  searchable?: readonly SystemColumnKey[];
  defaultSearch?: readonly SystemColumnKey[];
}

const date = (value?: string | null) => value ? formatProjectDateTime(value) : '-';

function resolveActorName(userId?: number | null, name?: string | null): string | undefined {
  const direct = name?.trim();
  if (direct) return direct;
  return getUserDisplayName(userId);
}

const actor = (value?: number | null, name?: string | null) => resolveActorName(value, name) || (value
  ? i18n.t('dataGrid.userNumber', { number: value })
  : i18n.t('dataGrid.systemActor'));

function SystemActorLabel({
  userId,
  name,
}: {
  userId?: number | null;
  name?: string | null;
}): ReactElement {
  const names = useUserDisplayNameDirectory();
  const resolved = name?.trim() || (userId != null ? names.get(userId) : undefined);
  return <>{actor(userId, resolved)}</>;
}

export function systemColumns<T extends AuditableGridRow>(options: SystemColumnOptions = {}): GridColumn<T>[] {
  const search = (key: SystemColumnKey) => ({
    searchable: options.searchable?.includes(key) ?? key === 'id',
    defaultSearch: options.defaultSearch?.includes(key) ?? false,
  });
  return [
    { key: 'id', label: 'Kayıt ID', hideable: false, ...search('id'), contextValue: (row) => row.id, render: (row) => <span className="font-mono text-xs font-semibold">#{row.id}</span> },
    {
      key: 'createdBy',
      label: 'Kayıt Eden',
      filterable: false,
      ...search('createdBy'),
      contextValue: (row) => actor(row.createdBy, row.createdByName),
      render: (row) => <SystemActorLabel userId={row.createdBy} name={row.createdByName} />,
    },
    { key: 'createdDate', label: 'Kayıt Zamanı', filterable: false, filterType: 'datetime', contextValue: (row) => date(row.createdDate), render: (row) => date(row.createdDate) },
    {
      key: 'updatedBy',
      label: 'Güncelleyen',
      filterable: false,
      ...search('updatedBy'),
      contextValue: (row) => (row.updatedDate ? actor(row.updatedBy, row.updatedByName) : '-'),
      render: (row) => (
        row.updatedDate
          ? <SystemActorLabel userId={row.updatedBy} name={row.updatedByName} />
          : '-'
      ),
    },
    { key: 'updatedDate', label: 'Güncelleme Zamanı', filterable: false, filterType: 'datetime', contextValue: (row) => date(row.updatedDate), render: (row) => date(row.updatedDate) },
  ];
}

export const requiredActionColumn = { sortable: false, filterable: false, hideable: false } as const;
