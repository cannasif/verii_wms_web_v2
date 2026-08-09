import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  AlertTriangle, Barcode, ChevronRight, List, Loader2, MapPin, PackageCheck, Play, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDropdownInfiniteSearch } from '@/hooks/useDropdownInfiniteSearch';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { StockOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionTransferExecution,
  type ProductionTransferPickingRow,
  type ProductionTransferPickingTable,
  type ProductionTransferRouteRefreshCandidate,
  type ProductionTransferRouteRefreshCandidates,
  type ResolveProductionTransferBarcodeResult,
} from '../api';
import { ProductionTaskStartShortageDialog } from './ProductionTaskStartShortageDialog';
import { useProductionTaskStart } from '../hooks/useProductionTaskStart';

type PickTab = 'all' | 'completed';

type TableSection =
  | { type: 'flat'; row: ProductionTransferPickingRow }
  | {
      type: 'serial-group';
      stockId: number;
      stockCode: string;
      stockName?: string;
      rows: ProductionTransferPickingRow[];
    };

const STOCK_LIST_SEARCH_DEBOUNCE_MS = 400;
const STOCK_LIST_PAGE_SIZE = 50;
const STOCK_LIST_MIN_SEARCH_CHARS = 2;
const STOCK_LIST_SCROLL_THRESHOLD = 0.82;

const TABLE_HEAD_CELL = 'border border-[var(--wms-app-border)] p-3';
const TABLE_CELL = 'border border-[var(--wms-app-border)] p-3';
const LOCATION_HEAD_CELL = cn(TABLE_HEAD_CELL, 'text-center');
const LOCATION_CELL = cn(TABLE_CELL, 'text-center');
const HIGHLIGHT_ROW_CLASS = 'bg-amber-500/15 ring-2 ring-inset ring-amber-500';

function parseTransferLineNoFromError(message: string): number | undefined {
  const match = message.match(/(\d+)\. satır/i);
  if (!match) return undefined;
  const lineNo = Number(match[1]);
  return Number.isFinite(lineNo) && lineNo > 0 ? lineNo : undefined;
}

function summarizeSerialLineNos(rows: ProductionTransferPickingRow[]): string {
  const lineNos = [...new Set(rows.map((row) => row.lineNo))].sort((left, right) => left - right);
  if (lineNos.length === 0) return '—';
  if (lineNos.length === 1) return String(lineNos[0]);
  return lineNos.join(', ');
}

function isLineHighlighted(lineNo: number, highlightedLineNo?: number): boolean {
  return highlightedLineNo === lineNo;
}

function isSerialRow(row: ProductionTransferPickingRow): boolean {
  return Boolean(row.serialNo?.trim());
}

function pickingRowSelectionKey(row: ProductionTransferPickingRow): string {
  if (isSerialRow(row)) {
    return `${row.taskLineId}:${row.serialNo!.trim().toUpperCase()}`;
  }
  return String(row.taskLineId);
}

function serialRouteCandidateKey(candidate: ProductionTransferRouteRefreshCandidate): string {
  return `${candidate.locationId}:${candidate.serialNo?.trim().toUpperCase() ?? ''}`;
}

function isRowCompleted(row: ProductionTransferPickingRow): boolean {
  return row.remainingQuantity <= 0;
}

function isSerialGroupCompleted(rows: ProductionTransferPickingRow[]): boolean {
  return rows.length > 0 && rows.every(isRowCompleted);
}

function compareLineNoThenSerial(left: ProductionTransferPickingRow, right: ProductionTransferPickingRow): number {
  if (left.lineNo !== right.lineNo) return left.lineNo - right.lineNo;
  return (left.serialNo ?? '').localeCompare(right.serialNo ?? '', 'tr', { sensitivity: 'base' });
}

function compareDisplayOrder(
  left: ProductionTransferPickingRow,
  right: ProductionTransferPickingRow,
  displayOrder: Map<string, number>,
): number {
  const leftOrder = displayOrder.get(pickingRowSelectionKey(left)) ?? 0;
  const rightOrder = displayOrder.get(pickingRowSelectionKey(right)) ?? 0;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return compareLineNoThenSerial(left, right);
}

function sortRowsWithCompletedAtBottom(
  rows: ProductionTransferPickingRow[],
  displayOrder: Map<string, number>,
): ProductionTransferPickingRow[] {
  return [...rows].sort((left, right) => {
    const leftDone = isRowCompleted(left);
    const rightDone = isRowCompleted(right);
    if (leftDone !== rightDone) return leftDone ? 1 : -1;
    return compareDisplayOrder(left, right, displayOrder);
  });
}

function sortSerialGroupRows(
  rows: ProductionTransferPickingRow[],
  tab: PickTab,
  displayOrder: Map<string, number>,
): ProductionTransferPickingRow[] {
  const filtered = tab === 'completed'
    ? rows.filter(isRowCompleted)
    : rows;

  if (tab === 'all') {
    return sortRowsWithCompletedAtBottom(filtered, displayOrder);
  }

  return [...filtered].sort((left, right) => compareDisplayOrder(left, right, displayOrder));
}

function sectionDisplayOrder(section: TableSection, displayOrder: Map<string, number>): number {
  if (section.type === 'flat') return displayOrder.get(pickingRowSelectionKey(section.row)) ?? section.row.lineNo;
  return Math.min(...section.rows.map((row) => displayOrder.get(pickingRowSelectionKey(row)) ?? row.lineNo));
}

