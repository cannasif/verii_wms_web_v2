import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Barcode, CheckCircle2, HardHat, LayoutGrid, List, MapPinned, Package,
  PackageCheck, PlayCircle, RotateCcw, ScanBarcode, Search, TriangleAlert, Undo2, UserRound, Warehouse,
} from 'lucide-react';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { useTheme } from '@/components/theme-provider';
import {
  resolveStockImageUrl,
  stockImagesApi,
} from '@/features/erp-mirror/api/stock-images.api';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import {
  formatProjectNumber,
  formatProjectQuantity,
  isPieceUnit,
  maskProjectQuantityInput,
  nextQuantityCaret,
  parseLocalizedNumber,
} from '@/lib/project-format';
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
  type KkdPhysicalDeliveryResult,
  type KkdQuotaDecision,
  type KkdStockLookup,
} from './kkd-api';
import { KkdDistributionReceiptDialog } from './KkdDistributionReceiptDialog';

const BOARD_TABS = new Set(['pending', 'preparing', 'completed', 'cancelled', 'mine']);
const PICK_VIEW_STORAGE_KEY = 'kkd-pick-view-mode';
type PickViewMode = 'list' | 'grid';

function readPickViewMode(): PickViewMode {
  try {
    const value = sessionStorage.getItem(PICK_VIEW_STORAGE_KEY);
    return value === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function writePickViewMode(mode: PickViewMode): void {
  try {
    sessionStorage.setItem(PICK_VIEW_STORAGE_KEY, mode);
  } catch {
    /* private mode / quota — tercih kaybolabilir, akış bozulmaz */
  }
}

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
  /** Yanlış bedeni okutup geri aldıktan sonra kalemi doğru stoğa taşıyabilme izni (sunucu kararı). */
  canChangeStock: boolean;
};

type PendingPick = {
  resolved: KkdPreparationResolveScanResult;
  quantity: string;
  /** Üretimdeki requiresThresholdConfirm — eşik üstü ikinci onay. */
  requiresThresholdConfirm?: boolean;
  selected: Record<string, boolean>;
  quantities: Record<string, string>;
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

function maxRouteCandidateQuantity(candidate: RouteCandidate, line: PickLine): number {
  return Math.max(0, Math.min(candidate.availableQuantity, line.targetQuantity));
}

function capRouteQuantity(raw: string, unitCode: string, max: number): string {
  const masked = maskProjectQuantityInput(raw, unitCode);
  if (!masked) return '';
  const parsed = parseLocalizedNumber(masked);
  if (!Number.isFinite(parsed) || parsed <= 0) return masked;
  if (parsed > max) return formatProjectQuantity(max, unitCode);
  return masked;
}

function pickCandidateKey(candidate: { locationId: number; serialNo?: string | null; lotNo?: string | null }): string {
  return `${candidate.locationId}:${candidate.serialNo ?? ''}:${candidate.lotNo ?? ''}`;
}

function maxPickCandidateQuantity(
  candidate: { availableQuantity: number; serialNo?: string | null },
  remaining: number,
  isSerial: boolean,
): number {
  if (isSerial || candidate.serialNo) return Math.max(0, Math.min(1, remaining, candidate.availableQuantity));
  return Math.max(0, Math.min(candidate.availableQuantity, remaining));
}

function buildPendingPick(resolved: KkdPreparationResolveScanResult): PendingPick {
  const unitCode = resolved.unitCode || 'ADET';
  const remaining = resolved.remainingQuantity;
  const candidates = resolved.balanceCandidates ?? [];
  const selected: Record<string, boolean> = {};
  const quantities: Record<string, string> = {};
  const unique = candidates.length === 1;
  for (const candidate of candidates) {
    const key = pickCandidateKey(candidate);
    const max = maxPickCandidateQuantity(candidate, remaining, resolved.isSerial);
    quantities[key] = max > 0 ? formatProjectQuantity(max, unitCode) : '';
    if (unique) selected[key] = true;
  }
  const defaultQty = Math.min(resolved.defaultQuantity, remaining);
  return {
    resolved,
    quantity: defaultQty > 0 ? formatProjectQuantity(defaultQty, unitCode) : '',
    selected,
    quantities,
  };
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
        canChangeStock: line.canChangeStock ?? false,
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
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-[var(--wms-app-text-muted)]">
          {line.groupCode}
          {line.canChangeStock ? (
            <button
              type="button"
              className="wms-ops-grid-icon-btn !size-6"
              title="Yanlış stok bağlandıysa değiştir"
              aria-label="Stoğu değiştir"
              onClick={(event) => { event.stopPropagation(); onOpenStockList(line); }}
            >
              <Search className="size-3" />
            </button>
          ) : null}
        </span>
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

/** Raf sütunu: rota rezervasyonu + toplanmış kaynak izleri. Toplanmış satırlar rota güncellemede
 * silinmediği için (bkz. API SplitRoute) birden fazla çip görülebilir — hangisinin ne olduğu etiketlenir. */
function LocationChips({ line }: { line: PickLine }): ReactElement {
  if (!line.stockId) return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
  if (line.locations.length === 0) return <span className="text-xs text-amber-700 dark:text-amber-400">Henüz raf atanmadı</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {line.locations.map((loc) => {
        const picked = loc.pickedQuantity > 0;
        const reserved = loc.reservedQuantity > 0;
        const roleLabel = picked ? 'toplandı' : reserved ? 'rezerve' : null;
        const role = picked && reserved
          ? 'Kaynak · kısmen toplandı'
          : picked
            ? 'Kaynak · toplandı'
            : reserved
              ? 'Rezerve'
              : 'Raf';
        return (
          <span
            key={`${loc.locationId}-${loc.serialNo ?? ''}`}
            className="wms-kkd-pick-shelf-chip inline-flex max-w-full items-center gap-1 border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_85%,transparent)] px-2 py-0.5 text-[0.68rem]"
            title={`${role} · Rezerve: ${formatProjectNumber(loc.reservedQuantity)} · Toplanan: ${formatProjectNumber(loc.pickedQuantity)}`}
          >
            <MapPinned className="size-3 shrink-0 text-[var(--wms-ops-accent)]" />
            <span className="font-mono font-semibold">{loc.locationCode}</span>
            {roleLabel ? (
              <span className="truncate text-[0.62rem] text-[var(--wms-app-text-muted)]">{roleLabel}</span>
            ) : null}
            {loc.serialNo ? <span className="text-[var(--wms-app-text-muted)]">#{loc.serialNo}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function truncateChipValue(value: string, max = 50): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
}

function PickBackLink({ href }: { href: string }): ReactElement {
  return (
    <Link
      to={href}
      className={cn(
        'wms-kkd-pick-back inline-flex items-center gap-1.5 border px-3 py-1.5 text-[0.82rem] font-semibold',
        'border-[color-mix(in_oklab,var(--wms-ops-accent)_35%,var(--wms-ops-card-border))]',
        'bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-bg))]',
        'text-[var(--wms-ops-accent)] transition-[background,opacity] hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_18%,var(--wms-ops-card-bg))]',
      )}
    >
      <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
      Panoya dön
    </Link>
  );
}

/** "Talep eden · Depo · Hazırlayan" rozeti; tezgâh sayfası toplamadan önceki adımlarda da aynısını kullanır. */
export function PickContextChip({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  const display = truncateChipValue(value);
  return (
    <span
      className={cn(
        'wms-kkd-pick-context-chip inline-flex shrink-0 items-center gap-2 border border-[var(--wms-ops-card-border)]',
        'bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_88%,transparent)] px-2 py-1 text-[var(--wms-ops-shell-fg)]',
      )}
      title={`${label}: ${value}`}
    >
      <span className="shrink-0 text-[var(--wms-ops-accent)]" aria-hidden>{icon}</span>
      <span>
        <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">
          {label}
        </span>
        <span className="block whitespace-nowrap text-[0.78rem] font-medium leading-tight">{display}</span>
      </span>
    </span>
  );
}

function primaryShelfLabel(line: PickLine): { code: string; extra: number } {
  const withPick = line.locations.find((loc) => loc.pickedQuantity > 0);
  const withReserve = line.locations.find((loc) => loc.reservedQuantity > 0);
  const primary = withPick ?? withReserve ?? line.locations[0];
  return {
    code: primary?.locationCode ?? '—',
    extra: Math.max(0, line.locations.length - (primary ? 1 : 0)),
  };
}

function StockThumb({ stockId, stockName }: { stockId: number | null; stockName?: string | null }): ReactElement {
  const query = useQuery({
    queryKey: ['stock-images', stockId],
    queryFn: () => stockImagesApi.list(stockId!),
    enabled: Boolean(stockId && stockId > 0),
    staleTime: 5 * 60_000,
  });
  const image = query.data?.find((item) => item.isPrimary) ?? query.data?.[0] ?? null;
  if (image) {
    return (
      <img
        src={resolveStockImageUrl(image.url)}
        alt={image.altText || stockName || ''}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid h-full w-full place-items-center text-[var(--wms-app-text-muted)]" aria-hidden>
      <Package className="size-8 opacity-45" />
    </span>
  );
}

function PickGridCard({
  line,
  selected,
  flashing,
  onSelect,
  onOpenStockList,
}: {
  line: PickLine;
  selected: boolean;
  flashing: boolean;
  onSelect: () => void;
  onOpenStockList: (line: PickLine) => void;
}): ReactElement {
  const state = linePickState(line);
  const shelf = primaryShelfLabel(line);
  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'wms-kkd-pick-grid-card cursor-pointer',
        flashing && 'wms-kkd-pick-flash',
        state === 'partial' && 'border-[color-mix(in_oklab,#f59e0b_40%,var(--wms-ops-card-border))]',
        state === 'done' && 'border-[color-mix(in_oklab,#10b981_40%,var(--wms-ops-card-border))]',
        selected && 'ring-2 ring-[var(--wms-ops-accent)]',
      )}
    >
      <div className="wms-kkd-pick-grid-card__media">
        <StockThumb stockId={line.stockId} stockName={line.stockName} />
        <span
          className="wms-kkd-pick-grid-card__shelf"
          title={line.locations.map((loc) => {
            const tag = loc.pickedQuantity > 0 ? 'toplandı' : loc.reservedQuantity > 0 ? 'rezerve' : 'raf';
            return `${loc.locationCode} (${tag})`;
          }).join(' · ') || `Raf: ${shelf.code}`}
        >
          <MapPinned className="size-3 shrink-0" />
          {shelf.code}
          {shelf.extra > 0 ? <span className="opacity-80">+{shelf.extra}</span> : null}
        </span>
        <span className="wms-kkd-pick-grid-card__status">
          <PickStatusChip state={state} />
        </span>
      </div>
      <div className="wms-kkd-pick-grid-card__body">
        <div className="min-w-0">
          <strong className="block truncate font-mono text-sm">
            {line.stockCode || line.groupCode}
          </strong>
          <span className="mt-0.5 line-clamp-2 block text-[0.72rem] text-[var(--wms-app-text-muted)]">
            {line.stockName || line.groupName || 'Stok grubu bağlanmamış'}
          </span>
        </div>
        {line.canChangeStock ? (
          <button
            type="button"
            className="wms-ops-grid-icon-btn !size-7 shrink-0"
            title="Yanlış stok bağlandıysa değiştir"
            aria-label="Stoğu değiştir"
            onClick={(event) => { event.stopPropagation(); onOpenStockList(line); }}
          >
            <Search className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="wms-kkd-pick-grid-card__footer">
        <PickProgress line={line} />
      </div>
    </article>
  );
}

/**
 * "Benim İşlerim" hazırlama görevi için barkodlu toplama. Akış: "Bu işi yapıyorum" (raf ataması +
 * gerçek rezervasyon) → barkod/StokKodu**SeriNo okutarak canlı toplama (her onaylanan miktar
 * gerçek stok hareketi olarak postalanır) → istenirse "Rotayı güncelle" / "Stok listesi" / "Geri al" →
 * ayrı bir adım olarak "Fiziksel Teslim Onayı" (tam/eksik, o an ambar çıkışı + teslim belgesi oluşur).
 */
/**
 * Toplama ekranının çerçevesi. Tam sayfa açıldığında kendi başlığı ve "Panoya dön" linki olur; tezgâh
 * (kiosk) akışına gömüldüğünde başlık kiosk sayfasınındır, rozetler içeriğin başına alınır.
 */
function PickShell({
  embedded,
  title,
  description,
  boardHref,
  chips,
  children,
}: {
  embedded: boolean;
  title: string;
  description: string;
  boardHref: string;
  chips?: ReactElement;
  children: ReactNode;
}): ReactElement {
  if (embedded) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {chips ? <div className="flex justify-start sm:justify-end">{chips}</div> : null}
        {children}
      </div>
    );
  }
  return (
    <KkdPage
      title={title}
      description={description}
      hintLabel="Bu sayfa ne yapar?"
      hideEyebrow
      topBar={<PickBackLink href={boardHref} />}
      actions={chips}
    >
      {children}
    </KkdPage>
  );
}

export function KkdPreparationPickingPage(): ReactElement {
  const { requestId, taskId } = useParams();
  const [searchParams] = useSearchParams();
  return (
    <KkdPreparationPickingView
      requestId={Number(requestId)}
      taskId={Number(taskId)}
      boardHref={resolveBoardHref(searchParams.get('returnTab'))}
    />
  );
}

/**
 * Barkodlu toplama ekranı. Rotadan bağımsızdır: hem "Açık KKD talepleri" üzerinden açılan tam sayfa
 * toplama hem de tezgâh akışı aynı bileşeni çalıştırır; böylece iki kanalda iki ayrı toplama davranışı
 * oluşmaz.
 */
export function KkdPreparationPickingView({
  requestId,
  taskId,
  boardHref,
  embedded = false,
  closeTaskOnDelivery = false,
  onFinished,
}: {
  requestId: number;
  taskId: number;
  /** Tam sayfa modunda "Panoya dön" hedefi. */
  boardHref: string;
  /** Kiosk gibi bir sayfanın içine gömülü render. Kendi başlığını ve geri linkini basmaz. */
  embedded?: boolean;
  /**
   * Anlık (tezgâh) teslim: personel malı alıp gittiği için teslimde görev kapatılır ve okutulmayan kalan
   * miktarın rezervasyonu serbest bırakılır. Açık talepler kanalında kapalıdır; orada yarım kalan iş açık
   * durur ve kalanı sonra toplanır.
   */
  closeTaskOnDelivery?: boolean;
  /** Gömülü modda teslim bittikten sonra "Sıradaki kişi" aksiyonu. */
  onFinished?: () => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const currentUser = useAuthStore((state) => state.user);

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
  const [deliveryResult, setDeliveryResult] = useState<KkdPhysicalDeliveryResult | null>(null);
  const [viewMode, setViewMode] = useState<PickViewMode>(() => readPickViewMode());
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
        canChangeStock: taskLine?.canChangeStock ?? false,
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

  const commitPick = async (
    pending: PendingPick,
    confirmAboveThreshold = false,
    selection?: { locationId: number; serialNo?: string | null; lotNo?: string | null; quantity: number },
  ): Promise<void> => {
    const line = lines.find((item) => item.requestLineId === pending.resolved.requestLineId);
    if (!line) {
      throw new Error('Hedef kalem bulunamadı.');
    }
    const maxQty = Math.min(remainingFor(line), pending.resolved.remainingQuantity);
    const pickedQty = selection?.quantity
      ?? (pending.resolved.isSerial
        ? Math.min(1, maxQty)
        : parsePositiveQuantity(pending.quantity, maxQty));
    if (pickedQty == null || pickedQty <= 0) {
      throw new Error('Geçerli bir miktar girin.');
    }
    const sourceLocationId = selection?.locationId ?? pending.resolved.suggestedLocationId ?? null;
    if (!sourceLocationId) {
      throw new Error('Kaynak raf belirlenemedi; birden fazla raf/seri varsa birini seçmelisiniz.');
    }

    const result = await kkdApi.scanPickPreparationTask(taskId, {
      barcode: pending.resolved.rawBarcode,
      expectedTaskLineId: pending.resolved.taskLineId,
      quantity: pending.resolved.isSerial || selection?.serialNo ? 1 : pickedQty,
      sourceLocationId,
      serialNo: selection?.serialNo ?? pending.resolved.serialNo ?? null,
      lotNo: selection?.lotNo ?? pending.resolved.lotNo ?? null,
      expectedRequestLineRowVersion: pending.resolved.needsGroupResolve
        ? line.requestLineRowVersion
        : null,
      confirmAboveThreshold: confirmAboveThreshold || pending.requiresThresholdConfirm === true,
    });
    applyScanResult(result);
    setLastMatch({
      ...pending.resolved,
      serialNo: selection?.serialNo ?? pending.resolved.serialNo,
      lotNo: selection?.lotNo ?? pending.resolved.lotNo,
      suggestedLocationId: selection?.locationId ?? pending.resolved.suggestedLocationId,
    });
    toast.success(`${result.stockCode}: +${formatProjectNumber(result.acceptedQuantity)} toplandı.`);
  };

  /** Üretim ile aynı: resolve → (tek raf + eşik altı otomatik | raf/miktar diyaloğu) → scan-pick. */
  const resolveBarcode = async (rawBarcode?: string): Promise<void> => {
    const scanned = (rawBarcode ?? barcode).trim();
    if (!scanned || !working || !started || !task || scanBusy || pendingPick) return;
    setScanBusy(true);
    try {
      const resolved = await kkdApi.resolvePreparationScan(taskId, {
        barcode: scanned,
        expectedTaskLineId: lines.find((item) => item.requestLineId === selectedLineId)?.taskLineId ?? null,
      });
      if (resolved.defaultQuantity <= 0 || resolved.remainingQuantity <= 0) {
        toast.error('Bu kalemde kalan miktar yok.');
        return;
      }

      const threshold = resolved.autoPickWithoutConfirmMaxQuantity;
      const pending = buildPendingPick(resolved);
      pending.requiresThresholdConfirm = Boolean(
        !resolved.isSerial
        && threshold
        && threshold > 0
        && resolved.defaultQuantity > threshold,
      );
      const candidates = resolved.balanceCandidates ?? [];
      const only = candidates.length === 1 ? candidates[0] : undefined;
      const autoQty = only
        ? Math.min(
          resolved.defaultQuantity,
          maxPickCandidateQuantity(only, resolved.remainingQuantity, resolved.isSerial),
        )
        : 0;
      if (resolved.canAutoPick && only && autoQty > 0) {
        try {
          await commitPick(pending, false, {
            locationId: only.locationId,
            serialNo: only.serialNo,
            lotNo: only.lotNo,
            quantity: autoQty,
          });
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
      toast.error(error instanceof Error ? error.message : 'Barkod çözümlenemedi.');
    } finally {
      setBarcode('');
      setScanBusy(false);
      focusBarcode();
    }
  };

  const confirmPendingPick = async (): Promise<void> => {
    if (!pendingPick || scanBusy) return;
    const candidates = pendingPick.resolved.balanceCandidates ?? [];
    if (candidates.length === 0) {
      toast.error('Bu stok için kullanılabilir raf bakiyesi yok.');
      return;
    }
    const selectedCandidates = candidates.filter((candidate) =>
      pendingPick.selected[pickCandidateKey(candidate)]);
    if (selectedCandidates.length === 0) {
      toast.error('En az bir raf/seri seçin.');
      return;
    }
    const picks = selectedCandidates
      .map((candidate) => {
        const key = pickCandidateKey(candidate);
        const max = maxPickCandidateQuantity(
          candidate,
          pendingPick.resolved.remainingQuantity,
          pendingPick.resolved.isSerial,
        );
        const quantity = pendingPick.resolved.isSerial || candidate.serialNo
          ? Math.min(1, max)
          : parseLocalizedNumber(pendingPick.quantities[key] ?? pendingPick.quantity);
        return { candidate, quantity, max };
      });
    if (picks.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      toast.error('Seçilen her raf için geçerli bir miktar girin.');
      return;
    }
    const total = picks.reduce((sum, item) => sum + item.quantity, 0);
    if (total > pendingPick.resolved.remainingQuantity + 0.000001) {
      toast.error('Seçilen miktar kalemin kalanını aşıyor.');
      return;
    }

    setScanBusy(true);
    try {
      let remaining = pendingPick.resolved.remainingQuantity;
      for (const item of picks) {
        const quantity = Math.min(item.quantity, item.max, remaining);
        if (quantity <= 0) break;
        await commitPick(pendingPick, true, {
          locationId: item.candidate.locationId,
          serialNo: item.candidate.serialNo,
          lotNo: item.candidate.lotNo,
          quantity,
        });
        remaining -= quantity;
      }
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
      const nextQuantities = { ...current.quantities };
      if (checked && !nextQuantities[key]) {
        const unitCode = current.line.unitCode || 'ADET';
        nextQuantities[key] = current.isSerial
          ? '1'
          : formatProjectQuantity(maxRouteCandidateQuantity(candidate, current.line), unitCode);
      }
      return {
        ...current,
        selected: { ...current.selected, [key]: checked },
        quantities: nextQuantities,
      };
    });
  };

  const submitRouteSplit = async (): Promise<void> => {
    if (!routeDialog) return;
    const selections = routeDialog.candidates
      .filter((candidate) => routeDialog.selected[candidateKey(candidate.locationId, candidate.serialNo)])
      .map((candidate) => {
        const key = candidateKey(candidate.locationId, candidate.serialNo);
        const quantity = routeDialog.isSerial
          ? 1
          : Math.min(
            parseLocalizedNumber(routeDialog.quantities[key] ?? ''),
            maxRouteCandidateQuantity(candidate, routeDialog.line),
          );
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
      const rebinding = Boolean(stockListLine.stockId);
      await kkdApi.resolveRequestLine(requestId, stockListLine.requestLineId, {
        stockId: stock.id,
        reason: rebinding
          ? `Toplama sırasında yanlış stok bağlanmıştı; ${stockListLine.stockCode} yerine ${stock.code} seçildi.`
          : 'Stok listesinden manuel bağlandı.',
        expectedRowVersion: stockListLine.requestLineRowVersion,
      });
      toast.success(rebinding
        ? `Kalem ${stock.code} stoğuna taşındı.`
        : `${stockListLine.groupCode} grubu ${stock.code} stoğuna bağlandı.`);
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
      setLastMatch(null);
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
  const setPickViewMode = (mode: PickViewMode): void => {
    setViewMode(mode);
    writePickViewMode(mode);
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

  const openDeliveryDialog = (): void => setDeliveryOpen(true);

  /**
   * Teslim tek sunucu çağrısıdır: miktar sorulmaz (teslim edilen, bekleme rafına okutulan kalemlerin
   * kendisidir) ve dağıtım + ambar çıkışı + ERP gönderimi bir arada yürür. Böylece zincirin ortasında
   * kalan bir adım, talep satırındaki ayrılmış miktarı kilitli bırakmaz.
   */
  const confirmDelivery = async (): Promise<void> => {
    if (!task) return;
    setStage('finishing');
    setDeliveryOpen(false);
    try {
      const result = await kkdApi.deliverPreparationTask(taskId, crypto.randomUUID(), closeTaskOnDelivery);
      setDistributionId(result.distributionId);
      setDeliveryResult(result);
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId] });
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'preparation-tasks', taskId, 'scans'] });
      if (result.excessApprovalStatus === 'Pending') {
        setStage('excess-pending');
        return;
      }
      toast.success(`Fiziksel teslim onaylandı. Ambar çıkışı: ${result.warehouseOutboundDocumentNo}`);
      setStage('done');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Teslim tamamlanamadı.');
      setStage('error');
    }
  };

  if (effectiveStage === 'loading') {
    return (
      <PickShell
        embedded={embedded}
        title="Toplama"
        description="Hazırlama görevi yükleniyor…"
        boardHref={boardHref}
      >
        <div className="grid min-h-60 place-items-center px-4">
          <OpsLoadingState code="PICK" message="Hazırlama görevi yükleniyor…" />
        </div>
      </PickShell>
    );
  }

  if (effectiveStage === 'not-found') {
    return (
      <PickShell
        embedded={embedded}
        title="Toplama"
        description="Hazırlama görevi bulunamadı."
        boardHref={boardHref}
      >
        <KkdCallout tone="danger" icon={<TriangleAlert className="size-5" />} title="Görev bulunamadı">
          Bu görev artık mevcut değil ya da erişim yetkiniz yok.
        </KkdCallout>
      </PickShell>
    );
  }

  const pendingTarget = pendingPick
    ? lines.find((line) => line.requestLineId === pendingPick.resolved.requestLineId)
    : null;

  const contextChips = (
    <div className="wms-kkd-pick-context-row flex flex-nowrap items-center justify-start gap-1.5 overflow-x-auto sm:justify-end sm:gap-2">
      <PickContextChip icon={<HardHat className="size-3.5" />} label="Talep eden" value={employeeLabel} />
      <PickContextChip icon={<Warehouse className="size-3.5" />} label="Depo" value={warehouseLabel} />
      <PickContextChip icon={<UserRound className="size-3.5" />} label="Hazırlayan" value={pickerLabel} />
    </div>
  );

  return (
    <PickShell
      embedded={embedded}
      title={`Toplama · ${task!.taskNo}`}
      description={
        started
          ? "Barkod okutup hazırlama görevini toplar; hazır olanlar için Fiziksel Teslim Onayı ile ambar çıkışı oluşur."
          : "Toplamaya başlamak için önce “Bu işi yapıyorum” deyin — raf ataması ve rezervasyon o an yapılır."
      }
      boardHref={boardHref}
      chips={contextChips}
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
              <OpsActionButton onClick={() => startTask()} loading={startBusy} disabled={quotaBlockedLines.length > 0} className="!px-6">
                <PlayCircle className="size-4 shrink-0" />Bu işi yapıyorum
              </OpsActionButton>
            </div>
          </KkdPanel>
        </div>
      ) : (
        <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          {/* Sol / üst: barkod — Enter/Tab/el terminali Onayla (OpsQrCaptureField onCommit) */}
          <div className="wms-kkd-pick-scan-sticky space-y-3 order-1">
            <KkdPanel
              title="Barkod okut"
              icon={<ScanBarcode className="size-4" />}
              description="Barkodu okutun veya yazıp Onayla’ya basın."
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <OpsActionButton
                    variant="secondary"
                    className="min-h-11 flex-1 sm:min-h-9"
                    disabled={!working || !selectedLine?.stockId}
                    onClick={() => selectedLine && void openRouteDialog(selectedLine)}
                  >
                    <RotateCcw className="size-3.5 shrink-0" />Rotayı güncelle
                  </OpsActionButton>
                  <OpsActionButton
                    variant="secondary"
                    className="min-h-11 flex-1 sm:min-h-9"
                    disabled={!working}
                    onClick={() => setQuickStockPickerOpen(true)}
                  >
                    <List className="size-3.5 shrink-0" />Stok listesi
                  </OpsActionButton>
                </div>
                {!selectedLine ? (
                  <p className="text-[0.7rem] leading-4 text-[var(--wms-app-text-muted)]">
                    Rotayı güncellemek için sağdaki listeden bir kalem seçin.
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
                  className="min-h-12 w-full sm:min-h-10 sm:w-auto"
                  loading={scanBusy}
                  disabled={!working || !barcode.trim() || Boolean(pendingPick)}
                  onClick={() => void resolveBarcode()}
                >
                  <Barcode className="size-4" />
                  Onayla
                </OpsActionButton>
                <p className="text-[0.7rem] leading-4 text-[var(--wms-app-text-muted)]">
                  Tek rafta otomatik toplanır · birden fazla raf/seride kaynak seçilir · grup satırında beden okutunca bağlanır.
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

          {/* Sağ / alt: liste veya grid */}
          <div className="min-w-0 space-y-3 order-2">
            <KkdPanel
              title="Toplama durumu"
              icon={<PackageCheck className="size-4" />}
              actions={
                <div className="wms-kkd-pick-view-toggle" role="group" aria-label="Görünüm">
                  <button
                    type="button"
                    className={cn('wms-kkd-pick-view-toggle__btn', viewMode === 'list' && 'is-active')}
                    aria-pressed={viewMode === 'list'}
                    title="Liste görünümü"
                    onClick={() => setPickViewMode('list')}
                  >
                    <List className="size-3.5" />
                    <span className="hidden sm:inline">Liste</span>
                  </button>
                  <button
                    type="button"
                    className={cn('wms-kkd-pick-view-toggle__btn', viewMode === 'grid' && 'is-active')}
                    aria-pressed={viewMode === 'grid'}
                    title="Kart görünümü"
                    onClick={() => setPickViewMode('grid')}
                  >
                    <LayoutGrid className="size-3.5" />
                    <span className="hidden sm:inline">Kart</span>
                  </button>
                </div>
              }
            >
              {viewMode === 'grid' ? (
                <div className="wms-kkd-pick-grid">
                  {lines.map((line) => (
                    <PickGridCard
                      key={line.requestLineId}
                      line={line}
                      selected={selectedLineId === line.requestLineId}
                      flashing={flashLineId === line.requestLineId}
                      onSelect={() => toggleLineSelection(line)}
                      onOpenStockList={setStockListLine}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* Telefon / el terminali: yoğun liste kartları */}
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
                  </div>
                </>
              )}

              {pendingLines.length > 0 ? (
                <p className="mt-3 text-xs text-[var(--wms-app-text-muted)]">
                  {pendingLines.length} kalem açık — kısmen toplayıp kalanı sonraya bırakabilirsiniz.
                </p>
              ) : (
                <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                  Tüm kalemler tamam.
                </p>
              )}
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

            {effectiveStage === 'done' && deliveryResult ? (
              <KkdCallout tone="success" title="Teslim tamamlandı" icon={<CheckCircle2 className="size-5" />}
                actions={
                  <>
                    <OpsActionButton variant="secondary" onClick={() => setReceiptOpen(true)}>
                      Teslim fişi ({deliveryResult.receiptNo})
                    </OpsActionButton>
                    <OpsActionButton variant="secondary" asChild>
                      <Link to={`/warehouse/warehouse-outbounds/${deliveryResult.warehouseOutboundId}/operations`}>
                        Ambar çıkışı ({deliveryResult.warehouseOutboundDocumentNo})
                      </Link>
                    </OpsActionButton>
                    {embedded && onFinished ? (
                      <OpsActionButton variant="primary" onClick={onFinished}>
                        Sıradaki kişi
                      </OpsActionButton>
                    ) : null}
                  </>
                }
              >
                {deliveryResult.recipientName} adına teslim edildi ve stok ambardan düşüldü.
                {deliveryResult.erpStatus === 'Succeeded'
                  ? ` Netsis belgesi oluştu${deliveryResult.erpDocumentNo ? `: ${deliveryResult.erpDocumentNo}` : ''}.`
                  : ' Netsis gönderimi tamamlanmadı; ambar çıkışı ekranından tekrar gönderebilirsiniz.'}
              </KkdCallout>
            ) : null}
          </div>
        </div>
      )}

      {pendingPick && pendingTarget ? (
        <ResponsiveDialog
          onClose={() => { setPendingPick(null); focusBarcode(); }}
          title={
            pendingPick.requiresThresholdConfirm
              ? 'Onay eşiği aşıldı'
              : (pendingPick.resolved.balanceCandidates?.length ?? 0) > 1
                ? 'Kaynak raf seç'
                : 'Toplama miktarı'
          }
          description={
            pendingPick.requiresThresholdConfirm
              ? KKD_PICK_ABOVE_THRESHOLD_CONFIRM_MESSAGE
              : pendingPick.resolved.needsGroupResolve
                ? `${pendingTarget.groupCode} grubu ${pendingPick.resolved.stockCode} stoğuna bağlanacak. Kaynağı ve miktarı onaylayın.`
                : (pendingPick.resolved.balanceCandidates?.length ?? 0) > 1
                  ? `${pendingPick.resolved.stockCode} birden fazla rafta. Toplamadan önce kaynak raf/seri seçin. Kalan: ${formatProjectQuantity(remainingFor(pendingTarget), pendingTarget.unitCode)} ${pendingTarget.unitCode}.`
                  : `${pendingPick.resolved.stockCode} için miktarı onaylayın. Kalan: ${formatProjectQuantity(remainingFor(pendingTarget), pendingTarget.unitCode)} ${pendingTarget.unitCode}.`
          }
          className="!max-w-xl"
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
            </div>
            {(pendingPick.resolved.balanceCandidates?.length ?? 0) > 0 ? (
              <div>
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                  Kaynak raf / seri
                </p>
                <div className="wms-kkd-route-list max-h-80 overflow-y-auto">
                  {pendingPick.resolved.balanceCandidates.map((candidate) => {
                    const key = pickCandidateKey(candidate);
                    const checked = Boolean(pendingPick.selected[key]);
                    const unitCode = pendingPick.resolved.unitCode || 'ADET';
                    const max = maxPickCandidateQuantity(
                      candidate,
                      pendingPick.resolved.remainingQuantity,
                      pendingPick.resolved.isSerial,
                    );
                    const serialPick = pendingPick.resolved.isSerial || Boolean(candidate.serialNo);
                    return (
                      <div
                        key={key}
                        className={cn(
                          'wms-kkd-route-row flex w-full items-center gap-2.5 border border-transparent px-2 py-1.5',
                          checked && 'wms-kkd-route-row--on',
                        )}
                      >
                        <OpsSkinCheckbox
                          checked={checked}
                          onCheckedChange={(next) => setPendingPick((current) => (current
                            ? { ...current, selected: { ...current.selected, [key]: next } }
                            : current))}
                          aria-label={candidate.locationCode}
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setPendingPick((current) => (current
                            ? { ...current, selected: { ...current.selected, [key]: !checked } }
                            : current))}
                        >
                          <strong className="block truncate text-sm">{candidate.locationCode}</strong>
                          {candidate.locationName && candidate.locationName !== candidate.locationCode ? (
                            <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                              {candidate.locationName}
                            </span>
                          ) : null}
                          {candidate.serialNo ? (
                            <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                              Seri: {candidate.serialNo}
                            </span>
                          ) : null}
                          {candidate.lotNo ? (
                            <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                              Lot: {candidate.lotNo}
                            </span>
                          ) : null}
                          <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                            Mevcut: {formatProjectQuantity(candidate.availableQuantity, unitCode)}
                          </span>
                        </button>
                        {!serialPick ? (
                          <div className="wms-kkd-route-qty" data-disabled={!checked || undefined}>
                            <AppInput
                              className="wms-kkd-route-qty__input w-full text-right tabular-nums"
                              inputMode="decimal"
                              disabled={!checked}
                              readOnly={!checked}
                              tabIndex={checked ? 0 : -1}
                              aria-label="Miktar"
                              placeholder={checked ? '' : '—'}
                              value={checked ? (pendingPick.quantities[key] ?? '') : ''}
                              onFocus={(event) => event.currentTarget.select()}
                              onKeyDown={(event) => {
                                if (event.ctrlKey || event.metaKey || event.altKey) return;
                                if (event.key.length !== 1) return;
                                if (isPieceUnit(unitCode) && !/\d/.test(event.key)) event.preventDefault();
                                else if (!isPieceUnit(unitCode) && !/[\d.,]/.test(event.key)) event.preventDefault();
                              }}
                              onChange={(event) => {
                                const field = event.currentTarget;
                                const caret = field.selectionStart ?? field.value.length;
                                const next = capRouteQuantity(field.value, unitCode, max);
                                const restoreAt = nextQuantityCaret(field.value, caret, next);
                                setPendingPick((current) => (current
                                  ? { ...current, quantities: { ...current.quantities, [key]: next } }
                                  : current));
                                requestAnimationFrame(() => {
                                  field.setSelectionRange(restoreAt, restoreAt);
                                });
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <KkdCallout tone="warn" title="Kaynak raf yok">
                  Bu stok için kullanılabilir raf bakiyesi bulunamadı.
                </KkdCallout>
                <label className="block text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                  Miktar
                </label>
                <AppInput
                  inputMode="decimal"
                  value={pendingPick.quantity}
                  onChange={(event) => {
                    const max = remainingFor(pendingTarget);
                    setPendingPick({
                      ...pendingPick,
                      quantity: capRouteQuantity(event.target.value, pendingTarget.unitCode || 'ADET', max),
                    });
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                  autoFocus
                />
              </>
            )}
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
                disabled={
                  (pendingPick.resolved.balanceCandidates?.length ?? 0) === 0
                  || !Object.values(pendingPick.selected).some(Boolean)
                }
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
          className="!max-w-xl"
        >
          {routeDialog.loading ? (
            <OpsLoadingState compact code="ROUTE" message="Aday raflar yükleniyor…" />
          ) : routeDialog.candidates.length === 0 ? (
            <KkdCallout tone="warn" title="Aday bulunamadı">
              Bu stok için mevcut rafın dışında kullanılabilir bakiye yok.
            </KkdCallout>
          ) : (
            <div className="space-y-3">
              <div className="wms-kkd-route-list max-h-80 overflow-y-auto">
                {routeDialog.candidates.map((candidate) => {
                  const key = candidateKey(candidate.locationId, candidate.serialNo);
                  const checked = Boolean(routeDialog.selected[key]);
                  const unitCode = routeDialog.line.unitCode || 'ADET';
                  const showLocationName = Boolean(
                    candidate.locationName
                    && candidate.locationName !== candidate.locationCode,
                  );
                  return (
                    <div
                      key={key}
                      className={cn(
                        'wms-kkd-route-row flex w-full items-center gap-2.5 border border-transparent px-2 py-1.5',
                        checked && 'wms-kkd-route-row--on',
                      )}
                    >
                      <OpsSkinCheckbox
                        checked={checked}
                        onCheckedChange={(next) => toggleRouteCandidate(candidate, next)}
                        aria-label={candidate.locationCode}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => toggleRouteCandidate(candidate, !checked)}
                      >
                        <strong className="block truncate text-sm">{candidate.locationCode}</strong>
                        {showLocationName ? (
                          <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                            {candidate.locationName}
                          </span>
                        ) : null}
                        {candidate.serialNo ? (
                          <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                            Seri: {candidate.serialNo}
                          </span>
                        ) : null}
                        {candidate.lotNo ? (
                          <span className="block truncate text-[0.7rem] text-[var(--wms-app-text-muted)]">
                            Lot: {candidate.lotNo}
                          </span>
                        ) : null}
                        <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                          Mevcut: {formatProjectQuantity(candidate.availableQuantity, unitCode)}
                        </span>
                      </button>
                      {!routeDialog.isSerial ? (
                        <div className="wms-kkd-route-qty" data-disabled={!checked || undefined}>
                          <AppInput
                            className="wms-kkd-route-qty__input w-full text-right tabular-nums"
                            inputMode="decimal"
                            disabled={!checked}
                            readOnly={!checked}
                            tabIndex={checked ? 0 : -1}
                            aria-label="Miktar"
                            placeholder={checked ? '' : '—'}
                            value={checked ? (routeDialog.quantities[key] ?? '') : ''}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={(event) => {
                              if (event.ctrlKey || event.metaKey || event.altKey) return;
                              if (event.key.length !== 1) return;
                              if (isPieceUnit(unitCode)) {
                                if (!/\d/.test(event.key)) event.preventDefault();
                                return;
                              }
                              if (!/[\d.,]/.test(event.key)) event.preventDefault();
                            }}
                            onChange={(event) => {
                              const field = event.currentTarget;
                              const caret = field.selectionStart ?? field.value.length;
                              const max = maxRouteCandidateQuantity(candidate, routeDialog.line);
                              const next = capRouteQuantity(field.value, unitCode, max);
                              const restoreAt = nextQuantityCaret(field.value, caret, next);
                              setRouteDialog((current) => (current
                                ? { ...current, quantities: { ...current.quantities, [key]: next } }
                                : current));
                              requestAnimationFrame(() => {
                                field.setSelectionRange(restoreAt, restoreAt);
                              });
                            }}
                            onBlur={(event) => {
                              const max = maxRouteCandidateQuantity(candidate, routeDialog.line);
                              const next = capRouteQuantity(event.currentTarget.value, unitCode, max);
                              if (!next) return;
                              setRouteDialog((current) => (current
                                ? { ...current, quantities: { ...current.quantities, [key]: next } }
                                : current));
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
                <OpsActionButton variant="secondary" onClick={() => setRouteDialog(null)}>Vazgeç</OpsActionButton>
                <OpsActionButton loading={routeDialog.submitting} onClick={() => submitRouteSplit()}>
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
          title={stockListLine.stockId ? 'Stoğu değiştir' : 'Grubu stoğa bağla'}
          description={stockListLine.stockId
            ? `${stockListLine.stockCode} yerine ${stockListLine.groupCode} grubundan doğru stok/bedeni seçin.`
            : `${stockListLine.groupCode} grubu içinde ara ve bir stok/beden seçin.`}
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
                <OpsLoadingState compact code="STK" message="Stoklar yükleniyor…" />
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
              <OpsLoadingState compact code="SCAN" message="Okutmalar yükleniyor…" />
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
                    <OpsActionButton variant="secondary" className="!h-8 !px-2 !text-xs" onClick={() => unpickScan(scan)}>
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
          description="Aşağıdaki kalemler bekleme rafında hazır. Onaylarsanız ambar çıkışı ve teslim fişi bu miktarlarla oluşur; okutulmamış kalan miktar görevde açık kalır."
          className="!max-w-xl"
        >
          <div className="space-y-3">
            <div className="wms-kkd-route-list max-h-80 overflow-y-auto">
              {deliverableLines.map((line) => {
                const unitCode = line.unitCode || 'ADET';
                return (
                  <div
                    key={line.requestLineId}
                    className="wms-kkd-route-row flex w-full items-center gap-2.5 border border-[var(--wms-ops-card-border)] px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-mono text-sm">{line.stockCode}</strong>
                      <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatProjectQuantity(line.deliverable, unitCode)} {unitCode}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton variant="secondary" onClick={() => setDeliveryOpen(false)}>Vazgeç</OpsActionButton>
              <OpsActionButton onClick={() => confirmDelivery()}>
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
    </PickShell>
  );
}
