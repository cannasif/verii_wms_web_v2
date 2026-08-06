import { useMemo, useState, type ReactElement } from 'react';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import type { PagedResponse } from '@/types/api';
import type { KkdEmployee } from './kkd-api';
import { KkdField } from './kkd-ops-ui';

const employeeLabel = (item: KkdEmployee): string => `${item.employeeCode} · ${item.fullName}`;

function pageEmployees(
  items: KkdEmployee[],
  search: string,
  pageNumber: number,
  pageSize: number,
): PagedResponse<KkdEmployee> {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = query
    ? items.filter((item) =>
        `${item.employeeCode} ${item.fullName} ${item.qrCode}`.toLocaleLowerCase('tr-TR').includes(query),
      )
    : items;
  const start = (pageNumber - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  const totalCount = filtered.length;
  return {
    data,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1))),
    hasPreviousPage: pageNumber > 1,
    hasNextPage: start + pageSize < totalCount,
  };
}

/** Yazılabilir combobox + arama ikonu / çift tık ile temalı personel seçim popup'ı. */
export function KkdEmployeeLookupField({
  value,
  employees,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  employees?: KkdEmployee[];
  onChange: (employeeId: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => employees?.find((item) => String(item.id) === value),
    [employees, value],
  );

  return (
    <KkdField label="Personel">
      <PagedLookupDialog<KkdEmployee>
        variant="ops"
        triggerMode="combobox"
        autoSearchMinLength={1}
        disabled={disabled}
        invalid={invalid}
        open={open}
        onOpenChange={setOpen}
        title="Personel seç"
        description="Kod veya ad yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
        value={selected ? employeeLabel(selected) : ''}
        placeholder="Personel yazın veya seçin"
        searchPlaceholder="Personel ara"
        emptyText="Personel bulunamadı."
        queryKey={['kkd', 'employee-lookup-dialog']}
        fetchPage={async ({ pageNumber, pageSize, search }) =>
          pageEmployees(employees ?? [], search, pageNumber, pageSize)
        }
        getKey={(item) => String(item.id)}
        getLabel={employeeLabel}
        onSelect={(item) => onChange(String(item.id))}
      />
    </KkdField>
  );
}
