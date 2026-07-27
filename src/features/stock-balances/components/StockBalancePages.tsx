import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsDialogBody, OpsDialogContent, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { localizeEnumValue } from '@/lib/enum-localization';
import { stockBalancesApi } from '../api/stock-balances.api';
import type { LocationBalanceRow, ReconciliationSummary, SerialBalanceRow, SerialMovementHistoryRow, StockBalanceDrillDown, WarehouseBalanceRow } from '../types/stock-balance.types';
import { formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';

const L = 'dataGrid.locationBalances';
const W = 'dataGrid.warehouseBalances';
const S = 'dataGrid.serialBalances';
const H = 'dataGrid.serialMovementHistory';

const quantity = (value: number) => (
  <span className={value < 0 ? 'font-bold text-red-600' : value > 0 ? 'font-bold text-emerald-600' : 'text-slate-500'}>
    {formatProjectNumber(value)}
  </span>
);
const date = (value: string) => formatProjectDateTime(value);

export function LocationBalancesPage() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const { can, isLoading, isError } = usePermissionAccess();
  const allow = isLoading || isError || can('WMS.STOCK_BALANCES.RECONCILE');
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [working, setWorking] = useState(false);

  const reconcile = async () => {
    setWorking(true);
    try {
      const current = await stockBalancesApi.getReconciliation();
      setSummary(current);
      if (current.mismatchCount > 0) {
        const result = await stockBalancesApi.rebuild();
        toast.success(t(`${L}.rebuildSuccess`, { locationRows: result.locationRows, warehouseRows: result.warehouseRows }));
        await queryClient.invalidateQueries({ queryKey: ['advanced-grid'] });
        setSummary(await stockBalancesApi.getReconciliation());
      } else {
        toast.success(t(`${L}.reconcileOk`));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${L}.reconcileFailed`));
    } finally {
      setWorking(false);
    }
  };

  const columns = useMemo<GridColumn<LocationBalanceRow>[]>(() => [
    ...systemColumns<LocationBalanceRow>(),
    { key: 'warehouseCode', label: t(`${L}.warehouseCode`), render: r => r.warehouseCode },
    { key: 'warehouseName', label: t(`${L}.warehouseName`), render: r => r.warehouseName },
    { key: 'locationCode', label: t(`${L}.locationCode`), render: r => r.locationCode },
    { key: 'locationName', label: t(`${L}.locationName`), render: r => r.locationName },
    { key: 'stockCode', label: t(`${L}.stockCode`), render: r => r.stockCode },
    { key: 'stockName', label: t(`${L}.stockName`), render: r => r.stockName },
    { key: 'yapCode', label: t(`${L}.yapCode`), render: r => r.yapCode || '-' },
    { key: 'lotNo', label: t(`${L}.lotNo`), render: r => r.lotNo || '-' },
    { key: 'serialNo', label: t(`${L}.serialNo`), render: r => r.serialNo || '-' },
    { key: 'stockStatus', label: t(`${L}.stockStatus`), render: r => localizeEnumValue(r.stockStatus) },
    { key: 'quantity', label: t(`${L}.quantity`), render: r => quantity(r.quantity) },
    { key: 'reservedQuantity', label: t(`${L}.reservedQuantity`), render: r => quantity(r.reservedQuantity) },
    { key: 'availableQuantity', label: t(`${L}.availableQuantity`), render: r => quantity(r.availableQuantity) },
    { key: 'unitCode', label: t(`${L}.unitCode`), render: r => r.unitCode },
    { key: 'lastMovementEntryId', label: t(`${L}.lastMovementEntryId`), render: r => r.lastMovementEntryId },
    { key: 'lastTransactionDate', label: t(`${L}.lastTransactionDate`), render: r => date(r.lastTransactionDate) },
    { key: 'actions', label: t(`${L}.actions`), sortable: false, filterable: false, hideable: false, render: () => <span className="text-xs text-slate-500">{t(`${L}.readOnly`)}</span> },
  ], [t, gridLanguage]);

  return (
    <div className="space-y-4" data-no-auto-localize="true">
      {summary && (
        <div className={`rounded-xl border p-4 ${summary.mismatchCount ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-emerald-400 bg-emerald-50 text-emerald-900'}`}>
          <strong>{t(`${L}.reconciliationTitle`)}</strong>{' '}
          {t(`${L}.reconciliationDetail`, { count: summary.mismatchCount, ledgerId: summary.ledgerLastEntryId, projectionId: summary.projectionLastEntryId })}
        </div>
      )}
      <AdvancedDataGrid
        pageKey="location-stock-balances"
        title={t(`${L}.title`)}
        description={t(`${L}.description`)}
        columns={columns}
        fetchPage={stockBalancesApi.getLocations}
        toolbarAction={allow ? { label: working ? t(`${L}.reconciling`) : t(`${L}.reconcile`), run: reconcile } : undefined}
      />
    </div>
  );
}

export function WarehouseBalancesPage() {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const [detail, setDetail] = useState<StockBalanceDrillDown | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (row: WarehouseBalanceRow) => {
    setLoading(true);
    try {
      setDetail(await stockBalancesApi.getDrillDown(row.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${W}.detailFailed`));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const columns = useMemo<GridColumn<WarehouseBalanceRow>[]>(() => [
    ...systemColumns<WarehouseBalanceRow>(),
    { key: 'warehouseCode', label: t(`${W}.warehouseCode`), render: r => r.warehouseCode },
    { key: 'warehouseName', label: t(`${W}.warehouseName`), render: r => r.warehouseName },
    { key: 'stockCode', label: t(`${W}.stockCode`), render: r => r.stockCode },
    { key: 'stockName', label: t(`${W}.stockName`), render: r => r.stockName },
    { key: 'yapCode', label: t(`${W}.yapCode`), render: r => r.yapCode || '-' },
    { key: 'stockStatus', label: t(`${W}.stockStatus`), render: r => localizeEnumValue(r.stockStatus) },
    { key: 'quantity', label: t(`${W}.quantity`), render: r => quantity(r.quantity) },
    { key: 'reservedQuantity', label: t(`${W}.reservedQuantity`), render: r => quantity(r.reservedQuantity) },
    { key: 'availableQuantity', label: t(`${W}.availableQuantity`), render: r => quantity(r.availableQuantity) },
    { key: 'unitCode', label: t(`${W}.unitCode`), render: r => r.unitCode },
    { key: 'distinctLocationCount', label: t(`${W}.distinctLocationCount`), render: r => r.distinctLocationCount },
    { key: 'distinctLotCount', label: t(`${W}.distinctLotCount`), render: r => r.distinctLotCount },
    { key: 'distinctSerialCount', label: t(`${W}.distinctSerialCount`), render: r => r.distinctSerialCount },
    { key: 'lastTransactionDate', label: t(`${W}.lastTransactionDate`), render: r => date(r.lastTransactionDate) },
    {
      key: 'actions', label: t(`${W}.actions`), sortable: false, filterable: false, hideable: false,
      render: r => <button type="button" title={t(`${W}.viewDetail`)} onClick={() => void open(r)} className="rounded-lg border p-2 text-cyan-600"><Eye className="size-4" /></button>,
    },
  ], [open, t, gridLanguage]);

  return (
    <div data-no-auto-localize="true">
      <AdvancedDataGrid
        pageKey="warehouse-stock-balances"
        title={t(`${W}.title`)}
        description={t(`${W}.description`)}
        columns={columns}
        fetchPage={stockBalancesApi.getWarehouses}
      />
      {(detail || loading) && (
        <Dialog open onOpenChange={v => { if (!v) setDetail(null); }}>
          <OpsDialogContent size="full" portalRoot="body">
            {!detail ? (
              <OpsDialogBody>
                <div className="grid h-48 place-items-center"><Loader2 className="size-7 animate-spin" /></div>
              </OpsDialogBody>
            ) : (
              <>
                <OpsDialogHeader>
                  <DialogTitle className="wms-ops-detail-dialog__title">{detail.summary.stockCode} · {detail.summary.warehouseName}</DialogTitle>
                </OpsDialogHeader>
                <OpsDialogBody>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <SummaryCard label={t(`${W}.quantity`)} value={detail.summary.quantity} />
                    <SummaryCard label={t(`${W}.reservedQuantity`)} value={detail.summary.reservedQuantity} />
                    <SummaryCard label={t(`${W}.availableQuantity`)} value={detail.summary.availableQuantity} />
                    <SummaryCard label={t(`${W}.locationLabel`)} value={detail.summary.distinctLocationCount} />
                  </div>
                  <div className="mt-5 overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-white/5">
                          <th className="p-3 text-left">{t(`${W}.locationLabel`)}</th>
                          <th className="p-3 text-left">{t(`${W}.yapLotSerial`)}</th>
                          <th className="p-3 text-left">{t(`${W}.stockStatus`)}</th>
                          <th className="p-3 text-right">{t(`${W}.quantity`)}</th>
                          <th className="p-3 text-right">{t(`${W}.reservedQuantity`)}</th>
                          <th className="p-3 text-right">{t(`${W}.availableQuantity`)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.locations.map(r => (
                          <tr key={r.id} className="border-t">
                            <td className="p-3"><strong>{r.locationCode}</strong><small className="block text-slate-500">{r.locationName}</small></td>
                            <td className="p-3">{r.yapCode || '-'} / {r.lotNo || '-'} / {r.serialNo || '-'}</td>
                            <td className="p-3">{localizeEnumValue(r.stockStatus)}</td>
                            <td className="p-3 text-right">{quantity(r.quantity)}</td>
                            <td className="p-3 text-right">{quantity(r.reservedQuantity)}</td>
                            <td className="p-3 text-right">{quantity(r.availableQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </OpsDialogBody>
              </>
            )}
          </OpsDialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function SerialBalancesPage() {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const [selected, setSelected] = useState<SerialBalanceRow | null>(null);

  const fetchHistory = useCallback((request: Parameters<typeof stockBalancesApi.getSerials>[0]) => {
    if (!selected) {
      return Promise.resolve({ items: [], totalCount: 0, pageNumber: 1, page: 1, pageSize: request.pageSize, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
    }
    return stockBalancesApi.getSerialMovements(selected.id, request);
  }, [selected]);

  const columns = useMemo<GridColumn<SerialBalanceRow>[]>(() => [
    ...systemColumns<SerialBalanceRow>(),
    { key: 'serialNo', label: t(`${S}.serialNo`), hideable: false, render: r => <span className="font-mono font-bold text-cyan-600">{r.serialNo}</span> },
    { key: 'stockCode', label: t(`${S}.stockCode`), render: r => r.stockCode },
    { key: 'stockName', label: t(`${S}.stockName`), render: r => r.stockName },
    { key: 'warehouseCode', label: t(`${S}.warehouseCode`), render: r => r.warehouseCode },
    { key: 'warehouseName', label: t(`${S}.warehouseName`), render: r => r.warehouseName },
    { key: 'locationCode', label: t(`${S}.locationCode`), render: r => r.locationCode },
    { key: 'locationName', label: t(`${S}.locationName`), render: r => r.locationName },
    { key: 'yapCode', label: t(`${S}.yapCode`), render: r => r.yapCode || '-' },
    { key: 'lotNo', label: t(`${S}.lotNo`), render: r => r.lotNo || '-' },
    { key: 'stockStatus', label: t(`${S}.stockStatus`), render: r => localizeEnumValue(r.stockStatus) },
    { key: 'quantity', label: t(`${S}.quantity`), render: r => quantity(r.quantity) },
    { key: 'reservedQuantity', label: t(`${S}.reservedQuantity`), render: r => quantity(r.reservedQuantity) },
    { key: 'availableQuantity', label: t(`${S}.availableQuantity`), render: r => quantity(r.availableQuantity) },
    { key: 'unitCode', label: t(`${S}.unitCode`), render: r => r.unitCode },
    { key: 'lastMovementEntryId', label: t(`${S}.lastMovementEntryId`), render: r => r.lastMovementEntryId },
    { key: 'lastTransactionDate', label: t(`${S}.lastTransactionDate`), render: r => date(r.lastTransactionDate) },
    {
      key: 'actions', label: t(`${S}.actions`), sortable: false, filterable: false, hideable: false,
      render: r => <button type="button" title={t(`${S}.viewHistory`)} onClick={() => setSelected(r)} className="rounded-lg border p-2 text-cyan-600"><Eye className="size-4" /></button>,
    },
  ], [t, gridLanguage]);

  const historyColumns = useMemo<GridColumn<SerialMovementHistoryRow>[]>(() => [
    ...systemColumns<SerialMovementHistoryRow>(),
    { key: 'occurredAt', label: t(`${H}.occurredAt`), hideable: false, render: r => date(r.occurredAt) },
    { key: 'operationType', label: t(`${H}.operationType`), render: r => movementTypeLabel(r.operationType, t) },
    { key: 'operationStatus', label: t(`${H}.operationStatus`), render: r => localizeEnumValue(r.operationStatus) },
    { key: 'operationCode', label: t(`${H}.operationCode`), render: r => <span className="font-mono text-xs">{r.operationCode}</span> },
    { key: 'referenceNo', label: t(`${H}.referenceNo`), render: r => [r.referenceType, r.referenceNo].filter(Boolean).join(' / ') || '-' },
    { key: 'warehouseCode', label: t(`${H}.warehouseCode`), render: r => r.warehouseCode },
    { key: 'warehouseName', label: t(`${H}.warehouseName`), render: r => r.warehouseName },
    { key: 'locationCode', label: t(`${H}.locationCode`), render: r => r.locationCode },
    { key: 'locationName', label: t(`${H}.locationName`), render: r => r.locationName },
    { key: 'quantityDelta', label: t(`${H}.quantityDelta`), render: r => <span className={r.quantityDelta > 0 ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>{r.quantityDelta > 0 ? '+' : ''}{formatProjectNumber(r.quantityDelta)} {r.unitCode}</span> },
    { key: 'stockStatus', label: t(`${H}.stockStatus`), render: r => localizeEnumValue(r.stockStatus) },
    { key: 'actions', label: t(`${H}.actions`), sortable: false, filterable: false, hideable: false, render: () => <span className="text-xs text-slate-500">{t(`${H}.immutable`)}</span> },
  ], [t, gridLanguage]);

  return (
    <div data-no-auto-localize="true">
      <AdvancedDataGrid
        pageKey="serial-stock-balances"
        title={t(`${S}.title`)}
        description={t(`${S}.description`)}
        columns={columns}
        fetchPage={stockBalancesApi.getSerials}
      />
      {selected && (
        <Dialog open onOpenChange={open => { if (!open) setSelected(null); }}>
          <OpsDialogContent size="full" portalRoot="body" className="sm:max-w-7xl">
            <OpsDialogHeader>
              <DialogTitle className="wms-ops-detail-dialog__title">{t(`${S}.historyTitle`, { stockCode: selected.stockCode, serialNo: selected.serialNo })}</DialogTitle>
              <p className="text-sm text-slate-500">{t(`${S}.historyDescription`)}</p>
            </OpsDialogHeader>
            <OpsDialogBody>
              <AdvancedDataGrid
                pageKey={`serial-movement-history-${selected.id}`}
                title={t(`${S}.historyGridTitle`)}
                description={t(`${S}.historyGridDescription`, {
                  warehouseName: selected.warehouseName,
                  locationCode: selected.locationCode,
                  quantity: formatProjectNumber(selected.quantity),
                  unitCode: selected.unitCode,
                })}
                columns={historyColumns}
                fetchPage={fetchHistory}
              />
            </OpsDialogBody>
          </OpsDialogContent>
        </Dialog>
      )}
    </div>
  );
}

function movementTypeLabel(value: string, t: (key: string) => string): string {
  const key = `${H}.operationTypes.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{formatProjectNumber(value)}</p>
    </div>
  );
}
