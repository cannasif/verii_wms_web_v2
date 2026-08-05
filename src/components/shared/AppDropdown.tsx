import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizeEnumOptionLabel } from '@/lib/enum-localization';
import { cn } from '@/lib/utils';
import { getWorkspacePortalRoot } from '@/lib/workspace-portal';

export interface AppDropdownOption<TValue extends string = string> {
  value: TValue;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface AppDropdownProps<TValue extends string = string> {
  value?: TValue | null;
  onValueChange: (value: TValue) => void;
  options: readonly AppDropdownOption<TValue>[];
  placeholder?: string;
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  searchable?: boolean;
  /** API aramasını etkinleştirir. false/boş olduğunda filtreleme options üzerinde yerel yapılır. */
  searchApi?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onSearchChange?: (search: string) => void;
  onFetchNextPage?: () => void | Promise<unknown>;
  onOpenChange?: (open: boolean) => void;
  errorText?: string;
  onRetry?: () => void | Promise<unknown>;
  renderValue?: (selected: AppDropdownOption<TValue> | undefined) => ReactNode;
  hideChevron?: boolean;
  className?: string;
  contentClassName?: string;
  /** Popover genişliğini tetikleyici ile eşleştir (varsayılan: true). Dar pill butonlarda false kullanın. */
  matchTriggerWidth?: boolean;
  contentAlign?: 'start' | 'center' | 'end';
  testId?: string;
  /**
   * `ops` (varsayılan): Terminal/Premium ops host sınıfları.
   * `plain`: Auth/login gibi ops dışı yüzeyler — Terminal DNA uygulanmaz.
   */
  tone?: 'ops' | 'plain';
  /** Override popover portal target. Pass `null` to use document.body. */
  portalContainer?: HTMLElement | null;
}

const SEARCH_DEBOUNCE_MS = 300;
const LOAD_MORE_THRESHOLD = 0.82;

/** Dialog scroll-lock body'de wheel'i yuttuğunda liste kaydırmayı korur. */
function useDropdownListWheelScroll(
  listRef: RefObject<HTMLDivElement | null>,
  open: boolean,
): void {
  useEffect(() => {
    if (!open) return;

    const onWheel = (event: WheelEvent) => {
      const list = listRef.current;
      if (!list) return;
      const target = event.target;
      if (!(target instanceof Node) || !list.contains(target)) return;

      const maxScroll = list.scrollHeight - list.clientHeight;
      if (maxScroll <= 0) return;

      const nextScrollTop = Math.min(
        maxScroll,
        Math.max(0, list.scrollTop + event.deltaY),
      );

      list.scrollTop = nextScrollTop;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, [listRef, open]);
}

export function AppDropdown<TValue extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  searchPlaceholder,
  emptyText,
  searchable = false,
  searchApi = false,
  disabled = false,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onSearchChange,
  onFetchNextPage,
  onOpenChange,
  errorText,
  onRetry,
  renderValue,
  hideChevron = false,
  className,
  contentClassName,
  matchTriggerWidth = true,
  contentAlign = 'start',
  testId,
  tone = 'ops',
  portalContainer,
}: AppDropdownProps<TValue>): ReactElement {
  const { t, i18n } = useTranslation('shared');
  const opsTone = tone === 'ops';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cachedSelected, setCachedSelected] = useState<AppDropdownOption<TValue> | undefined>();
  const listRef = useRef<HTMLDivElement>(null);
  const fetchLockRef = useRef(false);
  const remoteSearch = searchApi && typeof onSearchChange === 'function';
  const showSearch = searchable || remoteSearch;
  const resolvedPortalContainer =
    portalContainer === null
      ? undefined
      : (portalContainer ?? getWorkspacePortalRoot() ?? undefined);

