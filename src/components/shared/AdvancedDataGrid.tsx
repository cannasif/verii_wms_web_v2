import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { toast } from 'sonner';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Columns3,
  Filter,
  GripVertical,
  ListFilter,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  getDefaultGridPreferences,
  getGridPreferenceKey,
  loadGridPreferences,
  MAX_GRID_SEARCH_FIELDS,
  saveGridPreferences,
  type GridPreferences,
} from '@/lib/grid-preferences';
import { isKnownEnumValue, localizeEnumValue } from '@/lib/enum-localization';
import { useAuthStore } from '@/stores/auth-store';
import { AppDropdown, type AppDropdownOption } from './AppDropdown';
import { AppDateInput } from './AppInput';
import { getWorkspacePortalRoot } from '@/lib/workspace-portal';
import { localizeLegacyUiText } from '@/lib/legacy-ui-localization';

export interface GridFilter { column: string; operator: string; value: string }
export interface GridRequest { pageNumber?: number; page?: number; pageSize: number; search: string | null; searchFields?: string[]; sortBy?: string | null; sortDirection?: 'asc' | 'desc'; filterLogic: 'and' | 'or'; filters: GridFilter[] }
export interface GridPage<T> { items: T[]; pageNumber: number; page?: number; pageSize: number; totalCount: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean }
export type GridFilterType = 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum' | 'guid';
export interface GridColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Sağ tık menüsünde gösterilecek ve kopyalanacak biçimlendirilmiş hücre değeri. */
  contextValue?: (row: T) => string | number | boolean | null | undefined;
  contextCopyDisabled?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  hideable?: boolean;
  searchable?: boolean;
  defaultSearch?: boolean;
  filterType?: GridFilterType;
  filterOptions?: AppDropdownOption[];
}
interface Props<T extends { id: number }> {
  pageKey: string;
  title: string;
  description?: string;
  columns: GridColumn<T>[];
  fetchPage: (request: GridRequest) => Promise<GridPage<T>>;
  toolbarAction?: { label: string; run: () => Promise<void> };
  /** Mutation sonrasında sunucu verisini yeniden okumak için artırılan sürüm anahtarı. */
  refreshKey?: string | number;
}

interface GridCellContext<T> {
  row: T;
  column: GridColumn<T>;
  value: string | null;
  x: number;
  y: number;
}

const MIN_COLUMN_WIDTH = 80;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_DROPDOWN_OPTIONS: AppDropdownOption[] = PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }));
const SYSTEM_COLUMN_LABEL_KEYS: Record<string, string> = {
  id: 'recordId',
  createdBy: 'createdBy',
  createdDate: 'createdAt',
  updatedBy: 'updatedBy',
  updatedDate: 'updatedAt',
  actions: 'actions',
};
const FILTER_OPERATOR_VALUES: Record<GridFilterType, string[]> = {
  text: ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'isNull', 'isNotNull'],
  number: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  date: ['equals', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  datetime: ['equals', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  boolean: ['equals', 'notEquals'],
  enum: ['equals', 'notEquals'],
  guid: ['equals', 'notEquals', 'isNull', 'isNotNull'],
};

function inferFilterType<T>(column: GridColumn<T>): GridFilterType {
  if (column.filterType) return column.filterType;
  const key = column.key.toLowerCase();
  if (/(correlationid$|operationcode$|traceid$|requestid$)/.test(key)) return 'guid';
  if (/(^id$|id$|count$|quantity$|amount$|percent$|priority$|number$|lineno$|sequenceno$|version$|dpi$|widthmm$|heightmm$|warehousecode$)/.test(key)) return 'number';
  if (/(status$|type$|mode$|scope$|policy$|direction$|action$|strategy$|decision$|state$|format$|characterset$|uniqueness$)/.test(key)) return 'enum';
  if (/(atutc$|datetime$|createdat$|updatedat$|occurredat$)/.test(key)) return 'datetime';
  if (/(date$|day$)/.test(key)) return 'date';
  if (/^(is|has|can|allow|require)[a-z]/.test(key)) return 'boolean';
  return 'text';
}

function isGridColumnSearchable<T>(column: GridColumn<T>): boolean {
  if (typeof column.searchable === 'boolean') return column.searchable;
  if (column.key === 'actions' || column.filterable === false) return false;
  return ['text', 'number', 'guid'].includes(inferFilterType(column));
}

function normalizeGridMenuSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/ı/g, 'i')
    .trim();
}

