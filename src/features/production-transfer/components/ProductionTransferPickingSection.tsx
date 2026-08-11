import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Barcode, ChevronRight, Layers, List, Loader2, MapPin, PackageCheck, Play, RefreshCw,
  RotateCcw, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { LocationOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionTransferExecution,
  type ProductionTransferPickingRow,
  type ProductionTransferPickingTable,
  type ProductionTransferRouteRefreshCandidate,
  type ProductionTransferRouteRefreshCandidates,
  type ResolveProductionTransferBarcodeResult,
  type ProductionTransferScanPickResult,
  type WarehouseTransferReturnSetting,
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
const PICKING_BARCODE_SEPARATOR = '**';

type PickingTableStockListItem = {
  stockId: number;
  stockCode: string;
  stockName?: string;
};

function buildPickingTableStockList(rows: ProductionTransferPickingRow[]): PickingTableStockListItem[] {
  const byStockId = new Map<number, PickingTableStockListItem>();
  for (const row of rows) {
    if (byStockId.has(row.stockId)) continue;
    byStockId.set(row.stockId, {
      stockId: row.stockId,
      stockCode: row.stockCode,
      stockName: row.stockName,
    });
  }
  return [...byStockId.values()].sort((left, right) =>
    left.stockCode.localeCompare(right.stockCode, 'tr', { sensitivity: 'base' }));
}

function filterPickingTableStockList(
  rows: PickingTableStockListItem[],
  searchTerm: string,
): PickingTableStockListItem[] {
  const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
  if (!query) return rows;
  return rows.filter((row) =>
    row.stockCode.toLocaleLowerCase('tr-TR').includes(query)
    || (row.stockName?.toLocaleLowerCase('tr-TR').includes(query) ?? false));
}

const TABLE_HEAD_CELL = 'border border-[var(--wms-app-border)] p-3';
const TABLE_CELL = 'border border-[var(--wms-app-border)] p-3';
const CHECKBOX_HEAD_CELL = cn(TABLE_HEAD_CELL, 'w-12 text-center');
const CHECKBOX_CELL = cn(TABLE_CELL, 'text-center');
const LOCATION_HEAD_CELL = cn(TABLE_HEAD_CELL, 'text-center');
const LOCATION_CELL = cn(TABLE_CELL, 'text-center');
const HIGHLIGHT_ROW_CLASS = 'bg-amber-500/15 ring-2 ring-inset ring-amber-500';

function locationOptionLabel(code?: string, name?: string): string {
  if (code && name) return `${code} · ${name}`;
  return code || name || 'Raf seçin';
}

function collectPlacableCompletedRows(sections: TableSection[]): ProductionTransferPickingRow[] {
  const rows: ProductionTransferPickingRow[] = [];
  for (const section of sections) {
    if (section.type === 'flat') rows.push(section.row);
    else rows.push(...section.rows);
  }
  return rows.filter((row) => isRowCompleted(row) && row.processedQuantity > 0);
}

function buildDefaultCompletedTargets(
  rows: ProductionTransferPickingRow[],
  excludedLocationIds: ReadonlySet<number>,
) {
  const targets: Record<string, string> = {};
  const labels: Record<string, string> = {};
  for (const row of rows) {
    const key = pickingRowSelectionKey(row);
    const defaultLocationId = row.sourceLocationId;
    if (!defaultLocationId || excludedLocationIds.has(defaultLocationId)) continue;
    targets[key] = String(defaultLocationId);
    labels[key] = locationOptionLabel(row.sourceLocationCode, undefined);
  }
  return { targets, labels };
}

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
  if (row.remainingQuantity <= 0 && row.processedQuantity > 0) {
    return `${row.taskLineId}:picked`;
  }
  if (row.processedQuantity <= 0 && row.remainingQuantity > 0) {
    return `${row.taskLineId}:open`;
  }
  return String(row.taskLineId);
}

function serialRouteCandidateKey(candidate: ProductionTransferRouteRefreshCandidate): string {
  return `${candidate.locationId}:${candidate.serialNo?.trim().toUpperCase() ?? ''}`;
}