  useEffect(() => {
    if (!remoteSearch || !open) return;
    const timer = window.setTimeout(() => onSearchChange(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [onSearchChange, open, remoteSearch, search]);

  useEffect(() => {
    if (open) return;
    setSearch('');
    if (remoteSearch) onSearchChange('');
  }, [onSearchChange, open, remoteSearch]);

  useDropdownListWheelScroll(listRef, open);

  const localizedOptions = useMemo(
    () => options.map((option) => ({
      ...option,
      label: localizeEnumOptionLabel(
        option.value,
        option.label,
        i18n.resolvedLanguage ?? i18n.language,
      ),
    })),
    [i18n.language, i18n.resolvedLanguage, options],
  );

  const visibleOptions = useMemo(() => {
    if (remoteSearch || !search.trim()) return localizedOptions;
    const normalized = search.trim().toLocaleLowerCase('tr-TR');
    return localizedOptions.filter((option) =>
      `${option.label} ${option.value}`.toLocaleLowerCase('tr-TR').includes(normalized),
    );
  }, [localizedOptions, remoteSearch, search]);

  const selectedFromOptions = localizedOptions.find((option) => option.value === value);

  useEffect(() => {
    if (selectedFromOptions) {
      setCachedSelected(selectedFromOptions);
      return;
    }
    if (value == null || value === '') {
      setCachedSelected(undefined);
    }
  }, [selectedFromOptions, value]);

  const selected =
    selectedFromOptions
    ?? (cachedSelected && cachedSelected.value === value ? cachedSelected : undefined);

  const fetchNextPage = useCallback((): void => {
    if (!hasNextPage || !onFetchNextPage || isFetchingNextPage) return;
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    Promise.resolve(onFetchNextPage()).finally(() => { fetchLockRef.current = false; });
  }, [hasNextPage, isFetchingNextPage, onFetchNextPage]);

  const handleScroll = (event: UIEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    if (!target.scrollHeight) return;
    const progress = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (progress >= LOAD_MORE_THRESHOLD) fetchNextPage();
  };

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list || !hasNextPage || isFetchingNextPage) return;
    if (list.scrollHeight <= list.clientHeight + 1) fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, open, options.length]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); onOpenChange?.(nextOpen); }}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled || isLoading}
          data-testid={testId}
          className={cn(
            opsTone && 'wms-ops-lookup-trigger',
            'flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 text-left text-sm text-[var(--wms-app-text)] shadow-sm outline-none transition',
            'hover:border-[var(--wms-brand-primary)]/60 focus-visible:border-[var(--wms-brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-primary)]/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-slate-500')}>
            {renderValue ? renderValue(selected) : (selected?.label ?? placeholder ?? t('dropdown.select'))}
          </span>
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-[var(--wms-brand-primary)]" />
          ) : !hideChevron ? (
            <ChevronDown className={cn('size-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
          ) : null}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal container={resolvedPortalContainer}>
        <PopoverPrimitive.Content
          align={contentAlign}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'wms-floating-surface z-[2000] overflow-hidden rounded-xl outline-none',
            opsTone && 'wms-ops-list-select-content',
            matchTriggerWidth ? 'w-[var(--radix-popover-trigger-width)]' : 'min-w-[12rem] w-max max-w-[min(18rem,calc(100vw-1.5rem))]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            contentClassName,
          )}
        >
          {showSearch && (
            <div className="wms-ops-dropdown-search-row flex items-center gap-2 border-b border-[var(--wms-app-border)] px-3">
              <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder ?? t('dropdown.search')}
                aria-label={searchPlaceholder ?? t('dropdown.search')}
                className="wms-ops-dropdown-search h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
              />
            </div>
          )}

          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            onScroll={handleScroll}
            className="wms-ops-scrollbar max-h-64 space-y-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {errorText ? (
              <div className="flex min-h-20 flex-col items-center justify-center gap-2 px-3 text-center text-sm text-red-600 dark:text-red-400">
                <span>{errorText}</span>
                {onRetry && <button type="button" onClick={() => void onRetry()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">{t('dropdown.retry')}</button>}
              </div>
            ) : isLoading && visibleOptions.length === 0 ? (
              <StatusRow icon={<Loader2 className="size-4 animate-spin" />} text={t('dropdown.loading')} />
            ) : visibleOptions.length === 0 ? (
              <StatusRow text={emptyText ?? t('dropdown.noResults')} />
            ) : (
              visibleOptions.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => {
                      setCachedSelected(option);
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors',
                      'hover:bg-[var(--wms-brand-soft)] focus-visible:bg-[var(--wms-brand-soft)]',
                      active && 'bg-[var(--wms-brand-soft)] font-semibold text-[var(--wms-brand-primary)]',
                      option.disabled && 'cursor-not-allowed opacity-45',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                          {option.description}
                        </span>
                      )}
                    </span>
                    <Check className={cn('size-4 shrink-0 text-[var(--wms-brand-primary)]', !active && 'opacity-0')} />
                  </button>
                );
              })
            )}
            {isFetchingNextPage && (
              <StatusRow icon={<Loader2 className="size-4 animate-spin" />} text={t('dropdown.loadingMore')} />
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function StatusRow({ icon, text }: { icon?: ReactElement; text: string }): ReactElement {
  return <div className="flex min-h-16 items-center justify-center gap-2 px-3 text-sm text-slate-500 dark:text-slate-400">{icon}{text}</div>;
}
