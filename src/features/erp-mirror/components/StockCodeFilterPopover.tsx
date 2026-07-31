import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Filter, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { cn } from '@/lib/utils';
import { getErpMirrorPage } from '../api/erp-mirror.api';
import type { StockMirror } from '../types/erp-mirror.types';
import { normalizeGridPage } from '@/lib/paged';
import {
  STOCK_CODE_FILTER_DIMENSIONS,
  cloneStockCodeFilterSelections,
  countStockCodeFilterSelections,
  createEmptyStockCodeFilterSelections,
  extractStockCodeFilterOptions,
  filterStockCodeOptions,
  stockCodeFilterSelectionsEqual,
  toggleStockCodeFilterValue,
  type StockCodeFilterDimension,
  type StockCodeFilterOption,
  type StockCodeFilterSelections,
} from '../stock-code-filter';

type Props = {
  draftSelections: StockCodeFilterSelections;
  onDraftSelectionsChange: (next: StockCodeFilterSelections) => void;
  appliedSelections: StockCodeFilterSelections;
  onApply: () => void;
  onClearApplied: () => void;
};

function buildInitialExpanded(): Record<StockCodeFilterDimension, boolean> {
  return {
    groupCode: true,
    code1: true,
    code2: false,
    code3: false,
    code4: false,
    code5: false,
  };
}

async function fetchStockRowsForCodeFilters(): Promise<StockMirror[]> {
  const pageSize = 200;
  const first = normalizeGridPage<StockMirror>(
    await getErpMirrorPage<StockMirror>('stocks', {
      pageNumber: 1,
      pageSize,
      search: null,
      sortBy: 'erpStockCode',
      sortDirection: 'asc',
      filterLogic: 'and',
      filters: [],
    }),
  );

  const rows = [...first.items];
  const totalPages = Math.max(
    1,
    first.totalPages ?? (Math.ceil((first.totalCount || rows.length) / pageSize) || 1),
  );

  for (let pageNumber = 2; pageNumber <= Math.min(totalPages, 20); pageNumber += 1) {
    const page = normalizeGridPage<StockMirror>(
      await getErpMirrorPage<StockMirror>('stocks', {
        pageNumber,
        pageSize,
        search: null,
        sortBy: 'erpStockCode',
        sortDirection: 'asc',
        filterLogic: 'and',
        filters: [],
      }),
    );
    rows.push(...page.items);
    if (!page.hasNextPage && page.items.length < pageSize) break;
  }

  return rows;
}

