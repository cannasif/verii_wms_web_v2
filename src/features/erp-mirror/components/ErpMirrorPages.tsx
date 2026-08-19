import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, Eye, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn, type GridPage, type GridRequest, type GridToolbarAction } from '@/components/shared/AdvancedDataGrid';
import { systemColumns, type AuditableGridRow } from '@/components/shared/GridSystemColumns';
import { OpsDialogBody, OpsDialogContent, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/components/theme-provider';
import { formatProjectDateTime } from '@/lib/project-format';
import { normalizeGridPage } from '@/lib/paged';
import { UNLIMITED_GRID_SEARCH_FIELDS } from '@/lib/grid-preferences';
import { cn } from '@/lib/utils';
import { getErpMirrorPage, syncErpMirror } from '../api/erp-mirror.api';
import {
  createEmptyStockCodeFilterSelections,
  cloneStockCodeFilterSelections,
  hasStockCodeFilterSelection,
  stockMatchesCodeFilterSelections,
  type StockCodeFilterSelections,
} from '../stock-code-filter';
import type { ConfigurationCodeMirror, CustomerMirror, StockMirror, WarehouseMirror } from '../types/erp-mirror.types';
import { CustomerMirrorDetailDialog } from './CustomerMirrorDetailDialog';
import { StockCodeFilterPopover } from './StockCodeFilterPopover';
import { StockTrackingSettingsDialog } from './StockTrackingSettingsDialog';
import { WarehouseMirrorDetailDialog } from './WarehouseMirrorDetailDialog';

const M = 'erpMirror';
const date = (value?: string) => formatProjectDateTime(value);
const col = (t: TFunction, key: string) => t(`${M}.columns.${key}`);

const gridViewButtonClassName = cn(
  'inline-flex size-8 items-center justify-center rounded-lg border border-transparent',
  'text-[var(--wms-ops-accent)] transition-all duration-200',
  'hover:border-[color-mix(in_oklab,var(--wms-ops-accent)_35%,var(--wms-app-border))]',
  'hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)]',
  'hover:shadow-[0_0_14px_color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-ops-accent)]',
);

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
    { key: 'unitCode', label: col(t, 'unitCode'), searchable: true, defaultSearch: false, render: row => <span className="font-semibold text-cyan-600">{row.unitCode || t(`${M}.undefinedUnit`)}</span> },
    { key: 'branchCode', label: col(t, 'branchCode'), searchable: true, defaultSearch: false, render: row => row.branchCode },
    { key: 'businessUnitCode', label: col(t, 'businessUnitCode'), searchable: true, defaultSearch: false, render: row => row.businessUnitCode },
    { key: 'erpStockCode', label: col(t, 'erpStockCode'), searchable: true, defaultSearch: true, filterType: 'text', render: row => row.erpStockCode },
    { key: 'stockName', label: col(t, 'stockName'), searchable: true, defaultSearch: true, filterType: 'text', render: row => row.stockName },
    { key: 'manufacturerCode', label: col(t, 'manufacturerCode'), searchable: true, defaultSearch: false, render: row => row.manufacturerCode || '-' },
    { key: 'groupCode', label: col(t, 'groupCode'), searchable: true, defaultSearch: false, render: row => row.groupCode || '-' },
    { key: 'code1', label: col(t, 'code1'), searchable: true, defaultSearch: true, filterable: true, filterType: 'text', render: row => row.code1 || '-' },
    { key: 'code2', label: col(t, 'code2'), searchable: true, defaultSearch: true, filterable: true, filterType: 'text', render: row => row.code2 || '-' },
    { key: 'code3', label: col(t, 'code3'), searchable: true, defaultSearch: true, filterable: true, filterType: 'text', render: row => row.code3 || '-' },
    { key: 'code4', label: col(t, 'code4'), searchable: true, defaultSearch: false, filterable: true, filterType: 'text', render: row => row.code4 || '-' },
    { key: 'code5', label: col(t, 'code5'), searchable: true, defaultSearch: false, filterable: true, filterType: 'text', render: row => row.code5 || '-' },
    { key: 'lastSyncDate', label: col(t, 'lastSyncDate'), searchable: false, render: row => date(row.lastSyncDate) },
  ];
}

