import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type UIEvent,
} from 'react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PagedResponse } from '@/types/api';
import { Button } from '@/components/ui/button';
import { OpsLoadingState } from './OpsLoadingState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toTurkishApiSearch } from '@/lib/turkish-search';
import { getWorkspacePortalRoot } from '@/lib/workspace-portal';
import { OpsActionButton } from './OpsActionButton';
import { OpsFieldShell } from './OpsFieldShell';
import { OPS_FIELD_CLASS } from './ops-field-styles';

const SEARCH_DEBOUNCE_MS = 300;
const LOAD_MORE_THRESHOLD = 0.82;

const isCoarsePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

interface PagedLookupDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  value?: string | null;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Terminal/premium ops hata yüzeyi (kırmızı border + flash). */
  invalid?: boolean;
  variant?: 'default' | 'ops';
  /**
   * `button`: sadece tıklanınca dialog açılır (mevcut davranış).
   * `combobox`: yazılabilir input + odak/yazınca dropdown; arama ikonu veya çift tık → dialog.
   */
  triggerMode?: 'button' | 'combobox';
  autoSearchMinLength?: number;
  triggerClassName?: string;
  /** `null`: popover portalsız, tetikleyicinin yanında render edilir. Dialog içinde kullanırken gerekir. */
  popoverPortalContainer?: HTMLElement | null;
  /** Dokunmatik cihazda çift tık mümkün olmadığı için tek dokunuş lookup dialog'unu açar. */
  openDialogOnTouchTap?: boolean;
  queryKey: readonly unknown[];
  fetchPage: (args: {
    pageNumber: number;
    pageSize: number;
    search: string;
    signal?: AbortSignal;
  }) => Promise<PagedResponse<T>>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
}