function matchesGridMenuSearch(label: string, search: string): boolean {
  const normalizedSearch = normalizeGridMenuSearch(search);
  return !normalizedSearch || normalizeGridMenuSearch(label).includes(normalizedSearch);
}

function GridMenuSearch({
  value,
  onChange,
  placeholder,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
}) {
  return <div className="relative mb-2">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-10 w-full rounded-lg border border-[var(--wms-app-border)] bg-transparent pl-9 pr-9 text-sm outline-none focus:border-[var(--wms-brand-primary)]"
    />
    {value && <button type="button" aria-label={clearLabel} onClick={() => onChange('')} className="absolute right-0 top-0 grid size-10 place-items-center text-slate-400 hover:text-[var(--wms-app-text)]"><X className="size-4"/></button>}
  </div>;
}

function defaultFilterOperator<T>(column: GridColumn<T>): string {
  return FILTER_OPERATOR_VALUES[inferFilterType(column)][0];
}

function operatorNeedsValue(operator: string): boolean {
  return operator !== 'isNull' && operator !== 'isNotNull';
}

function renderGridCell<T>(column: GridColumn<T>, row: T, language: string): ReactNode {
  const rendered = column.render(row);
  return typeof rendered === 'string'
    && inferFilterType(column) === 'enum'
    && isKnownEnumValue(rendered)
    ? localizeEnumValue(rendered, language)
    : rendered;
}

function toContextText(value: unknown, language: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    return isKnownEnumValue(value)
      ? localizeEnumValue(value, language)
      : localizeLegacyUiText(value, language);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
}

function getContextValue<T>(column: GridColumn<T>, row: T, language: string): string | null {
  const explicit = column.contextValue?.(row);
  if (explicit !== undefined) return toContextText(explicit, language);

  const rendered = renderGridCell(column, row, language);
  const renderedText = toContextText(rendered, language);
  if (renderedText != null) return renderedText;

  return toContextText((row as Record<string, unknown>)[column.key], language);
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

interface SortableHeaderProps {
  columnKey: string;
  label: string;
  sortable: boolean;
  isActiveSort: boolean;
  sortDirection: 'asc' | 'desc';
  width?: number;
  onSort: () => void;
  onResizeStart: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  dragLabel: string;
  resizeLabel: string;
}

function SortableHeader({ columnKey, label, sortable, isActiveSort, sortDirection, width, onSort, onResizeStart, dragLabel, resizeLabel }: SortableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: columnKey });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    width: width ? `${width}px` : undefined,
    minWidth: width ? `${width}px` : undefined,
    maxWidth: width ? `${width}px` : undefined,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <th ref={setNodeRef} style={style} data-column-key={columnKey} className="group relative border-b border-r border-[var(--wms-app-border)] px-1 py-2 font-semibold last:border-r-0">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dragLabel}
          title={dragLabel}
          className="hidden min-h-11 min-w-11 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 opacity-60 hover:bg-black/5 hover:opacity-100 active:cursor-grabbing sm:inline-flex dark:hover:bg-white/10"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" disabled={!sortable} onClick={onSort} className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-1 text-left disabled:cursor-default">
          <span className="truncate">{label}</span>
          {sortable && (isActiveSort ? (sortDirection === 'asc' ? <ArrowUp className="size-3.5 shrink-0" /> : <ArrowDown className="size-3.5 shrink-0" />) : <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" />)}
        </button>
      </div>
      <button
        type="button"
        aria-label={resizeLabel}
        title={resizeLabel}
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 hidden h-full w-2 cursor-col-resize touch-none bg-transparent hover:bg-[var(--wms-brand-primary)]/30 sm:block"
      />
    </th>
  );
}

