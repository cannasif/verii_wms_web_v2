import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Eye, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns, type AuditableGridRow } from '@/components/shared/GridSystemColumns';
import { OpsDialogBody, OpsDialogContent, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { formatProjectDateTime } from '@/lib/project-format';
import { getErpMirrorPage, syncErpMirror } from '../api/erp-mirror.api';
import type { ConfigurationCodeMirror, CustomerMirror, StockMirror, WarehouseMirror } from '../types/erp-mirror.types';
import { StockTrackingSettingsDialog } from './StockTrackingSettingsDialog';

const M = 'erpMirror';
const date = (value?: string) => formatProjectDateTime(value);
const col = (t: TFunction, key: string) => t(`${M}.columns.${key}`);

function buildWarehouseColumns(t: TFunction): GridColumn<WarehouseMirror>[] {
  return [
    { key: 'branchCode', label: col(t, 'branchCode'), render: row => row.branchCode },
    { key: 'warehouseCode', label: col(t, 'warehouseCode'), render: row => row.warehouseCode },
    { key: 'warehouseName', label: col(t, 'warehouseName'), render: row => row.warehouseName },
    { key: 'lastSyncDate', label: col(t, 'lastSyncDate'), render: row => date(row.lastSyncDate) },
  ];
}

function buildStockColumns(t: TFunction): GridColumn<StockMirror>[] {
  return [
    { key: 'unitCode', label: col(t, 'unitCode'), render: row => <span className="font-semibold text-cyan-600">{row.unitCode || t(`${M}.undefinedUnit`)}</span> },
    { key: 'branchCode', label: col(t, 'branchCode'), render: row => row.branchCode },
    { key: 'businessUnitCode', label: col(t, 'businessUnitCode'), render: row => row.businessUnitCode },
    { key: 'erpStockCode', label: col(t, 'erpStockCode'), render: row => row.erpStockCode },
    { key: 'stockName', label: col(t, 'stockName'), render: row => row.stockName },
    { key: 'manufacturerCode', label: col(t, 'manufacturerCode'), render: row => row.manufacturerCode || '-' },
    { key: 'groupCode', label: col(t, 'groupCode'), render: row => row.groupCode || '-' },
    { key: 'code1', label: col(t, 'code1'), render: row => row.code1 || '-' },
    { key: 'code2', label: col(t, 'code2'), render: row => row.code2 || '-' },
    { key: 'code3', label: col(t, 'code3'), render: row => row.code3 || '-' },
    { key: 'code4', label: col(t, 'code4'), render: row => row.code4 || '-' },
    { key: 'code5', label: col(t, 'code5'), render: row => row.code5 || '-' },
    { key: 'lastSyncDate', label: col(t, 'lastSyncDate'), render: row => date(row.lastSyncDate) },
  ];
}

function buildCustomerColumns(t: TFunction): GridColumn<CustomerMirror>[] {
  return [
    { key: 'branchCode', label: col(t, 'branchCode'), render: row => row.branchCode },
    { key: 'businessUnitCode', label: col(t, 'businessUnitCode'), render: row => row.businessUnitCode },
    { key: 'customerCode', label: col(t, 'customerCode'), render: row => row.customerCode },
    { key: 'customerName', label: col(t, 'customerName'), render: row => row.customerName },
    { key: 'lastSyncDate', label: col(t, 'lastSyncDate'), render: row => date(row.lastSyncDate) },
  ];
}

function buildConfigurationCodeColumns(t: TFunction): GridColumn<ConfigurationCodeMirror>[] {
  return [
    { key: 'branchCode', label: col(t, 'branchCode'), render: row => row.branchCode },
    { key: 'configurationCode', label: col(t, 'configurationCode'), render: row => row.configurationCode },
    { key: 'description', label: col(t, 'description'), render: row => row.description },
    { key: 'configurableStockCode', label: col(t, 'configurableStockCode'), render: row => row.configurableStockCode || '-' },
    { key: 'lastSyncDate', label: col(t, 'lastSyncDate'), render: row => date(row.lastSyncDate) },
  ];
}

function fieldLabel(t: TFunction, key: string) {
  return t(`${M}.fields.${key}`, { defaultValue: key });
}

function MirrorPage<T extends AuditableGridRow>({
  pageKey,
  title,
  description,
  dataColumns,
  extraActions,
  onView,
}: {
  pageKey: string;
  title: string;
  description: string;
  dataColumns: GridColumn<T>[];
  extraActions?: (row: T) => ReactNode;
  onView?: (row: T) => void;
}) {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [detail, setDetail] = useState<T | null>(null);
  const columns = useMemo<GridColumn<T>[]>(() => [
    ...systemColumns<T>(),
    ...dataColumns,
    {
      key: 'actions',
      label: t(`${M}.actions`),
      sortable: false,
      filterable: false,
      hideable: false,
      render: row => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onView ? onView(row) : setDetail(row)}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-cyan-600"
          >
            <Eye className="size-3.5" />
            {t(`${M}.view`)}
          </button>
          {extraActions?.(row)}
        </div>
      ),
    },
  ], [dataColumns, extraActions, language, onView, t]);

  return (
    <>
      <AdvancedDataGrid<T>
        pageKey={`erp-${pageKey}-v2`}
        title={title}
        description={description}
        columns={columns}
        fetchPage={request => getErpMirrorPage<T>(pageKey, request)}
        toolbarAction={{ label: t(`${M}.syncNow`), run: () => syncErpMirror(pageKey) }}
      />
      {detail && (
        <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
          <OpsDialogContent size="xl" portalRoot="body" className="data-no-auto-localize">
            <OpsDialogHeader>
              <DialogTitle className="wms-ops-detail-dialog__title">{t(`${M}.recordDetail`, { title, id: detail.id })}</DialogTitle>
            </OpsDialogHeader>
            <OpsDialogBody>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(detail).map(([key, value]) => (
                  <div key={key} className="rounded-xl border p-3">
                    <dt className="text-xs font-semibold text-slate-500">{fieldLabel(t, key)}</dt>
                    <dd className="mt-1 break-all text-sm">{value == null || value === '' ? '-' : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </OpsDialogBody>
          </OpsDialogContent>
        </Dialog>
      )}
    </>
  );
}

export function WarehouseMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const dataColumns = useMemo(() => buildWarehouseColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  return (
    <MirrorPage
      pageKey="warehouses"
      title={t('sidebar.erpWarehouses')}
      description={t(`${M}.pages.warehouses.description`)}
      dataColumns={dataColumns}
    />
  );
}

export function StockMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const { can } = usePermissionAccess();
  const [selectedStock, setSelectedStock] = useState<StockMirror | null>(null);
  const [selectedTab, setSelectedTab] = useState<'details' | 'tracking'>('details');
  const dataColumns = useMemo(() => buildStockColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  const openStock = useCallback((stock: StockMirror, tab: 'details' | 'tracking') => {
    setSelectedTab(tab);
    setSelectedStock(stock);
  }, []);
  const viewStock = useCallback((stock: StockMirror) => openStock(stock, 'details'), [openStock]);
  const trackingAction = useMemo(
    () => can('WMS.SERIAL_RULES.VIEW')
      ? (row: StockMirror) => (
          <button
            type="button"
            onClick={() => openStock(row, 'tracking')}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs font-semibold text-violet-500"
          >
            <SlidersHorizontal className="size-3.5" />
            {t(`${M}.trackingSettings`)}
          </button>
        )
      : undefined,
    [can, openStock, t],
  );

  return (
    <>
      <MirrorPage
        pageKey="stocks"
        title={t('sidebar.erpStocks')}
        description={t(`${M}.pages.stocks.description`)}
        dataColumns={dataColumns}
        extraActions={trackingAction}
        onView={viewStock}
      />
      <StockTrackingSettingsDialog
        stock={selectedStock}
        initialTab={selectedTab}
        onClose={() => setSelectedStock(null)}
      />
    </>
  );
}

export function CustomerMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const dataColumns = useMemo(() => buildCustomerColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  return (
    <MirrorPage
      pageKey="customers"
      title={t('sidebar.erpCustomers')}
      description={t(`${M}.pages.customers.description`)}
      dataColumns={dataColumns}
    />
  );
}

export function ConfigurationCodeMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const dataColumns = useMemo(() => buildConfigurationCodeColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  return (
    <MirrorPage
      pageKey="configuration-codes"
      title={t('sidebar.erpConfigurationCodes')}
      description={t(`${M}.pages.configurationCodes.description`)}
      dataColumns={dataColumns}
    />
  );
}