export function StockCodeFilterPopover({
  draftSelections,
  onDraftSelectionsChange,
  appliedSelections,
  onApply,
  onClearApplied,
}: Props): ReactElement {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [optionSearch, setOptionSearch] = useState('');
  const deferredSearch = useDeferredValue(optionSearch);
  const [expanded, setExpanded] = useState(buildInitialExpanded);
  const appliedCount = countStockCodeFilterSelections(appliedSelections);
  const draftDirty = !stockCodeFilterSelectionsEqual(draftSelections, appliedSelections);
  const hasDraftSelection = countStockCodeFilterSelections(draftSelections) > 0;

  const optionsQuery = useQuery({
    queryKey: ['erp-stock-code-filter-options', 'v2'],
    queryFn: async () => {
      const rows = await fetchStockRowsForCodeFilters();
      return {
        rowCount: rows.length,
        options: extractStockCodeFilterOptions(rows),
      };
    },
    enabled: open,
    staleTime: 300_000,
    gcTime: 600_000,
  });

  const optionsByDimension = useMemo(() => {
    const empty = {} as Record<StockCodeFilterDimension, StockCodeFilterOption[]>;
    for (const dimension of STOCK_CODE_FILTER_DIMENSIONS) {
      empty[dimension] = optionsQuery.data?.options?.[dimension] ?? [];
    }
    return empty;
  }, [optionsQuery.data]);

  const filteredOptionsByDimension = useMemo(() => {
    const result = {} as Record<StockCodeFilterDimension, StockCodeFilterOption[]>;
    for (const dimension of STOCK_CODE_FILTER_DIMENSIONS) {
      result[dimension] = filterStockCodeOptions(optionsByDimension[dimension], deferredSearch);
    }
    return result;
  }, [deferredSearch, optionsByDimension]);

  const dimensionLabel = (dimension: StockCodeFilterDimension) => {
    if (dimension === 'groupCode') return t('erpMirror.columns.groupCode');
    return t(`erpMirror.columns.${dimension}`);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onDraftSelectionsChange(cloneStockCodeFilterSelections(appliedSelections));
    } else {
      setOptionSearch('');
    }
    setOpen(nextOpen);
  };

  const handleApply = () => {
    onApply();
    setOpen(false);
  };

  const handleClearAll = () => {
    onDraftSelectionsChange(createEmptyStockCodeFilterSelections());
    onClearApplied();
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <OpsActionButton
          type="button"
          variant="secondary"
          className={cn(
            'wms-ops-list-toolbar-btn',
            (open || appliedCount > 0) && 'wms-ops-list-toolbar-btn--active',
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Filter className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t('erpMirror.codeFilters.button')}</span>
          {appliedCount > 0 ? (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-none bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {appliedCount}
            </span>
          ) : null}
        </OpsActionButton>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="wms-ops-list-popover pointer-events-auto z-[4000] flex w-[min(420px,95vw)] max-h-[min(72vh,560px)] flex-col overflow-hidden border-0 p-0 shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--wms-app-border)] px-3 py-2.5">
            <h3 className="text-sm font-semibold text-[var(--wms-app-text)]">
              {t('erpMirror.codeFilters.panelTitle')}
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-md text-[var(--wms-app-text-muted)] hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-app-text)]"
              aria-label={t('common.close')}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">
                {t('erpMirror.codeFilters.panelHint')}
              </p>
              {hasDraftSelection ? (
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-[var(--wms-ops-accent)] hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)]"
                  onClick={() => onDraftSelectionsChange(createEmptyStockCodeFilterSelections())}
                >
                  <RotateCcw className="size-3" aria-hidden />
                  {t('erpMirror.codeFilters.clearDraft')}
                </button>
              ) : null}
            </div>

            <div className="relative shrink-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--wms-ops-accent)]"
                aria-hidden
              />
              <input
                value={optionSearch}
                onChange={(event) => setOptionSearch(event.target.value)}
                placeholder={t('erpMirror.codeFilters.searchPlaceholder')}
                className="input h-10 w-full rounded-xl pl-9 text-xs"
              />
            </div>

            <div className="wms-ops-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {STOCK_CODE_FILTER_DIMENSIONS.map((dimension, index) => {
                const options = filteredOptionsByDimension[dimension];
                const total = optionsByDimension[dimension].length;
                const selectedSet = new Set(draftSelections[dimension]);
                const isExpanded = deferredSearch.trim().length > 0
                  ? options.length > 0
                  : expanded[dimension];
                const sectionId = `stock-code-section-${dimension}`;

                return (
                  <section
                    key={dimension}
                    className="overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_88%,transparent)]"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((current) => ({ ...current, [dimension]: !current[dimension] }))}
                      aria-expanded={isExpanded}
                      aria-controls={sectionId}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_6%,transparent)]"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wms-ops-accent)]">
                        {dimensionLabel(dimension)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {selectedSet.size > 0 ? (
                          <span className="rounded-full bg-[color-mix(in_oklab,var(--wms-ops-accent)_15%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--wms-ops-accent)]">
                            {t('erpMirror.codeFilters.selectedCount', { count: selectedSet.size })}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            'size-4 text-[var(--wms-app-text-muted)] transition-transform duration-200',
                            isExpanded && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </span>
                    </button>

                    {isExpanded ? (
                      <div id={sectionId} className="border-t border-[var(--wms-app-border)] px-2.5 pb-2.5 pt-1">
                        {optionsQuery.isLoading && index === 0 ? (
                          <div className="flex items-center gap-2 py-3 text-[11px] text-[var(--wms-app-text-muted)]">
                            <Loader2 className="size-3.5 animate-spin text-[var(--wms-ops-accent)]" aria-hidden />
                            {t('erpMirror.codeFilters.loading')}
                          </div>
                        ) : optionsQuery.isError && index === 0 ? (
                          <p className="py-2 text-[11px] text-red-500">
                            {optionsQuery.error instanceof Error
                              ? optionsQuery.error.message
                              : t('erpMirror.codeFilters.loadFailed')}
                          </p>
                        ) : total === 0 ? (
                          <p className="py-2 text-[11px] text-[var(--wms-app-text-muted)]">
                            {(optionsQuery.data?.rowCount ?? 0) > 0
                              ? t('erpMirror.codeFilters.noFilledValues')
                              : t('erpMirror.codeFilters.noOptions')}
                          </p>
                        ) : options.length === 0 ? (
                          <p className="py-2 text-[11px] text-[var(--wms-app-text-muted)]">
                            {t('erpMirror.codeFilters.searchEmpty')}
                          </p>
                        ) : (
                          <ul className="max-h-[min(28vh,220px)] space-y-0.5 overflow-y-auto">
                            {options.map((option) => {
                              const checked = selectedSet.has(option.value);
                              return (
                                <li key={`${dimension}-${option.value}`}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      onDraftSelectionsChange(
                                        toggleStockCodeFilterValue(draftSelections, dimension, option.value),
                                      );
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onDraftSelectionsChange(
                                          toggleStockCodeFilterValue(draftSelections, dimension, option.value),
                                        );
                                      }
                                    }}
                                    className={cn(
                                      'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors',
                                      checked
                                        ? 'bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)]'
                                        : 'hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_5%,transparent)]',
                                    )}
                                  >
                                    <OpsSkinCheckbox
                                      checked={checked}
                                      onCheckedChange={() => {
                                        onDraftSelectionsChange(
                                          toggleStockCodeFilterValue(draftSelections, dimension, option.value),
                                        );
                                      }}
                                      aria-label={option.label}
                                      className="mt-0.5"
                                    />
                                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--wms-app-text)]">
                                      {option.label}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {!hasDraftSelection ? (
              <p className="shrink-0 rounded-lg border border-dashed border-[var(--wms-app-border)] px-2.5 py-2 text-[11px] text-[var(--wms-app-text-muted)]">
                {t('erpMirror.codeFilters.pickHint')}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--wms-app-border)] p-3">
            <OpsActionButton type="button" variant="secondary" onClick={handleClearAll}>
              {t('erpMirror.codeFilters.clearAll')}
            </OpsActionButton>
            <OpsActionButton type="button" onClick={handleApply} disabled={!draftDirty}>
              {t('erpMirror.codeFilters.apply')}
            </OpsActionButton>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
