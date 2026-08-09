import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type UIEvent,
} from "react";
import {
  Check,
  LayoutGrid,
  List as ListIcon,
  Package,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/ui/dialog";
import {
  OpsDialogContent,
  OpsDialogHeader,
} from "@/components/shared/OpsDialogShell";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OpsLoadingState } from "@/components/shared/OpsLoadingState";
import { AppInput } from "@/components/shared/AppInput";
import { useDropdownInfiniteSearch } from "@/hooks/useDropdownInfiniteSearch";
import { warehouseTransferApi } from "@/features/warehouse-transfer-v2/api/warehouse-transfer.api";
import type { StockOption } from "@/features/goods-receipt-v2/types/goods-receipt.types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 24;
const SCROLL_THRESHOLD = 0.82;
const MIN_SEARCH_CHARS = 2;

type ViewMode = "list" | "card";

export function StockSelectDialog({
  open,
  onOpenChange,
  branchCode,
  selectedStockId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchCode: string;
  selectedStockId?: number;
  onSelect: (stock: StockOption) => void | Promise<void>;
}): ReactElement {
  const { t } = useTranslation("common");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedSearch("");
      setViewMode("list");
      return;
    }
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, searchQuery]);

  const stocksQuery = useDropdownInfiniteSearch<StockOption>({
    queryKey: ["stock-select-dialog", branchCode],
    searchTerm: debouncedSearch,
    enabled: open,
    minSearchLength: MIN_SEARCH_CHARS,
    pageSize: PAGE_SIZE,
    sortBy: "erpStockCode",
    sortDirection: "asc",
    searchFields: ["erpStockCode", "stockName"],
    fetchPage: (request) => warehouseTransferApi.stocks(request, branchCode),
  });

  const stocks = useMemo(() => stocksQuery.items, [stocksQuery.items]);
  const isThresholdInput =
    searchQuery.trim().length > 0 && searchQuery.trim().length < MIN_SEARCH_CHARS;

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!stocksQuery.hasNextPage || stocksQuery.isFetchingNextPage) return;
      const target = event.currentTarget;
      if (target.scrollHeight <= 0) return;
      const progress = (target.scrollTop + target.clientHeight) / target.scrollHeight;
      if (progress >= SCROLL_THRESHOLD) {
        void stocksQuery.fetchNextPage();
      }
    },
    [stocksQuery],
  );

  const handleSelect = (stock: StockOption) => {
    void Promise.resolve(onSelect(stock)).then(() => onOpenChange(false));
  };

  const renderContent = (): ReactElement => {
    if (stocksQuery.isLoading) {
      return (
        <div className="flex min-h-[240px] items-center justify-center">
          <OpsLoadingState code="STK" message={t("stockSelectDialog.loading")} compact />
        </div>
      );
    }

    if (stocksQuery.isError) {
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-red-500">
          <span>{t("stockSelectDialog.loadFailed")}</span>
          <OpsActionButton variant="secondary" onClick={() => void stocksQuery.refetch()}>
            {t("common.retry", { defaultValue: "Tekrar dene" })}
          </OpsActionButton>
        </div>
      );
    }

    if (isThresholdInput) {
      return (
        <div className="flex min-h-[240px] items-center justify-center px-6 text-center text-sm text-[var(--wms-app-text-muted)]">
          {t("stockSelectDialog.minChars", { count: MIN_SEARCH_CHARS })}
        </div>
      );
    }

    if (stocks.length === 0) {
      return (
        <div className="flex min-h-[240px] items-center justify-center px-6 text-center text-sm text-[var(--wms-app-text-muted)]">
          {searchQuery.trim()
            ? t("stockSelectDialog.noResults")
            : t("stockSelectDialog.emptyBrowse")}
        </div>
      );
    }

    if (viewMode === "list") {
      const borderColor = "border-[var(--wms-app-border)]";
      return (
        <div className="rounded-2xl bg-[var(--wms-app-border)] p-px shadow-sm">
          <div className="isolate overflow-hidden rounded-[calc(1rem-1px)] bg-[var(--wms-app-panel)]">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                <th
                  className={cn(
                    "w-[140px] bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-start",
                    borderColor,
                    "border-b border-e",
                  )}
                >
                  {t("stockSelectDialog.colCode")}
                </th>
                <th
                  className={cn(
                    "bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-start",
                    borderColor,
                    "border-b border-e",
                  )}
                >
                  {t("stockSelectDialog.colName")}
                </th>
                <th
                  className={cn(
                    "w-20 bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-center",
                    borderColor,
                    "border-b border-e",
                  )}
                >
                  {t("stockSelectDialog.colUnit")}
                </th>
                <th
                  className={cn(
                    "w-28 bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,var(--wms-app-panel))] px-3 py-2.5 text-center",
                    borderColor,
                    "border-b",
                  )}
                >
                  {t("stockSelectDialog.colAction")}
                </th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, rowIndex) => {
                const selected = stock.id === selectedStockId;
                const isLast = rowIndex === stocks.length - 1;
                const rowBorder = !isLast ? "border-b" : "";
                return (
                  <tr
                    key={stock.id}
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-[var(--wms-brand-soft)]",
                      selected && "bg-[var(--wms-brand-soft)]",
                    )}
                    onClick={() => handleSelect(stock)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelect(stock);
                      }
                    }}
                  >
                    <td
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        borderColor,
                        "border-e",
                        rowBorder,
                      )}
                    >
                      <span className="font-mono text-xs font-semibold text-[var(--wms-brand-primary)]">
                        {stock.erpStockCode}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        borderColor,
                        "border-e",
                        rowBorder,
                      )}
                    >
                      <span className="line-clamp-2 text-sm font-medium text-[var(--wms-app-text)]">
                        {stock.stockName || "—"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-center align-middle font-mono text-xs text-[var(--wms-app-text-muted)]",
                        borderColor,
                        "border-e",
                        rowBorder,
                      )}
                    >
                      {stock.unitCode || "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-center align-middle",
                        borderColor,
                        rowBorder,
                      )}
                    >
                      {selected ? (
                        <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-[var(--wms-brand-primary)]">
                          <Check className="size-3.5" />
                          {t("stockSelectDialog.selected")}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--wms-app-text-muted)]">
                          {t("stockSelectDialog.select")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stocks.map((stock) => {
          const selected = stock.id === selectedStockId;
          const watermark = (stock.erpStockCode ?? "").slice(0, 2).toUpperCase() || "·";
          return (
            <button
              key={stock.id}
              type="button"
              onClick={() => handleSelect(stock)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--wms-brand-ring)] hover:shadow-md",
                selected && "border-[var(--wms-brand-primary)] ring-2 ring-[var(--wms-brand-ring)]",
              )}
            >
              {selected ? (
                <div
                  className="absolute end-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)] shadow-sm"
                  aria-hidden
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </div>
              ) : null}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[color-mix(in_oklab,var(--wms-brand-primary)_8%,var(--wms-app-panel))] via-[var(--wms-app-panel)] to-[color-mix(in_oklab,var(--wms-brand-secondary)_10%,var(--wms-app-panel))]">
                <span
                  className="pointer-events-none absolute -bottom-1 start-1 select-none font-mono text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-none tracking-tighter text-[var(--wms-brand-primary)]/10"
                  aria-hidden
                >
                  {watermark}
                </span>
                <Package
                  className="pointer-events-none absolute end-2 top-2 size-4 text-[var(--wms-brand-primary)]/40 transition-colors group-hover:text-[var(--wms-brand-primary)]/70"
                  aria-hidden
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-brand-primary)]">
                    {stock.erpStockCode}
                  </span>
                  {stock.unitCode ? (
                    <span className="shrink-0 rounded-md bg-[var(--wms-brand-soft)] px-1.5 py-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--wms-brand-primary)]">
                      {stock.unitCode}
                    </span>
                  ) : null}
                </div>
                <h3 className="line-clamp-2 min-h-[2.2em] text-[12.5px] font-medium leading-snug text-[var(--wms-app-text)]">
                  {stock.stockName || "—"}
                </h3>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OpsDialogContent
        size="full"
        className="wms-ops-stock-select-dialog flex h-[min(86dvh,760px)] max-h-[min(86dvh,760px)] flex-col sm:max-w-[min(1120px,calc(100vw-2rem))]"
      >
        <OpsDialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--wms-app-border)]">
          <div>
            <h2 className="text-lg font-black text-[var(--wms-brand-primary)]">
              {t("stockSelectDialog.title")}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
              {t("stockSelectDialog.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("common.close", { defaultValue: "Kapat" })}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)] transition hover:border-[var(--wms-brand-ring)] hover:text-[var(--wms-brand-primary)]"
          >
            <X className="size-4" />
          </button>
        </OpsDialogHeader>

        <div className="shrink-0 border-b border-[var(--wms-app-border)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <OpsFieldShell className="min-w-0 flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--wms-app-text-muted)]" />
                <AppInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("stockSelectDialog.searchPlaceholder")}
                  className="ps-9"
                />
              </div>
            </OpsFieldShell>
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-1">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                aria-label={t("stockSelectDialog.cardView")}
                className={cn(
                  "rounded-lg p-2 transition",
                  viewMode === "card"
                    ? "bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"
                    : "text-[var(--wms-app-text-muted)] hover:bg-[var(--wms-brand-soft)]/60",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <div className="mx-0.5 h-4 w-px bg-[var(--wms-app-border)]" />
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label={t("stockSelectDialog.listView")}
                className={cn(
                  "rounded-lg p-2 transition",
                  viewMode === "list"
                    ? "bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"
                    : "text-[var(--wms-app-text-muted)] hover:bg-[var(--wms-brand-soft)]/60",
                )}
              >
                <ListIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5"
        >
          {renderContent()}
          {stocksQuery.isFetchingNextPage ? (
            <div className="flex justify-center py-4">
              <OpsLoadingState code="MORE" message={t("stockSelectDialog.loading")} compact />
            </div>
          ) : null}
        </div>
      </OpsDialogContent>
    </Dialog>
  );
}
