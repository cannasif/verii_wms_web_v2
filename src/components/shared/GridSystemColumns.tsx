import type { GridColumn } from './AdvancedDataGrid';
import { formatProjectDateTime } from '@/lib/project-format';

export interface AuditableGridRow {
  id: number;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
}

const date = (value?: string | null) => value ? formatProjectDateTime(value) : '-';
const actor = (value?: number | null) => value ? `Kullanıcı #${value}` : 'Sistem';

export function systemColumns<T extends AuditableGridRow>(): GridColumn<T>[] {
  return [
    { key: 'id', label: 'Kayıt ID', hideable: false, render: (row) => <span className="font-mono text-xs font-semibold">#{row.id}</span> },
    { key: 'createdBy', label: 'Kayıt Eden', sortable: false, filterable: false, render: (row) => actor(row.createdBy) },
    { key: 'createdDate', label: 'Kayıt Zamanı', sortable: false, filterable: false, render: (row) => date(row.createdDate) },
    { key: 'updatedBy', label: 'Güncelleyen', sortable: false, filterable: false, render: (row) => row.updatedDate ? actor(row.updatedBy) : '-' },
    { key: 'updatedDate', label: 'Güncelleme Zamanı', sortable: false, filterable: false, render: (row) => date(row.updatedDate) },
  ];
}

export const requiredActionColumn = { sortable: false, filterable: false, hideable: false } as const;
