import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Barcode, CheckCircle2, HardHat, List, Loader2, MapPinned, PackageCheck,
  PlayCircle, RotateCcw, ScanBarcode, Search, TriangleAlert, Undo2, UserRound, Warehouse,
} from 'lucide-react';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { useTheme } from '@/components/theme-provider';
import { warehouseOutboundApi, type ShipmentOperationLinePayload } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { KKD_CELL, KKD_HEAD_CELL, KkdCallout, KkdPage, KkdPanel, KkdTableShell } from './kkd-ops-ui';
import {
  KKD_PICK_ABOVE_THRESHOLD_CONFIRM_MESSAGE,
  kkdApi,
  type KkdPreparationResolveScanResult,
  type KkdPreparationScanRow,
  type KkdPreparationTaskLineLocationRow,
  type KkdPreparationTaskLineRow,
  type KkdPreparationTaskRow,
  type KkdQuotaDecision,
  type KkdStockLookup,
} from './kkd-api';
import { KkdDistributionReceiptDialog } from './KkdDistributionReceiptDialog';

const BOARD_TABS = new Set(['pending', 'preparing', 'completed', 'cancelled', 'mine']);

function isPickAboveThresholdConfirmError(message: string): boolean {
  return message.includes('onay eşiğini');
}

function resolveBoardHref(returnTab: string | null): string {
  let tab = returnTab;
  if (!tab || !BOARD_TABS.has(tab)) {
    try {
      tab = sessionStorage.getItem('kkd-requests-return-tab');
    } catch {
      tab = null;
    }
  }
  if (!tab || !BOARD_TABS.has(tab)) tab = 'mine';
  return `/warehouse/kkd/requests?tab=${tab}`;
}

function parsePositiveQuantity(value: string, max: number): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed > max) return null;
  return parsed;
}

type Stage = 'loading' | 'not-found' | 'working' | 'excess-pending' | 'finishing' | 'done' | 'error';

type PickLine = {
  taskLineId: number;
  requestLineId: number;
  requestLineRowVersion: string;
  groupCode: string;
  groupName?: string | null;
  stockId: number | null;
  stockCode: string | null;
  stockName: string | null;
  unitCode: string;
  /** Görev satırı hedefi (teslim edilen düşülmüş). */
  targetQuantity: number;
  /** Sunucudaki PreparedQuantity (scan-pick toplamı, teslim edilen düşülmüş). */
  quantity: number;
  /** Fiziksel teslim onayına kadar bekleyen (hazırlanmış ama teslim edilmemiş) miktar. */
  deliverable: number;
  locations: KkdPreparationTaskLineLocationRow[];
  sourceLocationId: number | null;
  lotNo: string | null;
  serialNo: string | null;
  /** Kota aşımı kararı — Pending/Rejected olduğu sürece bu görev başlatılamaz (bkz. StartAsync). */
  quotaDecision: KkdQuotaDecision;
};

type PendingPick = {
  resolved: KkdPreparationResolveScanResult;
  quantity: string;
  /** Üretimdeki requiresThresholdConfirm — eşik üstü ikinci onay. */
  requiresThresholdConfirm?: boolean;
};

type RouteCandidate = {
  locationId: number; locationCode: string; locationName: string; availableQuantity: number;
  serialNo?: string | null; lotNo?: string | null;
};

type RouteDialogState = {
  line: PickLine;
  isSerial: boolean;
  candidates: RouteCandidate[];
  selected: Record<string, boolean>;
  quantities: Record<string, string>;
  loading: boolean;
  submitting: boolean;
};

function candidateKey(locationId: number, serialNo?: string | null): string {
  return `${locationId}:${serialNo ?? ''}`;
}

function mapTaskToPickLines(task: KkdPreparationTaskRow): PickLine[] {
  return task.lines
    .filter((line) => line.quantity - line.deliveredQuantity > 0)
    .map((line: KkdPreparationTaskLineRow) => {
      // Açık hazırlık = henüz teslim edilmemiş prepared (kısmi teslim sonrası journal consume ile uyumlu).
      const openPrepared = Math.max(0, line.preparedQuantity - line.deliveredQuantity);
      return {
        taskLineId: line.id,
        requestLineId: line.requestLineId,
        requestLineRowVersion: line.requestLineRowVersion,
        groupCode: line.groupCode,
        groupName: line.groupName,
        stockId: line.stockId ?? null,
        stockCode: line.stockCode ?? null,
        stockName: line.stockName ?? null,
        unitCode: line.unitCode,
        targetQuantity: line.quantity - line.deliveredQuantity,
        quantity: openPrepared,
        deliverable: openPrepared,
        locations: line.locations ?? [],
        sourceLocationId: null,
        lotNo: null,
        serialNo: null,
        quotaDecision: line.quotaDecision,
      };
    });
}

function linePickState(line: PickLine): 'wait' | 'partial' | 'done' {
  if (line.stockId && line.quantity >= line.targetQuantity) return 'done';
  if (line.quantity > 0) return 'partial';
  return 'wait';
}

function PickStatusChip({ state }: { state: 'wait' | 'partial' | 'done' }): ReactElement {
  if (state === 'done') {
    return (
      <span className="wms-kkd-pick-chip wms-kkd-pick-chip--done">
        <CheckCircle2 className="size-3.5 shrink-0" />Tamam
      </span>
    );
  }
  if (state === 'partial') {
    return <span className="wms-kkd-pick-chip wms-kkd-pick-chip--partial">Kısmi</span>;
  }
  return <span className="wms-kkd-pick-chip wms-kkd-pick-chip--wait">Bekliyor</span>;
}