function isRowCompleted(row: ProductionTransferPickingRow): boolean {
  return row.remainingQuantity <= 0;
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

function sortSerialGroupRows(
  rows: ProductionTransferPickingRow[],
  tab: PickTab,
  displayOrder: Map<string, number>,
): ProductionTransferPickingRow[] {
  const filtered = tab === 'completed'
    ? rows.filter(isRowCompleted)
    : rows.filter((row) => !isRowCompleted(row));

  return [...filtered].sort((left, right) => compareDisplayOrder(left, right, displayOrder));
}

function sectionDisplayOrder(section: TableSection, displayOrder: Map<string, number>): number {
  if (section.type === 'flat') return displayOrder.get(pickingRowSelectionKey(section.row)) ?? section.row.lineNo;
  return Math.min(...section.rows.map((row) => displayOrder.get(pickingRowSelectionKey(row)) ?? row.lineNo));
}

function compareTableSections(
  left: TableSection,
  right: TableSection,
  displayOrder: Map<string, number>,
): number {
  return sectionDisplayOrder(left, displayOrder) - sectionDisplayOrder(right, displayOrder);
}

function buildTableSections(rows: ProductionTransferPickingRow[], tab: PickTab): TableSection[] {
  const displayOrder = new Map(rows.map((row, index) => [pickingRowSelectionKey(row), index]));
  const serialRows = rows.filter(isSerialRow);
  const nonSerialRows = rows.filter((row) => !isSerialRow(row));
  const serialStockIds = new Set(serialRows.map((row) => row.stockId));
  const serialShortageRows = nonSerialRows.filter((row) => serialStockIds.has(row.stockId));
  const standaloneNonSerialRows = nonSerialRows.filter((row) => !serialStockIds.has(row.stockId));

  const visibleNonSerial = tab === 'completed'
    ? standaloneNonSerialRows.filter(isRowCompleted)
    : standaloneNonSerialRows.filter((row) => !isRowCompleted(row));
  const flatSections: TableSection[] = [...visibleNonSerial]
    .sort((left, right) => compareDisplayOrder(left, right, displayOrder))
    .map((row) => ({ type: 'flat' as const, row } satisfies TableSection));

  const serialGroups = new Map<number, ProductionTransferPickingRow[]>();
  for (const row of [...serialRows, ...serialShortageRows]) {
    const bucket = serialGroups.get(row.stockId) ?? [];
    bucket.push(row);
    serialGroups.set(row.stockId, bucket);
  }

  const serialSections: TableSection[] = [...serialGroups.entries()]
    .map(([stockId, groupRows]) => ({
      type: 'serial-group' as const,
      stockId,
      stockCode: groupRows.find((row) => row.stockCode)?.stockCode ?? '',
      stockName: groupRows.find((row) => row.stockName)?.stockName,
      rows: sortSerialGroupRows(groupRows, tab, displayOrder),
    }))
    .filter((group) => group.rows.length > 0);

  return [...serialSections, ...flatSections].sort((left, right) => compareTableSections(left, right, displayOrder));
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

function parsePickingBarcodeInput(raw: string): {
  stockCode: string | null;
  serialNo: string | null;
  isComposite: boolean;
} {
  const trimmed = raw.trim();
  const separatorIndex = trimmed.indexOf(PICKING_BARCODE_SEPARATOR);
  if (separatorIndex < 0) {
    return { stockCode: null, serialNo: null, isComposite: false };
  }
  const stockCode = trimmed.slice(0, separatorIndex).trim();
  const serialNo = trimmed.slice(separatorIndex + PICKING_BARCODE_SEPARATOR.length).trim();
  if (!stockCode || !serialNo) {
    return { stockCode: null, serialNo: null, isComposite: false };
  }
  return { stockCode, serialNo, isComposite: true };
}

function samePickingStockCode(left: string, right: string): boolean {
  return left.trim().toLocaleUpperCase('tr-TR') === right.trim().toLocaleUpperCase('tr-TR');
}

function isOpenPickableRow(row: ProductionTransferPickingRow): boolean {
  return row.remainingQuantity > 0 && row.canPick;
}

function findOpenSerialRowsByStockCode(
  rows: ProductionTransferPickingRow[],
  stockCode: string,
): ProductionTransferPickingRow[] {
  return rows.filter((row) =>
    isOpenPickableRow(row)
    && Boolean(row.serialNo?.trim())
    && samePickingStockCode(row.stockCode, stockCode));
}

function findOpenNonSerialRowsByStockCode(
  rows: ProductionTransferPickingRow[],
  stockCode: string,
): ProductionTransferPickingRow[] {
  return rows.filter((row) =>
    isOpenPickableRow(row)
    && !row.serialNo?.trim()
    && samePickingStockCode(row.stockCode, stockCode));
}

function buildSerialPickBarcode(stockCode: string, serialNo: string): string {
  return `${stockCode.trim()}${PICKING_BARCODE_SEPARATOR}${serialNo.trim()}`;
}

interface BarcodeStep1 {
  barcode: string;
  match: ResolveProductionTransferBarcodeResult;
  quantity: string;
  idempotencyKey: string;
  requiresThresholdConfirm?: boolean;
}

export const PICK_ABOVE_THRESHOLD_CONFIRM_MESSAGE =
  'Bu miktar onay eşiğini aşıyor. Devam etmek için onaylayın.';

function isPickAboveThresholdConfirmError(message: string): boolean {
  return message.includes('onay eşiğini');
}

function applyScanPickDelta(
  table: ProductionTransferPickingTable,
  execution: ProductionTransferExecution,
  result: ProductionTransferScanPickResult,
): { table: ProductionTransferPickingTable; execution: ProductionTransferExecution } {
  const rowKey = (row: ProductionTransferPickingRow) => pickingRowSelectionKey(row);
  const updatedRow = result.row;
  const resultRowKey = rowKey(updatedRow);
  const hasRow = table.rows.some((row) => rowKey(row) === resultRowKey);
  const rows = hasRow
    ? table.rows.map((row) => (rowKey(row) === resultRowKey ? updatedRow : row))
    : table.rows.map((row) => (row.taskLineId === updatedRow.taskLineId && !row.serialNo?.trim()
      ? updatedRow
      : row));
  return {
    table: {
      ...table,
      workflowStatus: result.summary.workflowStatus,
      pickedQuantity: result.summary.pickedQuantity,
      shortageQuantity: result.summary.shortageQuantity,
      overIssueQuantity: result.summary.overIssueQuantity,
      canCompletePicking: result.summary.canCompletePicking,
      rows,
    },
    execution: {
      ...execution,
      workflowStatus: result.summary.workflowStatus,
      pickedQuantity: result.summary.pickedQuantity,
      shortageQuantity: result.summary.shortageQuantity,
      overIssueQuantity: result.summary.overIssueQuantity,
      canCompletePicking: result.summary.canCompletePicking,
      lines: execution.lines.map((line) => line.lineId === result.executionLine.lineId
        ? {
            ...line,
            pickedQuantity: result.executionLine.pickedQuantity,
            remainingToPickQuantity: result.executionLine.remainingToPickQuantity,
            overIssueQuantity: result.executionLine.overIssueQuantity,
          }
        : line),
    },
  };
}

interface Props {
  transferId: number;
  execution: ProductionTransferExecution;
  onExecutionChange: (execution: ProductionTransferExecution) => void;
}

function shouldAutoPickWithoutConfirm(
  match: ResolveProductionTransferBarcodeResult,
  threshold?: number,
): boolean {
  if (!threshold || threshold <= 0) return false;
  const quantity = Math.floor(match.defaultQuantity);
  return quantity > 0 && quantity <= Math.floor(threshold);
}

export function ProductionTransferPickingSection({ transferId, execution, onExecutionChange }: Props) {
  const currentUserId = useAuthStore((state) => state.user?.id);
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
  const [selectedStockListStockId, setSelectedStockListStockId] = useState<number>();
  const [step1, setStep1] = useState<BarcodeStep1 | null>(null);
  const [serialBulkPickDialog, setSerialBulkPickDialog] = useState<{
    stockCode: string;
    rows: ProductionTransferPickingRow[];
  } | null>(null);
  const [serialBulkPickSelection, setSerialBulkPickSelection] = useState<Set<string>>(() => new Set());
  const [routeDialog, setRouteDialog] = useState<ProductionTransferRouteRefreshCandidates | null>(null);
  const [routeQuantities, setRouteQuantities] = useState<Record<number, string>>({});
  const [selectedSerialCandidateKey, setSelectedSerialCandidateKey] = useState<string>();
  const [completedLineTargets, setCompletedLineTargets] = useState<Record<string, string>>({});
  const [completedLineTargetLabels, setCompletedLineTargetLabels] = useState<Record<string, string>>({});
  const [completedSelectedKeys, setCompletedSelectedKeys] = useState<Set<string>>(() => new Set());
  const [completedBulkPlacementOpen, setCompletedBulkPlacementOpen] = useState(false);
  const [completedBulkTargetLocation, setCompletedBulkTargetLocation] = useState('');
  const [completedBulkTargetLabel, setCompletedBulkTargetLabel] = useState('');
  const [nonSerialUnpickDialog, setNonSerialUnpickDialog] = useState<ProductionTransferPickingRow | null>(null);
  const [nonSerialUnpickTargetLocation, setNonSerialUnpickTargetLocation] = useState('');
  const [nonSerialUnpickTargetLabel, setNonSerialUnpickTargetLabel] = useState('');
  const [nonSerialUnpickQuantity, setNonSerialUnpickQuantity] = useState('');
  const [sourceWarehouseReturnSetting, setSourceWarehouseReturnSetting] = useState<WarehouseTransferReturnSetting>();
  const completedLocationLabelsRef = useRef<Record<string, string>>({});
  const [highlightedLineNo, setHighlightedLineNo] = useState<number>();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const pickDialogOpen = Boolean(step1);
  const serialBulkPickDialogOpen = Boolean(serialBulkPickDialog);
  const blockingDialogOpen = pickDialogOpen || serialBulkPickDialogOpen || Boolean(nonSerialUnpickDialog);

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
      setSelectedStockListStockId(undefined);
      return;
    }
    const timer = window.setTimeout(
      () => setDebouncedStockListSearch(stockListSearch.trim()),
      STOCK_LIST_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stockListOpen, stockListSearch]);

  const pickingTableStockList = useMemo(
    () => buildPickingTableStockList(table?.rows ?? []),
    [table?.rows],
  );
  const stockListRows = useMemo(
    () => filterPickingTableStockList(pickingTableStockList, debouncedStockListSearch),
    [debouncedStockListSearch, pickingTableStockList],
  );
  const stockListTotalCount = pickingTableStockList.length;

  const selectStockListRow = useCallback((row: PickingTableStockListItem) => {
    setSelectedStockListStockId(row.stockId);
    setBarcode(row.stockCode);
    setStockListOpen(false);
    requestAnimationFrame(() => barcodeRef.current?.focus());
  }, []);

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
  const completedRows = useMemo(
    () => collectPlacableCompletedRows(tableSections),
    [tableSections],
  );
  const completedSelectedKeyList = useMemo(() => [...completedSelectedKeys], [completedSelectedKeys]);
  const hasCompletedBulkSelection = completedSelectedKeys.size > 0;
  const allCompletedRowsSelected = completedRows.length > 0
    && completedRows.every((row) => completedSelectedKeys.has(pickingRowSelectionKey(row)));
  const someCompletedRowsSelected = completedRows.some((row) =>
    completedSelectedKeys.has(pickingRowSelectionKey(row)));

  useEffect(() => {
    if (tab === 'completed') {
      setSelectedRowKey(undefined);
      return;
    }
    setCompletedSelectedKeys(new Set());
    setCompletedBulkPlacementOpen(false);
    setCompletedBulkTargetLocation('');
    setCompletedBulkTargetLabel('');
  }, [tab]);

  const unpickExcludedLocationIds = useMemo(() => {
    const ids = new Set<number>();
    if (execution.waitingLocationId) ids.add(execution.waitingLocationId);
    if (sourceWarehouseReturnSetting?.defaultProductionTransferLocationId) {
      ids.add(sourceWarehouseReturnSetting.defaultProductionTransferLocationId);
    }
    for (const locationId of execution.excludedSourceLocationIds ?? []) ids.add(locationId);
    return ids;
  }, [
    execution.excludedSourceLocationIds,
    execution.waitingLocationId,
    sourceWarehouseReturnSetting?.defaultProductionTransferLocationId,
  ]);

  useEffect(() => {
    if (execution.sourceWarehouseId <= 0) {
      setSourceWarehouseReturnSetting(undefined);
      return;
    }
    let cancelled = false;
    void productionTransferApi.returnSetting(execution.sourceWarehouseId)
      .then((setting) => {
        if (!cancelled) setSourceWarehouseReturnSetting(setting);
      })
      .catch(() => {
        if (!cancelled) setSourceWarehouseReturnSetting(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [execution.sourceWarehouseId]);

  useEffect(() => {
    if (tab !== 'completed' || !table) return;
    setCompletedLineTargets((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of completedRows) {
        const key = pickingRowSelectionKey(row);
        if (next[key]) continue;
        const defaultLocationId = row.sourceLocationId;
        if (!defaultLocationId || unpickExcludedLocationIds.has(defaultLocationId)) continue;
        next[key] = String(defaultLocationId);
        changed = true;
      }
      return changed ? next : current;
    });
    setCompletedLineTargetLabels((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of completedRows) {
        const key = pickingRowSelectionKey(row);
        if (next[key]) continue;
        const defaultLocationId = row.sourceLocationId;
        if (!defaultLocationId || unpickExcludedLocationIds.has(defaultLocationId)) continue;
        next[key] = locationOptionLabel(row.sourceLocationCode, undefined);
        changed = true;
      }
      return changed ? next : current;
    });
    setCompletedSelectedKeys((current) => {
      const validKeys = new Set(completedRows.map((row) => pickingRowSelectionKey(row)));
      const next = new Set([...current].filter((key) => validKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [completedRows, tab, table, unpickExcludedLocationIds]);

  const toCompletedLocationOption = useCallback((item: LocationOption) => {
    const label = `${item.code} · ${item.name}`;
    completedLocationLabelsRef.current[String(item.id)] = label;
    return { value: String(item.id), label };
  }, []);

  const fetchCompletedLocationPage = useCallback(async (request: Parameters<typeof warehouseTransferApi.locations>[0]) => {
    const page = await warehouseTransferApi.locations(request, execution.sourceWarehouseId);
    return {
      ...page,
      items: page.items.filter((item) => !unpickExcludedLocationIds.has(item.id)),
    };
  }, [execution.sourceWarehouseId, unpickExcludedLocationIds]);

  const hasCompletedLayoutChanges = useMemo(() => {
    if (tab !== 'completed') return false;
    if (completedSelectedKeys.size > 0) return true;
    const defaults = buildDefaultCompletedTargets(completedRows, unpickExcludedLocationIds);
    return completedRows.some((row) => {
      const key = pickingRowSelectionKey(row);
      return (completedLineTargets[key] ?? '') !== (defaults.targets[key] ?? '');
    });
  }, [completedLineTargets, completedRows, completedSelectedKeys.size, tab, unpickExcludedLocationIds]);

  const completedRowsReadyToUnpick = useMemo(() => {
    const selectedOnly = completedSelectedKeys.size > 0;
    return completedRows.filter((row) => {
      const key = pickingRowSelectionKey(row);
      if (selectedOnly && !completedSelectedKeys.has(key)) return false;
      const target = completedLineTargets[key];
      return target != null && target !== '' && Number(target) > 0;
    });
  }, [completedLineTargets, completedRows, completedSelectedKeys]);

  const singleSelectedNonSerialRow = useMemo(() => {
    if (completedSelectedKeys.size !== 1) return undefined;
    const row = completedRows.find((item) => completedSelectedKeys.has(pickingRowSelectionKey(item)));
    if (!row || isSerialRow(row)) return undefined;
    return row;
  }, [completedRows, completedSelectedKeys]);

  const canExecuteCompletedUnpick = Boolean(
    singleSelectedNonSerialRow?.processedQuantity
    || completedRowsReadyToUnpick.length > 0,
  );

  const completedUnpickActionCount = singleSelectedNonSerialRow
    ? 1
    : completedRowsReadyToUnpick.length;

  const resetCompletedLayout = () => {
    const { targets, labels } = buildDefaultCompletedTargets(completedRows, unpickExcludedLocationIds);
    setCompletedLineTargets(targets);
    setCompletedLineTargetLabels(labels);
    setCompletedSelectedKeys(new Set());
    setCompletedBulkPlacementOpen(false);
    setCompletedBulkTargetLocation('');
    setCompletedBulkTargetLabel('');
    toast.success('Raf seçimleri varsayılan değerlere döndürüldü.');
  };

  const applyCompletedBulkTargetLocation = () => {
    if (!completedBulkTargetLocation || Number(completedBulkTargetLocation) <= 0) {
      toast.error('Toplu yerleştirme için raf seçin.');
      return;
    }
    const label = completedBulkTargetLabel
      || completedLocationLabelsRef.current[completedBulkTargetLocation]
      || completedBulkTargetLocation;
    const assignedCount = completedSelectedKeys.size;
    setCompletedLineTargets((current) => {
      const next = { ...current };
      for (const key of completedSelectedKeys) next[key] = completedBulkTargetLocation;
      return next;
    });
    setCompletedLineTargetLabels((current) => {
      const next = { ...current };
      for (const key of completedSelectedKeys) next[key] = label;
      return next;
    });
    setCompletedBulkPlacementOpen(false);
    setCompletedBulkTargetLocation('');
    setCompletedBulkTargetLabel('');
    setCompletedSelectedKeys(new Set());
    toast.success(`${assignedCount} satır seçilen rafa atandı.`);
  };

  const openNonSerialUnpickDialog = (row: ProductionTransferPickingRow) => {
    const key = pickingRowSelectionKey(row);
    const presetTarget = completedLineTargets[key];
    const defaultLocationId = row.sourceLocationId;
    const canUseDefaultLocation = defaultLocationId && !unpickExcludedLocationIds.has(defaultLocationId);
    setNonSerialUnpickDialog(row);
    setNonSerialUnpickTargetLocation(
      presetTarget || (canUseDefaultLocation ? String(defaultLocationId) : ''),
    );
    setNonSerialUnpickTargetLabel(
      completedLineTargetLabels[key] || (canUseDefaultLocation ? (row.sourceLocationCode ?? '') : ''),
    );
    setNonSerialUnpickQuantity(formatRouteQuantityValue(row.processedQuantity));
  };

  const handleCompletedUnpickClick = () => {
    if (busy || !canExecuteCompletedUnpick) return;
    if (singleSelectedNonSerialRow) {
      openNonSerialUnpickDialog(singleSelectedNonSerialRow);
      return;
    }
    void confirmCompletedUnpick();
  };

  const confirmCompletedUnpick = async () => {
    if (busy || completedRowsReadyToUnpick.length === 0) return;
    setBusy(true);
    const processedKeys = new Set<string>();
    try {
      let nextTable = table;
      for (const row of completedRowsReadyToUnpick) {
        const key = pickingRowSelectionKey(row);
        const targetLocationId = Number(completedLineTargets[key]);
        if (!Number.isFinite(targetLocationId) || targetLocationId <= 0) continue;
        const isSerial = Boolean(row.serialNo?.trim());
        nextTable = await productionTransferApi.unpickToLocation(transferId, {
          taskLineId: row.taskLineId,
          targetLocationId,
          quantity: isSerial ? undefined : Math.floor(row.processedQuantity),
          serialNo: row.serialNo,
        });
        processedKeys.add(key);
      }
      if (nextTable) setTable(nextTable);
      const nextExecution = await productionTransferApi.execution(transferId);
      onExecutionChange(nextExecution);
      setCompletedLineTargets((current) => {
        const next = { ...current };
        for (const key of processedKeys) delete next[key];
        return next;
      });
      setCompletedLineTargetLabels((current) => {
        const next = { ...current };
        for (const key of processedKeys) delete next[key];
        return next;
      });
      setCompletedSelectedKeys(new Set());
      setTab('all');
      toast.success(`${processedKeys.size} satır seçilen rafa bırakıldı.`);
    } catch (error) {
      if (table) await load();
      toast.error(error instanceof Error ? error.message : 'Rafa bırakma başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const confirmNonSerialUnpickDialog = async () => {
    if (!nonSerialUnpickDialog || busy) return;
    const targetLocationId = Number(nonSerialUnpickTargetLocation);
    if (!Number.isFinite(targetLocationId) || targetLocationId <= 0) {
      toast.error('Raf seçin.');
      return;
    }
    const quantity = parsePositiveIntegerInput(nonSerialUnpickQuantity);
    if (quantity === null || quantity <= 0 || quantity > Math.floor(nonSerialUnpickDialog.processedQuantity)) {
      toast.error('Geçerli bir geri alma miktarı girin.');
      return;
    }
    setBusy(true);
    const rowKey = pickingRowSelectionKey(nonSerialUnpickDialog);
    try {
      const nextTable = await productionTransferApi.unpickToLocation(transferId, {
        taskLineId: nonSerialUnpickDialog.taskLineId,
        targetLocationId,
        quantity,
        serialNo: nonSerialUnpickDialog.serialNo,
      });
      setTable(nextTable);
      const nextExecution = await productionTransferApi.execution(transferId);
      onExecutionChange(nextExecution);
      setNonSerialUnpickDialog(null);
      setNonSerialUnpickTargetLocation('');
      setNonSerialUnpickTargetLabel('');
      setNonSerialUnpickQuantity('');
      setCompletedLineTargets((current) => {
        const next = { ...current };
        delete next[rowKey];
        return next;
      });
      setCompletedLineTargetLabels((current) => {
        const next = { ...current };
        delete next[rowKey];
        return next;
      });
      setCompletedSelectedKeys(new Set());
      setTab('all');
      toast.success('Toplanan stok seçilen rafa bırakıldı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rafa bırakma başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCompletedRowSelection = useCallback((row: ProductionTransferPickingRow, checked: boolean) => {
    const key = pickingRowSelectionKey(row);
    setCompletedSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleCompletedSelectAll = useCallback((checked: boolean) => {
    setCompletedSelectedKeys(checked
      ? new Set(completedRows.map((row) => pickingRowSelectionKey(row)))
      : new Set());
  }, [completedRows]);

  const updateCompletedLineTarget = useCallback((rowKey: string, value: string) => {
    setCompletedLineTargets((current) => ({ ...current, [rowKey]: value }));
    setCompletedLineTargetLabels((current) => ({
      ...current,
      [rowKey]: completedLocationLabelsRef.current[value] ?? value,
    }));
  }, []);

  const toggleRowSelection = useCallback((row: ProductionTransferPickingRow) => {
    const key = pickingRowSelectionKey(row);
    setSelectedRowKey((current) => (current === key ? undefined : key));
  }, []);
  const hasShortage = (execution.shortageQuantity ?? 0) > 0;
  const hasOverIssue = (table?.overIssueQuantity ?? execution.overIssueQuantity ?? 0) > 0;
  const overIssueLines = table?.overIssueLines ?? execution.overIssueLines ?? [];
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [overIssueConfirmed, setOverIssueConfirmed] = useState(false);
  const [completePickingDialogOpen, setCompletePickingDialogOpen] = useState(false);

  const performPick = async (payload: BarcodeStep1, confirmAboveThreshold = false) => {
    const quantity = payload.match.isSerial ? null : parsePositiveIntegerInput(payload.quantity);
    if (!payload.match.isSerial && quantity === null) {
      toast.error('Geçerli bir tam sayı miktar girin.');
      return;
    }
    const result = await productionTransferApi.scanPick(
      transferId,
      payload.match.taskLineId,
      payload.barcode,
      {
        quantity: payload.match.isSerial ? undefined : quantity!,
        sourceLocationId: payload.match.sourceLocationId,
        idempotencyKey: payload.idempotencyKey,
        confirmAboveThreshold: confirmAboveThreshold || payload.requiresThresholdConfirm === true,
      },
    );
    if (!table) {
      await load();
    } else {
      const next = applyScanPickDelta(table, execution, result);
      setTable(next.table);
      onExecutionChange(next.execution);
    }
    setBarcode('');
    setStep1(null);
    toast.success(`${result.stockCode}: ${formatProjectNumber(result.acceptedQuantity)} toplandı.`);
  };

  const pickSerialBarcode = async (
    pickBarcode: string,
    confirmAboveThreshold = false,
  ) => {
    const match = await productionTransferApi.resolveBarcode(transferId, pickBarcode);
    return productionTransferApi.scanPick(
      transferId,
      match.taskLineId,
      pickBarcode,
      {
        quantity: undefined,
        sourceLocationId: match.sourceLocationId,
        idempotencyKey: crypto.randomUUID(),
        confirmAboveThreshold,
      },
    );
  };

  const toggleSerialBulkPickSelection = useCallback((row: ProductionTransferPickingRow) => {
    const key = pickingRowSelectionKey(row);
    setSerialBulkPickSelection((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const confirmSerialBulkPick = async () => {
    if (!serialBulkPickDialog || serialBulkPickSelection.size === 0 || busy) return;
    setBusy(true);
    let pickedCount = 0;
    let currentTable = table;
    let currentExecution = execution;
    try {
      const selectedRows = serialBulkPickDialog.rows.filter((row) =>
        serialBulkPickSelection.has(pickingRowSelectionKey(row)));
      for (const row of selectedRows) {
        const serialNo = row.serialNo?.trim();
        if (!serialNo) continue;
        const pickBarcode = buildSerialPickBarcode(serialBulkPickDialog.stockCode, serialNo);
        const result = await pickSerialBarcode(pickBarcode);
        pickedCount += 1;
        if (currentTable) {
          const next = applyScanPickDelta(currentTable, currentExecution, result);
          currentTable = next.table;
          currentExecution = next.execution;
        }
      }
      if (currentTable) {
        setTable(currentTable);
        onExecutionChange(currentExecution);
      } else {
        await load();
      }
      setSerialBulkPickDialog(null);
      setSerialBulkPickSelection(new Set());
      setBarcode('');
      toast.success(`${pickedCount} seri toplandı.`);
    } catch (error) {
      if (currentTable) {
        setTable(currentTable);
        onExecutionChange(currentExecution);
      }
      toast.error(error instanceof Error ? error.message : 'Seçilen seriler toplanamadı.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  };

  const resolveBarcode = async (rawBarcode?: string) => {
    const scanned = (rawBarcode ?? barcode).trim();
    if (!scanned || table?.isLocked || busy) return;

    const parsed = parsePickingBarcodeInput(scanned);
    if (!parsed.isComposite && table) {
      const openSerialRows = findOpenSerialRowsByStockCode(table.rows, scanned);
      const openNonSerialRows = findOpenNonSerialRowsByStockCode(table.rows, scanned);
      if (openSerialRows.length > 0 && openNonSerialRows.length === 0) {
        setSerialBulkPickDialog({ stockCode: scanned, rows: openSerialRows });
        setSerialBulkPickSelection(new Set());
        setBarcode('');
        return;
      }
    }

    setBusy(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const match = await productionTransferApi.resolveBarcode(transferId, scanned);
      const payload: BarcodeStep1 = {
        barcode: scanned,
        match,
        quantity: String(Math.floor(match.defaultQuantity)),
        idempotencyKey,
      };
      if (match.isSerial) {
        try {
          await performPick(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Toplama kaydedilemedi.';
          if (isPickAboveThresholdConfirmError(message)) {
            setStep1({ ...payload, requiresThresholdConfirm: true });
            return;
          }
          toast.error(message);
        }
        return;
      }
      const autoPickQuantity = Math.floor(match.defaultQuantity);
      if (shouldAutoPickWithoutConfirm(match, sourceWarehouseReturnSetting?.autoPickWithoutConfirmMaxQuantity)) {
        try {
          await performPick({ ...payload, quantity: String(autoPickQuantity) });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Toplama kaydedilemedi.';
          if (isPickAboveThresholdConfirmError(message)) {
            setStep1({ ...payload, quantity: String(autoPickQuantity), requiresThresholdConfirm: true });
            return;
          }
          toast.error(message);
        }
        return;
      }
      setStep1(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Barkod doğrulanamadı.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  };

  const confirmPick = async (payload: BarcodeStep1) => {
    if (busy) return;
    setBusy(true);
    try {
      await performPick(payload, payload.requiresThresholdConfirm === true);
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
        hasOverIssue ? overIssueConfirmed : false,
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
  const showCompletedShelfColumn = tab === 'completed' && !table.isLocked;

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
              tab === 'completed' ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 self-end">
                  <OpsActionButton
                    variant="secondary"
                    loading={false}
                    disabled={!hasCompletedLayoutChanges || busy}
                    onClick={resetCompletedLayout}
                    className="px-4 py-2 text-sm"
                  >
                    <RotateCcw className="size-4" />
                    Düzeni sıfırla
                  </OpsActionButton>
                  <OpsActionButton
                    variant="secondary"
                    loading={false}
                    disabled={!hasCompletedBulkSelection || busy}
                    onClick={() => setCompletedBulkPlacementOpen(true)}
                    className="px-4 py-2 text-sm"
                  >
                    <Layers className="size-4" />
                    Yerleştirme rafını seç
                    {hasCompletedBulkSelection ? ` (${completedSelectedKeys.size})` : ''}
                  </OpsActionButton>
                  <OpsActionButton
                    variant="primary"
                    disabled={busy || !canExecuteCompletedUnpick}
                    onClick={handleCompletedUnpickClick}
                  >
                    <Undo2 className="size-4" />
                    Rafa bırak
                    {completedUnpickActionCount > 0 ? ` (${completedUnpickActionCount})` : ''}
                  </OpsActionButton>
                </div>
              ) : (
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
                    disabled={busy || blockingDialogOpen}
                    placeholder="Barkod veya StokKodu**SeriNo"
                    cameraTitle="Barkod okut"
                    cameraDescription="Barkod veya QR kodu kamera karesine getirin."
                  />
                  <OpsActionButton variant="primary" loading={busy} disabled={!barcode.trim() || blockingDialogOpen} onClick={() => void resolveBarcode()}>
                    <Barcode className="size-4" />Onayla
                  </OpsActionButton>
                </div>
              </div>
              )
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
          <table className={cn(
            'w-full border-collapse text-sm',
            table.isLocked ? 'min-w-[640px]' : 'min-w-[920px]',
          )}>
            <thead className="bg-black/5 text-left text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
              <tr>
                <th className={tab === 'completed' && !table.isLocked ? CHECKBOX_HEAD_CELL : cn(TABLE_HEAD_CELL, 'w-10')}>
                  {tab === 'completed' && !table.isLocked ? (
                    <OpsSkinCheckbox
                      checked={allCompletedRowsSelected}
                      indeterminate={someCompletedRowsSelected && !allCompletedRowsSelected}
                      onCheckedChange={toggleCompletedSelectAll}
                      disabled={busy || completedRows.length === 0}
                      aria-label="Tüm satırları seç"
                    />
                  ) : null}
                </th>
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
                      pickTab={tab}
                      selected={tab === 'completed'
                        ? completedSelectedKeys.has(pickingRowSelectionKey(section.row))
                        : selectedRowKey === pickingRowSelectionKey(section.row)}
                      highlighted={isLineHighlighted(section.row.lineNo, highlightedLineNo)}
                      onSelect={toggleRowSelection}
                      completedShelf={showCompletedShelfColumn ? {
                        rowKey: pickingRowSelectionKey(section.row),
                        targetLocationId: completedLineTargets[pickingRowSelectionKey(section.row)] ?? '',
                        targetLabel: completedLineTargetLabels[pickingRowSelectionKey(section.row)] ?? '',
                        bulkSelected: completedSelectedKeys.has(pickingRowSelectionKey(section.row)),
                        disabled: busy,
                        warehouseId: execution.sourceWarehouseId,
                        onTargetChange: updateCompletedLineTarget,
                        onBulkSelect: toggleCompletedRowSelection,
                        toLocationOption: toCompletedLocationOption,
                        fetchLocationPage: fetchCompletedLocationPage,
                      } : undefined}
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
                    pickTab={tab}
                    highlightedLineNo={highlightedLineNo}
                    selectedRowKey={selectedRowKey}
                    completedSelectedKeys={tab === 'completed' ? completedSelectedKeys : undefined}
                    onSelect={toggleRowSelection}
                    showCompletedShelfColumn={showCompletedShelfColumn}
                    completedLineTargets={completedLineTargets}
                    completedLineTargetLabels={completedLineTargetLabels}
                    completedShelfBusy={busy}
                    completedWarehouseId={execution.sourceWarehouseId}
                    onCompletedTargetChange={updateCompletedLineTarget}
                    onCompletedBulkSelect={toggleCompletedRowSelection}
                    toCompletedLocationOption={toCompletedLocationOption}
                    fetchCompletedLocationPage={fetchCompletedLocationPage}
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
                if (hasShortage || hasOverIssue) setCompletePickingDialogOpen(true);
                else void completePicking();
              }}
            >
              <PackageCheck className="size-4" />
              Transfere hazır
            </OpsActionButton>
          </div>
        )}
      </div>

      {stockListOpen && (
        <ResponsiveDialog
          onClose={() => setStockListOpen(false)}
          title="Stok listesi"
          description={`Toplam ${stockListTotalCount.toLocaleString('tr-TR')} stok kalemi · Seçilen kod barkod alanına yazılır`}
          className="!max-w-2xl"
        >
          <div className="space-y-4">
            <input
              className="input w-full"
              value={stockListSearch}
              onChange={(event) => setStockListSearch(event.target.value)}
              placeholder="Stok kodu veya adına göre ara..."
              aria-label="Stok listesinde ara"
            />
            <div className="max-h-[min(28rem,60dvh)] overflow-auto">
              <div className="rounded-2xl bg-[var(--wms-app-border)] p-px shadow-sm">
                <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-[var(--wms-app-panel)]">
                  <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                        <th
                          className={cn(
                            'w-10 bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-start',
                            'border-b border-e border-[var(--wms-app-border)]',
                          )}
                        />
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
                            colSpan={3}
                            className="px-3 py-8 text-center text-sm text-[var(--wms-app-text-muted)]"
                          >
                            {debouncedStockListSearch ? 'Aramaya uygun stok bulunamadı.' : 'Toplama tablosunda stok kalemi bulunamadı.'}
                          </td>
                        </tr>
                      ) : stockListRows.map((row, rowIndex) => {
                        const isLast = rowIndex === stockListRows.length - 1;
                        const rowBorder = isLast ? '' : 'border-b border-[var(--wms-app-border)]';
                        const selected = selectedStockListStockId === row.stockId;
                        return (
                          <tr
                            key={row.stockId}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onClick={() => selectStockListRow(row)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                selectStockListRow(row);
                              }
                            }}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-[var(--wms-brand-soft)]',
                              selected && 'bg-[var(--wms-brand-soft)]',
                            )}
                          >
                            <td className={cn('px-3 py-2.5 align-middle', rowBorder)}>
                              <input
                                type="radio"
                                name="picking-stock-list"
                                checked={selected}
                                readOnly
                                aria-label={`${row.stockCode} seç`}
                                className="pointer-events-none"
                              />
                            </td>
                            <td
                              className={cn(
                                'border-e border-[var(--wms-app-border)] px-3 py-2.5 align-middle',
                                rowBorder,
                              )}
                            >
                              <span className="font-mono text-xs font-semibold text-[var(--wms-brand-primary)]">
                                {row.stockCode}
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
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {serialBulkPickDialog && (
        <ResponsiveDialog
          onClose={() => {
            setSerialBulkPickDialog(null);
            setSerialBulkPickSelection(new Set());
          }}
          title="Seri seçerek topla"
          description={`${serialBulkPickDialog.stockCode} · Toplanacak serileri seçin`}
          className="!max-w-2xl"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmSerialBulkPick();
            }}
          >
            <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-black/5 text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
                  <tr>
                    <th className="w-10 p-3">
                      <input
                        type="checkbox"
                        aria-label="Tümünü seç"
                        checked={serialBulkPickDialog.rows.length > 0
                          && serialBulkPickDialog.rows.every((row) =>
                            serialBulkPickSelection.has(pickingRowSelectionKey(row)))}
                        onChange={(event) => {
                          setSerialBulkPickSelection(event.target.checked
                            ? new Set(serialBulkPickDialog.rows.map((row) => pickingRowSelectionKey(row)))
                            : new Set());
                        }}
                      />
                    </th>
                    <th className="p-3 text-right">No</th>
                    <th className="p-3 text-left">Raf</th>
                    <th className="p-3 text-left">Seri</th>
                    <th className="p-3 text-right">Kalan</th>
                  </tr>
                </thead>
                <tbody>
                  {serialBulkPickDialog.rows.map((row) => {
                    const rowKey = pickingRowSelectionKey(row);
                    const selected = serialBulkPickSelection.has(rowKey);
                    return (
                      <tr
                        key={rowKey}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        onClick={() => toggleSerialBulkPickSelection(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSerialBulkPickSelection(row);
                          }
                        }}
                        className={cn(
                          'cursor-pointer border-t border-[var(--wms-app-border)] transition-colors hover:bg-[var(--wms-brand-soft)]',
                          selected && 'bg-[var(--wms-brand-soft)]',
                        )}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            aria-label={`Satır ${row.lineNo} seç`}
                            className="pointer-events-none"
                          />
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums">{row.lineNo}</td>
                        <td className="p-3 font-bold">{row.sourceLocationCode || '—'}</td>
                        <td className="p-3 font-semibold">{row.serialNo || '—'}</td>
                        <td className="p-3 text-right">{formatProjectNumber(row.remainingQuantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setSerialBulkPickDialog(null);
                  setSerialBulkPickSelection(new Set());
                }}
              >
                İptal
              </button>
              <OpsActionButton
                type="submit"
                variant="primary"
                loading={busy}
                disabled={serialBulkPickSelection.size === 0}
              >
                Onayla ({serialBulkPickSelection.size})
              </OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {step1 && (
        <ResponsiveDialog
          onClose={() => setStep1(null)}
          title={step1.requiresThresholdConfirm ? 'Onay eşiği aşıldı' : 'Toplama miktarı'}
          description={
            step1.requiresThresholdConfirm
              ? 'Bu miktar depo onay eşiğinin üzerinde. Devam etmek istiyor musunuz?'
              : step1.match.maxPickQuantity > step1.match.remainingQuantity
                ? `Kalan ${formatProjectNumber(step1.match.remainingQuantity)}; fazla sarf ile en fazla ${formatProjectNumber(step1.match.maxPickQuantity)} toplanabilir.`
                : 'Miktarı düşürerek kısmi toplama yapabilirsiniz.'
          }
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              const qty = parsePositiveIntegerInput(step1.quantity);
              const maxQty = Math.floor(step1.match.maxPickQuantity);
              if (qty === null || qty > maxQty) {
                toast.error('Geçerli bir tam sayı miktar girin.');
                return;
              }
              void confirmPick({ ...step1, quantity: String(qty) });
            }}
          >
            <PickSummary match={step1.match} quantity={parsePositiveIntegerInput(step1.quantity) ?? undefined} />
            <label className="mt-4 block text-xs font-bold">Miktar</label>
            <input
              className="input mt-1 w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              value={step1.quantity}
              onChange={(event) => setStep1({
                ...step1,
                quantity: clampPositiveIntegerInput(event.target.value, step1.match.maxPickQuantity),
              })}
              onFocus={(event) => event.currentTarget.select()}
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={() => setStep1(null)}>İptal</button>
              <OpsActionButton type="submit" variant="primary" loading={busy}>
                Onayla
              </OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {completePickingDialogOpen && (
        <ResponsiveDialog
          onClose={() => setCompletePickingDialogOpen(false)}
          title="Transfere hazır"
          description="Onayladığınızda transfer teslim beklemeye alınır."
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              Toplanan: {formatProjectNumber(table.pickedQuantity)} / {formatProjectNumber(table.requestedQuantity)}
              {hasShortage ? ` · Eksik: ${formatProjectNumber(table.shortageQuantity)}` : ''}
              {hasOverIssue ? ` · Fazla: ${formatProjectNumber(table.overIssueQuantity)}` : ''}
            </p>
            {hasOverIssue && (
              <div className="rounded-xl border-2 border-orange-500/60 bg-orange-500/10 p-3">
                <h4 className="flex items-center gap-2 text-sm font-black text-orange-600">
                  <AlertTriangle className="size-4" />
                  Fazla toplama uyarısı
                </h4>
                <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
                  Aşağıdaki kalemler talep miktarının üzerinde toplanmış.
                  {table.allowOverIssue && table.overIssueTolerancePercent > 0
                    ? ` Politika en fazla %${formatProjectNumber(table.overIssueTolerancePercent)} fazla toplamaya izin veriyor.`
                    : ''}
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-orange-500/30">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-black/5 text-left dark:bg-white/5">
                      <tr>
                        <th className="p-2">Stok</th>
                        <th className="p-2 text-right">Talep</th>
                        <th className="p-2 text-right">Toplanan</th>
                        <th className="p-2 text-right">Fazla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overIssueLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-orange-500/20">
                          <td className="p-2">
                            <strong>{line.stockCode}</strong>
                            {line.stockName && (
                              <span className="block text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                            )}
                          </td>
                          <td className="p-2 text-right">{formatProjectNumber(line.requestedQuantity)} {line.unitCode}</td>
                          <td className="p-2 text-right text-emerald-600">{formatProjectNumber(line.pickedQuantity)}</td>
                          <td className="p-2 text-right font-bold text-orange-600">{formatProjectNumber(line.overIssueQuantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overIssueConfirmed}
                    onChange={(event) => setOverIssueConfirmed(event.target.checked)}
                    className="mt-1"
                  />
                  Fazla toplamayı bilinçli olarak teslim aşamasına taşıyorum.
                </label>
              </div>
            )}
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
                disabled={(hasShortage && !partialConfirmed) || (hasOverIssue && !overIssueConfirmed)}
                onClick={() => void completePicking()}
              >
                <PackageCheck className="size-4" />
                Transfere hazır
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {nonSerialUnpickDialog && (
        <ResponsiveDialog
          variant="lookup"
          onClose={() => setNonSerialUnpickDialog(null)}
          title="Rafa bırak"
          description="Toplanan stok bekleme rafından seçtiğiniz rafa geri yerleştirilir ve satır Tümü sekmesine döner."
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmNonSerialUnpickDialog();
            }}
          >
            <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-[var(--wms-app-text-muted)]">Stok</span>
                  <strong className="block">{nonSerialUnpickDialog.stockCode}</strong>
                </div>
                <div>
                  <span className="text-xs text-[var(--wms-app-text-muted)]">Toplanan</span>
                  <strong className="block">{formatProjectNumber(nonSerialUnpickDialog.processedQuantity)}</strong>
                </div>
              </div>
            </div>
            <label className="mt-4 block text-xs font-bold">Geri alınacak miktar</label>
            <input
              className="input mt-1 w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              value={nonSerialUnpickQuantity}
              onChange={(event) => setNonSerialUnpickQuantity(
                clampPositiveIntegerInput(event.target.value, nonSerialUnpickDialog.processedQuantity),
              )}
              onFocus={(event) => event.currentTarget.select()}
              autoFocus
            />
            <label className="mt-4 block text-xs font-bold">Raf</label>
            <PagedAppDropdown<LocationOption>
              queryKey={[
                'production-pick-nonserial-unpick-location',
                execution.sourceWarehouseId,
                nonSerialUnpickDialog.taskLineId,
              ]}
              fetchPage={fetchCompletedLocationPage}
              toOption={toCompletedLocationOption}
              enabled={execution.sourceWarehouseId > 0}
              dependencies={[execution.sourceWarehouseId, nonSerialUnpickDialog.taskLineId]}
              value={nonSerialUnpickTargetLocation}
              onValueChange={(value) => {
                setNonSerialUnpickTargetLocation(value);
                setNonSerialUnpickTargetLabel(completedLocationLabelsRef.current[value] ?? '');
              }}
              selectedOption={nonSerialUnpickTargetLocation ? {
                value: nonSerialUnpickTargetLocation,
                label: nonSerialUnpickTargetLabel || nonSerialUnpickTargetLocation,
              } : undefined}
              searchable
              placeholder="Raf seçin"
              portalContainer={null}
              contentClassName="z-[5100]"
              className="mt-1 min-w-full"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                onClick={() => setNonSerialUnpickDialog(null)}
              >
                İptal
              </button>
              <OpsActionButton type="submit" variant="primary" loading={busy}>Onayla</OpsActionButton>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {completedBulkPlacementOpen ? (
        <ResponsiveDialog
          variant="lookup"
          onClose={() => {
            setCompletedBulkPlacementOpen(false);
            setCompletedBulkTargetLocation('');
            setCompletedBulkTargetLabel('');
          }}
          title="Toplu yerleştirme rafı"
          description={`Seçili ${completedSelectedKeys.size} satır bekleme rafından aşağıdaki rafa atanacak.`}
        >
          <PagedAppDropdown<LocationOption>
            queryKey={['production-pick-completed-bulk-target', execution.sourceWarehouseId]}
            fetchPage={fetchCompletedLocationPage}
            toOption={toCompletedLocationOption}
            enabled={execution.sourceWarehouseId > 0}
            dependencies={[execution.sourceWarehouseId, completedSelectedKeyList.join(',')]}
            value={completedBulkTargetLocation}
            onValueChange={(value) => {
              setCompletedBulkTargetLocation(value);
              setCompletedBulkTargetLabel(completedLocationLabelsRef.current[value] ?? value);
            }}
            selectedOption={completedBulkTargetLocation ? {
              value: completedBulkTargetLocation,
              label: completedBulkTargetLabel
                || completedLocationLabelsRef.current[completedBulkTargetLocation]
                || completedBulkTargetLocation,
            } : undefined}
            placeholder="Raf seçin"
            searchable
            portalContainer={null}
            contentClassName="z-[5100]"
            className="min-w-full"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setCompletedBulkPlacementOpen(false);
                setCompletedBulkTargetLocation('');
                setCompletedBulkTargetLabel('');
              }}
            >
              İptal
            </button>
            <OpsActionButton
              variant="primary"
              loading={false}
              disabled={!completedBulkTargetLocation}
              onClick={applyCompletedBulkTargetLocation}
            >
              Seçili satırlara ata
            </OpsActionButton>
          </div>
        </ResponsiveDialog>
      ) : null}

      {routeDialog && (
        <ResponsiveDialog
          onClose={() => setRouteDialog(null)}
          title="Rotayı güncelle"
          description={
            routeDialog.isSerial
              ? routeDialog.currentSerialNo
                ? `Mevcut seri: ${routeDialog.currentSerialNo} · Listede olmayan alternatif serilerden birini seçin.`
                : `Eksik seri: ${formatProjectNumber(routeDialog.remainingQuantity)} adet · Atanmamış serilerden birini seçin.`
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
                  Uygun alternatif seri bulunamadı
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

type CompletedShelfProps = {
  rowKey: string;
  targetLocationId: string;
  targetLabel: string;
  bulkSelected: boolean;
  disabled: boolean;
  warehouseId: number;
  onTargetChange: (rowKey: string, value: string) => void;
  onBulkSelect: (row: ProductionTransferPickingRow, checked: boolean) => void;
  toLocationOption: (item: LocationOption) => { value: string; label: string };
  fetchLocationPage: (request: Parameters<typeof warehouseTransferApi.locations>[0]) => Promise<Awaited<ReturnType<typeof warehouseTransferApi.locations>>>;
};

function PickingLocationCell({
  row,
  serialDetail = false,
  completedShelf,
}: {
  row: ProductionTransferPickingRow;
  serialDetail?: boolean;
  completedShelf?: CompletedShelfProps;
}) {
  if (completedShelf) {
    return (
      <td className={cn(LOCATION_CELL, serialDetail && 'pl-6')}>
        <PagedAppDropdown<LocationOption>
          queryKey={['production-pick-completed-target', completedShelf.warehouseId, completedShelf.rowKey]}
          fetchPage={completedShelf.fetchLocationPage}
          toOption={completedShelf.toLocationOption}
          enabled={completedShelf.warehouseId > 0 && !completedShelf.bulkSelected}
          dependencies={[completedShelf.warehouseId, completedShelf.rowKey]}
          value={completedShelf.targetLocationId}
          onValueChange={(value) => completedShelf.onTargetChange(completedShelf.rowKey, value)}
          selectedOption={completedShelf.targetLocationId ? {
            value: completedShelf.targetLocationId,
            label: completedShelf.targetLabel || completedShelf.targetLocationId,
          } : undefined}
          placeholder={completedShelf.bulkSelected ? 'Toplu atama bekliyor' : 'Raf seçin'}
          searchable
          disabled={completedShelf.disabled || completedShelf.bulkSelected}
          className="min-w-[12rem]"
        />
      </td>
    );
  }

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
  pickTab,
  highlightedLineNo,
  selectedRowKey,
  completedSelectedKeys,
  onSelect,
  showCompletedShelfColumn = false,
  completedLineTargets,
  completedLineTargetLabels,
  completedShelfBusy = false,
  completedWarehouseId = 0,
  onCompletedTargetChange,
  onCompletedBulkSelect,
  toCompletedLocationOption,
  fetchCompletedLocationPage,
}: {
  stockId: number;
  stockCode: string;
  stockName?: string;
  rows: ProductionTransferPickingRow[];
  locked: boolean;
  showRouteColumns: boolean;
  pickTab: PickTab;
  highlightedLineNo?: number;
  selectedRowKey?: string;
  completedSelectedKeys?: Set<string>;
  onSelect: (row: ProductionTransferPickingRow) => void;
  showCompletedShelfColumn?: boolean;
  completedLineTargets?: Record<string, string>;
  completedLineTargetLabels?: Record<string, string>;
  completedShelfBusy?: boolean;
  completedWarehouseId?: number;
  onCompletedTargetChange?: (rowKey: string, value: string) => void;
  onCompletedBulkSelect?: (row: ProductionTransferPickingRow, checked: boolean) => void;
  toCompletedLocationOption?: (item: LocationOption) => { value: string; label: string };
  fetchCompletedLocationPage?: CompletedShelfProps['fetchLocationPage'];
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
        {showRouteColumns && (
          showCompletedShelfColumn
            ? (
                <td className={LOCATION_CELL}>
                  <span className="text-[var(--wms-app-text-muted)]">—</span>
                </td>
              )
            : <PickingLocationSummaryCell rows={rows} />
        )}
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
      {expanded && rows.map((row) => {
        const rowKey = pickingRowSelectionKey(row);
        const completedShelf = showCompletedShelfColumn
          && onCompletedTargetChange
          && onCompletedBulkSelect
          && toCompletedLocationOption
          && fetchCompletedLocationPage
          ? {
            rowKey,
            targetLocationId: completedLineTargets?.[rowKey] ?? '',
            targetLabel: completedLineTargetLabels?.[rowKey] ?? '',
            bulkSelected: completedSelectedKeys?.has(rowKey) ?? false,
            disabled: completedShelfBusy,
            warehouseId: completedWarehouseId,
            onTargetChange: onCompletedTargetChange,
            onBulkSelect: onCompletedBulkSelect,
            toLocationOption: toCompletedLocationOption,
            fetchLocationPage: fetchCompletedLocationPage,
          }
          : undefined;
        return (
        <PickingRow
          key={`serial:${row.taskLineId}:${row.serialNo ?? ''}`}
          row={row}
          locked={locked}
          showRouteColumns={showRouteColumns}
          pickTab={pickTab}
          selected={pickTab === 'completed'
            ? (completedSelectedKeys?.has(rowKey) ?? false)
            : selectedRowKey === rowKey}
          highlighted={isLineHighlighted(row.lineNo, highlightedLineNo)}
          onSelect={onSelect}
          serialDetail
          completedShelf={completedShelf}
        />
        );
      })}
    </>
  );
}

function PickingRow({
  row,
  locked,
  showRouteColumns,
  pickTab,
  selected,
  highlighted = false,
  onSelect,
  serialDetail = false,
  completedShelf,
}: {
  row: ProductionTransferPickingRow;
  locked: boolean;
  showRouteColumns: boolean;
  pickTab: PickTab;
  selected: boolean;
  highlighted?: boolean;
  onSelect: (row: ProductionTransferPickingRow) => void;
  serialDetail?: boolean;
  completedShelf?: CompletedShelfProps;
}) {
  const done = row.remainingQuantity <= 0;
  const canSelect = !locked && (
    pickTab === 'completed'
      ? row.processedQuantity > 0 && row.remainingQuantity <= 0
      : row.remainingQuantity > 0
  );
  const isCompletedTab = pickTab === 'completed';
  return (
    <tr
      data-picking-line-no={row.lineNo}
      className={cn(done && 'opacity-70', serialDetail && 'bg-black/[0.02] dark:bg-white/[0.02]', highlighted && HIGHLIGHT_ROW_CLASS)}
    >
      <td className={isCompletedTab ? CHECKBOX_CELL : TABLE_CELL}>
        {isCompletedTab ? (
          <OpsSkinCheckbox
            checked={selected}
            onCheckedChange={(checked) => completedShelf?.onBulkSelect(row, checked)}
            disabled={!canSelect || completedShelf?.disabled}
            aria-label={`${row.stockCode} satırını seç`}
          />
        ) : (
          <input
            type="checkbox"
            checked={selected}
            disabled={!canSelect}
            onChange={() => canSelect && onSelect(row)}
          />
        )}
      </td>
      <td className={cn(TABLE_CELL, 'text-right font-bold tabular-nums')}>{row.lineNo}</td>
      {showRouteColumns && <PickingLocationCell row={row} serialDetail={serialDetail} completedShelf={completedShelf} />}
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
