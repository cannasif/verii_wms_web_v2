import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type UIEvent,
} from 'react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Loader2, Search } from 'lucide-react';
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
import { getWorkspacePortalRoot } from '@/lib/workspace-portal';
import { useStickyPopoverSide } from '@/hooks/useStickyPopoverSide';
import { OpsActionButton } from './OpsActionButton';
import { OpsFieldShell } from './OpsFieldShell';
import { OPS_FIELD_CLASS } from './ops-field-styles';
import { DROPDOWN_OVERLAY_WIDTH_CLASS, DropdownOptionLabel } from './DropdownOptionLabel';

const SEARCH_DEBOUNCE_MS = 300;
const LOAD_MORE_THRESHOLD = 0.82;
const SELECTION_LOCK_MS = 400;
/** Radix popover/dialog kapanış animasyonu bitene kadar liste etkileşimini dondur. */
const CLOSE_ANIMATION_MS = 200;
const SELECTION_COOLDOWN_MS = SELECTION_LOCK_MS + CLOSE_ANIMATION_MS;

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
  /** Combobox satırında üst satır (ör. cari adı). Yoksa `getLabel` kullanılır. */
  getPrimaryLabel?: (item: T) => string;
  /** Combobox satırında alt satır; hiç kesilmez (ör. cari kodu). */
  getSecondaryLabel?: (item: T) => string;
  onSelect: (item: T) => void;
  /** Combobox modunda yazılan metni parent'a iletir (serbest metin / seçim dışı değer için). */
  onComboboxTextChange?: (text: string) => void;
  /** Combobox'ta Enter: listeden seçilemezse yazılan metni parent'a teslim eder. */
  onCommitText?: (text: string) => unknown | PromiseLike<unknown>;
  onTriggerKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
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
  getPrimaryLabel,
  getSecondaryLabel,
  onSelect,
  onComboboxTextChange,
  onCommitText,
  onTriggerKeyDown,
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
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverContentRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownListRef = useRef<HTMLDivElement | null>(null);
  const fetchLockRef = useRef(false);
  const skipBlurCloseRef = useRef(false);
  const selectionLockRef = useRef(false);
  const selectionCleanupTimerRef = useRef<number | null>(null);
  const frozenComboboxItemsRef = useRef<T[]>([]);
  const frozenDialogItemsRef = useRef<T[]>([]);
  const [selectionFrozen, setSelectionFrozen] = useState(false);
  const openRef = useRef(open);
  const valueRef = useRef(value);
  openRef.current = open;
  valueRef.current = value;
  const dialogSearchId = useId();

  const restoreBodyPointerEvents = (): void => {
    window.setTimeout(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.removeProperty('pointer-events');
      }
    }, 0);
  };

  const isCombobox = triggerMode === 'combobox';
  const minLen = autoSearchMinLength ?? 1;

  const apiSearch = search;

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
  const effectiveDraft = editing && !isSameAsSelected ? comboboxDraft : '';
  const effectiveDraftLength = effectiveDraft.trim().length;
  const isThresholdMode = effectiveDraftLength > 0 && effectiveDraftLength < minLen;
  const activeComboboxSearch = effectiveDraftLength >= minLen ? comboboxSearch : '';
  const apiComboboxSearch = activeComboboxSearch;

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
    if (open) return;
    const timer = window.setTimeout(() => {
      setSearch('');
      setSearchInput('');
    }, SELECTION_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(
    () => () => {
      if (selectionCleanupTimerRef.current !== null) {
        window.clearTimeout(selectionCleanupTimerRef.current);
      }
    },
    [],
  );

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
      setSearch(searchInput);
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

  const scheduleSelectionCleanup = (onCleanup?: () => void): void => {
    if (selectionCleanupTimerRef.current !== null) {
      window.clearTimeout(selectionCleanupTimerRef.current);
    }
    selectionCleanupTimerRef.current = window.setTimeout(() => {
      selectionCleanupTimerRef.current = null;
      selectionLockRef.current = false;
      skipBlurCloseRef.current = false;
      setSelectionFrozen(false);
      onCleanup?.();
    }, SELECTION_COOLDOWN_MS);
  };

  const selectItem = (item: T, source: 'combobox' | 'dialog'): void => {
    if (selectionLockRef.current) return;
    const label = getLabel(item);
    if (Boolean(value) && label.trim() === (value ?? '').trim()) {
      setComboboxDraft(label);
      setComboboxOpen(false);
      setEditing(false);
      onOpenChange(false);
      restoreBodyPointerEvents();
      return;
    }
    selectionLockRef.current = true;
    skipBlurCloseRef.current = true;

    if (source === 'combobox') {
      frozenComboboxItemsRef.current = comboboxItems;
    } else {
      frozenDialogItemsRef.current = items;
    }
    setSelectionFrozen(true);

    onSelect(item);
    setEditing(false);
    setComboboxOpen(false);
    setComboboxDraft(label);
    onOpenChange(false);
    restoreBodyPointerEvents();
    if (source !== 'dialog') {
      inputRef.current?.blur();
    }

    scheduleSelectionCleanup(() => {
      setComboboxSearch('');
    });
  };

  const focusDialogSearch = (): void => {
    const field = document.getElementById(dialogSearchId);
    if (!(field instanceof HTMLInputElement)) return;
    field.focus();
    field.select();
  };

  const openDialog = (): void => {
    if (disabled || selectionLockRef.current) return;
    skipBlurCloseRef.current = true;
    setComboboxOpen(false);
    setEditing(false);
    setSearchInput('');
    setSearch('');
    inputRef.current?.blur();
    onOpenChange(true);
  };

  const handleComboboxSelect = (item: T): void => {
    selectItem(item, 'combobox');
  };

  const handleDialogSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    setSearch(searchInput);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onTriggerKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (disabled || open) return;

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
      if (comboboxOpen && comboboxItems.length > 0) {
        event.preventDefault();
        const item = comboboxItems[highlightIndex] ?? comboboxItems[0];
        if (item) {
          const alreadySelected =
            Boolean(value) && getLabel(item).trim() === (value ?? '').trim();
          handleComboboxSelect(item);
          if (!alreadySelected) onCommitText?.(getLabel(item));
        }
        return;
      }
      if (trimmedDraft.length >= minLen && onCommitText) {
        event.preventDefault();
        setComboboxOpen(false);
        setEditing(false);
        onCommitText(trimmedDraft);
      }
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
  const comboboxPopoverOpen = comboboxOpen && !open && !selectionFrozen;
  const comboboxPopoverSide = useStickyPopoverSide({
    open: comboboxPopoverOpen,
    triggerRef: anchorRef,
    contentRef: popoverContentRef,
    preferredSide: 'bottom',
    estimatedHeight: 280,
  });
  // Dialog içinde popover, workspace portal kökünde kalırsa dialog'un arkasında görünür;
  // bu durumda dialog gövdesine portallanır.
  const portalContainer = skipPopoverPortal
    ? ((anchorRef.current?.closest('[data-slot="dialog-content"]') as HTMLElement | null) ?? undefined)
    : (popoverPortalContainer ?? getWorkspacePortalRoot() ?? undefined);
  const displayValue = editing ? comboboxDraft : (value ?? '');
  const comboboxFetching = comboboxQuery.isFetching && !comboboxQuery.isFetchingNextPage;
  const comboboxLoading = (comboboxQuery.isLoading || comboboxFetching) && comboboxItems.length === 0 && !isThresholdMode;
  const comboboxEmptyText = isThresholdMode
    ? t('shared:dropdown.minSearchCharacters', { count: minLen })
    : (emptyText ?? t('common.noResults'));
  const visibleComboboxItems = selectionFrozen ? frozenComboboxItemsRef.current : comboboxItems;
  const visibleDialogItems = selectionFrozen ? frozenDialogItemsRef.current : items;
  const showComboboxLoading = !selectionFrozen && comboboxLoading;
  const showDialogInitialLoading = !selectionFrozen && isInitialLoading;

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
        onClick={() => {
          if (selectionLockRef.current) return;
          onOpenChange(true);
        }}
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
      onClick={() => {
        if (selectionLockRef.current) return;
        onOpenChange(true);
      }}
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
      open={comboboxOpen && !open && !selectionFrozen}
      onOpenChange={(next) => {
        if (open || selectionLockRef.current || selectionFrozen) return;
        // Dropdown yalnızca yazınca açılır; dışarı tıklanınca kapanabilir.
        if (!next) {
          setComboboxOpen(false);
        }
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div className="relative w-full min-w-0" ref={anchorRef}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={comboboxOpen && !open}
            aria-autocomplete="list"
            aria-controls="paged-lookup-combobox-list"
            aria-activedescendant={
              comboboxOpen && visibleComboboxItems[highlightIndex]
                ? `paged-lookup-option-${getKey(visibleComboboxItems[highlightIndex])}`
                : undefined
            }
            disabled={disabled}
            tabIndex={open ? -1 : undefined}
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
              if (open) {
                event.currentTarget.blur();
                window.requestAnimationFrame(focusDialogSearch);
                return;
              }
              if (disabled || selectionLockRef.current) return;
              setEditing(true);
              event.currentTarget.select();
            }}
            onClick={() => {
              if (disabled || open || selectionLockRef.current) return;
              if (openDialogOnTouchTap && isCoarsePointer()) {
                openDialog();
                return;
              }
              inputRef.current?.focus();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              if (selectionLockRef.current) return;
              openDialog();
            }}
            onChange={(event) => {
              const next = event.target.value;
              setEditing(true);
              setComboboxDraft(next);
              onComboboxTextChange?.(next);
              if (selectionLockRef.current) return;
              setComboboxOpen(next.trim().length > 0);
            }}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              window.setTimeout(() => {
                if (skipBlurCloseRef.current || selectionLockRef.current) return;
                if (openRef.current) return;
                setComboboxOpen(false);
                setEditing(false);
                setComboboxDraft(valueRef.current ?? '');
              }, SELECTION_COOLDOWN_MS);
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={resolvedSearchPlaceholder}
            className="absolute left-0.5 top-1/2 z-[1] inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--wms-app-text-muted)] transition hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)] disabled:opacity-50 max-sm:size-8"
            onPointerDown={(event) => {
              if (selectionLockRef.current) return;
              skipBlurCloseRef.current = true;
              // Dokunmatikte preventDefault sonraki click'i bastırabildiği için yalnızca fareye uygulanır.
              if (event.pointerType === 'mouse') event.preventDefault();
            }}
            onClick={() => {
              if (selectionLockRef.current) return;
              openDialog();
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
          ref={popoverContentRef}
          align="start"
          side={comboboxPopoverSide}
          avoidCollisions={false}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'wms-floating-surface wms-ops-lookup-popover wms-ops-list-select-content z-[2000] overflow-hidden outline-none',
            DROPDOWN_OVERLAY_WIDTH_CLASS,
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        >
          <div
            ref={dropdownListRef}
            id="paged-lookup-combobox-list"
            role="listbox"
            onScroll={handleComboboxScroll}
            onPointerDown={() => {
              skipBlurCloseRef.current = true;
            }}
            className={cn(
              'relative h-64 space-y-1 overflow-y-auto overscroll-contain p-1.5',
              selectionFrozen && 'pointer-events-none',
            )}
          >
            {showComboboxLoading ? (
              <div className="flex h-full items-center justify-center px-2">
                <OpsLoadingState message={t('common.loading')} compact code="LOOKUP" />
              </div>
            ) : visibleComboboxItems.length === 0 ? (
              <div className="flex h-full items-center justify-center px-3 text-center text-sm text-slate-500">
                {comboboxEmptyText}
              </div>
            ) : (
              <>
                {visibleComboboxItems.map((item, index) => {
                  const key = getKey(item);
                  const label = getLabel(item);
                  const primary = getPrimaryLabel?.(item) ?? label;
                  const secondary = getSecondaryLabel?.(item);
                  const active = value === label;
                  const highlighted = index === highlightIndex;
                  return (
                    <button
                      key={key}
                      id={`paged-lookup-option-${key}`}
                      type="button"
                      tabIndex={-1}
                      role="option"
                      title={label}
                      aria-label={label}
                      aria-selected={active || highlighted}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors',
                        'hover:bg-[var(--wms-brand-soft)] focus-visible:bg-[var(--wms-brand-soft)]',
                        (active || highlighted) && 'bg-[var(--wms-brand-soft)] font-semibold text-[var(--wms-brand-primary)]',
                        comboboxFetching && 'opacity-70',
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        skipBlurCloseRef.current = true;
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (selectionLockRef.current) return;
                        handleComboboxSelect(item);
                      }}
                    >
                      <DropdownOptionLabel primary={primary} secondary={secondary} />
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

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next && (selectionLockRef.current || selectionFrozen)) return;
          if (!next && !selectionLockRef.current) {
            skipBlurCloseRef.current = false;
            restoreBodyPointerEvents();
          }
          onOpenChange(next);
        }}
      >
        <DialogContent
          tone="ops"
          portalRoot="body"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.blur();
            focusDialogSearch();
            window.requestAnimationFrame(focusDialogSearch);
            window.setTimeout(focusDialogSearch, 50);
          }}
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
                    id={dialogSearchId}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={handleDialogSearchKeyDown}
                    placeholder={resolvedSearchPlaceholder}
                    className={cn(OPS_FIELD_CLASS, 'h-10')}
                    aria-label={resolvedSearchPlaceholder}
                  />
                </OpsFieldShell>
              ) : (
                <Input
                  id={dialogSearchId}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleDialogSearchKeyDown}
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
                  onClick={() => setSearch(searchInput)}
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
                  onClick={() => setSearch(searchInput)}
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
                selectionFrozen && 'pointer-events-none',
              )}
            >
              {showDialogInitialLoading ? (
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

                  {visibleDialogItems.length === 0 ? (
                    <div
                      className={cn(
                        'flex h-full items-center justify-center text-center text-sm',
                        isOps ? 'wms-ops-lookup-empty' : 'text-slate-500',
                      )}
                    >
                      {emptyText ?? t('common.noResults')}
                    </div>
                  ) : (
                    visibleDialogItems.map((item) => {
                      const label = getLabel(item);
                      const primary = getPrimaryLabel?.(item) ?? label;
                      const secondary = getSecondaryLabel?.(item);
                      return (
                      <button
                        key={getKey(item)}
                        type="button"
                        title={label}
                        aria-label={label}
                        className={cn(
                          'flex w-full items-start px-3 py-2.5 text-left text-sm transition',
                          isOps
                            ? 'wms-ops-lookup-item'
                            : 'rounded-xl border border-slate-200/70 bg-white/80 hover:border-sky-300 hover:bg-sky-50/70 dark:border-white/10 dark:bg-white/4 dark:hover:border-sky-400/50 dark:hover:bg-sky-500/10',
                        )}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (selectionLockRef.current) return;
                          selectItem(item, 'dialog');
                        }}
                      >
                        <span className={isOps ? 'wms-ops-lookup-item__label w-full' : 'w-full font-medium text-slate-900 dark:text-white'}>
                          <DropdownOptionLabel primary={primary} secondary={secondary} />
                        </span>
                      </button>
                      );
                    })
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