export function PagedLookupDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  invalid = false,
  variant = 'default',
  triggerMode = 'button',
  autoSearchMinLength,
  triggerClassName,
  popoverPortalContainer,
  openDialogOnTouchTap = false,
  queryKey,
  fetchPage,
  getKey,
  getLabel,
  onSelect,
}: PagedLookupDialogProps<T>): ReactElement {
  const { t } = useTranslation(['common', 'shared']);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxDraft, setComboboxDraft] = useState('');
  const [comboboxSearch, setComboboxSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [anchorElement, setAnchorElement] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownListRef = useRef<HTMLDivElement | null>(null);
  const fetchLockRef = useRef(false);
  const skipBlurCloseRef = useRef(false);

  const isCombobox = triggerMode === 'combobox';
  const minLen = autoSearchMinLength ?? 1;

  const apiSearch = toTurkishApiSearch(search);

  const query = useInfiniteQuery({
    queryKey: [...queryKey, apiSearch],
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchPage({
        pageNumber: pageParam,
        pageSize: 20,
        search: apiSearch,
        signal,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.pageNumber + 1 : undefined),
  });

  const items = useMemo(
    () =>
      query.data?.pages.flatMap((page) =>
        Array.isArray(page.data) && page.data.length > 0
          ? page.data
          : Array.isArray((page as { items?: T[] }).items)
            ? ((page as { items?: T[] }).items ?? [])
            : [],
      ) ?? [],
    [query.data?.pages],
  );

  const trimmedDraft = comboboxDraft.trim();
  const isSameAsSelected = Boolean(value) && trimmedDraft === (value ?? '').trim();
  const effectiveDraft = editing && !isSameAsSelected ? trimmedDraft : '';
  const isThresholdMode = effectiveDraft.length > 0 && effectiveDraft.length < minLen;
  const activeComboboxSearch = effectiveDraft.length >= minLen ? comboboxSearch : '';
  const apiComboboxSearch = toTurkishApiSearch(activeComboboxSearch);

  const comboboxQuery = useInfiniteQuery({
    queryKey: [...queryKey, 'combobox', apiComboboxSearch],
    enabled: isCombobox && comboboxOpen && !isThresholdMode,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchPage({
        pageNumber: pageParam,
        pageSize: 20,
        search: apiComboboxSearch,
        signal,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.pageNumber + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const comboboxItems = useMemo(
    () =>
      comboboxQuery.data?.pages.flatMap((page) =>
        Array.isArray(page.data) && page.data.length > 0
          ? page.data
          : Array.isArray((page as { items?: T[] }).items)
            ? ((page as { items?: T[] }).items ?? [])
            : [],
      ) ?? [],
    [comboboxQuery.data?.pages],
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSearchInput('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = searchInput.trim();
    const minRequired = autoSearchMinLength ?? 0;

    if (trimmed.length === 0) {
      setSearch('');
      return;
    }

    if (minRequired > 0 && trimmed.length < minRequired) {
      setSearch('');
      return;
    }

    const timer = window.setTimeout(() => {
      setSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoSearchMinLength, open, searchInput]);

  useEffect(() => {
    if (!isCombobox || !comboboxOpen || !editing) return;
    if (isSameAsSelected) {
      setComboboxSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setComboboxSearch(effectiveDraft);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [comboboxOpen, editing, effectiveDraft, isCombobox, isSameAsSelected]);

  useEffect(() => {
    if (!isCombobox) return;
    if (!editing) {
      setComboboxDraft(value ?? '');
    }
  }, [isCombobox, value, editing]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [activeComboboxSearch, comboboxOpen]);

  useEffect(() => {
    if (open && isCombobox) {
      setComboboxOpen(false);
      setEditing(false);
    }
  }, [open, isCombobox]);

  const handleScroll = (): void => {
    const element = listRef.current;
    if (!element || query.isFetchingNextPage || !query.hasNextPage) {
      return;
    }

    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 80) {
      void query.fetchNextPage();
    }
  };

  const fetchComboboxNext = (): void => {
    if (!comboboxQuery.hasNextPage || comboboxQuery.isFetchingNextPage || fetchLockRef.current) {
      return;
    }
    fetchLockRef.current = true;
    void comboboxQuery.fetchNextPage().finally(() => {
      fetchLockRef.current = false;
    });
  };

  const handleComboboxScroll = (event: UIEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    if (!target.scrollHeight) return;
    const progress = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (progress >= LOAD_MORE_THRESHOLD) fetchComboboxNext();
  };

  const selectItem = (item: T): void => {
    onSelect(item);
    setEditing(false);
    setComboboxOpen(false);
    setComboboxDraft(getLabel(item));
    onOpenChange(false);
  };

  const openDialog = (): void => {
    if (disabled) return;
    setComboboxOpen(false);
    setEditing(false);
    onOpenChange(true);
  };

  const handleComboboxSelect = (item: T): void => {
    skipBlurCloseRef.current = true;
    selectItem(item);
    window.setTimeout(() => {
      skipBlurCloseRef.current = false;
    }, 0);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (disabled) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setComboboxOpen(false);
      setEditing(false);
      setComboboxDraft(value ?? '');
      inputRef.current?.blur();
      return;
    }

    if (event.key === 'ArrowDown') {
      if (!comboboxOpen) return;
      event.preventDefault();
      setHighlightIndex((prev) =>
        comboboxItems.length === 0 ? 0 : Math.min(prev + 1, comboboxItems.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!comboboxOpen) return;
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!comboboxOpen || comboboxItems.length === 0) return;
      event.preventDefault();
      const item = comboboxItems[highlightIndex] ?? comboboxItems[0];
      if (item) handleComboboxSelect(item);
      return;
    }

    if (event.key === 'F4' || (event.key === 'F2' && event.ctrlKey)) {
      event.preventDefault();
      openDialog();
    }
  };

  const isOps = variant === 'ops';
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('paged.searchPlaceholder');
  const isLookupFetching = query.isFetching && !query.isFetchingNextPage;
  const isInitialLoading = query.isLoading || (isLookupFetching && items.length === 0);
  const triggerIcon = open && isLookupFetching ? (
    <Loader2 className="size-4 shrink-0 animate-spin opacity-70" aria-hidden />
  ) : (
    <Search className="size-4 shrink-0 opacity-60" aria-hidden />
  );

  const skipPopoverPortal = popoverPortalContainer === null;
  // Dialog içinde popover, workspace portal kökünde kalırsa dialog'un arkasında görünür;
  // bu durumda dialog gövdesine portallanır.
  const portalContainer = skipPopoverPortal
    ? ((anchorElement?.closest('[data-slot="dialog-content"]') as HTMLElement | null) ?? undefined)
    : (popoverPortalContainer ?? getWorkspacePortalRoot() ?? undefined);
  const displayValue = editing ? comboboxDraft : (value ?? '');
  const comboboxFetching = comboboxQuery.isFetching && !comboboxQuery.isFetchingNextPage;
  const comboboxLoading = (comboboxQuery.isLoading || comboboxFetching) && comboboxItems.length === 0 && !isThresholdMode;
  const comboboxEmptyText = isThresholdMode
    ? t('shared:dropdown.minSearchCharacters', { count: minLen })
    : (emptyText ?? t('common.noResults'));

  const buttonTrigger = isOps ? (
    <OpsFieldShell aria-invalid={invalid || undefined}>
      <button
        type="button"
        className={cn(
          'wms-ops-lookup-trigger wms-ops-field',
          !value && 'wms-ops-field--placeholder',
          invalid && 'wms-ops-field--invalid',
          triggerClassName,
        )}
        aria-invalid={invalid || undefined}
        onClick={() => onOpenChange(true)}
        disabled={disabled}
      >
        <span className="truncate">{value || placeholder}</span>
        {triggerIcon}
      </button>
    </OpsFieldShell>
  ) : (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'w-full justify-between font-normal',
        !value && 'text-muted-foreground',
        triggerClassName,
      )}
      onClick={() => onOpenChange(true)}
      disabled={disabled}
    >
      <span className="truncate">{value || placeholder}</span>
      {open && isLookupFetching ? (
        <Loader2 className="size-4 animate-spin opacity-70" aria-hidden />
      ) : (
        <Search className="size-4 opacity-50" aria-hidden />
      )}
    </Button>
  );

  const comboboxInner = (
    <PopoverPrimitive.Root
      open={comboboxOpen && !open}
      onOpenChange={(next) => {
        if (open) return;
        // Dropdown yalnızca yazınca açılır; dışarı tıklanınca kapanabilir.
        if (!next) {
          setComboboxOpen(false);
          setEditing(false);
          setComboboxDraft(value ?? '');
        }
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div className="relative w-full min-w-0" ref={setAnchorElement}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={comboboxOpen && !open}
            aria-autocomplete="list"
            aria-controls="paged-lookup-combobox-list"
            aria-activedescendant={
              comboboxOpen && comboboxItems[highlightIndex]
                ? `paged-lookup-option-${getKey(comboboxItems[highlightIndex])}`
                : undefined
            }
            disabled={disabled}
            aria-invalid={invalid || undefined}
            value={displayValue}
            placeholder={placeholder}
            className={cn(
              isOps
                ? cn(OPS_FIELD_CLASS, 'h-7 w-full !py-1 !pl-8 !pr-2 text-sm')
                : 'flex h-11 w-full min-w-0 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] py-2 pl-10 pr-3 text-sm text-[var(--wms-app-text)] shadow-sm outline-none transition hover:border-[var(--wms-brand-primary)]/60 focus:border-[var(--wms-brand-primary)] focus:ring-2 focus:ring-[var(--wms-brand-primary)]/25',
              disabled && 'cursor-not-allowed opacity-50',
              !displayValue && 'wms-ops-field--placeholder',
              invalid && 'wms-ops-field--invalid',
              triggerClassName,
            )}
            title={displayValue || undefined}
            onFocus={(event) => {
              if (disabled || open) return;
              setEditing(true);
              event.currentTarget.select();
            }}
            onClick={() => {
              if (disabled || open) return;
              if (openDialogOnTouchTap && isCoarsePointer()) {
                openDialog();
                return;
              }
              inputRef.current?.focus();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              openDialog();
            }}
            onChange={(event) => {
              const next = event.target.value;
              setEditing(true);
              setComboboxDraft(next);
              // Sadece yazmaya başlayınca aç; boşsa kapat.
              setComboboxOpen(next.trim().length > 0);
            }}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              window.setTimeout(() => {
                if (skipBlurCloseRef.current) return;
                if (open) return;
                setComboboxOpen(false);
                setEditing(false);
                setComboboxDraft(value ?? '');
              }, 150);
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={resolvedSearchPlaceholder}
            className="absolute left-0.5 top-1/2 z-[1] inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--wms-app-text-muted)] transition hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)] disabled:opacity-50 max-sm:size-8"
            onPointerDown={(event) => {
              skipBlurCloseRef.current = true;
              // Dokunmatikte preventDefault sonraki click'i bastırabildiği için yalnızca fareye uygulanır.
              if (event.pointerType === 'mouse') event.preventDefault();
            }}
            onClick={() => {
              openDialog();
              window.setTimeout(() => {
                skipBlurCloseRef.current = false;
              }, 0);
            }}
          >
            {open && isLookupFetching ? (
              <Loader2 className="size-3.5 animate-spin opacity-70" aria-hidden />
            ) : (
              <Search className="size-3.5 opacity-70" aria-hidden />
            )}
          </button>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'wms-floating-surface wms-ops-lookup-popover wms-ops-list-select-content z-[2000] w-[var(--radix-popover-trigger-width)] overflow-hidden outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        >
          <div
            ref={dropdownListRef}
            id="paged-lookup-combobox-list"
            role="listbox"
            onScroll={handleComboboxScroll}
            onMouseDown={() => {
              skipBlurCloseRef.current = true;
            }}
            className="relative h-64 space-y-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {comboboxLoading ? (
              <div className="flex h-full items-center justify-center px-2">
                <OpsLoadingState message={t('common.loading')} compact code="LOOKUP" />
              </div>
            ) : comboboxItems.length === 0 ? (
              <div className="flex h-full items-center justify-center px-3 text-center text-sm text-slate-500">
                {comboboxEmptyText}
              </div>
            ) : (
              <>
                {comboboxItems.map((item, index) => {
                  const key = getKey(item);
                  const label = getLabel(item);
                  const active = value === label;
                  const highlighted = index === highlightIndex;
                  return (
                    <button
                      key={key}
                      id={`paged-lookup-option-${key}`}
                      type="button"
                      role="option"
                      aria-selected={active || highlighted}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors',
                        'hover:bg-[var(--wms-brand-soft)] focus-visible:bg-[var(--wms-brand-soft)]',
                        (active || highlighted) && 'bg-[var(--wms-brand-soft)] font-semibold text-[var(--wms-brand-primary)]',
                        comboboxFetching && 'opacity-70',
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => handleComboboxSelect(item)}
                    >
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <Check className={cn('size-4 shrink-0 text-[var(--wms-brand-primary)]', !active && 'opacity-0')} />
                    </button>
                  );
                })}
              </>
            )}
            {comboboxQuery.isFetchingNextPage ? (
              <div className="px-2 py-2">
                <OpsLoadingState message={t('common.loading')} compact code="MORE" />
              </div>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );

  const comboboxTrigger = isOps ? (
    <OpsFieldShell
      className={cn(open && 'wms-ops-field-shell--active')}
      aria-invalid={invalid || undefined}
    >
      {comboboxInner}
    </OpsFieldShell>
  ) : (
    comboboxInner
  );

  const trigger = isCombobox ? comboboxTrigger : buttonTrigger;

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          tone="ops"
          portalRoot="body"
          className={cn(
            isOps ? 'wms-ops-lookup-dialog sm:max-w-2xl lg:max-w-3xl' : 'sm:max-w-xl',
          )}
        >
          <DialogHeader className={isOps ? 'wms-ops-lookup-dialog__header' : undefined}>
            <DialogTitle className={isOps ? 'wms-ops-lookup-dialog__title' : undefined}>
              {title}
            </DialogTitle>
            {description && !isOps ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className={cn('flex flex-col gap-4', isOps && 'wms-ops-dialog__body wms-ops-lookup-dialog__body')}>
            <div className={cn('flex gap-2', isOps ? 'items-center' : 'items-center')}>
              {isOps ? (
                <OpsFieldShell className="min-w-0 flex-1">
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setSearch(searchInput.trim());
                      }
                    }}
                    placeholder={resolvedSearchPlaceholder}
                    className={cn(OPS_FIELD_CLASS, 'h-10')}
                    aria-label={resolvedSearchPlaceholder}
                  />
                </OpsFieldShell>
              ) : (
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setSearch(searchInput.trim());
                    }
                  }}
                  placeholder={resolvedSearchPlaceholder}
                  className="min-w-0 flex-1"
                  aria-label={resolvedSearchPlaceholder}
                />
              )}
              {isOps ? (
                <OpsActionButton
                  type="button"
                  variant="secondary"
                  className="wms-ops-lookup-search-btn h-10 shrink-0"
                  onClick={() => setSearch(searchInput.trim())}
                  disabled={isLookupFetching}
                >
                  {isLookupFetching ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Search className="size-3.5" aria-hidden />
                  )}
                  {t('paged.search')}
                </OpsActionButton>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 shrink-0 gap-1.5 px-4"
                  onClick={() => setSearch(searchInput.trim())}
                  disabled={isLookupFetching}
                >
                  {isLookupFetching ? (
                    <Loader2 className="size-4 animate-spin opacity-80" aria-hidden />
                  ) : (
                    <Search className="size-4 opacity-80" aria-hidden />
                  )}
                  {t('paged.search')}
                </Button>
              )}
            </div>

            <div
              ref={listRef}
              onScroll={handleScroll}
              className={cn(
                'h-[min(360px,50vh)] space-y-2 overflow-y-auto p-3',
                isOps
                  ? 'wms-ops-lookup-list'
                  : 'rounded-2xl border border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/3',
              )}
            >
              {isInitialLoading ? (
                <div className={cn('flex h-full items-center justify-center', isOps ? 'wms-ops-lookup-list__loading px-2' : 'px-2')}>
                  <OpsLoadingState message={t('common.loading')} compact code="FETCH" />
                </div>
              ) : (
                <>
                  {isLookupFetching ? (
                    <div className={cn(isOps ? 'wms-ops-lookup-list__fetching' : 'sticky top-0 z-10 mb-2 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm border-slate-200 bg-white/95 text-slate-600 dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-200')}>
                      {isOps ? (
                        <OpsLoadingState message={t('common.loading')} compact code="FETCH" />
                      ) : (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          {t('common.loading')}
                        </>
                      )}
                    </div>
                  ) : null}

                  {items.length === 0 ? (
                    <div
                      className={cn(
                        'flex h-full items-center justify-center text-center text-sm',
                        isOps ? 'wms-ops-lookup-empty' : 'text-slate-500',
                      )}
                    >
                      {emptyText ?? t('common.noResults')}
                    </div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={getKey(item)}
                        type="button"
                        className={cn(
                          'flex w-full items-center px-3 py-2.5 text-left text-sm transition',
                          isOps
                            ? 'wms-ops-lookup-item'
                            : 'rounded-xl border border-slate-200/70 bg-white/80 hover:border-sky-300 hover:bg-sky-50/70 dark:border-white/10 dark:bg-white/4 dark:hover:border-sky-400/50 dark:hover:bg-sky-500/10',
                        )}
                        onClick={() => {
                          selectItem(item);
                        }}
                      >
                        <span className={isOps ? 'wms-ops-lookup-item__label' : 'font-medium text-slate-900 dark:text-white'}>
                          {getLabel(item)}
                        </span>
                      </button>
                    ))
                  )}
                </>
              )}

              {query.isFetchingNextPage ? (
                <div className={cn('py-3', isOps ? 'px-2' : 'flex items-center justify-center text-xs text-slate-500')}>
                  <OpsLoadingState message={t('common.loading')} compact code="MORE" />
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