function isSectionCompleted(section: TableSection): boolean {
  if (section.type === 'flat') return isRowCompleted(section.row);
  return isSerialGroupCompleted(section.rows);
}

function compareTableSections(
  left: TableSection,
  right: TableSection,
  tab: PickTab,
  displayOrder: Map<string, number>,
): number {
  if (tab === 'all') {
    const leftCompleted = isSectionCompleted(left);
    const rightCompleted = isSectionCompleted(right);
    if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1;
  }
  return sectionDisplayOrder(left, displayOrder) - sectionDisplayOrder(right, displayOrder);
}

function buildTableSections(rows: ProductionTransferPickingRow[], tab: PickTab): TableSection[] {
  const displayOrder = new Map(rows.map((row, index) => [pickingRowSelectionKey(row), index]));
  const serialRows = rows.filter(isSerialRow);
  const nonSerialRows = rows.filter((row) => !isSerialRow(row));

  const visibleNonSerial = tab === 'completed'
    ? nonSerialRows.filter(isRowCompleted)
    : nonSerialRows;
  const flatSections: TableSection[] = (tab === 'all'
    ? sortRowsWithCompletedAtBottom(visibleNonSerial, displayOrder)
    : [...visibleNonSerial].sort((left, right) => compareDisplayOrder(left, right, displayOrder))
  ).map((row) => ({ type: 'flat' as const, row } satisfies TableSection));

  const serialGroups = new Map<number, ProductionTransferPickingRow[]>();
  for (const row of serialRows) {
    const bucket = serialGroups.get(row.stockId) ?? [];
    bucket.push(row);
    serialGroups.set(row.stockId, bucket);
  }

  const serialSections: TableSection[] = [...serialGroups.entries()]
    .map(([stockId, groupRows]) => ({
      type: 'serial-group' as const,
      stockId,
      stockCode: groupRows[0]?.stockCode ?? '',
      stockName: groupRows[0]?.stockName,
      rows: sortSerialGroupRows(groupRows, tab, displayOrder),
    }))
    .filter((group) => group.rows.length > 0);

  return [...serialSections, ...flatSections].sort((left, right) => compareTableSections(left, right, tab, displayOrder));
}

function sanitizePositiveIntegerInput(rawValue: string): string {
  const match = rawValue.trim().replace(',', '.').match(/^\d+/);
  if (!match) return '';
  return match[0].replace(/^0+(?=\d)/, '');
}

function parsePositiveIntegerInput(value: string): number | null {
  const sanitized = sanitizePositiveIntegerInput(value);
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampPositiveIntegerInput(rawValue: string, maxQuantity: number): string {
  const sanitized = sanitizePositiveIntegerInput(rawValue);
  if (!sanitized) return '';
  const parsed = Number(sanitized);
  const maxInt = Math.max(0, Math.floor(maxQuantity));
  if (parsed > maxInt) return String(maxInt);
  return sanitized;
}

function parseRouteQuantityInput(value: string): number | null {
  return parsePositiveIntegerInput(value);
}

function formatRouteQuantityValue(value: number): string {
  return String(Math.max(0, Math.floor(value)));
}

function maxRouteQuantityForLocation(
  locationId: number,
  candidates: ProductionTransferRouteRefreshCandidate[],
  quantities: Record<number, string>,
  remainingQuantity: number,
): number {
  const candidate = candidates.find((row) => row.locationId === locationId);
  if (!candidate) return 0;
  const otherTotal = candidates
    .filter((row) => row.locationId !== locationId)
    .reduce((sum, row) => sum + (parseRouteQuantityInput(quantities[row.locationId] ?? '') ?? 0), 0);
  return Math.max(0, Math.floor(Math.min(candidate.availableQuantity, remainingQuantity - otherTotal)));
}

function clampRouteQuantityInput(
  locationId: number,
  rawValue: string,
  candidates: ProductionTransferRouteRefreshCandidate[],
  quantities: Record<number, string>,
  remainingQuantity: number,
): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  const sanitized = sanitizePositiveIntegerInput(trimmed);
  if (!sanitized) return '';

  const parsed = Number(sanitized);
  if (parsed <= 0) return sanitized;

  const maxQuantity = maxRouteQuantityForLocation(locationId, candidates, quantities, remainingQuantity);
  if (parsed > maxQuantity) return formatRouteQuantityValue(maxQuantity);
  return sanitized;
}

interface BarcodeStep1 {
  barcode: string;
  match: ResolveProductionTransferBarcodeResult;
  quantity: string;
}

interface Props {
  transferId: number;
  execution: ProductionTransferExecution;
  onExecutionChange: (execution: ProductionTransferExecution) => void;
}

