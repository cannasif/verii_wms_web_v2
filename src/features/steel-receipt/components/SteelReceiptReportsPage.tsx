import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, ClipboardClock, PackageCheck, ShieldAlert, Warehouse } from 'lucide-react';
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridFilter,
  type GridRequest,
} from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { formatProjectNumber } from '@/lib/project-format';
import { steelReceiptApi } from '../api/steel-receipt.api';
import type { SteelLineRow } from '../types/steel-receipt.types';

type ReportView = 'all' | 'expected' | 'inspection' | 'rejected' | 'receiptReady' | 'putaway';

const viewFilters: Record<ReportView, GridFilter[]> = {
  all: [],
  expected: [{ column: 'arrivalStatus', operator: 'equals', value: 'Expected' }],
  inspection: [{ column: 'inspectionStatus', operator: 'equals', value: 'Pending' }],
  rejected: [{ column: 'inspectionStatus', operator: 'equals', value: 'Rejected' }],
  receiptReady: [
    { column: 'inspectionStatus', operator: 'equals', value: 'Approved' },
    { column: 'conversionStatus', operator: 'equals', value: 'NotCreated' },
  ],
  putaway: [
    { column: 'conversionStatus', operator: 'equals', value: 'Created' },
    { column: 'putawayStatus', operator: 'equals', value: 'Pending' },
  ],
};

const R = 'steelGoodReceiptAcceptance.reportsPage';
const G = 'dataGrid.steelReportLines';