export function AdvancedDataGrid<T extends { id: number }>({
  pageKey,
  title,
  description,
  columns: sourceColumns,
  fetchPage,
  toolbarAction,
  refreshKey = 0,
}: Props<T>) {
  const { t, i18n } = useTranslation();
  const enumLanguage = i18n.resolvedLanguage ?? i18n.language;
  const localizedTitle = localizeLegacyUiText(title, enumLanguage);
  const localizedDescription = description ? localizeLegacyUiText(description, enumLanguage) : undefined;
  const filterLogicOptions = useMemo<AppDropdownOption[]>(() => [
    { value: 'and', label: t('dataGrid.logicAll') },
    { value: 'or', label: t('dataGrid.logicAny') },
  ], [t]);
  const booleanFilterOptions = useMemo<AppDropdownOption[]>(() => [
    { value: 'true', label: t('common.yes') },
    { value: 'false', label: t('common.no') },
  ], [t]);
  const filterOperatorOptions = useMemo<Record<GridFilterType, AppDropdownOption[]>>(
    () => Object.fromEntries(
      Object.entries(FILTER_OPERATOR_VALUES).map(([type, operators]) => [
        type,
        operators.map((operator) => ({ value: operator, label: t(`dataGrid.operators.${operator}`) })),
      ]),
    ) as Record<GridFilterType, AppDropdownOption[]>,
    [t],
  );
  const columns = useMemo(() => sourceColumns.map((column) => {
    const systemLabelKey = SYSTEM_COLUMN_LABEL_KEYS[column.key];
    const localizedColumn = systemLabelKey
      ? { ...column, label: t(`dataGrid.systemColumns.${systemLabelKey}`) }
      : column;
    return column.key === 'id' || column.key === 'actions'
      ? { ...localizedColumn, hideable: false }
      : localizedColumn;
  }), [sourceColumns, t]);
  const localizedColumns = useMemo(
    () => columns.map((column) => ({ ...column, label: localizeLegacyUiText(column.label, enumLanguage) })),
    [columns, enumLanguage],
  );
  const userId = useAuthStore((state) => state.user?.id);
  const preferenceColumns = useMemo(
    () => columns.map((column) => ({
      key: column.key,
      sortable: column.sortable,
      hideable: (column.key === 'id' || column.key === 'actions') ? false : column.hideable,
      searchable: isGridColumnSearchable(column),
      defaultSearch: column.defaultSearch,
    })),
    [columns],
  );
  const storageKey = getGridPreferenceKey(pageKey, userId);
  const initialPreferences = useMemo(() => loadGridPreferences(pageKey, userId, preferenceColumns), [pageKey, userId, preferenceColumns]);
  const [loadedKey, setLoadedKey] = useState(storageKey);
  const [visible, setVisible] = useState<string[]>(initialPreferences.visible);
  const [order, setOrder] = useState<string[]>(initialPreferences.order);
  const [widths, setWidths] = useState<Record<string, number>>(initialPreferences.widths);
  const [searchFields, setSearchFields] = useState<string[]>(initialPreferences.searchFields);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string | null>(initialPreferences.sortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialPreferences.sortDirection);
  const [showColumns, setShowColumns] = useState(false);
  const [showSearchFields, setShowSearchFields] = useState(false);
  const [columnMenuSearch, setColumnMenuSearch] = useState('');
  const [searchFieldMenuSearch, setSearchFieldMenuSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<GridFilter[]>([]);
  const [filters, setFilters] = useState<GridFilter[]>([]);
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and');
  const [actionRunning, setActionRunning] = useState(false);
  const [cellContext, setCellContext] = useState<GridCellContext<T> | null>(null);
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (loadedKey === storageKey) return;
    const preferences = loadGridPreferences(pageKey, userId, preferenceColumns);
    setVisible(preferences.visible);
    setOrder(preferences.order);
    setWidths(preferences.widths);
    setSearchFields(preferences.searchFields);
    setPageSize(preferences.pageSize);
    setSortBy(preferences.sortBy);
    setSortDirection(preferences.sortDirection);
    setPage(1);
    setLoadedKey(storageKey);
  }, [loadedKey, pageKey, preferenceColumns, storageKey, userId]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    const timer = window.setTimeout(() => {
      const preferences: GridPreferences = { version: 2, visible, order, widths, searchFields, sortBy, sortDirection, pageSize };
      saveGridPreferences(pageKey, userId, preferences);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadedKey, order, pageKey, pageSize, searchFields, sortBy, sortDirection, storageKey, userId, visible, widths]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      setWidths((current) => ({ ...current, [state.key]: Math.max(MIN_COLUMN_WIDTH, state.startWidth + event.clientX - state.startX) }));
    };
    const handleMouseUp = () => { resizeRef.current = null; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!cellContext) return;
    const close = () => setCellContext(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [cellContext]);

  const searchableColumns = useMemo(
    () => localizedColumns.filter(isGridColumnSearchable),
    [localizedColumns],
  );
  const visibleSearchableColumns = useMemo(
    () => searchableColumns.filter((column) => visible.includes(column.key)),
    [searchableColumns, visible],
  );
  const filteredSearchableColumns = useMemo(
    () => visibleSearchableColumns.filter((column) => matchesGridMenuSearch(column.label, searchFieldMenuSearch)),
    [searchFieldMenuSearch, visibleSearchableColumns],
  );
  const columnMenuColumns = useMemo(
    () => order
      .map((key) => localizedColumns.find((column) => column.key === key))
      .filter((column): column is GridColumn<T> => Boolean(column))
      .filter((column) => matchesGridMenuSearch(column.label, columnMenuSearch)),
    [columnMenuSearch, localizedColumns, order],
  );
  const effectiveSearchFields = useMemo(() => {
    const selected = searchFields
      .filter((key) => visibleSearchableColumns.some((column) => column.key === key))
      .slice(0, MAX_GRID_SEARCH_FIELDS);
    return selected.length > 0
      ? selected
      : visibleSearchableColumns.slice(0, 1).map((column) => column.key);
  }, [searchFields, visibleSearchableColumns]);
  const request = useMemo<GridRequest>(
    () => ({
      pageNumber: page,
      pageSize,
      search: search || null,
      searchFields: search && effectiveSearchFields.length > 0 ? effectiveSearchFields : undefined,
      sortBy,
      sortDirection,
      filterLogic,
      filters,
    }),
    [page, pageSize, search, effectiveSearchFields, sortBy, sortDirection, filterLogic, filters],
  );
  const query = useQuery({
    queryKey: ['advanced-grid', pageKey, refreshKey, request],
    queryFn: () => fetchPage(request),
    placeholderData: (previous) => previous,
  });
  const activeColumns = order.map((key) => localizedColumns.find((column) => column.key === key)).filter((column): column is GridColumn<T> => Boolean(column && visible.includes(column.key)));
  const actionColumn = localizedColumns.find((column) => column.key === 'actions');
  const total = query.data?.totalCount ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? Math.ceil(total / pageSize));
  const first = total ? ((page - 1) * pageSize) + 1 : 0;
  const last = Math.min(page * pageSize, total);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const addFilter = () => {
    const column = columns.find((item) => item.filterable !== false) ?? columns[0];
    setDraftFilters((value) => [...value, { column: column.key, operator: defaultFilterOperator(column), value: '' }]);
  };
  const applyFilters = () => {
    setFilters(draftFilters.filter((filter) => !operatorNeedsValue(filter.operator) || filter.value.trim()));
    setPage(1);
    setShowFilters(false);
  };
  const clearFilters = () => { setDraftFilters([]); setFilters([]); setPage(1); };
  const changeSort = (key: string) => { if (sortBy === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortDirection('asc'); } setPage(1); };
  const runAction = async () => { if (!toolbarAction) return; setActionRunning(true); try { await toolbarAction.run(); await query.refetch(); } finally { setActionRunning(false); } };
  const toggleColumn = (key: string) => {
    if (key === 'id' || key === 'actions' || columns.find((column) => column.key === key)?.hideable === false) return;
    setVisible((current) => current.includes(key) ? (current.length === 1 ? current : current.filter((item) => item !== key)) : [...current, key]);
  };
  const resetLayout = () => {
    const defaults = getDefaultGridPreferences(preferenceColumns);
    setVisible(defaults.visible);
    setOrder(defaults.order);
    setWidths(defaults.widths);
    setSearchFields(defaults.searchFields);
    setSortBy(defaults.sortBy);
    setSortDirection(defaults.sortDirection);
    setPageSize(defaults.pageSize);
    setPage(1);
  };
  const toggleSearchField = (key: string) => {
    setSearchFields((current) => {
      if (!current.includes(key)) {
        const visibleSelectedCount = current.filter((item) =>
          visibleSearchableColumns.some((column) => column.key === item)).length;
        return visibleSelectedCount >= MAX_GRID_SEARCH_FIELDS ? current : [...current, key];
      }
      return effectiveSearchFields.length > 1 ? current.filter((item) => item !== key) : current;
    });
    setPage(1);
  };
  const resetSearchFields = () => {
    setSearchFields(getDefaultGridPreferences(preferenceColumns).searchFields);
    setPage(1);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
  };
  const startResize = (event: ReactMouseEvent<HTMLButtonElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest('th');
    resizeRef.current = { key, startX: event.clientX, startWidth: widths[key] ?? header?.getBoundingClientRect().width ?? 160 };
  };
  const openCellContext = (event: ReactMouseEvent<HTMLTableCellElement>, row: T, column: GridColumn<T>) => {
    event.preventDefault();
    const menuWidth = 320;
    const menuHeight = actionColumn ? 300 : 220;
    setCellContext({
      row,
      column,
      value: getContextValue(column, row, enumLanguage),
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };
  const copyCellValue = async () => {
    if (!cellContext?.value) return;
    try {
      await copyText(cellContext.value);
      toast.success(t('dataGrid.cellCopied'));
      setCellContext(null);
    } catch {
      toast.error(t('dataGrid.cellCopyFailed'));
    }
  };

  return <section className="min-h-[calc(100vh-8rem)] rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">V3RII WMS</p><h1 className="mt-1 text-2xl font-bold">{localizedTitle}</h1>{localizedDescription && <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{localizedDescription}</p>}</div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <div className="col-span-2 flex min-w-0 gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('dataGrid.searchPlaceholder')} aria-label={t('dataGrid.searchPlaceholder')} className="h-11 w-full rounded-xl border border-[var(--wms-app-border)] bg-transparent pl-9 pr-11 text-sm outline-none"/>{searchInput && <button type="button" aria-label={t('dataGrid.clearSearch')} onClick={() => setSearchInput('')} className="absolute right-0 top-0 grid size-11 place-items-center"><X className="size-4"/></button>}</label>
          {visibleSearchableColumns.length > 0 && <PopoverPrimitive.Root open={showSearchFields} onOpenChange={(open) => { setShowSearchFields(open); if (!open) setSearchFieldMenuSearch(''); }}>
            <PopoverPrimitive.Trigger asChild>
              <button type="button" aria-expanded={showSearchFields} aria-haspopup="menu" title={t('dataGrid.searchFields')} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm">
                <ListFilter className="size-4"/>
                <span className="hidden lg:inline">{t('dataGrid.searchFields')}</span>
                <span className="rounded-full bg-[var(--wms-brand-primary)] px-1.5 text-xs text-white">{effectiveSearchFields.length}</span>
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal container={getWorkspacePortalRoot() ?? undefined}>
              <PopoverPrimitive.Content role="menu" align="end" sideOffset={8} collisionPadding={8} className="wms-floating-surface z-[2000] w-72 rounded-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
                <strong className="block text-sm">{t('dataGrid.searchFields')}</strong>
                <p className="mb-2 mt-1 text-xs text-[var(--wms-app-text-muted)]">{t('dataGrid.searchFieldsHelp')}</p>
                <GridMenuSearch value={searchFieldMenuSearch} onChange={setSearchFieldMenuSearch} placeholder={t('dataGrid.menuSearchPlaceholder')} clearLabel={t('dataGrid.clearMenuSearch')}/>
                <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                  {filteredSearchableColumns.length === 0
                    ? <p role="status" className="px-2 py-6 text-center text-sm text-[var(--wms-app-text-muted)]">{t('dataGrid.noMatchingColumns')}</p>
                    : filteredSearchableColumns.map((column) => {
                      const checked = effectiveSearchFields.includes(column.key);
                      const locked = checked && effectiveSearchFields.length === 1;
                      const limitReached = !checked && effectiveSearchFields.length >= MAX_GRID_SEARCH_FIELDS;
                      return <label key={column.key} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--wms-brand-soft)] ${locked ? 'opacity-60' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={locked || limitReached} onChange={() => toggleSearchField(column.key)}/>
                        <span className="truncate">{column.label}</span>
                      </label>;
                    })}
                </div>
                <button type="button" onClick={resetSearchFields} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--wms-app-border)] px-3 py-2 text-sm hover:bg-[var(--wms-brand-soft)]"><RotateCcw className="size-4"/>{t('dataGrid.resetSearchFields')}</button>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>}
        </div>
        <PopoverPrimitive.Root open={showColumns} onOpenChange={(open) => { setShowColumns(open); if (!open) setColumnMenuSearch(''); }}>
          <PopoverPrimitive.Trigger asChild>
            <button type="button" aria-expanded={showColumns} aria-haspopup="menu" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm sm:w-auto"><Columns3 className="size-4"/>{t('dataGrid.columns')}</button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal container={getWorkspacePortalRoot() ?? undefined}>
            <PopoverPrimitive.Content
              role="menu"
              align="end"
              sideOffset={8}
              collisionPadding={8}
              className="wms-floating-surface wms-grid-columns-popover z-[2000] rounded-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            >
              <p className="mb-2 text-xs text-[var(--wms-app-text-muted)]">{t('dataGrid.columnHelp')}</p>
              <GridMenuSearch value={columnMenuSearch} onChange={setColumnMenuSearch} placeholder={t('dataGrid.menuSearchPlaceholder')} clearLabel={t('dataGrid.clearMenuSearch')}/>
              <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                {columnMenuColumns.length === 0
                  ? <p role="status" className="px-2 py-6 text-center text-sm text-[var(--wms-app-text-muted)]">{t('dataGrid.noMatchingColumns')}</p>
                  : columnMenuColumns.map((column) => <label key={column.key} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--wms-brand-soft)] ${column.hideable === false ? 'opacity-60' : ''}`}>
                    <input type="checkbox" checked={visible.includes(column.key)} disabled={column.hideable === false} onChange={() => toggleColumn(column.key)}/>
                    <span className="truncate">{column.label}</span>
                    {column.hideable === false && <small className="ml-auto text-[10px] uppercase text-slate-400">{t('dataGrid.fixed')}</small>}
                  </label>)}
              </div>
              <button type="button" onClick={resetLayout} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--wms-app-border)] px-3 py-2 text-sm hover:bg-[var(--wms-brand-soft)]"><RotateCcw className="size-4"/>{t('dataGrid.resetLayout')}</button>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
        <button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} className="relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm sm:w-auto"><Filter className="size-4"/>{t('advancedFilter.title')}{filters.length > 0 && <span className="rounded-full bg-[var(--wms-brand-primary)] px-1.5 text-xs text-white">{filters.length}</span>}</button>
        <button type="button" aria-label={t('dataGrid.refresh')} onClick={() => query.refetch()} className="h-11 rounded-xl border border-[var(--wms-app-border)] p-2.5"><RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`}/></button>
        {toolbarAction && <button type="button" onClick={runAction} disabled={actionRunning} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"><RefreshCw className={`size-4 ${actionRunning ? 'animate-spin' : ''}`}/>{toolbarAction.label}</button>}
      </div>
    </div>
    {showFilters && <div className="mb-4 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel-muted)] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><strong className="text-sm">{t('dataGrid.filters')}</strong><AppDropdown value={filterLogic} onValueChange={(value) => setFilterLogic(value as 'and' | 'or')} options={filterLogicOptions} ariaLabel={t('dataGrid.filterMatchType')} className="h-11 w-full sm:w-44" /></div><button type="button" onClick={addFilter} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[var(--wms-app-border)] px-3 text-sm text-[var(--wms-brand-primary)] sm:border-0"><Plus className="size-4"/>{t('advancedFilter.add')}</button></div>
      {draftFilters.length === 0 ? <p className="text-sm text-slate-500">{t('dataGrid.noFilters')}</p> : <div className="space-y-2">{draftFilters.map((filter, index) => {
        const selectedColumn = localizedColumns.find((column) => column.key === filter.column) ?? localizedColumns[0];
        const filterType = inferFilterType(selectedColumn);
        const valueOptions = selectedColumn.filterOptions ?? (filterType === 'boolean' ? booleanFilterOptions : undefined);
        return <div key={`${filter.column}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_190px_1fr_40px]">
          <AppDropdown value={filter.column} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => {
            if (number !== index) return item;
            const nextColumn = localizedColumns.find((column) => column.key === value) ?? localizedColumns[0];
            return { ...item, column: value, operator: defaultFilterOperator(nextColumn), value: '' };
          }))} options={localizedColumns.filter((column) => column.filterable !== false).map((column) => ({ value: column.key, label: column.label }))} ariaLabel={t('dataGrid.filterColumnAria', { number: index + 1 })} searchable className="h-10" />
          <AppDropdown value={filter.operator} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, operator: value } : item))} options={filterOperatorOptions[filterType]} ariaLabel={t('dataGrid.filterOperatorAria', { number: index + 1 })} className="h-10" />
          {!operatorNeedsValue(filter.operator) ? <div className="flex items-center rounded-lg border border-[var(--wms-app-border)] px-3 text-sm text-slate-500">{t('dataGrid.valueNotRequired')}</div>
            : valueOptions ? <AppDropdown value={filter.value || null} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value } : item))} options={valueOptions} ariaLabel={t('dataGrid.filterValueAria', { number: index + 1 })} className="h-10" />
              : filterType === 'date' || filterType === 'datetime'
                ? <AppDateInput type={filterType === 'date' ? 'date' : 'datetime-local'} value={filter.value} onChange={(event) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value: event.target.value } : item))} aria-label={t('dataGrid.filterValueAria', { number: index + 1 })} className="h-10"/>
                : <input type={filterType === 'number' ? 'number' : 'text'} value={filter.value} onChange={(event) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value: event.target.value } : item))} aria-label={t('dataGrid.filterValueAria', { number: index + 1 })} className="input h-10"/>}
          <button type="button" aria-label={t('advancedFilter.remove')} onClick={() => setDraftFilters((value) => value.filter((_, number) => number !== index))} className="rounded-lg border border-[var(--wms-app-border)] p-2"><Trash2 className="size-4"/></button>
        </div>;
      })}</div>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={clearFilters} className="rounded-lg border border-[var(--wms-app-border)] px-3 py-2 text-sm">{t('advancedFilter.clear')}</button><button type="button" onClick={applyFilters} className="rounded-lg bg-[var(--wms-brand-primary)] px-3 py-2 text-sm text-white">{t('dataGrid.apply')}</button></div>
    </div>}
    <div className="hidden overflow-hidden rounded-xl border border-[var(--wms-app-border)] sm:block"><div className="overflow-x-auto"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><table className={`w-full min-w-[760px] border-collapse text-sm ${Object.keys(widths).length ? 'table-fixed' : ''}`}><thead className="bg-[var(--wms-app-panel-muted)] text-left text-xs uppercase tracking-wide text-[var(--wms-app-text-muted)]"><tr><SortableContext items={activeColumns.map((column) => column.key)} strategy={horizontalListSortingStrategy}>{activeColumns.map((column) => <SortableHeader key={column.key} columnKey={column.key} label={column.label} sortable={column.sortable !== false} isActiveSort={sortBy === column.key} sortDirection={sortDirection} width={widths[column.key]} onSort={() => changeSort(column.key)} onResizeStart={(event) => startResize(event, column.key)} dragLabel={t('dataGrid.dragColumn', { column: column.label })} resizeLabel={t('dataGrid.resizeColumn', { column: column.label })}/>)}</SortableContext></tr></thead><tbody>{query.isLoading ? <tr><td colSpan={activeColumns.length} className="h-40 text-center">{t('common.loading')}</td></tr> : query.isError ? <tr><td colSpan={activeColumns.length} className="h-40 text-center text-red-500">{query.error instanceof Error ? query.error.message : t('dataGrid.loadError')}</td></tr> : !query.data?.items.length ? <tr><td colSpan={activeColumns.length} className="h-40 text-center text-slate-500">{t('dataGrid.noRecords')}</td></tr> : query.data.items.map((row) => <tr key={row.id} className="border-b border-[var(--wms-app-border)] hover:bg-[var(--wms-brand-soft)]">{activeColumns.map((column) => <td key={column.key} onContextMenu={(event) => openCellContext(event, row, column)} style={widths[column.key] ? { width: widths[column.key], maxWidth: widths[column.key] } : undefined} className="overflow-hidden border-r border-[var(--wms-app-border)] px-4 py-3 last:border-r-0"><div className="truncate">{renderGridCell(column, row, enumLanguage)}</div></td>)}</tr>)}</tbody></table></DndContext></div></div>
    <div className="space-y-3 sm:hidden" aria-live="polite">
      {query.isLoading ? <GridMobileStatus text={t('common.loading')} /> : query.isError ? <GridMobileStatus text={query.error instanceof Error ? query.error.message : t('dataGrid.loadError')} error /> : !query.data?.items.length ? <GridMobileStatus text={t('dataGrid.noRecords')} /> : query.data.items.map((row) => (
        <article key={row.id} className="overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm">
          {activeColumns.map((column) => (
            <div key={column.key} className={`grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 border-b border-[var(--wms-app-border)] px-3 py-3 last:border-b-0 ${column.key === 'actions' ? 'items-center bg-[var(--wms-brand-soft)]' : 'items-start'}`}>
              <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">{column.label}</span>
              <div className="min-w-0 break-words text-right text-sm [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:touch-manipulation [&>div]:justify-end">{renderGridCell(column, row, enumLanguage)}</div>
            </div>
          ))}
        </article>
      ))}
    </div>
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-slate-500"><span>{t('dataGrid.recordRange', { first, last, total })}</span><AppDropdown value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={PAGE_SIZE_DROPDOWN_OPTIONS} ariaLabel={t('dataGrid.rowsPerPage')} className="h-9 w-20" /></div><div className="flex items-center gap-2"><button type="button" aria-label={t('common.previous')} disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[var(--wms-app-border)] p-2 disabled:opacity-40"><ChevronLeft className="size-4"/></button><span>{t('dataGrid.pageOf', { page, totalPages })}</span><button type="button" aria-label={t('common.next')} disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[var(--wms-app-border)] p-2 disabled:opacity-40"><ChevronRight className="size-4"/></button></div></div>
    {cellContext && createPortal(
      <div
        role="menu"
        aria-label={t('dataGrid.cellMenu')}
        style={{ left: cellContext.x, top: cellContext.y }}
        className="fixed z-[4000] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-2 text-sm shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="rounded-xl bg-[var(--wms-app-panel-muted)] px-3 py-2.5">
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-app-text-muted)]">{t('dataGrid.selectedCell')}</span>
          <strong className="mt-1 block truncate">{cellContext.column.label}</strong>
          <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--wms-app-text-muted)]">
            {cellContext.value ?? t('dataGrid.emptyCell')}
          </p>
        </div>
        {cellContext.value != null && !cellContext.column.contextCopyDisabled && (
          <button type="button" role="menuitem" onClick={() => void copyCellValue()} className="mt-2 inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-medium hover:bg-[var(--wms-brand-soft)]">
            <Copy className="size-4 text-[var(--wms-brand-primary)]"/>
            {t('dataGrid.copyCell')}
          </button>
        )}
        {actionColumn?.render && (
          <div className="mt-2 border-t border-[var(--wms-app-border)] px-2 pt-2" onClick={() => setCellContext(null)}>
            <span className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-app-text-muted)]">{t('dataGrid.rowActions')}</span>
            <div className="[&>div]:flex-wrap">{actionColumn.render(cellContext.row)}</div>
          </div>
        )}
      </div>,
      document.body,
    )}
  </section>;
}

function GridMobileStatus({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`grid min-h-40 place-items-center rounded-xl border border-[var(--wms-app-border)] px-4 text-center text-sm ${
        error ? 'text-red-500' : 'text-slate-500'
      }`}
    >
      {text}
    </div>
  );
}