export function ProductionTransferPickingSection({ transferId, execution, onExecutionChange }: Props) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const [table, setTable] = useState<ProductionTransferPickingTable>();
  const [board, setBoard] = useState<ProductionTaskBoard>();
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<PickTab>('all');
  const [selectedRowKey, setSelectedRowKey] = useState<string>();
  const [barcode, setBarcode] = useState('');
  const [stockListOpen, setStockListOpen] = useState(false);
  const [stockListSearch, setStockListSearch] = useState('');
  const [debouncedStockListSearch, setDebouncedStockListSearch] = useState('');
  const [step1, setStep1] = useState<BarcodeStep1 | null>(null);
  const [step2, setStep2] = useState<BarcodeStep1 | null>(null);
  const [routeDialog, setRouteDialog] = useState<ProductionTransferRouteRefreshCandidates | null>(null);
  const [routeQuantities, setRouteQuantities] = useState<Record<number, string>>({});
  const [selectedSerialCandidateKey, setSelectedSerialCandidateKey] = useState<string>();
  const [highlightedLineNo, setHighlightedLineNo] = useState<number>();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const step2SubmitRef = useRef<HTMLButtonElement>(null);
  const pickDialogOpen = Boolean(step1 || step2);

  useEffect(() => {
    if (!step2) return;
    barcodeRef.current?.blur();
    window.requestAnimationFrame(() => step2SubmitRef.current?.focus());
  }, [step2]);

  const focusPickingLineError = useCallback((message: string) => {
    const lineNo = parseTransferLineNoFromError(message);
    if (!lineNo) return;
    setTab('all');
    setHighlightedLineNo(lineNo);
  }, []);

  const load = useCallback(async () => {
    try {
      const [nextTable, nextBoard] = await Promise.all([
        productionTransferApi.pickingTable(transferId),
        productionTransferApi.taskBoard(transferId),
      ]);
      setTable(nextTable);
      setBoard(nextBoard);
      setLoadError(undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Toplama tablosu yüklenemedi.');
    }
  }, [transferId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!stockListOpen) {
      setStockListSearch('');
      setDebouncedStockListSearch('');
      return;
    }
    const timer = window.setTimeout(
      () => setDebouncedStockListSearch(stockListSearch.trim()),
      STOCK_LIST_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stockListOpen, stockListSearch]);

  const stockListQuery = useDropdownInfiniteSearch<StockOption>({
    queryKey: ['production-picking-stock-list', branchCode],
    searchTerm: debouncedStockListSearch,
    enabled: stockListOpen,
    minSearchLength: STOCK_LIST_MIN_SEARCH_CHARS,
    pageSize: STOCK_LIST_PAGE_SIZE,
    sortBy: 'erpStockCode',
    sortDirection: 'asc',
    searchFields: ['erpStockCode', 'stockName'],
    fetchPage: (request) => warehouseTransferApi.stocks(request, branchCode),
  });

  const stockListRows = stockListQuery.items;
  const stockListTotalCount = stockListQuery.data?.pages[0]?.totalCount ?? stockListRows.length;
  const isStockListThresholdInput = stockListSearch.trim().length > 0
    && stockListSearch.trim().length < STOCK_LIST_MIN_SEARCH_CHARS;

  const handleStockListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!stockListQuery.hasNextPage || stockListQuery.isFetchingNextPage) return;
    const target = event.currentTarget;
    if (target.scrollHeight <= 0) return;
    const progress = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (progress >= STOCK_LIST_SCROLL_THRESHOLD) {
      void stockListQuery.fetchNextPage();
    }
  }, [stockListQuery]);
  useEffect(() => {
    if (!table?.isLocked) requestAnimationFrame(() => barcodeRef.current?.focus());
  }, [table?.isLocked, table?.rows.length]);

  const workerPickTask = useMemo(() => {
    if (!board) return undefined;
    const tasks = board.tasks.filter((task) =>
      task.taskType === 'Pick' && !['Completed', 'Cancelled'].includes(task.status));
    return tasks.find((task) => task.assignments.some((a) => a.userId === currentUserId));
  }, [board, currentUserId]);

  const runBoardAction = useCallback(async (action: () => Promise<ProductionTaskBoard>) => {
    setBusy(true);
    try {
      setBoard(await action());
      await load();
      const nextExecution = await productionTransferApi.execution(transferId);
      onExecutionChange(nextExecution);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'İşlem başarısız.';
      focusPickingLineError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [focusPickingLineError, load, onExecutionChange, transferId]);

  const {
    shortageDialog,
    checkingTaskId,
    requestStart,
    confirmPartialStart,
    cancelPartialStart,
  } = useProductionTaskStart({ transferId, run: runBoardAction, onError: focusPickingLineError });

  const tableSections = useMemo(() => {
    if (!table) return [];
    return buildTableSections(table.rows, tab);
  }, [tab, table]);

  useEffect(() => {
    if (!highlightedLineNo) return;
    const timer = window.setTimeout(() => {
      document.querySelector(`tr[data-picking-line-no="${highlightedLineNo}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    const clearTimer = window.setTimeout(() => setHighlightedLineNo(undefined), 8000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedLineNo, tableSections]);

  const selectedCount = selectedRowKey ? 1 : 0;
  const selectedRow = table?.rows.find((row) => pickingRowSelectionKey(row) === selectedRowKey);

  const toggleRowSelection = useCallback((row: ProductionTransferPickingRow) => {
    const key = pickingRowSelectionKey(row);
    setSelectedRowKey((current) => (current === key ? undefined : key));
  }, []);
  const hasShortage = (execution.shortageQuantity ?? 0) > 0;
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [completePickingDialogOpen, setCompletePickingDialogOpen] = useState(false);

  const resolveBarcode = async (rawBarcode?: string) => {
    const scanned = (rawBarcode ?? barcode).trim();
    if (!scanned || table?.isLocked) return;
    setBusy(true);
    try {
      const match = await productionTransferApi.resolveBarcode(transferId, scanned);
      if (match.isSerial) {
        setStep2({ barcode: scanned, match, quantity: String(match.defaultQuantity) });
        return;
      }
      setStep1({
        barcode: scanned,
        match,
        quantity: String(Math.floor(match.defaultQuantity)),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Barkod doğrulanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPick = async (payload: BarcodeStep1) => {
    if (busy) return;
    const quantity = payload.match.isSerial ? null : parsePositiveIntegerInput(payload.quantity);
    if (!payload.match.isSerial && quantity === null) {
      toast.error('Geçerli bir tam sayı miktar girin.');
      return;
    }
    setBusy(true);
    try {
      const result = await productionTransferApi.scanPick(
        transferId,
        payload.match.taskLineId,
        payload.barcode,
        payload.match.isSerial ? undefined : quantity!,
        payload.match.sourceLocationId,
      );
      onExecutionChange(result.execution);
      await load();
      setBarcode('');
      setStep1(null);
      setStep2(null);
      toast.success(`${result.stockCode}: ${formatProjectNumber(result.acceptedQuantity)} toplandı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Toplama kaydedilemedi.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  };

  const openRouteRefresh = async () => {
    if (!selectedRow || table?.isLocked) return;
    setBusy(true);
    try {
      const candidates = await productionTransferApi.routeRefreshCandidates(
        transferId,
        selectedRow.taskLineId,
        selectedRow.serialNo,
      );
      setRouteDialog(candidates);
      setRouteQuantities({});
      setSelectedSerialCandidateKey(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rota adayları alınamadı.');
    } finally {
      setBusy(false);
    }
  };

  const updateRouteQuantity = useCallback((locationId: number, rawValue: string) => {
    if (!routeDialog) return;
    setRouteQuantities((current) => ({
      ...current,
      [locationId]: clampRouteQuantityInput(
        locationId,
        rawValue,
        routeDialog.candidates,
        current,
        routeDialog.remainingQuantity,
      ),
    }));
  }, [routeDialog]);

  const applyRouteSplit = async () => {
    if (!routeDialog) return;

    if (routeDialog.isSerial) {
      const selected = routeDialog.candidates.find((row) => serialRouteCandidateKey(row) === selectedSerialCandidateKey);
      if (!selected?.serialNo?.trim()) {
        toast.error('Yeni seri seçin.');
        return;
      }
      setBusy(true);
      try {
        const nextTable = await productionTransferApi.applyRouteSplit(
          transferId,
          routeDialog.taskLineId,
          [{ locationId: selected.locationId, quantity: 1, serialNo: selected.serialNo.trim() }],
          routeDialog.currentSerialNo,
        );
        setTable(nextTable);
        setRouteDialog(null);
        setSelectedRowKey(undefined);
        const nextExecution = await productionTransferApi.execution(transferId);
        onExecutionChange(nextExecution);
        toast.success('Seri rotası güncellendi.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Rota güncellenemedi.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const splits = routeDialog.candidates
      .map((row) => ({
        locationId: row.locationId,
        quantity: parsePositiveIntegerInput(routeQuantities[row.locationId] ?? '') ?? 0,
      }))
      .filter((row) => row.quantity > 0);
    const total = splits.reduce((sum, row) => sum + row.quantity, 0);
    if (total <= 0) {
      toast.error('En az bir raftan miktar girin.');
      return;
    }
    if (total > routeDialog.remainingQuantity + 0.000001) {
      toast.error('Toplam miktar kalan ihtiyaçtan fazla olamaz.');
      return;
    }
    setBusy(true);
    try {
      const nextTable = await productionTransferApi.applyRouteSplit(transferId, routeDialog.taskLineId, splits);
      setTable(nextTable);
      setRouteDialog(null);
      setSelectedRowKey(undefined);
      const nextExecution = await productionTransferApi.execution(transferId);
      onExecutionChange(nextExecution);
      toast.success('Toplama rotası güncellendi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rota güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const completePicking = async () => {
    setBusy(true);
    try {
      const result = await productionTransferApi.completePicking(
        transferId,
        hasShortage ? partialConfirmed : false,
      );
      onExecutionChange(result);
      setCompletePickingDialogOpen(false);
      toast.success('Toplama tamamlandı. Malzeme teslim onayı bekliyor.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Toplama tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="wms-ops-form-card p-5">
        <p className="font-bold text-red-500">{loadError}</p>
        <button type="button" className="mt-3 text-sm font-bold text-[var(--wms-brand-primary)]" onClick={() => void load()}>
          Tekrar dene
        </button>
      </section>
    );
  }

  if (!table) {
    return <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-[var(--wms-brand-primary)]" /></div>;
  }

  const canStart = Boolean(
    workerPickTask
    && workerPickTask.assignments.some((a) => a.userId === currentUserId)
    && !['InProgress', 'PartiallyCompleted', 'Completed', 'Cancelled'].includes(workerPickTask.status),
  );

  return (
    <section className="space-y-4">
      <div className="wms-ops-form-card p-5">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--wms-app-text-muted)]">Reçete / iş emri</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-black">{table.externalReferenceNo || execution.documentNo}</h2>
              <PickingRowTabs value={tab} onChange={setTab} />
            </div>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              {table.pickTaskNo}
              {' · '}
              {execution.sourceWarehouseCode} · {execution.sourceWarehouseName}
              {' · '}
              {table.isLocked ? 'Reçete' : 'Toplama aktif'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {table.isLocked && canStart ? (
              <button
                type="button"
                disabled={busy || checkingTaskId === workerPickTask?.taskId}
                onClick={() => workerPickTask && void requestStart(workerPickTask.taskId, workerPickTask.taskNo)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
              >
                {checkingTaskId === workerPickTask?.taskId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Bu işi yapıyorum
              </button>
            ) : !table.isLocked ? (
              <div className="flex min-w-[280px] flex-1 items-center gap-2 xl:flex-none">
                <button
                  type="button"
                  disabled={busy || selectedCount !== 1 || !selectedRow || selectedRow.remainingQuantity <= 0}
                  onClick={() => void openRouteRefresh()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-500 disabled:opacity-40"
                >
                  <RefreshCw className="size-4" />Rotayı güncelle
                </button>
                <div className="relative flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--wms-app-border)] px-3 py-2 text-xs font-bold text-[var(--wms-app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                    title="Stok listesi"
                    onClick={() => setStockListOpen(true)}
                  >
                    <List className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Stok listesi</span>
                  </button>
                  <OpsQrCaptureField
                    className="min-w-0 flex-1"
                    inputRef={barcodeRef}
                    value={barcode}
                    onChange={setBarcode}
                    onCommit={(code) => void resolveBarcode(code)}
                    autoFocus={!table.isLocked}
                    disabled={busy || pickDialogOpen}
                    placeholder="Barkod veya StokKodu**SeriNo"
                    cameraTitle="Barkod okut"
                    cameraDescription="Barkod veya QR kodu kamera karesine getirin."
                  />
                  <OpsActionButton variant="primary" loading={busy} disabled={!barcode.trim() || pickDialogOpen} onClick={() => void resolveBarcode()}>
                    <Barcode className="size-4" />Onayla
                  </OpsActionButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
          <table className={cn('w-full border-collapse text-sm', table.isLocked ? 'min-w-[640px]' : 'min-w-[920px]')}>
            <thead className="bg-black/5 text-left text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
              <tr>
                <th className={cn(TABLE_HEAD_CELL, 'w-10')} />
                <th className={cn(TABLE_HEAD_CELL, 'w-14 text-right')}>No</th>
                {!table.isLocked && <th className={LOCATION_HEAD_CELL}>Raf</th>}
                <th className={TABLE_HEAD_CELL}>Stok</th>
                {!table.isLocked && <th className={TABLE_HEAD_CELL}>Seri</th>}
                <th className={cn(TABLE_HEAD_CELL, 'text-right')}>İstenen</th>
                <th className={cn(TABLE_HEAD_CELL, 'text-right')}>Kalan</th>
                <th className={cn(TABLE_HEAD_CELL, 'text-right')}>Toplanan</th>
              </tr>
            </thead>
            <tbody>
              {tableSections.map((section) => {
                if (section.type === 'flat') {
                  return (
                    <PickingRow
                      key={`flat:${section.row.taskLineId}:${section.row.sourceLocationId ?? 'x'}:${section.row.serialNo ?? ''}`}
                      row={section.row}
                      locked={table.isLocked}
                      showRouteColumns={!table.isLocked}
                      selected={selectedRowKey === pickingRowSelectionKey(section.row)}
                      highlighted={isLineHighlighted(section.row.lineNo, highlightedLineNo)}
                      onSelect={toggleRowSelection}
                    />
                  );
                }

                return (
                  <SerialStockGroup
                    key={`serial-group:${section.stockId}`}
                    stockId={section.stockId}
                    stockCode={section.stockCode}
                    stockName={section.stockName}
                    rows={section.rows}
                    locked={table.isLocked}
                    showRouteColumns={!table.isLocked}
                    highlightedLineNo={highlightedLineNo}
                    selectedRowKey={selectedRowKey}
                    onSelect={toggleRowSelection}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {table.canCompletePicking && !table.isLocked && (
          <div className="mt-5 flex justify-end">
            <OpsActionButton
              variant="primary"
              onClick={() => {
                if (hasShortage) setCompletePickingDialogOpen(true);
                else void completePicking();
              }}
            >
              <PackageCheck className="size-4" />
              Toplamayı bitir
            </OpsActionButton>
          </div>
        )}
      </div>

      {stockListOpen && (
        <ResponsiveDialog
          onClose={() => setStockListOpen(false)}
          title="Stok listesi"
          description={`Toplam ${stockListTotalCount.toLocaleString('tr-TR')} stok kalemi`}
          className="!max-w-2xl"
        >
          <div className="space-y-4">
            <input
              className="input w-full"
              value={stockListSearch}
              onChange={(event) => setStockListSearch(event.target.value)}
              placeholder="Stok kodu veya adına göre ara (en az 2 karakter)..."
              aria-label="Stok listesinde ara"
            />
            <div
              onScroll={handleStockListScroll}
              className="max-h-[min(28rem,60dvh)] overflow-auto"
            >
              {stockListQuery.isLoading ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
                  <Loader2 className="size-6 animate-spin text-[var(--wms-brand-primary)]" />
                </div>
              ) : stockListQuery.isError ? (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center text-sm font-semibold text-red-500">
                  Stok listesi yüklenemedi.
                </p>
              ) : isStockListThresholdInput ? (
                <p className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 text-center text-sm text-[var(--wms-app-text-muted)]">
                  Arama için en az {STOCK_LIST_MIN_SEARCH_CHARS} karakter girin.
                </p>
              ) : (
                <div className="rounded-2xl bg-[var(--wms-app-border)] p-px shadow-sm">
                  <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-[var(--wms-app-panel)]">
                    <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                          <th
                            className={cn(
                              'w-[140px] bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-start',
                              'border-b border-e border-[var(--wms-app-border)]',
                            )}
                          >
                            Stok kodu
                          </th>
                          <th
                            className={cn(
                              'bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-start',
                              'border-b border-[var(--wms-app-border)]',
                            )}
                          >
                            Stok adı
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockListRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="px-3 py-8 text-center text-sm text-[var(--wms-app-text-muted)]"
                            >
                              {debouncedStockListSearch ? 'Aramaya uygun stok bulunamadı.' : 'Stok kalemi bulunamadı.'}
                            </td>
                          </tr>
                        ) : stockListRows.map((row, rowIndex) => {
                          const isLast = rowIndex === stockListRows.length - 1;
                          const rowBorder = isLast ? '' : 'border-b border-[var(--wms-app-border)]';
                          return (
                            <tr
                              key={row.id}
                              className="transition-colors hover:bg-[var(--wms-brand-soft)]"
                            >
                              <td
                                className={cn(
                                  'border-e border-[var(--wms-app-border)] px-3 py-2.5 align-middle',
                                  rowBorder,
                                )}
                              >
                                <span className="font-mono text-xs font-semibold text-[var(--wms-brand-primary)]">
                                  {row.erpStockCode}
                                </span>
                              </td>
                              <td className={cn('px-3 py-2.5 align-middle', rowBorder)}>
                                <span className="line-clamp-2 text-sm font-medium text-[var(--wms-app-text)]">
                                  {row.stockName?.trim() || '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {stockListQuery.isFetchingNextPage && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="size-5 animate-spin text-[var(--wms-brand-primary)]" />
                </div>
              )}
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {step1 && (
        <ResponsiveDialog
          onClose={() => setStep1(null)}
          title="Toplama miktarı"
          description="Miktarı düşürerek kısmi toplama yapabilirsiniz."
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const qty = parsePositiveIntegerInput(step1.quantity);
              const maxQty = Math.floor(step1.match.remainingQuantity);
              if (qty === null || qty > maxQty) {
                toast.error('Geçerli bir tam sayı miktar girin.');
                return;
              }
              setStep2({ ...step1, quantity: String(qty) });
            }}
          >
            <PickSummary match={step1.match} />
            <label className="mt-4 block text-xs font-bold">Miktar</label>
            <input
              className="input mt-1 w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              value={step1.quantity}
              onChange={(event) => setStep1({
                ...step1,
                quantity: clampPositiveIntegerInput(event.target.value, step1.match.remainingQuantity),
              })}
              onFocus={(event) => event.currentTarget.select()}
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={() => setStep1(null)}>İptal</button>
              <OpsActionButton type="submit" variant="primary" loading={busy}>
                Devam
              </OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {step2 && (
        <ResponsiveDialog
          onClose={() => (step2.match.isSerial ? setStep2(null) : setStep1(step2))}
          title="Toplamayı onayla"
          description="Onayladığınızda stok hareketi kaydedilir."
          showCloseButton={false}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              void confirmPick(step2);
            }}
          >
            <PickSummary match={step2.match} quantity={step2.match.isSerial ? step2.match.defaultQuantity : Number(step2.quantity.replace(',', '.'))} />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                onClick={() => (step2.match.isSerial ? setStep2(null) : setStep1(step2))}
              >
                İptal
              </button>
              <OpsActionButton ref={step2SubmitRef} type="submit" variant="primary" loading={busy}>Onayla</OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {completePickingDialogOpen && (
        <ResponsiveDialog
          onClose={() => setCompletePickingDialogOpen(false)}
          title="Toplamayı bitir"
          description="Onayladığınızda transfer teslim beklemeye alınır."
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              Toplanan: {formatProjectNumber(table.pickedQuantity)} / {formatProjectNumber(table.requestedQuantity)}
              {hasShortage ? ` · Eksik: ${formatProjectNumber(table.shortageQuantity)}` : ''}
            </p>
            {hasShortage && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={partialConfirmed}
                    onChange={(event) => setPartialConfirmed(event.target.checked)}
                    className="mt-1"
                  />
                  Eksik toplamayı bilinçli olarak teslim aşamasına taşıyorum.
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                onClick={() => setCompletePickingDialogOpen(false)}
              >
                İptal
              </button>
              <OpsActionButton
                variant="primary"
                loading={busy}
                disabled={hasShortage && !partialConfirmed}
                onClick={() => void completePicking()}
              >
                <PackageCheck className="size-4" />
                Toplamayı bitir ve teslim beklemeye al
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {routeDialog && (
        <ResponsiveDialog
          onClose={() => setRouteDialog(null)}
          title="Rotayı güncelle"
          description={
            routeDialog.isSerial
              ? `Mevcut seri: ${routeDialog.currentSerialNo || '—'} · Listede olmayan alternatif serilerden birini seçin.`
              : `Kalan miktar: ${formatProjectNumber(routeDialog.remainingQuantity)}`
          }
          className="!max-w-2xl"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void applyRouteSplit();
            }}
          >
            <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
              {routeDialog.candidates.length === 0 ? (
                <p className="p-6 text-center text-sm font-semibold text-[var(--wms-app-text-muted)]">
                  Bu stoktan başka rafta yoktur
                </p>
              ) : (
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-black/5 text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
                    <tr>
                      {routeDialog.isSerial && <th className="p-3 text-left">Seç</th>}
                      <th className="p-3 text-left">Raf</th>
                      {routeDialog.isSerial && <th className="p-3 text-left">Seri</th>}
                      <th className="p-3 text-right">Mevcut</th>
                      {!routeDialog.isSerial && <th className="p-3 text-right">Miktar</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {routeDialog.candidates.map((row) => (
                      <tr key={routeDialog.isSerial ? serialRouteCandidateKey(row) : row.locationId} className="border-t border-[var(--wms-app-border)]">
                        {routeDialog.isSerial && (
                          <td className="p-3">
                            <input
                              type="radio"
                              name="serial-route-candidate"
                              checked={selectedSerialCandidateKey === serialRouteCandidateKey(row)}
                              onChange={() => setSelectedSerialCandidateKey(serialRouteCandidateKey(row))}
                            />
                          </td>
                        )}
                        <td className="p-3 font-bold">{row.locationCode}</td>
                        {routeDialog.isSerial && <td className="p-3 font-semibold">{row.serialNo || '—'}</td>}
                        <td className="p-3 text-right">{formatProjectNumber(row.availableQuantity)}</td>
                        {!routeDialog.isSerial && (
                          <td className="p-3 text-right">
                            <input
                              className="input w-28 text-right"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={routeQuantities[row.locationId] ?? ''}
                              onChange={(event) => updateRouteQuantity(row.locationId, event.target.value)}
                              onFocus={(event) => event.currentTarget.select()}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={() => setRouteDialog(null)}>İptal</button>
              <OpsActionButton
                type="submit"
                variant="primary"
                loading={busy}
                disabled={routeDialog.candidates.length === 0}
              >
                Rotayı tamamla
              </OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {shortageDialog && (
        <ProductionTaskStartShortageDialog
          taskNo={shortageDialog.taskNo}
          shortages={shortageDialog.shortages}
          busy={busy}
          onConfirm={() => void confirmPartialStart()}
          onCancel={cancelPartialStart}
        />
      )}
    </section>
  );
}

function PickingRowTabs({
  value,
  onChange,
}: {
  value: PickTab;
  onChange: (value: PickTab) => void;
}) {
  const tabs = [
    { id: 'all' as const, label: 'Tümü' },
    { id: 'completed' as const, label: 'Toplananlar' },
  ];

  return (
    <div
      className="inline-grid w-[12.5rem] shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]"
      role="tablist"
      aria-label="Toplama sekmeleri"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'min-h-9 px-3 text-center text-xs font-bold tracking-wide transition',
            'border-r border-[var(--wms-app-border)] last:border-r-0',
            value === tab.id
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
              : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function isPickingRowWithoutBalance(row: ProductionTransferPickingRow): boolean {
  return row.remainingQuantity > 0 && !row.sourceLocationId;
}

function PickingLocationCell({
  row,
  serialDetail = false,
}: {
  row: ProductionTransferPickingRow;
  serialDetail?: boolean;
}) {
  if (isPickingRowWithoutBalance(row)) {
    return (
      <td className={cn(LOCATION_CELL, serialDetail && 'pl-6')}>
        <span
          className="inline-flex items-center justify-center gap-1.5"
          title="Depoda yeterli stok bakiyesi bulunamadı"
        >
          <AlertTriangle
            className="size-5 shrink-0 text-amber-500"
            aria-label="Stok bakiyesi yok"
          />
        </span>
      </td>
    );
  }

  return (
    <td className={cn(LOCATION_CELL, serialDetail && 'pl-6')}>
      {row.sourceLocationCode
        ? (
            <span className="inline-flex items-center justify-center gap-1 font-bold">
              <MapPin className="size-3.5" />
              {row.sourceLocationCode}
            </span>
          )
        : <span className="text-[var(--wms-app-text-muted)]">—</span>}
    </td>
  );
}

function PickingLocationSummaryCell({
  rows,
}: {
  rows: ProductionTransferPickingRow[];
}) {
  const remaining = rows.reduce((sum, row) => sum + row.remainingQuantity, 0);
  const locationLabel = summarizeSerialLocations(rows);
  const hasShortage = rows.some(isPickingRowWithoutBalance);

  if (hasShortage && locationLabel === '—' && remaining > 0) {
    return (
      <td className={LOCATION_CELL}>
        <span
          className="inline-flex items-center justify-center gap-1.5"
          title="Depoda yeterli stok bakiyesi bulunamadı"
        >
          <AlertTriangle
            className="size-5 shrink-0 text-amber-500"
            aria-label="Stok bakiyesi yok"
          />
        </span>
      </td>
    );
  }

  return (
    <td className={LOCATION_CELL}>
      {locationLabel !== '—'
        ? (
            <span className="inline-flex items-center justify-center gap-1 font-bold">
              <MapPin className="size-3.5" />
              {locationLabel}
            </span>
          )
        : <span className="text-[var(--wms-app-text-muted)]">—</span>}
    </td>
  );
}

function summarizeSerialLocations(rows: ProductionTransferPickingRow[]): string {
  const codes = [...new Set(rows.map((row) => row.sourceLocationCode).filter(Boolean))] as string[];
  if (codes.length === 0) return '—';
  if (codes.length === 1) return codes[0];
  return codes.join(', ');
}

function SerialStockGroup({
  stockId,
  stockCode,
  stockName,
  rows,
  locked,
  showRouteColumns,
  highlightedLineNo,
  selectedRowKey,
  onSelect,
}: {
  stockId: number;
  stockCode: string;
  stockName?: string;
  rows: ProductionTransferPickingRow[];
  locked: boolean;
  showRouteColumns: boolean;
  highlightedLineNo?: number;
  selectedRowKey?: string;
  onSelect: (row: ProductionTransferPickingRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totals = useMemo(() => ({
    requested: rows.reduce((sum, row) => sum + row.requestedQuantity, 0),
    remaining: rows.reduce((sum, row) => sum + row.remainingQuantity, 0),
    processed: rows.reduce((sum, row) => sum + row.processedQuantity, 0),
  }), [rows]);
  const done = totals.remaining <= 0;
  const lineNoLabel = summarizeSerialLineNos(rows);
  const headerHighlighted = rows.some((row) => isLineHighlighted(row.lineNo, highlightedLineNo));

  useEffect(() => {
    if (highlightedLineNo && rows.some((row) => row.lineNo === highlightedLineNo)) {
      setExpanded(true);
    }
  }, [highlightedLineNo, rows]);

  return (
    <>
      <tr
        data-picking-line-no={lineNoLabel.includes(',') ? undefined : lineNoLabel}
        className={cn('transition-colors', done && 'opacity-70', expanded && 'bg-black/[0.03] dark:bg-white/[0.03]', headerHighlighted && HIGHLIGHT_ROW_CLASS)}
      >
        <td className={TABLE_CELL}>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-transparent hover:border-[var(--wms-app-border)] hover:bg-black/5 dark:hover:bg-white/5"
            aria-expanded={expanded}
            aria-label={expanded ? 'Seri listesini gizle' : 'Seri listesini göster'}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        </td>
        <td className={cn(TABLE_CELL, 'text-right font-bold tabular-nums')}>{lineNoLabel}</td>
        {showRouteColumns && <PickingLocationSummaryCell rows={rows} />}
        <td className={TABLE_CELL}>
          <StockIdentityCell stockId={stockId} stockCode={stockCode} stockName={stockName} layout="stacked" />
        </td>
        {showRouteColumns && (
          <td className={TABLE_CELL}>
            <span className="text-[var(--wms-app-text-muted)]">—</span>
          </td>
        )}
        <td className={cn(TABLE_CELL, 'text-right font-semibold')}>{formatProjectNumber(totals.requested)}</td>
        <td className={cn(TABLE_CELL, 'text-right font-semibold')}>{formatProjectNumber(totals.remaining)}</td>
        <td className={cn(TABLE_CELL, 'text-right font-semibold text-emerald-600')}>{formatProjectNumber(totals.processed)}</td>
      </tr>
      {expanded && rows.map((row) => (
        <PickingRow
          key={`serial:${row.taskLineId}:${row.serialNo ?? ''}`}
          row={row}
          locked={locked}
          showRouteColumns={showRouteColumns}
          selected={selectedRowKey === pickingRowSelectionKey(row)}
          highlighted={isLineHighlighted(row.lineNo, highlightedLineNo)}
          onSelect={onSelect}
          serialDetail
        />
      ))}
    </>
  );
}

function PickingRow({
  row,
  locked,
  showRouteColumns,
  selected,
  highlighted = false,
  onSelect,
  serialDetail = false,
}: {
  row: ProductionTransferPickingRow;
  locked: boolean;
  showRouteColumns: boolean;
  selected: boolean;
  highlighted?: boolean;
  onSelect: (row: ProductionTransferPickingRow) => void;
  serialDetail?: boolean;
}) {
  const done = row.remainingQuantity <= 0;
  const canSelectForRoute = !locked && row.remainingQuantity > 0;
  return (
    <tr
      data-picking-line-no={row.lineNo}
      className={cn(done && 'opacity-70', serialDetail && 'bg-black/[0.02] dark:bg-white/[0.02]', highlighted && HIGHLIGHT_ROW_CLASS)}
    >
      <td className={TABLE_CELL}>
        <input
          type="checkbox"
          checked={selected}
          disabled={locked || !canSelectForRoute}
          onChange={() => canSelectForRoute && onSelect(row)}
        />
      </td>
      <td className={cn(TABLE_CELL, 'text-right font-bold tabular-nums')}>{row.lineNo}</td>
      {showRouteColumns && <PickingLocationCell row={row} serialDetail={serialDetail} />}
      <td className={TABLE_CELL}>
        <StockIdentityCell stockId={row.stockId} stockCode={row.stockCode} stockName={row.stockName} layout="stacked" />
      </td>
      {showRouteColumns && (
        <td className={cn(TABLE_CELL, serialDetail && 'font-semibold')}>{row.serialNo || '—'}</td>
      )}
      <td className={cn(TABLE_CELL, 'text-right')}>{formatProjectNumber(row.requestedQuantity)}</td>
      <td className={cn(TABLE_CELL, 'text-right')}>{formatProjectNumber(row.remainingQuantity)}</td>
      <td className={cn(TABLE_CELL, 'text-right text-emerald-600')}>{formatProjectNumber(row.processedQuantity)}</td>
    </tr>
  );
}

function PickSummary({
  match,
  quantity,
}: {
  match: ResolveProductionTransferBarcodeResult;
  quantity?: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div><span className="text-xs text-[var(--wms-app-text-muted)]">Raf</span><strong className="block">{match.sourceLocationCode || '—'}</strong></div>
        <div><span className="text-xs text-[var(--wms-app-text-muted)]">Miktar</span><strong className="block">{formatProjectNumber(quantity ?? match.defaultQuantity)}</strong></div>
        <div className="sm:col-span-2"><StockIdentityCell stockId={match.stockId} stockCode={match.stockCode} stockName={match.stockName} layout="stacked" /></div>
        {match.serialNo && <div><span className="text-xs text-[var(--wms-app-text-muted)]">Seri</span><strong className="block">{match.serialNo}</strong></div>}
      </div>
    </div>
  );
}
