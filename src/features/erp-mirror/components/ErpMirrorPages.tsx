import { useMemo, useState, type ReactNode } from 'react';
import { Eye, SlidersHorizontal } from 'lucide-react';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns, type AuditableGridRow } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { formatProjectDateTime } from '@/lib/project-format';
import { getErpMirrorPage, syncErpMirror } from '../api/erp-mirror.api';
import type { ConfigurationCodeMirror, CustomerMirror, StockMirror, WarehouseMirror } from '../types/erp-mirror.types';
import { StockTrackingSettingsDialog } from './StockTrackingSettingsDialog';

const date = (value?: string) => formatProjectDateTime(value);

const warehouseColumns: GridColumn<WarehouseMirror>[] = [
  { key: 'branchCode', label: 'Şube', render: row => row.branchCode },
  { key: 'warehouseCode', label: 'Depo Kodu', render: row => row.warehouseCode },
  { key: 'warehouseName', label: 'Depo Adı', render: row => row.warehouseName },
  { key: 'lastSyncDate', label: 'Son Eşleme', render: row => date(row.lastSyncDate) },
];

const stockColumns: GridColumn<StockMirror>[] = [
  { key: 'branchCode', label: 'Şube', render: row => row.branchCode },
  { key: 'businessUnitCode', label: 'İşletme', render: row => row.businessUnitCode },
  { key: 'erpStockCode', label: 'Stok Kodu', render: row => row.erpStockCode },
  { key: 'stockName', label: 'Stok Adı', render: row => row.stockName },
  { key: 'manufacturerCode', label: 'Üretici Kodu', render: row => row.manufacturerCode || '-' },
  { key: 'groupCode', label: 'Grup Kodu', render: row => row.groupCode || '-' },
  { key: 'code1', label: 'Kod 1', render: row => row.code1 || '-' },
  { key: 'code2', label: 'Kod 2', render: row => row.code2 || '-' },
  { key: 'code3', label: 'Kod 3', render: row => row.code3 || '-' },
  { key: 'code4', label: 'Kod 4', render: row => row.code4 || '-' },
  { key: 'code5', label: 'Kod 5', render: row => row.code5 || '-' },
  { key: 'lastSyncDate', label: 'Son Eşleme', render: row => date(row.lastSyncDate) },
];

const customerColumns: GridColumn<CustomerMirror>[] = [
  { key: 'branchCode', label: 'Şube', render: row => row.branchCode },
  { key: 'businessUnitCode', label: 'İşletme', render: row => row.businessUnitCode },
  { key: 'customerCode', label: 'Cari Kodu', render: row => row.customerCode },
  { key: 'customerName', label: 'Cari Adı', render: row => row.customerName },
  { key: 'lastSyncDate', label: 'Son Eşleme', render: row => date(row.lastSyncDate) },
];

const configurationCodeColumns: GridColumn<ConfigurationCodeMirror>[] = [
  { key: 'branchCode', label: 'Şube', render: row => row.branchCode },
  { key: 'configurationCode', label: 'Yapılandırma Kodu', render: row => row.configurationCode },
  { key: 'description', label: 'Açıklama', render: row => row.description },
  { key: 'configurableStockCode', label: 'Yapılandırılabilir Stok Kodu', render: row => row.configurableStockCode || '-' },
  { key: 'lastSyncDate', label: 'Son Eşleme', render: row => date(row.lastSyncDate) },
];

function MirrorPage<T extends AuditableGridRow>({
  pageKey,
  title,
  description,
  dataColumns,
  extraActions,
}: {
  pageKey: string;
  title: string;
  description: string;
  dataColumns: GridColumn<T>[];
  extraActions?: (row: T) => ReactNode;
}) {
  const [detail, setDetail] = useState<T | null>(null);
  const columns = useMemo<GridColumn<T>[]>(() => [
    ...systemColumns<T>(),
    ...dataColumns,
    {
      key: 'actions',
      label: 'İşlemler',
      sortable: false,
      filterable: false,
      hideable: false,
      render: row => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDetail(row)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-cyan-600"
          >
            <Eye className="size-3.5" />
            Görüntüle
          </button>
          {extraActions?.(row)}
        </div>
      ),
    },
  ], [dataColumns, extraActions]);

  return (
    <>
      <AdvancedDataGrid<T>
        pageKey={`erp-${pageKey}-v2`}
        title={title}
        description={description}
        columns={columns}
        fetchPage={request => getErpMirrorPage<T>(pageKey, request)}
        toolbarAction={{ label: 'Şimdi Eşle', run: () => syncErpMirror(pageKey) }}
      />
      {detail && (
        <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
          <DialogContent className="max-h-[calc(100%-2rem)] w-full !max-w-2xl overflow-auto rounded-2xl">
            <DialogTitle>{title} Kayıt Detayı #{detail.id}</DialogTitle>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(detail).map(([key, value]) => (
                <div key={key} className="rounded-xl border p-3">
                  <dt className="text-xs font-semibold uppercase text-slate-500">{key}</dt>
                  <dd className="mt-1 break-all text-sm">{value == null || value === '' ? '-' : String(value)}</dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export const WarehouseMirrorPage = () => (
  <MirrorPage
    pageKey="warehouses"
    title="Depolar"
    description="Netsis depo kartlarının eşlenmiş görünümü."
    dataColumns={warehouseColumns}
  />
);

export function StockMirrorPage() {
  const { can } = usePermissionAccess();
  const [trackingStock, setTrackingStock] = useState<StockMirror | null>(null);
  const trackingAction = useMemo(
    () => can('WMS.SERIAL_RULES.VIEW')
      ? (row: StockMirror) => (
          <button
            type="button"
            onClick={() => setTrackingStock(row)}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs font-semibold text-violet-500"
          >
            <SlidersHorizontal className="size-3.5" />
            Takip Ayarları
          </button>
        )
      : undefined,
    [can],
  );

  return (
    <>
      <MirrorPage
        pageKey="stocks"
        title="Stoklar"
        description="Netsis stok kartları ve stoğa bağlı WMS takip zorunlulukları."
        dataColumns={stockColumns}
        extraActions={trackingAction}
      />
      <StockTrackingSettingsDialog stock={trackingStock} onClose={() => setTrackingStock(null)} />
    </>
  );
}

export const CustomerMirrorPage = () => (
  <MirrorPage
    pageKey="customers"
    title="Cariler"
    description="Netsis cari kartlarının eşlenmiş görünümü."
    dataColumns={customerColumns}
  />
);

export const ConfigurationCodeMirrorPage = () => (
  <MirrorPage
    pageKey="configuration-codes"
    title="Yapılandırma Kodları"
    description="Netsis ürün konfigüratöründeki stok varyantlarının WMS ayna görünümü."
    dataColumns={configurationCodeColumns}
  />
);