function buildCustomerColumns(t: TFunction): GridColumn<CustomerMirror>[] {
  return [
    { key: 'branchCode', label: col(t, 'branchCode'), render: row => row.branchCode },
    { key: 'businessUnitCode', label: col(t, 'businessUnitCode'), render: row => row.businessUnitCode },
    { key: 'customerCode', label: col(t, 'customerCode'), render: row => row.customerCode },
    { key: 'customerName', label: col(t, 'customerName'), render: row => row.customerName },
    { key: 'customerType', label: col(t, 'customerType'), render: row => row.customerType || '—' },
    { key: 'phone1', label: col(t, 'phone1'), render: row => row.phone1 || '—' },
    { key: 'phone2', label: col(t, 'phone2'), render: row => row.phone2 || '—' },
    { key: 'phone3', label: col(t, 'phone3'), render: row => row.phone3 || '—' },
    { key: 'email', label: col(t, 'email'), render: row => row.email || '—' },
    { key: 'website', label: col(t, 'website'), render: row => row.website || '—' },
    { key: 'city', label: col(t, 'city'), render: row => row.city || '—' },
    { key: 'district', label: col(t, 'district'), render: row => row.district || '—' },
    { key: 'countryCode', label: col(t, 'countryCode'), render: row => row.countryCode || '—' },
    { key: 'address', label: col(t, 'address'), render: row => row.address || '—' },
    { key: 'taxOffice', label: col(t, 'taxOffice'), render: row => row.taxOffice || '—' },
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

function PageTitleWithHint({ title, hint }: { title: string; hint: string }) {
  const { skin } = useTheme();
  if (skin !== 'premium') return <>{title}</>;

  return (
    <span className="inline-flex items-center gap-2">
      <span>{title}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="wms-ops-gr-page-hero__hint"
              aria-label={hint}
            >
              <CircleAlert className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={10}
            className={cn(
              'wms-ops-page-hint-tooltip max-w-[22rem] overflow-hidden rounded-xl border p-0 text-left shadow-[0_12px_40px_color-mix(in_oklab,black_45%,transparent),0_0_0_1px_color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)]',
              '!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]',
              'border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))]',
              '!text-[var(--wms-app-text)]',
            )}
          >
            <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-3.5 py-2">
              <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-ops-accent)]">
                <span
                  className="size-1.5 rounded-full bg-[var(--wms-ops-accent)] shadow-[0_0_8px_var(--wms-ops-accent)]"
                  aria-hidden
                />
                {title}
              </span>
            </div>
            <p className="px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">
              {hint}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

function useErpSyncToolbarAction(resource: string): GridToolbarAction {
  const { t } = useTranslation('common');
  return useMemo(() => ({
    label: t(`${M}.syncWithErp`),
    tooltip: t(`${M}.syncWithErpTooltip`),
    icon: <RefreshCw className="size-3.5" aria-hidden />,
    run: async () => {
      try {
        await syncErpMirror(resource);
        toast.success(t(`${M}.syncSuccess`));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t(`${M}.syncFailed`));
        throw error;
      }
    },
  }), [resource, t]);
}

function MirrorPage<T extends AuditableGridRow>({
  pageKey,
  gridPageKey,
  title,
  description,
  dataColumns,
  onView,
  toolbarAction,
  toolbarEndExtra,
  fetchPage,
  refreshKey,
  iconOnlyView = false,
  maxSearchFields,
}: {
  pageKey: string;
  gridPageKey?: string;
  title: ReactNode;
  description: string;
  dataColumns: GridColumn<T>[];
  onView?: (row: T) => void;
  toolbarAction?: GridToolbarAction;
  toolbarEndExtra?: ReactNode;
  fetchPage?: (request: GridRequest) => Promise<GridPage<T>>;
  refreshKey?: string | number;
  iconOnlyView?: boolean;
  maxSearchFields?: number;
}) {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [detail, setDetail] = useState<T | null>(null);
  const titleText = typeof title === 'string' ? title : '';
  const columns = useMemo<GridColumn<T>[]>(() => [
    ...systemColumns<T>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    ...dataColumns,
    {
      key: 'actions',
      label: t(`${M}.actions`),
      sortable: false,
      filterable: false,
      hideable: false,
      width: iconOnlyView ? 88 : 160,
      render: row => (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            title={t(`${M}.view`)}
            aria-label={t(`${M}.view`)}
            onClick={() => onView ? onView(row) : setDetail(row)}
            className={iconOnlyView
              ? gridViewButtonClassName
              : 'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-cyan-600'}
          >
            <Eye className="size-3.5" />
            {!iconOnlyView && t(`${M}.view`)}
          </button>
        </div>
      ),
    },
  ], [dataColumns, iconOnlyView, language, onView, t]);

  const resolvedToolbarAction = useMemo<GridToolbarAction>(() => {
    if (toolbarAction) return toolbarAction;
    return {
      label: t(`${M}.syncWithErp`),
      icon: <RefreshCw className="size-3.5" aria-hidden />,
      tooltip: t(`${M}.syncWithErpTooltip`),
      run: async () => {
        try {
          await syncErpMirror(pageKey);
          toast.success(t(`${M}.syncSuccess`));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t(`${M}.syncFailed`));
          throw error;
        }
      },
    };
  }, [pageKey, t, toolbarAction]);

  return (
    <>
      <AdvancedDataGrid<T>
        pageKey={gridPageKey ?? `erp-${pageKey}-v2`}
        title={title}
        description={description}
        columns={columns}
        fetchPage={fetchPage ?? (request => getErpMirrorPage<T>(pageKey, request))}
        toolbarAction={resolvedToolbarAction}
        toolbarEndExtra={toolbarEndExtra}
        refreshKey={refreshKey}
        maxSearchFields={maxSearchFields}
      />
      {detail && (
        <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
          <OpsDialogContent size="xl" portalRoot="body" className="data-no-auto-localize">
            <OpsDialogHeader>
              <DialogTitle className="wms-ops-detail-dialog__title">{t(`${M}.recordDetail`, { title: titleText || pageKey, id: detail.id })}</DialogTitle>
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
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseMirror | null>(null);
  const dataColumns = useMemo(() => buildWarehouseColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  const toolbarAction = useErpSyncToolbarAction('warehouses');
  const viewWarehouse = useCallback((warehouse: WarehouseMirror) => {
    setSelectedWarehouse(warehouse);
  }, []);
  const title = useMemo(
    () => (
      <PageTitleWithHint
        title={t('sidebar.erpWarehouses')}
        hint={t(`${M}.pages.warehouses.titleHint`)}
      />
    ),
    [t, i18n.resolvedLanguage ?? i18n.language],
  );

  return (
    <>
      <MirrorPage
        pageKey="warehouses"
        title={title}
        description={t(`${M}.pages.warehouses.description`)}
        dataColumns={dataColumns}
        onView={viewWarehouse}
        toolbarAction={toolbarAction}
        iconOnlyView
      />
      <WarehouseMirrorDetailDialog
        warehouse={selectedWarehouse}
        onClose={() => setSelectedWarehouse(null)}
      />
    </>
  );
}

export function StockMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const [selectedStock, setSelectedStock] = useState<StockMirror | null>(null);
  const [draftCodeFilters, setDraftCodeFilters] = useState<StockCodeFilterSelections>(createEmptyStockCodeFilterSelections);
  const [appliedCodeFilters, setAppliedCodeFilters] = useState<StockCodeFilterSelections>(createEmptyStockCodeFilterSelections);
  const dataColumns = useMemo(() => buildStockColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  const viewStock = useCallback((stock: StockMirror) => {
    setSelectedStock(stock);
  }, []);

  const title = useMemo(
    () => (
      <PageTitleWithHint
        title={t('sidebar.erpStocks')}
        hint={t(`${M}.pages.stocks.titleHint`)}
      />
    ),
    [t, i18n.resolvedLanguage ?? i18n.language],
  );

  const toolbarAction = useErpSyncToolbarAction('stocks');

  const codeFilterKey = useMemo(
    () => JSON.stringify(appliedCodeFilters),
    [appliedCodeFilters],
  );

  const fetchStocksPage = useCallback(async (request: GridRequest) => {
    if (!hasStockCodeFilterSelection(appliedCodeFilters)) {
      return getErpMirrorPage<StockMirror>('stocks', request);
    }

    const pool = normalizeGridPage<StockMirror>(
      await getErpMirrorPage<StockMirror>('stocks', {
        ...request,
        pageNumber: 1,
        pageSize: Math.max(request.pageSize * 50, 1000),
      }),
    );
    const matched = pool.items.filter((row) =>
      stockMatchesCodeFilterSelections(row as unknown as Record<string, unknown>, appliedCodeFilters),
    );
    const pageNumber = request.pageNumber ?? 1;
    const start = (pageNumber - 1) * request.pageSize;
    const items = matched.slice(start, start + request.pageSize);
    const totalCount = matched.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / request.pageSize) || 1);

    return {
      items,
      pageNumber,
      pageSize: request.pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    };
  }, [appliedCodeFilters]);

  const toolbarEndExtra = useMemo(() => (
    <StockCodeFilterPopover
      draftSelections={draftCodeFilters}
      onDraftSelectionsChange={setDraftCodeFilters}
      appliedSelections={appliedCodeFilters}
      onApply={() => setAppliedCodeFilters(cloneStockCodeFilterSelections(draftCodeFilters))}
      onClearApplied={() => {
        const empty = createEmptyStockCodeFilterSelections();
        setDraftCodeFilters(empty);
        setAppliedCodeFilters(empty);
      }}
    />
  ), [appliedCodeFilters, draftCodeFilters]);

  return (
    <>
      <MirrorPage
        pageKey="stocks"
        gridPageKey="erp-stocks-v3"
        title={title}
        description={t(`${M}.pages.stocks.description`)}
        dataColumns={dataColumns}
        onView={viewStock}
        toolbarAction={toolbarAction}
        toolbarEndExtra={toolbarEndExtra}
        fetchPage={fetchStocksPage}
        refreshKey={codeFilterKey}
        iconOnlyView
      />
      <StockTrackingSettingsDialog
        stock={selectedStock}
        initialTab="details"
        onClose={() => setSelectedStock(null)}
      />
    </>
  );
}

export function CustomerMirrorPage() {
  const { t, i18n } = useTranslation('common');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMirror | null>(null);
  const dataColumns = useMemo(() => buildCustomerColumns(t), [i18n.resolvedLanguage ?? i18n.language, t]);
  const toolbarAction = useErpSyncToolbarAction('customers');
  const viewCustomer = useCallback((customer: CustomerMirror) => {
    setSelectedCustomer(customer);
  }, []);
  const title = useMemo(
    () => (
      <PageTitleWithHint
        title={t('sidebar.erpCustomers')}
        hint={t(`${M}.pages.customers.titleHint`)}
      />
    ),
    [t, i18n.resolvedLanguage ?? i18n.language],
  );

  return (
    <>
      <MirrorPage
        pageKey="customers"
        title={title}
        description={t(`${M}.pages.customers.description`)}
        dataColumns={dataColumns}
        onView={viewCustomer}
        toolbarAction={toolbarAction}
        iconOnlyView
        maxSearchFields={UNLIMITED_GRID_SEARCH_FIELDS}
      />
      <CustomerMirrorDetailDialog
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </>
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