export function SteelReceiptReportsPage(): ReactElement {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const [view, setView] = useState<ReportView>('all');
  const summary = useQuery({
    queryKey: ['steel-receipt-report-summary'],
    queryFn: async () => {
      const count = async (filters: GridFilter[]) => (await steelReceiptApi.linesPaged(summaryRequest(filters))).totalCount;
      const [all, expected, inspection, rejected, receiptReady, putaway] = await Promise.all([
        count(viewFilters.all),
        count(viewFilters.expected),
        count(viewFilters.inspection),
        count(viewFilters.rejected),
        count(viewFilters.receiptReady),
        count(viewFilters.putaway),
      ]);
      return { all, expected, inspection, rejected, receiptReady, putaway };
    },
    staleTime: 30_000,
  });

  const fetchPage = useCallback((request: GridRequest) => steelReceiptApi.linesPaged({
    ...request,
    filterLogic: 'and',
    filters: [...viewFilters[view], ...request.filters],
  }), [view]);

  const statusLabel = useCallback((value: string) => t(`${R}.statusLabels.${value}`, { defaultValue: value }), [t]);

  const columns = useMemo<GridColumn<SteelLineRow>[]>(() => [
    ...systemColumns<SteelLineRow>(),
    { key: 'dCode', label: t(`${G}.dCode`), sortable: true, filterable: true, render: row => <span className="font-mono font-black text-cyan-600">{row.dCode}</span> },
    { key: 'supplierSerialNo', label: t(`${G}.supplierSerialNo`), sortable: true, filterable: true, render: row => row.supplierSerialNo },
    { key: 'secondarySerialNo', label: t(`${G}.secondarySerialNo`), sortable: true, filterable: true, render: row => row.secondarySerialNo || '—' },
    { key: 'stockCode', label: t(`${G}.stockCode`), sortable: true, filterable: true, render: row => row.stockCode },
    { key: 'stockName', label: t(`${G}.stockName`), sortable: true, filterable: true, render: row => row.stockName },
    { key: 'importReferenceNo', label: t(`${G}.importReferenceNo`), sortable: true, filterable: true, render: row => row.importReferenceNo },
    { key: 'netsisOrderNo', label: t(`${G}.netsisOrderNo`), sortable: true, filterable: true, render: row => row.netsisOrderNo || '—' },
    { key: 'materialGrade', label: t(`${G}.materialGrade`), sortable: true, filterable: true, render: row => row.materialGrade || '—' },
    { key: 'combinedSize', label: t(`${G}.combinedSize`), sortable: true, filterable: true, render: row => row.combinedSize || '—' },
    { key: 'heatNumber', label: t(`${G}.heatNumber`), sortable: true, filterable: true, render: row => row.heatNumber || '—' },
    { key: 'certificateNumber', label: t(`${G}.certificateNumber`), sortable: true, filterable: true, render: row => row.certificateNumber || '—' },
    { key: 'expectedQuantity', label: t(`${G}.expectedQuantity`), sortable: true, filterable: true, render: row => `${formatProjectNumber(row.expectedQuantity)} ${row.unitCode}` },
    { key: 'arrivedQuantity', label: t(`${G}.arrivedQuantity`), sortable: true, filterable: true, render: row => formatProjectNumber(row.arrivedQuantity) },
    { key: 'approvedQuantity', label: t(`${G}.approvedQuantity`), sortable: true, filterable: true, render: row => formatProjectNumber(row.approvedQuantity) },
    { key: 'rejectedQuantity', label: t(`${G}.rejectedQuantity`), sortable: true, filterable: true, render: row => formatProjectNumber(row.rejectedQuantity) },
    { key: 'arrivalStatus', label: t(`${G}.arrivalStatus`), sortable: true, filterable: true, render: row => statusLabel(row.arrivalStatus) },
    { key: 'inspectionStatus', label: t(`${G}.inspectionStatus`), sortable: true, filterable: true, render: row => statusLabel(row.inspectionStatus) },
    { key: 'conversionStatus', label: t(`${G}.conversionStatus`), sortable: true, filterable: true, render: row => statusLabel(row.conversionStatus) },
    { key: 'putawayStatus', label: t(`${G}.putawayStatus`), sortable: true, filterable: true, render: row => statusLabel(row.putawayStatus) },
    { key: 'goodsReceiptNo', label: t(`${G}.goodsReceiptNo`), sortable: true, filterable: true, render: row => row.goodsReceiptNo || '—' },
  ], [statusLabel, t, gridLanguage]);

  const cards: Array<{ key: ReportView; label: string; icon: typeof BarChart3; tone: string }> = [
    { key: 'all', label: t(`${R}.cards.all`), icon: BarChart3, tone: 'text-violet-500 bg-violet-500/10' },
    { key: 'expected', label: t(`${R}.cards.expected`), icon: ClipboardClock, tone: 'text-amber-500 bg-amber-500/10' },
    { key: 'inspection', label: t(`${R}.cards.inspection`), icon: ShieldAlert, tone: 'text-orange-500 bg-orange-500/10' },
    { key: 'receiptReady', label: t(`${R}.cards.receiptReady`), icon: PackageCheck, tone: 'text-cyan-500 bg-cyan-500/10' },
    { key: 'putaway', label: t(`${R}.cards.putaway`), icon: Warehouse, tone: 'text-emerald-500 bg-emerald-500/10' },
    { key: 'rejected', label: t(`${R}.cards.rejected`), icon: ShieldAlert, tone: 'text-rose-500 bg-rose-500/10' },
  ];

  return <section className="space-y-5" data-no-auto-localize="true">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-500">{t(`${R}.eyebrow`)}</p>
      <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t(`${R}.title`)}</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-500">{t(`${R}.description`)}</p>
    </header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map(({ key, label, icon: Icon, tone }) => <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`min-h-28 rounded-2xl border p-4 text-left transition ${view === key ? 'border-cyan-500 ring-2 ring-cyan-500/15' : 'border-[var(--wms-app-border)] hover:border-cyan-500/40'}`}>
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4"/></span>
        <strong className="mt-3 block text-2xl">{summary.isLoading ? '…' : summary.data?.[key] ?? 0}</strong>
        <span className="text-xs text-slate-500">{label}</span>
      </button>)}
    </div>

    {summary.isError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600">{t(`${R}.summaryError`)}</div>}

    <AdvancedDataGrid key={view} pageKey={`steel-reports-${view}`} title={t(`${R}.views.${view}.title`)} description={t(`${R}.views.${view}.description`)} columns={columns} fetchPage={fetchPage}/>
  </section>;
}

function summaryRequest(filters: GridFilter[]): GridRequest {
  return { pageNumber: 1, pageSize: 10, search: null, sortBy: 'id', sortDirection: 'desc', filterLogic: 'and', filters };
}
