import type { GridColumn } from './AdvancedDataGrid';
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
const actor = (value?: number | null, name?: string | null) => name?.trim() || (value
  ? i18n.t('dataGrid.userNumber', { number: value })
  : i18n.t('dataGrid.systemActor'));

export function systemColumns<T extends AuditableGridRow>(options: SystemColumnOptions = {}): GridColumn<T>[] {
  const search = (key: SystemColumnKey) => ({
    searchable: options.searchable?.includes(key) ?? false,
    defaultSearch: options.defaultSearch?.includes(key) ?? false,
  });
  return [
    { key: 'id', label: 'Kayıt ID', hideable: false, ...search('id'), render: (row) => <span className="font-mono text-xs font-semibold">#{row.id}</span> },
    { key: 'createdBy', label: 'Kayıt Eden', sortable: false, filterable: false, ...search('createdBy'), render: (row) => actor(row.createdBy, row.createdByName) },
    { key: 'createdDate', label: 'Kayıt Zamanı', sortable: false, filterable: false, render: (row) => date(row.createdDate) },
    { key: 'updatedBy', label: 'Güncelleyen', sortable: false, filterable: false, ...search('updatedBy'), render: (row) => row.updatedDate ? actor(row.updatedBy, row.updatedByName) : '-' },
    { key: 'updatedDate', label: 'Güncelleme Zamanı', sortable: false, filterable: false, render: (row) => date(row.updatedDate) },
  ];
}

export const requiredActionColumn = { sortable: false, filterable: false, hideable: false } as const;
