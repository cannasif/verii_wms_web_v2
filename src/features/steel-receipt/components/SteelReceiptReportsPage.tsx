import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
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

const viewMeta: Record<ReportView, { title: string; description: string }> = {
  all: { title: 'Levha İzlenebilirlik Raporu', description: 'Tüm levhaları DCode, tedarikçi serisi, stok, kalite, mal kabul ve yerleştirme durumuyla arayın.' },
  expected: { title: 'Beklenen Levhalar', description: 'Henüz sahaya ulaşmamış veya araç kabulü tamamlanmamış levhalar.' },
  inspection: { title: 'Kontrol Bekleyen Levhalar', description: 'Fiziksel ve kalite kararı bekleyen levhalar.' },
  rejected: { title: 'Ret ve İstisna Raporu', description: 'Reddedilen levhaları stok, seri ve malzeme bilgileriyle inceleyin.' },
  receiptReady: { title: 'Mal Kabule Hazır Levhalar', description: 'Onaylanmış fakat henüz ortak mal kabul belgesine aktarılmamış levhalar.' },
  putaway: { title: 'Yerleştirme Bekleyen Levhalar', description: 'Mal kabulü oluşmuş ancak nihai saha veya raf konumu tamamlanmamış levhalar.' },
};

export function SteelReceiptReportsPage(): ReactElement {
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

  const columns = useMemo<GridColumn<SteelLineRow>[]>(() => [
    ...systemColumns<SteelLineRow>(),
    { key: 'dCode', label: 'DCode', sortable: true, filterable: true, render: row => <span className="font-mono font-black text-cyan-600">{row.dCode}</span> },
    { key: 'supplierSerialNo', label: 'Tedarikçi Serisi', sortable: true, filterable: true, render: row => row.supplierSerialNo },
    { key: 'secondarySerialNo', label: 'İkinci Seri', sortable: true, filterable: true, render: row => row.secondarySerialNo || '—' },
    { key: 'stockCode', label: 'Stok Kodu', sortable: true, filterable: true, render: row => row.stockCode },
    { key: 'stockName', label: 'Stok Adı', sortable: true, filterable: true, render: row => row.stockName },
    { key: 'importReferenceNo', label: 'Excel / İçe Aktarım', sortable: true, filterable: true, render: row => row.importReferenceNo },
    { key: 'netsisOrderNo', label: 'Netsis Sipariş', sortable: true, filterable: true, render: row => row.netsisOrderNo || '—' },
    { key: 'materialGrade', label: 'Kalite', sortable: true, filterable: true, render: row => row.materialGrade || '—' },
    { key: 'combinedSize', label: 'Ebat', sortable: true, filterable: true, render: row => row.combinedSize || '—' },
    { key: 'heatNumber', label: 'Döküm No', sortable: true, filterable: true, render: row => row.heatNumber || '—' },
    { key: 'certificateNumber', label: 'Sertifika', sortable: true, filterable: true, render: row => row.certificateNumber || '—' },
    { key: 'expectedQuantity', label: 'Beklenen', sortable: true, filterable: true, render: row => `${formatProjectNumber(row.expectedQuantity)} ${row.unitCode}` },
    { key: 'arrivedQuantity', label: 'Gelen', sortable: true, filterable: true, render: row => formatProjectNumber(row.arrivedQuantity) },
    { key: 'approvedQuantity', label: 'Onaylanan', sortable: true, filterable: true, render: row => formatProjectNumber(row.approvedQuantity) },
    { key: 'rejectedQuantity', label: 'Reddedilen', sortable: true, filterable: true, render: row => formatProjectNumber(row.rejectedQuantity) },
    { key: 'arrivalStatus', label: 'Varış', sortable: true, filterable: true, render: row => statusLabel(row.arrivalStatus) },
    { key: 'inspectionStatus', label: 'Kontrol', sortable: true, filterable: true, render: row => statusLabel(row.inspectionStatus) },
    { key: 'conversionStatus', label: 'Mal Kabul', sortable: true, filterable: true, render: row => statusLabel(row.conversionStatus) },
    { key: 'putawayStatus', label: 'Yerleştirme', sortable: true, filterable: true, render: row => statusLabel(row.putawayStatus) },
    { key: 'goodsReceiptNo', label: 'Mal Kabul No', sortable: true, filterable: true, render: row => row.goodsReceiptNo || '—' },
  ], []);

  const cards: Array<{ key: ReportView; label: string; icon: typeof BarChart3; tone: string }> = [
    { key: 'all', label: 'Toplam Levha', icon: BarChart3, tone: 'text-violet-500 bg-violet-500/10' },
    { key: 'expected', label: 'Varış Bekleyen', icon: ClipboardClock, tone: 'text-amber-500 bg-amber-500/10' },
    { key: 'inspection', label: 'Kontrol Bekleyen', icon: ShieldAlert, tone: 'text-orange-500 bg-orange-500/10' },
    { key: 'receiptReady', label: 'Mal Kabule Hazır', icon: PackageCheck, tone: 'text-cyan-500 bg-cyan-500/10' },
    { key: 'putaway', label: 'Yerleştirme Bekleyen', icon: Warehouse, tone: 'text-emerald-500 bg-emerald-500/10' },
    { key: 'rejected', label: 'Reddedilen', icon: ShieldAlert, tone: 'text-rose-500 bg-rose-500/10' },
  ];

  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-500">Mal Kabul · SAC İşlemleri</p>
      <h1 className="mt-1 text-2xl font-black sm:text-3xl">SAC Operasyon Raporları</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-500">Canlı operasyon verisini sunucu taraflı arama, filtreleme ve sıralama ile izleyin. Kartlar rapor kapsamını değiştirir.</p>
    </header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map(({ key, label, icon: Icon, tone }) => <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`min-h-28 rounded-2xl border p-4 text-left transition ${view === key ? 'border-cyan-500 ring-2 ring-cyan-500/15' : 'border-[var(--wms-app-border)] hover:border-cyan-500/40'}`}>
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4"/></span>
        <strong className="mt-3 block text-2xl">{summary.isLoading ? '…' : summary.data?.[key] ?? 0}</strong>
        <span className="text-xs text-slate-500">{label}</span>
      </button>)}
    </div>

    {summary.isError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600">Rapor özetleri alınamadı; detay listesi üzerinden çalışmaya devam edebilirsiniz.</div>}

    <AdvancedDataGrid key={view} pageKey={`steel-reports-${view}`} title={viewMeta[view].title} description={viewMeta[view].description} columns={columns} fetchPage={fetchPage}/>
  </section>;
}

function summaryRequest(filters: GridFilter[]): GridRequest {
  return { pageNumber: 1, pageSize: 10, search: null, sortBy: 'id', sortDirection: 'desc', filterLogic: 'and', filters };
}

function statusLabel(value: string): string {
  return ({
    Expected: 'Bekleniyor', Arrived: 'Geldi', Missing: 'Eksik',
    Pending: 'Bekliyor', Inspected: 'İncelendi', Approved: 'Onaylandı',
    PartiallyApproved: 'Kısmi Onay', Rejected: 'Reddedildi',
    NotCreated: 'Oluşmadı', Created: 'Oluştu', Placed: 'Yerleştirildi',
  } as Record<string, string>)[value] ?? value;
}
