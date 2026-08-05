import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ArrowDown, ArrowRightLeft, ArrowUp, ChevronDown, ChevronUp, CircleHelp, FileText, PackageOpen, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme-provider';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsListPageShell } from '@/components/shared/OpsListPageShell';
import { OpsListSearchField } from '@/components/shared/OpsListSearchField';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { GridExportMenu } from '@/components/shared/GridExportMenu';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { buildTerminalEyebrowFromNav } from '@/components/shared/PremiumEyebrow';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { appendFoldedSearchToken, foldTurkishSearch } from '@/lib/turkish-search';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { productionTransferApi, type ProductionTransferPolicy } from '@/features/production-transfer/api';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { ActiveUserOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import type { PagedResponse } from '@/types/api';
import { productionApi } from './api';
import type { ProductionSourceWorkOrder, PreparedNetsisProductionMaterial, PreparedNetsisProductionWorkOrder } from './types';

const userDisplayName = (user: ActiveUserOption): string =>
  `${user.firstName} ${user.lastName}`.trim() || user.username;

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

const PAGE_DESCRIPTION = 'Şube politikasında seçilen kaynaktaki iş emrini ve reçetesini inceleyin; mevcut üretim transfer akışına aktarın.';

type DateSort = 'asc' | 'desc';

const CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2 py-2 text-center align-middle last:border-r-0';

const RECIPE_EXPORT_COLUMNS = [
  { key: 'lineNo', label: 'Sıra' },
  { key: 'stockCode', label: 'Stok kodu' },
  { key: 'stockName', label: 'Stok adı' },
  { key: 'unitCode', label: 'Birim' },
  { key: 'operationNumber', label: 'Operasyon no' },
  { key: 'recipeQuantity', label: 'Reçete miktarı' },
  { key: 'wasteQuantity', label: 'Fire miktarı' },
  { key: 'requiredQuantity', label: 'Toplam ihtiyaç' },
  { key: 'mappingStatus', label: 'Eşleme durumu' },
];

/**
 * Başlıktaki özet hücreleri, dialog panelinin skin DNA'sını kullanır:
 * terminal'de köşesiz accent çerçeve, premium'da yuvarlak cam kart.
 */
const HEADER_CARD_CLASS = 'wms-ops-detail-panel !px-3 !py-2 max-sm:!px-2.5 max-sm:!py-1.5';

/** Dialog CSS'i aksiyon butonlarına 2.75rem yükseklik dayatıyor; mobilde bunu kırıp kompakt tutar. */
const MODAL_CTA_CLASS =
  'max-sm:w-full max-sm:!min-h-9 max-sm:!gap-1.5 max-sm:!px-3 max-sm:!text-[0.62rem]';

/** Aynı iş emri numarası farklı kaynaklarda tekrar edebildiği için satır kimliği kaynakla birlikte kurulur. */
const workOrderKey = (row: ProductionSourceWorkOrder): string =>
  `${row.sourceType}:${row.sourceSystemCode}:${row.workOrderNumber}`;

/** Her rozet ayrı ayrı eşleşmeli (AND); eşleşme Türkçe katlamalı. */
function matchesSearch(row: ProductionSourceWorkOrder, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = foldTurkishSearch([row.workOrderNumber, row.stockCode, row.stockName ?? '', row.sourceSystemCode].join(' '));
  return terms.every((term) => {
    const folded = foldTurkishSearch(term);
    return !folded || haystack.includes(folded);
  });
}

function dateValue(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function ProductionWorkOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const { skin } = useTheme();
  const { can } = usePermissionAccess();
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const isPremium = skin === 'premium';
  const [policy, setPolicy] = useState<ProductionTransferPolicy>();
  const [searchInput, setSearchInput] = useState('');
  const [searchTokens, setSearchTokens] = useState<string[]>([]);
  const [activeSearch, setActiveSearch] = useState<string[]>([]);
  const [rows, setRows] = useState<ProductionSourceWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PreparedNetsisProductionWorkOrder>();
  const [detailLoading, setDetailLoading] = useState<string>();
  const [dateSort, setDateSort] = useState<DateSort>('desc');
  const eyebrow = buildTerminalEyebrowFromNav(pathname, t, i18n.resolvedLanguage ?? i18n.language) ?? 'VERII WMS';

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try { setRows(await productionApi.sourceWorkOrders(term)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Üretim iş emirleri yüklenemedi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void productionTransferApi.policy(branchCode).then(setPolicy).catch((error: Error) => toast.error(error.message)); }, [branchCode]);

  // Rozet varken serbest metin aramaya karışmaz; rozetsizken yazarken canlı aranır.
  useEffect(() => {
    if (searchTokens.length > 0) {
      setActiveSearch(searchTokens);
      return;
    }
    const timer = window.setTimeout(() => {
      const term = searchInput.trim();
      setActiveSearch(term ? [term] : []);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchTokens]);

  // Servis en fazla 200 kayıt döndürdüğü için rozet eklenirken sunucu tarafında da aranır.
  const commitSearchToken = () => {
    const term = searchInput.trim();
    setSearchTokens((current) => appendFoldedSearchToken(current, searchInput));
    if (term) setSearchInput('');
    void load(term || undefined);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTokens([]);
    setActiveSearch([]);
    void load();
  };

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => matchesSearch(row, activeSearch));
    return [...filtered].sort((a, b) => {
      const delta = dateValue(a.workOrderDate) - dateValue(b.workOrderDate);
      return dateSort === 'asc' ? delta : -delta;
    });
  }, [rows, activeSearch, dateSort]);

  const open = async (row: ProductionSourceWorkOrder) => {
    setDetailLoading(workOrderKey(row));
    try { setSelected(await productionApi.prepareSourceWorkOrder(row)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'İş emri reçetesi hazırlanamadı.'); }
    finally { setDetailLoading(undefined); }
  };

  const sourceLabel = policy?.productionOrderSource === 'ErpAndWms'
    ? `Netsis ERP + ${policy.wmsSourceSystemCode}`
    : policy?.productionOrderSource === 'WmsIntegrationTables' ? policy.wmsSourceSystemCode : 'Netsis ERP';

  const toggleDateSort = () => setDateSort((current) => (current === 'asc' ? 'desc' : 'asc'));

  const title = (
    <span className="inline-flex items-center gap-2">
      Üretime Transfer İş Emirleri
      {isPremium ? (
        <TooltipProvider delayDuration={160}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="wms-ops-gr-page-hero__hint" aria-label="Sayfa bilgilendirmesi">
                <CircleHelp className="size-3.5" aria-hidden />
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
                  <span className="size-1.5 rounded-full bg-[var(--wms-ops-accent)] shadow-[0_0_8px_var(--wms-ops-accent)]" aria-hidden />
                  Bilgilendirme
                </span>
              </div>
              <p className="px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">{PAGE_DESCRIPTION}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );

  return <>
    <OpsListPageShell
      eyebrow={eyebrow}
      title={title}
      description={isPremium ? undefined : PAGE_DESCRIPTION}
      actions={(
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center justify-end gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-app-text-muted)]">
            <span>Kaynak</span>
            <OpsCodeBadge>{sourceLabel}</OpsCodeBadge>
          </div>
          {can('WMS.PRODUCTION_TRANSFER.CREATE') ? (
            <OpsActionButton
              variant="primary"
              // Taslak sayfası varsayılan olarak plansız/manuel (StockBased) emirli akışla açılır.
              onClick={() => navigate('/warehouse/production-transfers/new')}
            >
              <Plus className="size-3.5" aria-hidden />
              Yeni kayıt
            </OpsActionButton>
          ) : null}
        </div>
      )}
    >
      <div className="wms-ops-data-grid min-w-0 space-y-0">
        <div className="wms-ops-data-grid-toolbar flex flex-wrap items-start justify-between gap-2">
          <div className="wms-ops-data-grid-toolbar__start flex min-w-0 !grow flex-wrap items-start gap-2">
            <div className="wms-ops-grid-search wms-ops-grid-search--tokens" data-no-auto-localize="true">
              <OpsListSearchField
                value={searchInput}
                placeholder="İş emri veya mamul ara..."
                title="Enter ile rozet ekleyin"
                onValueChange={setSearchInput}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitSearchToken();
                }}
                className="!w-full !max-w-none"
                rightSlot={searchInput || searchTokens.length > 0 ? (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={clearSearch}
                    className="wms-ops-voice-btn grid place-items-center"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined}
              />
              {searchTokens.length > 0 ? (
                <div className="wms-ops-grid-search__chips" aria-label="Aktif arama rozetleri">
                  {searchTokens.map((token) => (
                    <span key={token} className="wms-ops-grid-search__chip">
                      <span className="wms-ops-grid-search__chip-text">{token}</span>
                      <button
                        type="button"
                        className="wms-ops-grid-search__chip-remove"
                        onClick={() => setSearchTokens((current) => current.filter((item) => item !== token))}
                        aria-label={`${token} rozetini kaldır`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="wms-ops-grid-search__clear" onClick={clearSearch}>
                    Rozetleri temizle
                  </button>
                </div>
              ) : null}
            </div>
            <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" onClick={commitSearchToken} disabled={loading}>
              <Search className="size-3.5" aria-hidden />
              <span>Ara</span>
            </OpsActionButton>
            <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => void load()} disabled={loading} title="Açık iş emirlerini yenile">
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden />
              <span className="hidden md:inline">Yenile</span>
            </OpsActionButton>
          </div>
        </div>

        {/* Skin'in tablo sarmalayıcı sınıfları yatay kaydırmayı zorunlu kıldığı için burada kullanılmaz; kolonlar sığıyor. */}
        <div className="wms-ops-scrollbar relative mt-4 block max-h-[max(20rem,calc(100dvh-26rem))] overflow-x-auto overflow-y-auto border border-[var(--wms-ops-card-border)] max-sm:hidden">
          <table className="wms-ops-data-grid w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={CELL}>İş emri</th>
                <th className={CELL}>Kaynak</th>
                <th className={CELL}>Mamul</th>
                <th className={CELL}>Miktar / birim</th>
                <th className={CELL}>
                  <button
                    type="button"
                    onClick={toggleDateSort}
                    className="inline-flex items-center justify-center gap-1.5 font-semibold uppercase tracking-wide"
                    title={dateSort === 'asc' ? 'Tarihe göre artan (tıkla: azalan)' : 'Tarihe göre azalan (tıkla: artan)'}
                    aria-label="Tarihe göre sırala"
                  >
                    Tarih
                    {dateSort === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                  </button>
                </th>
                <th className={CELL}>Proje</th>
                <th className={CELL}>Depo akışı</th>
                <th className={CELL} aria-label="İşlem" />
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wms-ops-grid-state-cell">
                    <OpsLoadingState message="İş emirleri yükleniyor…" code="FETCH" compact />
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message={activeSearch.length > 0 ? 'Aramaya uygun açık iş emri bulunamadı.' : 'Seçili kaynakta transfere hazır açık iş emri bulunamadı.'} />
                  </td>
                </tr>
              ) : visibleRows.map((row) => (
                <tr key={workOrderKey(row)} onClick={() => void open(row)} className="cursor-pointer">
                  <td className={cn(CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>{row.workOrderNumber}</td>
                  <td className={CELL}>
                    <OpsCodeBadge>{row.sourceSystemCode}</OpsCodeBadge>
                    {row.revisionNumber > 1 ? (
                      <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Rev. {row.revisionNumber}</div>
                    ) : null}
                  </td>
                  <td className={CELL}>
                    <strong className="block">{row.stockCode}</strong>
                    <div className="mx-auto max-w-80 truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                  </td>
                  <td className={cn(CELL, 'font-bold')}>{formatProjectNumber(row.workOrderQuantity)} {row.unitCode ?? ''}</td>
                  <td className={CELL}>{formatProjectDate(row.workOrderDate)}</td>
                  <td className={CELL}>{row.projectCode || '—'}</td>
                  <td className={CELL}>{row.issueWarehouseCode} → {row.warehouseCode}</td>
                  <td className={CELL}>
                    <OpsActionButton
                      variant="secondary"
                      className="wms-ops-list-toolbar-btn mx-auto"
                      loading={detailLoading === workOrderKey(row)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void open(row);
                      }}
                    >
                      <FileText className="size-3.5" aria-hidden />
                      <span>Reçeteyi aç</span>
                    </OpsActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 sm:hidden" aria-live="polite">
          {loading && rows.length === 0 ? (
            <div className="border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,transparent)] p-4">
              <OpsLoadingState message="İş emirleri yükleniyor…" code="FETCH" compact />
            </div>
          ) : visibleRows.length === 0 ? (
            <OpsGridEmptyState message={activeSearch.length > 0 ? 'Aramaya uygun açık iş emri bulunamadı.' : 'Seçili kaynakta transfere hazır açık iş emri bulunamadı.'} />
          ) : (
            <>
              <button
                type="button"
                onClick={toggleDateSort}
                className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-brand-primary)]"
              >
                Tarih {dateSort === 'asc' ? 'artan' : 'azalan'}
                {dateSort === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
              </button>
              {visibleRows.map((row) => (
                <article key={`${workOrderKey(row)}-card`} className="overflow-hidden border border-[var(--wms-ops-card-border)] bg-[var(--wms-ops-card-bg)]">
                  <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono text-sm font-black text-[var(--wms-brand-primary)]">{row.workOrderNumber}</div>
                      <OpsCodeBadge>{row.sourceSystemCode}</OpsCodeBadge>
                    </div>
                    <strong className="mt-1 block text-sm">{row.stockCode}</strong>
                    <div className="truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
                    <CardStat label="Miktar" value={`${formatProjectNumber(row.workOrderQuantity)} ${row.unitCode ?? ''}`} />
                    <CardStat label="Tarih" value={formatProjectDate(row.workOrderDate)} />
                    <CardStat label="Proje" value={row.projectCode || '—'} />
                    <CardStat label="Depo akışı" value={`${row.issueWarehouseCode} → ${row.warehouseCode}`} />
                  </dl>
                  <div className="border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-3 py-2.5">
                    <OpsActionButton
                      variant="secondary"
                      className="wms-ops-list-toolbar-btn w-full"
                      loading={detailLoading === workOrderKey(row)}
                      onClick={() => void open(row)}
                    >
                      <FileText className="size-3.5" aria-hidden />
                      <span>Reçeteyi aç</span>
                    </OpsActionButton>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </OpsListPageShell>
    {selected && (
      <WorkOrderDrawer
        value={selected}
        close={() => setSelected(undefined)}
        createTransfer={(assignee, materials) => navigate('/warehouse/production-transfers/new', {
          state: { netsisProduction: { ...selected, materials }, assignees: [assignee] },
        })}
        canCreateTransfer={can('WMS.PRODUCTION_TRANSFER.CREATE')}
      />
    )}
  </>;
}

function WorkOrderDrawer({
  value,
  close,
  createTransfer,
  canCreateTransfer,
}: {
  value: PreparedNetsisProductionWorkOrder;
  close: () => void;
  createTransfer: (assignee: ActiveUserOption, materials: PreparedNetsisProductionMaterial[]) => void;
  canCreateTransfer: boolean;
}): ReactElement {
  const blocked = value.mappingErrors.length > 0 || value.isClosed;
  const alreadyImported = Boolean(value.existingProductionOrderId);
  // Dar ekranda başlık bloğu yer kapladığı için varsayılan kapalı; sm ve üstünde her zaman açık.
  const [headerOpen, setHeaderOpen] = useState(false);
  const [assignee, setAssignee] = useState<ActiveUserOption | null>(null);
  const [assigneeLookupOpen, setAssigneeLookupOpen] = useState(false);
  const [assigneeHintOpen, setAssigneeHintOpen] = useState(false);
  const [selectedLines, setSelectedLines] = useState<ReadonlySet<number>>(
    () => new Set(value.materials.map((_, index) => index)),
  );

  // Başka bir iş emri açıldığında seçim tüm kalemlerle yeniden başlar.
  useEffect(() => {
    setSelectedLines(new Set(value.materials.map((_, index) => index)));
  }, [value]);

  const selectedCount = selectedLines.size;
  const allSelected = value.materials.length > 0 && selectedCount === value.materials.length;
  const toggleLine = (index: number): void =>
    setSelectedLines((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  const toggleAllLines = (): void =>
    setSelectedLines(allSelected ? new Set() : new Set(value.materials.map((_, index) => index)));
  const footerHint = blocked || !canCreateTransfer
    ? null
    : !assignee
      ? 'Devam etmek için emir sorumlusu seçin.'
      : selectedCount === 0
        ? 'Devam etmek için en az bir reçete bileşeni seçin.'
        : null;
  const recipeExportRows = value.materials.map((material, index) => ({
    lineNo: index + 1,
    stockCode: material.stockCode,
    stockName: material.stockName ?? '',
    unitCode: material.unitCode,
    operationNumber: material.operationNumber,
    recipeQuantity: material.recipeQuantity,
    wasteQuantity: material.wasteQuantity,
    requiredQuantity: material.requiredQuantity,
    mappingStatus: material.mappingError ?? 'Hazır',
  }));
  const recipeExportFileName = `Recete_${value.workOrderNumber.replace(/[^\p{L}\p{N}._-]+/gu, '_')}`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        className={cn(
          'wms-ops-detail-dialog wms-ops-form flex !h-[min(90dvh,880px)] !max-h-[calc(100dvh-2.5rem)] w-full flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0',
          // Geniş ekranda 72rem; dar ekranda kenarlara yaslanmasın diye pay bırakılır.
          '!max-w-[min(72rem,calc(100%-2.5rem))]',
          '[scrollbar-gutter:auto]',
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0 max-sm:!py-2.5">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="min-w-0 pr-2 lg:w-[20rem] lg:shrink-0">
            <p className={cn('mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300', !headerOpen && 'max-sm:hidden')}>
              {value.sourceSystemCode} · İş emri / reçete
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title max-sm:!text-[0.72rem]">
              <span className="whitespace-nowrap">İş emri</span>
              <span className="ml-2 font-mono text-base font-bold text-cyan-600 max-sm:text-sm dark:text-cyan-300">
                {value.workOrderNumber}
              </span>
            </DialogTitle>
            <DialogDescription className={cn('wms-ops-detail-dialog__description', !headerOpen && 'max-sm:hidden')}>
              {value.productCode} · {value.productName}
            </DialogDescription>
            <div className={cn('mt-3 flex flex-wrap gap-2', !headerOpen && 'max-sm:hidden')}>
              <OpsStatusBadge tone={value.isClosed ? 'danger' : 'active'}>
                {value.isClosed ? 'Kapalı iş emri' : 'Açık iş emri'}
              </OpsStatusBadge>
              <OpsStatusBadge
                tone={value.mappingErrors.length > 0 ? 'danger' : 'done'}
                title={value.mappingErrors.length > 0 ? 'ERP mirror eşlemeleri tamamlanmadan aktarım yapılamaz.' : undefined}
              >
                {value.mappingErrors.length > 0 ? `${value.mappingErrors.length} eşleme hatası` : 'Eşlemeler hazır'}
              </OpsStatusBadge>
              {alreadyImported ? (
                <OpsStatusBadge tone="pending">WMS’e alınmış</OpsStatusBadge>
              ) : null}
              <OpsCodeBadge className="max-sm:hidden">{value.unitCode || '—'}</OpsCodeBadge>
            </div>
            <button
              type="button"
              onClick={() => setHeaderOpen((current) => !current)}
              aria-expanded={headerOpen}
              className="mt-2 inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-brand-primary)] sm:hidden"
            >
              {headerOpen ? 'Bilgileri gizle' : 'Bilgileri göster'}
              {headerOpen ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            </button>
          </div>
          <div
            className={cn(
              'grid min-w-0 grid-cols-2 gap-2 lg:flex-1 lg:grid-cols-4',
              !headerOpen && 'max-sm:hidden',
            )}
          >
            <SummaryCell className={HEADER_CARD_CLASS} label="İş emri miktarı" value={`${formatProjectNumber(value.plannedQuantity)} ${value.unitCode}`} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Proje" value={value.projectCode || '—'} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Çıkış deposu" value={`${value.sourceWarehouseCode} · ${value.sourceWarehouseName ?? 'Eşleşmedi'}`} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Üretim deposu" value={`${value.targetWarehouseCode} · ${value.targetWarehouseName ?? 'Eşleşmedi'}`} />
          </div>
          </div>
        </header>

        <div className="wms-ops-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <section className="space-y-4">
            <div className="wms-ops-detail-panel p-3 sm:p-4">
              <div className="flex items-center gap-1.5">
                <h3 className="wms-ops-detail-section-title !border-0 !p-0">Emir sorumlusu</h3>
                <TooltipProvider delayDuration={160}>
                  <Tooltip open={assigneeHintOpen} onOpenChange={setAssigneeHintOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Emir sorumlusu hakkında"
                        onClick={() => setAssigneeHintOpen((current) => !current)}
                        className="inline-flex size-5 items-center justify-center rounded-full text-[var(--wms-app-text-muted)] transition hover:text-[var(--wms-brand-primary)]"
                      >
                        <CircleHelp className="size-4" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-[16rem]">
                      Transferi hazırlamadan önce görevi üstlenecek depo çalışanını seçin; transfer bu kişiye atanmış olarak açılır.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="mt-2">
                <PagedLookupDialog<ActiveUserOption>
                  variant="ops"
                  triggerMode="combobox"
                  autoSearchMinLength={1}
                  popoverPortalContainer={null}
                  openDialogOnTouchTap
                  open={assigneeLookupOpen}
                  onOpenChange={setAssigneeLookupOpen}
                  title="Emir sorumlusu seçin"
                  value={assignee ? userDisplayName(assignee) : null}
                  placeholder="Depo çalışanı seçin"
                  searchPlaceholder="Ad, kullanıcı adı veya e-posta ile arayın"
                  emptyText="Eşleşen depo çalışanı bulunamadı."
                  triggerClassName="!h-11 !py-2 !pl-9 !pr-3"
                  queryKey={['production-work-order-assignee']}
                  fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                    toPagedResponse(await warehouseTransferApi.activeUsers({
                      pageNumber,
                      pageSize,
                      search,
                      sortBy: 'username',
                      sortDirection: 'asc',
                      signal: signal ?? new AbortController().signal,
                    }))
                  }
                  getKey={(user) => String(user.id)}
                  getLabel={(user) => userDisplayName(user)}
                  onSelect={setAssignee}
                />
              </div>
              {assignee ? (
                <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">
                  Görev <strong className="text-[var(--wms-brand-primary)]">{userDisplayName(assignee)}</strong> kullanıcısına atanacak.
                </p>
              ) : null}
            </div>

            {alreadyImported ? (
              <div className="wms-ops-detail-panel p-4 text-sm">
                <strong className="text-amber-500">Bu {value.sourceSystemCode} iş emri daha önce WMS’e alındı.</strong>
                <div className="mt-1 text-[var(--wms-app-text-muted)]">
                  WMS belgesi: {value.existingProductionDocumentNo}. Yeni WMS emri oluşturulamaz; bağlı transfer hazırlanabilir.
                </div>
              </div>
            ) : null}

            {value.mappingErrors.length > 0 ? (
              <div className="wms-ops-detail-panel p-4 text-sm">
                <strong className="text-red-500">Aktarım öncesi ERP mirror eşlemeleri tamamlanmalı:</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--wms-app-text-muted)]">
                  {value.mappingErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="wms-ops-detail-section-title !border-0 !p-0">Reçete bileşenleri</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {value.materials.length} bileşen · <strong className="text-[var(--wms-brand-primary)]">{selectedCount}</strong> seçili
                </p>
              </div>
              <GridExportMenu
                fileName={recipeExportFileName}
                columns={RECIPE_EXPORT_COLUMNS}
                rows={recipeExportRows}
                compactMobile
                portalContainer={typeof document === 'undefined' ? undefined : document.body}
              />
            </div>

            {value.materials.length === 0 ? (
              <div className="wms-ops-detail-empty flex flex-col items-center gap-2 p-8 text-center">
                <PackageOpen className="wms-ops-detail-empty__icon size-8 opacity-40" aria-hidden />
                <p className="wms-ops-detail-empty__title text-sm text-slate-500">Bu iş emrine bağlı reçete bileşeni bulunamadı.</p>
              </div>
            ) : (
              <>
              <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto max-sm:hidden">
                <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <OpsSkinCheckbox
                          aria-label="Tüm bileşenleri seç"
                          checked={allSelected}
                          indeterminate={selectedCount > 0 && !allSelected}
                          onCheckedChange={toggleAllLines}
                        />
                      </th>
                      <th>#</th>
                      <th>Bileşen</th>
                      <th>Birim</th>
                      <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
                      <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
                      <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
                      <th>Eşleme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.materials.map((row, index) => (
                      <tr
                        key={`${row.stockCode}-${row.operationNumber}-${index}`}
                        className={cn(!selectedLines.has(index) && 'opacity-55')}
                      >
                        <td>
                          <OpsSkinCheckbox
                            aria-label={`${row.stockCode} bileşenini seç`}
                            checked={selectedLines.has(index)}
                            onCheckedChange={() => toggleLine(index)}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{row.stockCode}</strong>
                          <div className="wms-ops-gr-detail-lines-table__muted text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                        </td>
                        <td>{row.unitCode}</td>
                        <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.recipeQuantity)}</td>
                        <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.wasteQuantity)}</td>
                        <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                          {formatProjectNumber(row.requiredQuantity)}
                        </td>
                        <td>
                          <OpsStatusBadge tone={row.mappingError ? 'danger' : 'done'} title={row.mappingError ?? undefined}>
                            {row.mappingError ?? 'Hazır'}
                          </OpsStatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wms-app-text-muted)] sm:hidden">
                <OpsSkinCheckbox
                  aria-label="Tüm bileşenleri seç"
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  onCheckedChange={toggleAllLines}
                />
                <button type="button" onClick={toggleAllLines}>Tümünü seç</button>
              </div>

              <div className="space-y-3 sm:hidden">
                {value.materials.map((row, index) => (
                  <article
                    key={`${row.stockCode}-${row.operationNumber}-${index}-card`}
                    className={cn('wms-ops-detail-panel overflow-hidden', !selectedLines.has(index) && 'opacity-55')}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <OpsSkinCheckbox
                          aria-label={`${row.stockCode} bileşenini seç`}
                          className="mt-0.5"
                          checked={selectedLines.has(index)}
                          onCheckedChange={() => toggleLine(index)}
                        />
                        <div className="min-w-0">
                          <strong className="block text-sm">{row.stockCode}</strong>
                          <div className="truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                        </div>
                      </div>
                      <OpsStatusBadge tone={row.mappingError ? 'danger' : 'done'} title={row.mappingError ?? undefined}>
                        {row.mappingError ? 'Hata' : 'Hazır'}
                      </OpsStatusBadge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
                      <CardStat label="Birim" value={row.unitCode} />
                      <CardStat label="Reçete" value={formatProjectNumber(row.recipeQuantity)} />
                      <CardStat label="Fire" value={formatProjectNumber(row.wasteQuantity)} />
                      <CardStat label="Toplam ihtiyaç" value={formatProjectNumber(row.requiredQuantity)} accent />
                    </dl>
                  </article>
                ))}
              </div>
              </>
            )}
          </section>
        </div>

        <footer className="wms-ops-actions wms-ops-detail-dialog__footer flex shrink-0 flex-col-reverse gap-1.5 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:px-6 sm:py-4">
          {footerHint ? (
            <span className="text-xs text-[var(--wms-app-text-muted)] max-sm:text-[0.62rem] sm:mr-auto">{footerHint}</span>
          ) : null}
          <OpsActionButton
            variant="primary"
            className={MODAL_CTA_CLASS}
            disabled={blocked || !canCreateTransfer || !assignee || selectedCount === 0}
            onClick={() => {
              if (!assignee || selectedCount === 0) return;
              createTransfer(assignee, value.materials.filter((_, index) => selectedLines.has(index)));
            }}
          >
            <ArrowRightLeft className="size-4 max-sm:size-3.5" aria-hidden />
            {selectedCount === value.materials.length
              ? 'Doğrudan transfer hazırla'
              : `Seçili ${selectedCount} kalem için transfer hazırla`}
          </OpsActionButton>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** Mobil kartlarda etiket/değer; hem liste hem dialog kapsamında çalışsın diye dialog'a scope'lu CSS yerine utility kullanır. */
function CardStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)]">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-sm font-semibold', accent && 'text-[var(--wms-brand-primary)]')}>{value}</dd>
    </div>
  );
}

function SummaryCell({ label, value, className }: { label: string; value: string; className?: string }): ReactElement {
  return (
    <div className={cn('wms-ops-detail-summary-cell', className)}>
      <span className="wms-ops-detail-summary-cell__label">{label}</span>
      <span className="wms-ops-detail-summary-cell__value">{value}</span>
    </div>
  );
}