function PickProgress({ line }: { line: PickLine }): ReactElement {
  const state = linePickState(line);
  const ratio = line.targetQuantity > 0
    ? Math.min(100, (line.quantity / line.targetQuantity) * 100)
    : 0;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[0.7rem] text-[var(--wms-app-text-muted)]">
        <span>
          {formatProjectNumber(line.quantity)} / {formatProjectNumber(line.targetQuantity)} {line.unitCode}
        </span>
        <span className="font-mono tabular-nums">{Math.round(ratio)}%</span>
      </div>
      <div className="wms-kkd-pick-progress" aria-hidden>
        <div
          className={cn(
            'wms-kkd-pick-progress__fill',
            state === 'done' && 'wms-kkd-pick-progress__fill--done',
            state === 'partial' && 'wms-kkd-pick-progress__fill--partial',
          )}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

function PickLineIdentity({ line, onOpenStockList }: { line: PickLine; onOpenStockList: (line: PickLine) => void }): ReactElement {
  if (line.stockId) {
    return (
      <>
        <strong className="font-mono text-[var(--wms-ops-shell-fg)]">{line.stockCode}</strong>
        <span className="mt-0.5 block text-[0.75rem] text-[var(--wms-app-text-muted)]">{line.stockName}</span>
        <span className="mt-0.5 block text-[0.65rem] text-[var(--wms-app-text-muted)]">{line.groupCode}</span>
      </>
    );
  }
  return (
    <>
      <strong className="text-[var(--wms-ops-shell-fg)]">{line.groupCode}</strong>
      <span className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-amber-700 dark:text-amber-400">
        <TriangleAlert className="size-3 shrink-0" />
        Stok grubu bağlanmamış — okutunca çözülür
        <button
          type="button"
          className="wms-ops-grid-icon-btn !size-6"
          title="Stok listesinden seç"
          aria-label="Stok listesinden seç"
          onClick={(event) => { event.stopPropagation(); onOpenStockList(line); }}
        >
          <Search className="size-3" />
        </button>
      </span>
    </>
  );
}

/** Raf sütunu: rezervasyon/toplama izini raf kodu + miktar çipleri olarak gösterir. Rota güncellemesi
 * artık satırı seçip üstteki (Production'daki gibi) "Rotayı güncelle" araç çubuğu butonundan yapılır. */
function LocationChips({ line }: { line: PickLine }): ReactElement {
  if (!line.stockId) return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
  if (line.locations.length === 0) return <span className="text-xs text-amber-700 dark:text-amber-400">Henüz raf atanmadı</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {line.locations.map((loc) => (
        <span
          key={`${loc.locationId}-${loc.serialNo ?? ''}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_85%,transparent)] px-2 py-0.5 text-[0.68rem]"
          title={`Rezerve: ${formatProjectNumber(loc.reservedQuantity)} · Toplanan: ${formatProjectNumber(loc.pickedQuantity)}`}
        >
          <MapPinned className="size-3 shrink-0 text-[var(--wms-ops-accent)]" />
          {loc.locationCode}
          {loc.serialNo ? <span className="text-[var(--wms-app-text-muted)]">#{loc.serialNo}</span> : null}
        </span>
      ))}
    </div>
  );
}

function PickContextChip({
  icon,
  label,
  value,
  compact,
}: {
  icon: ReactElement;
  label: string;
  value: string;
  compact?: boolean;
}): ReactElement {
  return (
    <span
      className={cn(
        'wms-kkd-pick-context-chip inline-flex min-w-0 max-w-full items-center gap-1.5 border border-[var(--wms-ops-card-border)]',
        'bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_88%,transparent)] text-[var(--wms-ops-shell-fg)]',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-1',
      )}
      title={`${label}: ${value}`}
    >
      <span className="shrink-0 text-[var(--wms-ops-accent)]" aria-hidden>{icon}</span>
      {!compact ? (
        <span className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)] sm:inline">
          {label}
        </span>
      ) : null}
      <span className={cn('min-w-0 truncate font-medium', compact ? 'text-[0.7rem]' : 'text-xs')}>{value}</span>
    </span>
  );
}

/**
 * "Benim İşlerim" hazırlama görevi için barkodlu toplama. Akış: "Bu işi yapıyorum" (raf ataması +
 * gerçek rezervasyon) → barkod/StokKodu**SeriNo okutarak canlı toplama (her onaylanan miktar
 * gerçek stok hareketi olarak postalanır) → istenirse "Rotayı güncelle" / "Stok listesi" / "Geri al" →
 * ayrı bir adım olarak "Fiziksel Teslim Onayı" (tam/eksik, o an ambar çıkışı + teslim belgesi oluşur).
 */
export function KkdPreparationPickingPage(): ReactElement {
  const { requestId: requestIdParam, taskId: taskIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const requestId = Number(requestIdParam);
  const taskId = Number(taskIdParam);
  const queryClient = useQueryClient();
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const currentUser = useAuthStore((state) => state.user);
  const boardHref = useMemo(
    () => resolveBoardHref(searchParams.get('returnTab')),
    [searchParams],
  );

  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [distributionId, setDistributionId] = useState<number | null>(null);
  const [lines, setLines] = useState<PickLine[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [lastMatch, setLastMatch] = useState<KkdPreparationResolveScanResult | null>(null);
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [flashLineId, setFlashLineId] = useState<number | null>(null);
  const [routeDialog, setRouteDialog] = useState<RouteDialogState | null>(null);
  const [stockListLine, setStockListLine] = useState<PickLine | null>(null);
  const [stockListSearch, setStockListSearch] = useState('');
  /** Üretimdeki toplama ekranındaki gibi: satır seçilir, ardından üstteki "Rotayı güncelle" butonu o satıra uygulanır. */
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  /** Üretimdeki "Stok listesi": barkod okunamadığında bu görevin kendi (zaten çözülmüş) stoklarından
   * birini seçip barkod alanına yazdırır — normal okutma akışı (Onayla) aynen çalışır. */
  const [quickStockPickerOpen, setQuickStockPickerOpen] = useState(false);
  const [quickStockPickerSearch, setQuickStockPickerSearch] = useState('');
  const [scansOpen, setScansOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, string>>({});
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const requestQuery = useQuery({
    queryKey: ['kkd', 'requests', requestId],
    queryFn: () => kkdApi.requestDetail(requestId),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  const tasksQuery = useQuery({
    queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'],
    queryFn: () => kkdApi.requestPreparationTasks(requestId),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  const seriesQuery = useQuery({ queryKey: ['kkd', 'distribution-series'], queryFn: kkdApi.distributionSeries });
  const receiptDetail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', distributionId],
    queryFn: () => kkdApi.distributionDetail(distributionId!),
    enabled: Boolean(distributionId) && receiptOpen,
  });

  const task = tasksQuery.data?.find((item) => item.id === taskId);
  const started = Boolean(task?.startedAtUtc);
  const warehouseQuery = useQuery({
    queryKey: ['kkd', 'pick-warehouse', branchCode, task?.warehouseId],
    queryFn: async ({ signal }) => {
      const page = await warehouseOutboundApi.warehouses(
        { pageNumber: 1, pageSize: 200, search: '', signal },
        branchCode,
      );
      return page.items.find((item) => Number(item.id) === task!.warehouseId) ?? null;
    },
    enabled: Boolean(task?.warehouseId),
    staleTime: 60_000,
  });
  const scansQuery = useQuery({
    queryKey: ['kkd', 'preparation-tasks', taskId, 'scans'],
    queryFn: () => kkdApi.preparationScans(taskId),
    enabled: scansOpen && Number.isFinite(taskId) && taskId > 0,
  });
  const stockListQuery = useQuery({
    queryKey: ['kkd', 'stock-list', stockListLine?.groupCode, stockListSearch],
    queryFn: async ({ signal }) => {
      const page = await kkdApi.stocksPaged(
        { pageNumber: 1, pageSize: 20, search: stockListSearch, signal },
        stockListLine?.groupCode,
      );
      return page.items;
    },
    enabled: Boolean(stockListLine),
  });
  const loading = requestQuery.isLoading || tasksQuery.isLoading;
  const notFound = !loading && (!requestQuery.data || !task);
  const effectiveStage: Stage = stage !== 'loading' ? stage : loading ? 'loading' : notFound ? 'not-found' : 'working';
  const working = effectiveStage === 'working';

  const pickerLabel = task?.assignedUserName?.trim()
    || currentUser?.name?.trim()
    || currentUser?.email
    || '—';
  const warehouseLabel = warehouseQuery.data
    ? `${warehouseQuery.data.warehouseCode} · ${warehouseQuery.data.warehouseName}`
    : task
      ? `#${task.warehouseId}`
      : '—';
  const employeeLabel = requestQuery.data
    ? `${requestQuery.data.employeeName} (${requestQuery.data.employeeCode})`
    : '—';

  useEffect(() => {
    if (!task) return;
    if (!seeded) {
      setLines(mapTaskToPickLines(task));
      setSeeded(true);
      return;
    }
    // Sunucu prepared/raf verisini koruyarak satırları senkronize et; son lot/seri ipucunu tut.
    setLines((current) => {
      const mapped = mapTaskToPickLines(task);
      return mapped.map((line) => {
        const prev = current.find((item) => item.requestLineId === line.requestLineId);
        return prev
          ? {
              ...line,
              sourceLocationId: prev.sourceLocationId,
              lotNo: prev.lotNo,
              serialNo: prev.serialNo,
            }
          : line;
      });
    });
  }, [task, seeded]);

  const focusBarcode = (): void => {
    requestAnimationFrame(() => barcodeRef.current?.focus());
  };

  const startTask = async (): Promise<void> => {
    if (!task || startBusy) return;
    setStartBusy(true);
    try {
      const result = await kkdApi.startPreparationTask(task.id);
      queryClient.setQueryData<KkdPreparationTaskRow[]>(
        ['kkd', 'requests', requestId, 'preparation-tasks'],
        (current) => (current ? current.map((item) => (item.id === result.id ? result : item)) : [result]),
      );
      toast.success('Toplama başlatıldı.');
      focusBarcode();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Başlatılamadı.');
    } finally {
      setStartBusy(false);
    }
  };

  const applyScanResult = (result: Awaited<ReturnType<typeof kkdApi.scanPickPreparationTask>>): void => {
    queryClient.setQueryData<KkdPreparationTaskRow[]>(
      ['kkd', 'requests', requestId, 'preparation-tasks'],
      (current) => {
        if (!current) return [result.task];
        return current.map((item) => (item.id === result.task.id ? result.task : item));
      },
    );
    void queryClient.invalidateQueries({ queryKey: ['kkd', 'preparation-tasks', taskId, 'scans'] });
    const taskLine = result.task.lines.find((l) => l.requestLineId === result.requestLineId);
    const delivered = taskLine?.deliveredQuantity ?? 0;
    setLines((current) => current.map((line) => {
      if (line.requestLineId !== result.requestLineId) return line;
      const prepared = Math.max(0, result.linePreparedQuantity - delivered);
      return {
        ...line,
        stockId: result.stockId,
        stockCode: result.stockCode,
        stockName: result.stockName,
        quantity: prepared,
        deliverable: prepared,
        locations: taskLine?.locations ?? line.locations,
        targetQuantity: result.lineQuantity - delivered,
        sourceLocationId: result.sourceLocationId ?? line.sourceLocationId,
        lotNo: result.lotNo ?? line.lotNo,
        serialNo: result.serialNo ?? line.serialNo,
        requestLineRowVersion: taskLine?.requestLineRowVersion ?? line.requestLineRowVersion,
      };
    }));
    setFlashLineId(result.requestLineId);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashLineId(null), 1100);
  };

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  const remainingFor = (line: PickLine): number => Math.max(0, line.targetQuantity - line.quantity);
  /** Kota kararı bekleyen/reddedilen kalemler — bunlar varken StartAsync toplamayı başlatmaz (bkz. backend). */
  const quotaBlockedLines = lines.filter((line) => line.quotaDecision === 'Pending' || line.quotaDecision === 'Rejected');

  const commitPick = async (pending: PendingPick, confirmAboveThreshold = false): Promise<void> => {
    const line = lines.find((item) => item.requestLineId === pending.resolved.requestLineId);
    if (!line) {
      toast.error('Hedef kalem bulunamadı.');
      return;
    }
    const maxQty = Math.min(remainingFor(line), pending.resolved.remainingQuantity);
    const qty = pending.resolved.isSerial
      ? Math.min(1, maxQty)
      : parsePositiveQuantity(pending.quantity, maxQty);
    if (qty == null || qty <= 0) {
      toast.error('Geçerli bir miktar girin.');
      return;
    }

    const result = await kkdApi.scanPickPreparationTask(taskId, {
      barcode: pending.resolved.rawBarcode,
      expectedTaskLineId: pending.resolved.taskLineId,
      quantity: pending.resolved.isSerial ? 1 : qty,
      sourceLocationId: pending.resolved.suggestedLocationId ?? null,
      expectedRequestLineRowVersion: pending.resolved.needsGroupResolve
        ? line.requestLineRowVersion
        : null,
      // Dialogdan Topla = kullanıcı miktarı gördü; eşik üstünde de tutarlı onay.
      confirmAboveThreshold: confirmAboveThreshold || pending.requiresThresholdConfirm === true,
    });
    applyScanResult(result);
    toast.success(`${result.stockCode}: +${formatProjectNumber(result.acceptedQuantity)} toplandı.`);
  };

  /** Üretim ile aynı: resolve → (seri/eşik altı otomatik | miktar diyaloğu) → scan-pick. */
  const resolveBarcode = async (rawBarcode?: string): Promise<void> => {
    const scanned = (rawBarcode ?? barcode).trim();
    if (!scanned || !working || !started || !task || scanBusy || pendingPick) return;
    setScanBusy(true);
    try {
      const resolved = await kkdApi.resolvePreparationScan(taskId, { barcode: scanned });
      setLastMatch(resolved);
      if (resolved.defaultQuantity <= 0 || resolved.remainingQuantity <= 0) {
        toast.error('Bu kalemde kalan miktar yok.');
        return;
      }

      const threshold = resolved.autoPickWithoutConfirmMaxQuantity;
      const pending: PendingPick = {
        resolved,
        quantity: String(resolved.defaultQuantity),
        requiresThresholdConfirm: Boolean(
          !resolved.isSerial
          && threshold
          && threshold > 0
          && resolved.defaultQuantity > threshold,
        ),
      };

      if (resolved.canAutoPick) {
        try {
          await commitPick(pending, false);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Toplama kaydı yazılamadı.';
          if (isPickAboveThresholdConfirmError(message)) {
            setPendingPick({ ...pending, requiresThresholdConfirm: true });
            return;
          }
          throw error;
        }
      } else {
        setPendingPick(pending);
      }
    } catch (error) {
      setLastMatch(null);
      toast.error(error instanceof Error ? error.message : 'Barkod çözümlenemedi.');
    } finally {
      setBarcode('');
      setScanBusy(false);
      focusBarcode();
    }
  };

  const confirmPendingPick = async (): Promise<void> => {
    if (!pendingPick || scanBusy) return;
    setScanBusy(true);
    try {
      // Miktar diyaloğunda Topla = açık kullanıcı onayı (üretim eşik onayı ile uyumlu, tutarlı).
      await commitPick(pendingPick, true);
      setPendingPick(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Toplama kaydı yazılamadı.';
      if (isPickAboveThresholdConfirmError(message)) {
        setPendingPick({ ...pendingPick, requiresThresholdConfirm: true });
      } else {
        toast.error(message);
      }
    } finally {
      setScanBusy(false);
      focusBarcode();
    }
  };

  const openRouteDialog = async (line: PickLine): Promise<void> => {
    setRouteDialog({ line, isSerial: false, candidates: [], selected: {}, quantities: {}, loading: true, submitting: false });
    try {
      const result = await kkdApi.routeCandidates(line.taskLineId);
      setRouteDialog({
        line, isSerial: result.isSerial, candidates: result.candidates,
        selected: {}, quantities: {}, loading: false, submitting: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Raf adayları alınamadı.');
      setRouteDialog(null);
    }
  };

  const toggleRouteCandidate = (candidate: RouteCandidate, checked: boolean): void => {
    setRouteDialog((current) => {
      if (!current) return current;
      const key = candidateKey(candidate.locationId, candidate.serialNo);
      return {
        ...current,
        selected: { ...current.selected, [key]: checked },
        quantities: current.quantities[key]
          ? current.quantities
          : { ...current.quantities, [key]: current.isSerial ? '1' : String(candidate.availableQuantity) },
      };
    });
  };

  const submitRouteSplit = async (): Promise<void> => {
    if (!routeDialog) return;
    const selections = routeDialog.candidates
      .filter((candidate) => routeDialog.selected[candidateKey(candidate.locationId, candidate.serialNo)])
      .map((candidate) => {
        const key = candidateKey(candidate.locationId, candidate.serialNo);
        const quantity = routeDialog.isSerial ? 1 : Number(routeDialog.quantities[key]?.replace(',', '.') || 0);
        return { locationId: candidate.locationId, quantity, serialNo: candidate.serialNo ?? null };
      })
      .filter((selection) => selection.quantity > 0);
    if (selections.length === 0) {
      toast.error('En az bir raf/seri seçin.');
      return;
    }
    setRouteDialog((current) => (current ? { ...current, submitting: true } : current));
    try {
      const result = await kkdApi.applyRouteSplit(routeDialog.line.taskLineId, { selections });
      queryClient.setQueryData<KkdPreparationTaskRow[]>(
        ['kkd', 'requests', requestId, 'preparation-tasks'],
        (current) => (current ? current.map((item) => (item.id === result.id ? result : item)) : [result]),
      );
      toast.success('Rota güncellendi.');
      setRouteDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rota güncellenemedi.');
      setRouteDialog((current) => (current ? { ...current, submitting: false } : current));
    }
  };

  const resolveFromStockList = async (stock: KkdStockLookup): Promise<void> => {
    if (!stockListLine || !requestQuery.data) return;
    try {
      await kkdApi.resolveRequestLine(requestId, stockListLine.requestLineId, {
        stockId: stock.id,
        reason: 'Stok listesinden manuel bağlandı.',
        expectedRowVersion: stockListLine.requestLineRowVersion,
      });
      toast.success(`${stockListLine.groupCode} grubu ${stock.code} stoğuna bağlandı.`);
      setStockListLine(null);
      setStockListSearch('');
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stoğa bağlanamadı.');
    }
  };

  const unpickScan = async (scan: KkdPreparationScanRow): Promise<void> => {
    try {
      const result = await kkdApi.unpickScan(taskId, scan.id);
      queryClient.setQueryData<KkdPreparationTaskRow[]>(
        ['kkd', 'requests', requestId, 'preparation-tasks'],
        (current) => (current ? current.map((item) => (item.id === result.task.id ? result.task : item)) : [result.task]),
      );
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'preparation-tasks', taskId, 'scans'] });
      toast.success('Tarama geri alındı; raf bakiyesi geri yüklendi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Geri alınamadı.');
    }
  };

  const pendingLines = lines.filter((line) => !line.stockId || line.quantity < line.targetQuantity);
  const deliverableLines = lines.filter((line) => line.stockId && line.deliverable > 0);
  const selectedLine = lines.find((line) => line.requestLineId === selectedLineId) ?? null;
  const toggleLineSelection = (line: PickLine): void => {
    setSelectedLineId((current) => (current === line.requestLineId ? null : line.requestLineId));
  };
  const resolvedLinesForQuickPick = lines.filter((line): line is PickLine & { stockId: number; stockCode: string } =>
    Boolean(line.stockId && line.stockCode));
  const quickPickSearch = quickStockPickerSearch.trim().toLocaleLowerCase('tr-TR');
  const quickPickRows = quickPickSearch
    ? resolvedLinesForQuickPick.filter((line) => line.stockCode.toLocaleLowerCase('tr-TR').includes(quickPickSearch)
      || (line.stockName ?? '').toLocaleLowerCase('tr-TR').includes(quickPickSearch))
    : resolvedLinesForQuickPick;
  const selectFromQuickStockPicker = (line: PickLine & { stockCode: string }): void => {
    setBarcode(line.stockCode);
    setQuickStockPickerOpen(false);
    setQuickStockPickerSearch('');
    requestAnimationFrame(() => barcodeRef.current?.focus());
  };

  const openDeliveryDialog = (): void => {
    setDeliveryQuantities(
      Object.fromEntries(deliverableLines.map((line) => [line.requestLineId, String(line.deliverable)])),
    );
    setDeliveryOpen(true);
  };

  const confirmDelivery = async (): Promise<void> => {
    if (!task || !requestQuery.data) return;
    const toDeliver = deliverableLines
      .map((line) => ({ line, quantity: parsePositiveQuantity(deliveryQuantities[line.requestLineId] ?? '', line.deliverable) }))
      .filter((item) => item.quantity != null && item.quantity > 0) as Array<{ line: PickLine; quantity: number }>;
    if (toDeliver.length === 0) {
      toast.error('Teslim edilecek en az bir kalem için miktar girin.');
      return;
    }
    const series = seriesQuery.data?.find((item) => item.isDefault) ?? seriesQuery.data?.[0];
    if (!series) {
      toast.error('Ambar çıkışı için belge serisi bulunamadı.');
      return;
    }
    setStage('finishing');
    setDeliveryOpen(false);
    try {
      const linesWithTrackings = await Promise.all(toDeliver.map(async ({ line, quantity }) => {
        const trackings = await kkdApi.preparationStagedTrackings(taskId, line.requestLineId);
        const stagedTotal = trackings.reduce((sum, item) => sum + item.quantity, 0);
        // Tam teslimde okutulan seri/lot/raf izini birebir kullan; kısmi teslimde sunucu kendi seçsin.
        const useExplicitTrackings = trackings.length > 0 && Math.abs(stagedTotal - quantity) < 0.0001;
        return {
          stockId: line.stockId!,
          yapCodeId: null,
          quantity,
          unitCode: line.unitCode,
          sourceLocationId: useExplicitTrackings
            ? line.sourceLocationId ?? trackings.find((item) => item.sourceLocationId)?.sourceLocationId ?? null
            : null,
          orderNumber: null,
          orderLineId: null,
          requireHandlingUnit: false,
          description: null,
          trackings: useExplicitTrackings
            ? trackings.map((item) => ({
                quantity: item.quantity,
                lotNo: item.lotNo ?? null,
                serialNo: item.serialNo ?? null,
                handlingUnitNo: null,
                manufacturingDate: null,
                expirationDate: null,
                sourceLocationId: item.sourceLocationId ?? null,
              }))
            : null,
          kkdRequestLineId: line.requestLineId,
        };
      }));

      const result = await kkdApi.createDistribution({
        idempotencyKey: crypto.randomUUID(),
        employeeId: requestQuery.data.employeeId,
        warehouseId: task.warehouseId,
        documentSeriesId: series.id,
        documentDate: new Date().toISOString().slice(0, 10),
        stagingLocationId: null,
        loadingLocationId: null,
        description: null,
        createWarehouseTask: false,
        assignedUserIds: null,
        kkdRequestId: task.requestId,
        lines: linesWithTrackings,
      });
      setDistributionId(result.id);
      if (result.excessApprovalStatus === 'Pending') {
        setStage('excess-pending');
        return;
      }

      const outboundDetail = await warehouseOutboundApi.detail(result.warehouseOutboundId);
      if (outboundDetail.header.status === 'Draft') {
        try {
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'release');
        } catch {
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'approve');
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'release');
        }
      }
      const payload: ShipmentOperationLinePayload[] = outboundDetail.lines.map((outboundLine) => {
        const match = toDeliver.find(({ line }) => line.stockId === outboundLine.stockId);
        const tracking = linesWithTrackings.find((line) => line.stockId === outboundLine.stockId)?.trackings?.[0];
        return {
          lineId: outboundLine.id,
          quantity: match?.quantity ?? outboundLine.requestedQuantity,
          sourceLocationId: match?.line.sourceLocationId ?? tracking?.sourceLocationId ?? null,
          targetLocationId: null,
          lotNo: match?.line.lotNo ?? tracking?.lotNo ?? null,
          serialNo: match?.line.serialNo ?? tracking?.serialNo ?? null,
          handlingUnitNo: null,
        };
      });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'pick', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'pack', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'load', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'ship', { lines: payload });
      toast.success('Fiziksel teslim onaylandı; ambar çıkışı ve ERP postalaması otomatik yapıldı.');
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId] });
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'] });
      setStage('done');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Teslim tamamlanamadı.');
      setStage('error');
    }
  };

  if (effectiveStage === 'loading') {
    return (
      <KkdPage
        title="Toplama"
        description="Hazırlama görevi yükleniyor…"
        leading={
          <OpsActionButton variant="secondary" asChild className="!h-9 !px-2.5 !text-xs">
            <Link to={boardHref} aria-label="Panoya dön">
              <ArrowLeft className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Panoya dön</span>
            </Link>
          </OpsActionButton>
        }
      >
        <div className="grid min-h-60 place-items-center text-[var(--wms-ops-accent)]">
          <Loader2 className="size-7 animate-spin" />
        </div>
      </KkdPage>
    );
  }

  if (effectiveStage === 'not-found') {
    return (
      <KkdPage
        title="Toplama"
        description="Hazırlama görevi bulunamadı."
        leading={
          <OpsActionButton variant="secondary" asChild className="!h-9 !px-2.5 !text-xs">
            <Link to={boardHref} aria-label="Panoya dön">
              <ArrowLeft className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Panoya dön</span>
            </Link>
          </OpsActionButton>
        }
      >
        <KkdCallout tone="danger" icon={<TriangleAlert className="size-5" />} title="Görev bulunamadı">
          Bu görev artık mevcut değil ya da erişim yetkiniz yok.
        </KkdCallout>
      </KkdPage>
    );
  }

  const pendingTarget = pendingPick
    ? lines.find((line) => line.requestLineId === pendingPick.resolved.requestLineId)
    : null;

  return (
    <KkdPage
      title={`Toplama · ${task!.taskNo}`}
      description={
        started
          ? "Barkod okutup hazırlama görevini toplar; hazır olanlar için Fiziksel Teslim Onayı ile ambar çıkışı oluşur."
          : "Toplamaya başlamak için önce “Bu işi yapıyorum” deyin — raf ataması ve rezervasyon o an yapılır."
      }
      hintLabel="Bu sayfa ne yapar?"
      leading={
        <OpsActionButton variant="secondary" asChild className="!h-9 !px-2.5 !text-xs">
          <Link to={boardHref} aria-label="Panoya dön">
            <ArrowLeft className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Panoya dön</span>
          </Link>
        </OpsActionButton>
      }
      subRow={
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <PickContextChip compact icon={<HardHat className="size-3" />} label="Personel" value={employeeLabel} />
          <PickContextChip compact icon={<Warehouse className="size-3" />} label="Depo" value={warehouseLabel} />
          <PickContextChip compact icon={<UserRound className="size-3" />} label="Toplayan" value={pickerLabel} />
        </div>
      }
    >
      {effectiveStage === 'excess-pending' ? (
        <KkdPanel title="Kota aşımı onayı bekleniyor" icon={<TriangleAlert className="size-4" />}>
          <KkdCallout tone="warn" title="Müdür onayı gerekiyor">
            Bu teslimde kota aşımı var; depo yöneticisinin fiziksel kontrol sonrası onaylaması bekleniyor.
            Onaylandıktan sonra &quot;Dağıtım ve Ambar Çıkış&quot; listesinden devam edebilirsiniz.
          </KkdCallout>
          <div className="mt-4">
            <OpsActionButton variant="secondary" asChild>
              <Link to="/warehouse/kkd/distributions">Dağıtım listesine git</Link>
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : effectiveStage === 'error' ? (
        <KkdPanel title="Bir sorun oluştu" icon={<TriangleAlert className="size-4" />}>
          <KkdCallout tone="danger" title="İşlem tamamlanamadı">{errorMessage}</KkdCallout>
          <div className="mt-4 flex gap-2">
            <OpsActionButton variant="secondary" onClick={() => setStage('working')}>
              Tekrar dene
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : !started ? (
        <div className="space-y-4">
          {quotaBlockedLines.length > 0 ? (
            <KkdCallout tone="danger" icon={<TriangleAlert className="size-5" />} title="Kota kararı bekleniyor">
              Bu görevde KKD hak matrisini aşan {quotaBlockedLines.length} kalem var: {quotaBlockedLines.map((line) => line.groupCode).join(', ')}.
              Müdürünüz bunu &quot;Kota Onayı&quot; ekranından karara bağlayana kadar toplamaya başlanamaz.
            </KkdCallout>
          ) : (
            <KkdCallout tone="info" icon={<PlayCircle className="size-5" />} title="Henüz başlatılmadı">
              Görev görüntülenebilir ama raf ataması/rezervasyon yok. &quot;Bu işi yapıyorum&quot; dediğiniz an
              stoğu bilinen kalemler için raflar rezerve edilir ve toplamaya başlayabilirsiniz.
            </KkdCallout>
          )}
          <KkdPanel title="Görev kalemleri" icon={<PackageCheck className="size-4" />}>
            <KkdTableShell>
              <thead>
                <tr>
                  <th className={KKD_HEAD_CELL}>Grup / Stok</th>
                  <th className={KKD_HEAD_CELL}>İstenen</th>
                  <th className={KKD_HEAD_CELL}>Kalan</th>
                  <th className={KKD_HEAD_CELL}>Kota</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.requestLineId}>
                    <td className={KKD_CELL}>
                      {line.stockId ? (
                        <>
                          <strong className="font-mono">{line.stockCode}</strong>
                          <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                        </>
                      ) : (
                        <strong>{line.groupCode}</strong>
                      )}
                    </td>
                    <td className={KKD_CELL}>{formatProjectNumber(line.targetQuantity)} {line.unitCode}</td>
                    <td className={KKD_CELL}>{formatProjectNumber(remainingFor(line))} {line.unitCode}</td>
                    <td className={KKD_CELL}>
                      {line.quotaDecision === 'Pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                          <TriangleAlert className="size-3 shrink-0" />Onay bekliyor
                        </span>
                      ) : line.quotaDecision === 'Rejected' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
                          <TriangleAlert className="size-3 shrink-0" />Reddedildi
                        </span>
                      ) : line.quotaDecision === 'Approved' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Onaylandı
                        </span>
                      ) : <span className="text-[var(--wms-app-text-muted)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </KkdTableShell>
            <div className="mt-5 flex justify-center">
              <OpsActionButton onClick={() => void startTask()} loading={startBusy} disabled={quotaBlockedLines.length > 0} className="!px-6">
                <PlayCircle className="size-4 shrink-0" />Bu işi yapıyorum
              </OpsActionButton>
            </div>
          </KkdPanel>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
          {/* Sol / üst: barkod — Enter/Tab/dıt = Onayla (OpsQrCaptureField onCommit) */}
          <div className="wms-kkd-pick-scan-sticky space-y-3">
            <KkdPanel
              title="Barkod okut"
              icon={<ScanBarcode className="size-4" />}
              description="Enter, Tab veya el terminali bip’i Onayla gibidir."
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <OpsActionButton
                    variant="secondary"
                    className="flex-1"
                    disabled={!working || !selectedLine?.stockId}
                    onClick={() => selectedLine && void openRouteDialog(selectedLine)}
                  >
                    <RotateCcw className="size-3.5 shrink-0" />Rotayı güncelle
                  </OpsActionButton>
                  <OpsActionButton
                    variant="secondary"
                    className="flex-1"
                    disabled={!working}
                    onClick={() => setQuickStockPickerOpen(true)}
                  >
                    <List className="size-3.5 shrink-0" />Stok listesi
                  </OpsActionButton>
                </div>
                {!selectedLine ? (
                  <p className="text-[0.7rem] leading-4 text-[var(--wms-app-text-muted)]">
                    Rotayı güncellemek için önce aşağıdaki listeden bir satır seçin.
                  </p>
                ) : null}
                <OpsQrCaptureField
                  className="min-w-0 w-full"
                  inputRef={barcodeRef}
                  value={barcode}
                  onChange={setBarcode}
                  onCommit={(code) => void resolveBarcode(code)}
                  autoFocus={working}
                  disabled={!working || scanBusy || Boolean(pendingPick)}
                  placeholder="Barkod veya StokKodu**SeriNo"
                  inputClassName="min-h-12 text-base"
                  cameraTitle="Barkod okut"
                  cameraDescription="Barkod veya QR kodu kamera karesine getirin."
                />
                <OpsActionButton
                  variant="primary"
                  className="w-full sm:w-auto"
                  loading={scanBusy}
                  disabled={!working || !barcode.trim() || Boolean(pendingPick)}
                  onClick={() => void resolveBarcode()}
                >
                  <Barcode className="size-4" />
                  Onayla
                </OpsActionButton>
                <p className="text-[0.7rem] leading-4 text-[var(--wms-app-text-muted)]">
                  Seri otomatik · serisizde depo eşiğine göre diyalog · grup satırında beden okutunca bağlanır.
                </p>
              </div>
              {lastMatch ? (
                <div
                  className={cn(
                    'mt-3 border px-3 py-2.5 text-sm',
                    'border-[color-mix(in_oklab,var(--wms-ops-accent)_40%,var(--wms-ops-card-border))]',
                    'bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,var(--wms-ops-card-bg))]',
                    isPremium ? 'rounded-xl' : 'rounded-none',
                  )}
                >
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-ops-accent)]">
                    Son okutma
                  </span>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <strong className="font-mono">{lastMatch.stockCode}</strong>
                    <span className="text-[var(--wms-app-text-muted)]">{lastMatch.stockName}</span>
                    {lastMatch.serialNo ? <span>Seri: <strong>{lastMatch.serialNo}</strong></span> : null}
                    {lastMatch.lotNo ? <span>Lot: <strong>{lastMatch.lotNo}</strong></span> : null}
                  </div>
                </div>
              ) : null}
            </KkdPanel>
            <OpsActionButton variant="secondary" className="w-full" onClick={() => setScansOpen(true)}>
              <List className="size-3.5 shrink-0" />Son okutmalar / geri al
            </OpsActionButton>
          </div>

          {/* Sağ / alt: liste */}
          <div className="min-w-0 space-y-3">
            <KkdPanel title="Toplama durumu" icon={<PackageCheck className="size-4" />}>
              {/* Mobil / dar: kartlar */}
              <div className="space-y-2 md:hidden">
                {lines.map((line) => {
                  const state = linePickState(line);
                  const rowSelected = selectedLineId === line.requestLineId;
                  return (
                    <article
                      key={line.requestLineId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={rowSelected}
                      onClick={() => toggleLineSelection(line)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLineSelection(line); } }}
                      className={cn(
                        'wms-kkd-pick-line-card cursor-pointer',
                        flashLineId === line.requestLineId && 'wms-kkd-pick-flash',
                        state === 'partial' && 'border-[color-mix(in_oklab,#f59e0b_35%,var(--wms-ops-card-border))]',
                        state === 'done' && 'border-[color-mix(in_oklab,#10b981_35%,var(--wms-ops-card-border))]',
                        rowSelected && 'ring-2 ring-[var(--wms-ops-accent)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <input type="radio" checked={rowSelected} readOnly aria-label="Satırı seç" className="mt-1 pointer-events-none" />
                          <div className="min-w-0"><PickLineIdentity line={line} onOpenStockList={setStockListLine} /></div>
                        </div>
                        <PickStatusChip state={state} />
                      </div>
                      <p className="mt-2 text-[0.7rem] text-[var(--wms-app-text-muted)]">
                        Seri / Lot: {line.serialNo || '—'} / {line.lotNo || '—'}
                      </p>
                      <div className="mt-2"><LocationChips line={line} /></div>
                      <PickProgress line={line} />
                    </article>
                  );
                })}
              </div>

              {/* Tablet+ : tablo */}
              <div className="hidden md:block">
                <KkdTableShell>
                  <thead>
                    <tr>
                      <th className={cn(KKD_HEAD_CELL, 'w-8')} />
                      <th className={KKD_HEAD_CELL}>Grup / Stok</th>
                      <th className={KKD_HEAD_CELL}>Raf</th>
                      <th className={KKD_HEAD_CELL}>İlerleme</th>
                      <th className={KKD_HEAD_CELL}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const state = linePickState(line);
                      const rowSelected = selectedLineId === line.requestLineId;
                      return (
                        <tr
                          key={line.requestLineId}
                          role="button"
                          tabIndex={0}
                          aria-pressed={rowSelected}
                          onClick={() => toggleLineSelection(line)}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLineSelection(line); } }}
                          className={cn(
                            'cursor-pointer',
                            flashLineId === line.requestLineId && 'wms-kkd-pick-flash',
                            state === 'partial' && 'bg-[color-mix(in_oklab,#f59e0b_6%,transparent)]',
                            state === 'done' && 'bg-[color-mix(in_oklab,#10b981_6%,transparent)]',
                            rowSelected && 'outline outline-2 -outline-offset-2 outline-[var(--wms-ops-accent)]',
                          )}
                        >
                          <td className={KKD_CELL}>
                            <input type="radio" checked={rowSelected} readOnly aria-label="Satırı seç" className="pointer-events-none" />
                          </td>
                          <td className={KKD_CELL}><PickLineIdentity line={line} onOpenStockList={setStockListLine} /></td>
                          <td className={cn(KKD_CELL, 'min-w-[10rem]')}>
                            <LocationChips line={line} />
                          </td>
                          <td className={cn(KKD_CELL, 'min-w-[9rem]')}>
                            <PickProgress line={line} />
                          </td>
                          <td className={KKD_CELL}><PickStatusChip state={state} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </KkdTableShell>

                {pendingLines.length > 0 ? (
                  <p className="mt-3 text-xs text-[var(--wms-app-text-muted)]">
                    {pendingLines.length} kalem açık — kısmen toplayıp kalanı sonraya bırakabilirsiniz.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                    Tüm kalemler tamam.
                  </p>
                )}
              </div>
            </KkdPanel>

            <div
              className={cn(
                'sticky bottom-2 z-10 flex flex-col gap-2 border p-3 sm:flex-row sm:items-center sm:justify-between',
                'border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-card-bg)_94%,transparent)]',
                'backdrop-blur-sm shadow-[0_-8px_24px_color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)]',
                isPremium ? 'rounded-xl' : 'rounded-none',
              )}
            >
              <p className="text-xs text-[var(--wms-app-text-muted)]">
                {deliverableLines.length === 0
                  ? 'Henüz toplanan yok — önce barkod okutun.'
                  : `${deliverableLines.length} kalem teslime hazır; hazırlayıp bekletebilir veya şimdi teslim edebilirsiniz.`}
              </p>
              <OpsActionButton
                className="w-full sm:w-auto"
                onClick={openDeliveryDialog}
                disabled={deliverableLines.length === 0 || effectiveStage === 'done'}
                loading={effectiveStage === 'finishing'}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />Fiziksel Teslim Onayı
              </OpsActionButton>
            </div>

            {effectiveStage === 'done' ? (
              <KkdCallout tone="success" title="Teslim tamamlandı" icon={<CheckCircle2 className="size-5" />}
                actions={
                  <OpsActionButton variant="secondary" onClick={() => setReceiptOpen(true)}>
                    Teslim belgesini görüntüle
                  </OpsActionButton>
                }
              >
                Ambar çıkışı ve ERP postalaması otomatik yapıldı.
              </KkdCallout>
            ) : null}
          </div>
        </div>
      )}

      {pendingPick && pendingTarget ? (
        <ResponsiveDialog
          onClose={() => { setPendingPick(null); focusBarcode(); }}
          title={pendingPick.requiresThresholdConfirm ? 'Onay eşiği aşıldı' : 'Toplama miktarı'}
          description={
            pendingPick.requiresThresholdConfirm
              ? KKD_PICK_ABOVE_THRESHOLD_CONFIRM_MESSAGE
              : pendingPick.resolved.needsGroupResolve
                ? `${pendingTarget.groupCode} grubu ${pendingPick.resolved.stockCode} stoğuna bağlanacak. Miktarı onaylayın.`
                : `${pendingPick.resolved.stockCode} için miktarı onaylayın. Kalan: ${formatProjectNumber(remainingFor(pendingTarget))} ${pendingTarget.unitCode}.`
          }
          className="!max-w-md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-sm">
              <strong className="font-mono">{pendingPick.resolved.stockCode}</strong>
              <p className="text-[var(--wms-app-text-muted)]">{pendingPick.resolved.stockName}</p>
              {pendingPick.resolved.serialNo ? (
                <p className="mt-1 text-xs">Seri: <strong>{pendingPick.resolved.serialNo}</strong></p>
              ) : null}
              {pendingPick.resolved.lotNo ? (
                <p className="text-xs">Lot: <strong>{pendingPick.resolved.lotNo}</strong></p>
              ) : null}
              {pendingPick.resolved.balanceCandidates.length > 1 ? (
                <p className="mt-2 text-[0.7rem] text-amber-700 dark:text-amber-400">
                  Bu stok için birden fazla raf/seri bulundu; toplama sonrası &quot;Rotayı güncelle&quot;den seçebilirsiniz.
                </p>
              ) : null}
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
              Miktar
            </label>
            <AppInput
              inputMode="decimal"
              value={pendingPick.quantity}
              onChange={(event) => setPendingPick({ ...pendingPick, quantity: event.target.value })}
              onFocus={(event) => event.currentTarget.select()}
              autoFocus
            />
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton
                type="button"
                variant="secondary"
                className="wms-ops-list-toolbar-btn"
                onClick={() => { setPendingPick(null); focusBarcode(); }}
              >
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="primary"
                className="wms-ops-list-toolbar-btn"
                loading={scanBusy}
                onClick={() => void confirmPendingPick()}
              >
                <PackageCheck className="size-3.5" />
                Topla
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}

      {routeDialog ? (
        <ResponsiveDialog
          onClose={() => setRouteDialog(null)}
          title="Rotayı güncelle"
          description={`${routeDialog.line.stockCode} için mevcut rafın dışındaki aday raf/serileri seçin.`}
          className="!max-w-lg"
        >
          {routeDialog.loading ? (
            <div className="grid min-h-32 place-items-center"><Loader2 className="size-6 animate-spin text-[var(--wms-ops-accent)]" /></div>
          ) : routeDialog.candidates.length === 0 ? (
            <KkdCallout tone="warn" title="Aday bulunamadı">
              Bu stok için mevcut rafın dışında kullanılabilir bakiye yok.
            </KkdCallout>
          ) : (
            <div className="space-y-3">
              <div className="max-h-80 space-y-1.5 overflow-y-auto">
                {routeDialog.candidates.map((candidate) => {
                  const key = candidateKey(candidate.locationId, candidate.serialNo);
                  const checked = Boolean(routeDialog.selected[key]);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 border border-[var(--wms-ops-card-border)] p-2.5"
                    >
                      <OpsSkinCheckbox
                        checked={checked}
                        onCheckedChange={(next) => toggleRouteCandidate(candidate, next)}
                        aria-label={candidate.locationCode}
                      />
                      <div className="min-w-0 flex-1">
                        <strong className="block text-sm">{candidate.locationCode}</strong>
                        <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                          {candidate.locationName}
                          {candidate.serialNo ? ` · Seri: ${candidate.serialNo}` : ''}
                          {' · Mevcut: '}{formatProjectNumber(candidate.availableQuantity)}
                        </span>
                      </div>
                      {!routeDialog.isSerial ? (
                        <AppInput
                          className="w-24"
                          inputMode="decimal"
                          disabled={!checked}
                          value={routeDialog.quantities[key] ?? ''}
                          onChange={(event) => setRouteDialog((current) => (current
                            ? { ...current, quantities: { ...current.quantities, [key]: event.target.value } }
                            : current))}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
                <OpsActionButton variant="secondary" onClick={() => setRouteDialog(null)}>Vazgeç</OpsActionButton>
                <OpsActionButton loading={routeDialog.submitting} onClick={() => void submitRouteSplit()}>
                  <RotateCcw className="size-3.5 shrink-0" />Rotayı Uygula
                </OpsActionButton>
              </div>
            </div>
          )}
        </ResponsiveDialog>
      ) : null}

      {stockListLine ? (
        <ResponsiveDialog
          onClose={() => { setStockListLine(null); setStockListSearch(''); }}
          title="Grubu stoğa bağla"
          description={`${stockListLine.groupCode} grubu içinde ara ve bir stok/beden seçin.`}
          className="!max-w-lg"
        >
          <div className="space-y-3">
            <AppInput
              autoFocus
              placeholder="Stok kodu veya adı ile ara…"
              value={stockListSearch}
              onChange={(event) => setStockListSearch(event.target.value)}
            />
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {stockListQuery.isLoading ? (
                <div className="grid min-h-24 place-items-center"><Loader2 className="size-5 animate-spin text-[var(--wms-ops-accent)]" /></div>
              ) : (stockListQuery.data ?? []).length === 0 ? (
                <p className="p-3 text-sm text-[var(--wms-app-text-muted)]">Sonuç bulunamadı.</p>
              ) : (
                (stockListQuery.data ?? []).map((stock) => (
                  <button
                    key={stock.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 border border-transparent p-2.5 text-left hover:border-[var(--wms-ops-card-border)] hover:bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_85%,transparent)]"
                    onDoubleClick={() => void resolveFromStockList(stock)}
                    onClick={() => void resolveFromStockList(stock)}
                  >
                    <span className="min-w-0">
                      <strong className="block font-mono text-sm">{stock.code}</strong>
                      <span className="block text-xs text-[var(--wms-app-text-muted)]">{stock.name}</span>
                    </span>
                    <span className="text-[0.65rem] text-[var(--wms-app-text-muted)]">{stock.unitCode}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}

      {quickStockPickerOpen ? (
        <ResponsiveDialog
          onClose={() => { setQuickStockPickerOpen(false); setQuickStockPickerSearch(''); }}
          title="Stok listesi"
          description="Bu görevdeki stoklardan birini seçin — kod barkod alanına yazılır, okutmuş gibi Onayla'ya basın."
          className="!max-w-lg"
        >
          <div className="space-y-3">
            <AppInput
              autoFocus
              placeholder="Stok kodu veya adı ile ara…"
              value={quickStockPickerSearch}
              onChange={(event) => setQuickStockPickerSearch(event.target.value)}
            />
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {quickPickRows.length === 0 ? (
                <p className="p-3 text-sm text-[var(--wms-app-text-muted)]">
                  {quickStockPickerSearch ? 'Sonuç bulunamadı.' : 'Bu görevde henüz çözülmüş stok yok.'}
                </p>
              ) : (
                quickPickRows.map((line) => (
                  <button
                    key={line.requestLineId}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 border border-transparent p-2.5 text-left hover:border-[var(--wms-ops-card-border)] hover:bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_85%,transparent)]"
                    onClick={() => selectFromQuickStockPicker(line)}
                  >
                    <span className="min-w-0">
                      <strong className="block font-mono text-sm">{line.stockCode}</strong>
                      <span className="block text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                    </span>
                    <span className="text-[0.65rem] text-[var(--wms-app-text-muted)]">{line.unitCode}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}

      {scansOpen ? (
        <ResponsiveDialog onClose={() => setScansOpen(false)} title="Son okutmalar" description="Yanlış okutulan bir kalemi geri alabilirsiniz." className="!max-w-lg">
          <div className="max-h-96 space-y-1.5 overflow-y-auto">
            {scansQuery.isLoading ? (
              <div className="grid min-h-24 place-items-center"><Loader2 className="size-5 animate-spin text-[var(--wms-ops-accent)]" /></div>
            ) : (scansQuery.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-[var(--wms-app-text-muted)]">Henüz okutma yok.</p>
            ) : (
              (scansQuery.data ?? []).map((scan) => (
                <div
                  key={scan.id}
                  className={cn(
                    'flex items-center justify-between gap-2 border p-2.5',
                    scan.isReversed ? 'border-[var(--wms-ops-card-border)] opacity-50' : 'border-[var(--wms-ops-card-border)]',
                  )}
                >
                  <span className="min-w-0">
                    <strong className="block font-mono text-sm">{scan.stockCode}</strong>
                    <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                      {formatProjectNumber(scan.quantity)} {scan.unitCode}
                      {scan.serialNo ? ` · Seri: ${scan.serialNo}` : ''}
                      {scan.isReversed ? ' · Geri alındı' : ''}
                    </span>
                  </span>
                  {scan.canUnpick ? (
                    <OpsActionButton variant="secondary" className="!h-8 !px-2 !text-xs" onClick={() => void unpickScan(scan)}>
                      <Undo2 className="size-3.5 shrink-0" />Geri al
                    </OpsActionButton>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </ResponsiveDialog>
      ) : null}

      {deliveryOpen ? (
        <ResponsiveDialog
          onClose={() => setDeliveryOpen(false)}
          title="Fiziksel Teslim Onayı"
          description="Talep sahibi malzemeyi alınca tam veya eksik teslimi onaylayın. Onaylanmayan miktar hazır bekler, sonra tekrar teslim edilebilir."
          className="!max-w-lg"
        >
          <div className="space-y-3">
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {deliverableLines.map((line) => (
                <div key={line.requestLineId} className="flex items-center justify-between gap-3 border border-[var(--wms-ops-card-border)] p-2.5">
                  <span className="min-w-0">
                    <strong className="block font-mono text-sm">{line.stockCode}</strong>
                    <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                      Hazır: {formatProjectNumber(line.deliverable)} {line.unitCode}
                    </span>
                  </span>
                  <AppInput
                    className="w-24"
                    inputMode="decimal"
                    value={deliveryQuantities[line.requestLineId] ?? ''}
                    onChange={(event) => setDeliveryQuantities((current) => ({ ...current, [line.requestLineId]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton variant="secondary" onClick={() => setDeliveryOpen(false)}>Vazgeç</OpsActionButton>
              <OpsActionButton onClick={() => void confirmDelivery()}>
                <CheckCircle2 className="size-3.5 shrink-0" />Teslimi Onayla
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}

      <KkdDistributionReceiptDialog
        open={receiptOpen && Boolean(receiptDetail.data)}
        onOpenChange={setReceiptOpen}
        detail={receiptDetail.data ?? null}
      />
    </KkdPage>
  );
}
