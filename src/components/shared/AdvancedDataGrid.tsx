import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsGridErrorState } from '@/components/shared/OpsGridErrorState';
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
import { useLocation } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronDown,
  Copy,
  Columns3,
  Eye,
  EyeOff,
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
import { normalizeGridPage } from '@/lib/paged';
import { OpsActionButton } from './OpsActionButton';
import { OpsListPageShell } from './OpsListPageShell';
import { OpsListSearchField } from './OpsListSearchField';
import { OPS_FIELD_CLASS } from './ops-field-styles';
import { buildTerminalEyebrowFromNav } from './PremiumEyebrow';
import { GridExportMenu } from './GridExportMenu';
import { VoiceSearchButton } from '@/components/ui/voice-search-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface GridFilter { column: string; operator: string; value: string }
export interface GridRequest { pageNumber?: number; page?: number; pageSize: number; search: string | null; searchFields?: string[]; sortBy?: string | null; sortDirection?: 'asc' | 'desc'; filterLogic: 'and' | 'or'; filters: GridFilter[] }
/** Normalized page shape. API may return rows as `data` (PagedResponse) or `items` — use normalizeGridPage. */
export interface GridPage<T> { items: T[]; data?: T[]; pageNumber: number; page?: number; pageSize: number; totalCount: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean }
export { normalizeGridPage };
export type GridFilterType = 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum' | 'guid';
export interface GridColumn<T> {
  key: string;
  label: string;
  width?: number;
  render: (row: T) => ReactNode;
  /** SaÄŸ tÄ±k menÃ¼sÃ¼nde gÃ¶sterilecek ve kopyalanacak biÃ§imlendirilmiÅŸ hÃ¼cre deÄŸeri. */
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
export interface GridToolbarAction {
  label: string;
  run: () => Promise<void>;
  icon?: ReactNode;
}
interface Props<T extends { id: number }> {
  pageKey: string;
  title: string;
  description?: string;
  /** Terminal: `GİRİŞ_OP / MAL_KABUL` chip. Premium: nav breadcrumb. */
  eyebrow?: ReactNode;
  /** Empty-state message (premium shows this alone; terminal also shows INFO NO_DATA). */
  emptyMessage?: string;
  columns: GridColumn<T>[];
  fetchPage: (request: GridRequest) => Promise<GridPage<T>>;
  toolbarAction?: GridToolbarAction;
  toolbarActions?: GridToolbarAction[];
  /** Mutation sonrasında sunucu verisini yeniden okumak için artırılan sürüm anahtarı. */
  refreshKey?: string | number;
  /** Satıra çift tıklanınca çağrılır (aksiyon hücreleri hariç etkileşimleri engellemez). */
  onRowDoubleClick?: (row: T) => void;
  /** Açık satır detayı; `renderExpandedRow` ile birlikte kullanılır. */
  expandedRowId?: number | null;
  /** Özet satırın altına açılan detay içeriği. */
  renderExpandedRow?: (row: T) => ReactNode;
}

interface GridCellContext<T> {
  row: T;
  column: GridColumn<T>;
  value: string | null;
  x: number;
  y: number;
}

const MIN_COLUMN_WIDTH = 80;
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;
const DEFAULT_COLUMN_WIDTH = 160;
const DEFAULT_ID_COLUMN_WIDTH = 88;
const DEFAULT_ACTIONS_COLUMN_WIDTH = 120;
const LOCKED_COLUMN_KEYS = new Set(['id']);
const EXCLUDED_COLUMN_PREF_KEYS = new Set(['actions']);
const gridScrollPositions = new Map<string, number>();

function resolveColumnWidth<T>(columnOrKey: GridColumn<T> | string, widths: Record<string, number>, fallbackWidth?: number): number {
  const column = typeof columnOrKey === 'string' ? undefined : columnOrKey;
  const key = typeof columnOrKey === 'string' ? columnOrKey : columnOrKey.key;
  if (widths[key] != null) return widths[key];
  if (typeof column?.width === 'number' && Number.isFinite(column.width)) return Math.max(MIN_COLUMN_WIDTH, column.width);
  if (typeof fallbackWidth === 'number' && Number.isFinite(fallbackWidth)) return Math.max(MIN_COLUMN_WIDTH, fallbackWidth);
  if (key === 'id') return DEFAULT_ID_COLUMN_WIDTH;
  if (key === 'actions') return DEFAULT_ACTIONS_COLUMN_WIDTH;
  return DEFAULT_COLUMN_WIDTH;
}

function pinLeadingLockedKeys(order: string[], lockedKeys: string[] = ['id']): string[] {
  const locked = lockedKeys.filter((key) => order.includes(key));
  const rest = order.filter((key) => !lockedKeys.includes(key));
  return [...locked, ...rest];
}
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
    .replace(/Ä±/g, 'i')
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
  return <div className="wms-ops-list-popover__search relative mb-2">
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--wms-ops-field-placeholder-fg)]"/>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(OPS_FIELD_CLASS, 'wms-ops-list-popover__search-input h-8 w-full border pl-8 pr-8 text-xs outline-none')}
    />
    {value && <button type="button" aria-label={clearLabel} onClick={() => onChange('')} className="absolute right-0 top-0 grid size-8 place-items-center text-[var(--wms-ops-field-placeholder-fg)] hover:text-[var(--wms-app-text)]"><X className="size-3.5"/></button>}
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
  // Keep the legacy selection copy synchronous with the user's click. Safari
  // may reject Clipboard API writes and the user-activation window is already
  // lost by the time that asynchronous rejection is observed.
  let copyEventHandled = false;
  const handleCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', value);
    copyEventHandled = true;
  };
  document.addEventListener('copy', handleCopy, { once: true });
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  document.removeEventListener('copy', handleCopy);
  const legacyCopySucceeded = copied && copyEventHandled;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      if (legacyCopySucceeded) return;
      throw new Error('Clipboard unavailable');
    }
  }

  if (legacyCopySucceeded) return;
  throw new Error('Clipboard unavailable');
}

interface SortableHeaderProps {
  columnKey: string;
  label: string;
  sortable: boolean;
  isActiveSort: boolean;
  sortDirection: 'asc' | 'desc';
  width?: number;
  onSort: () => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  dragLabel: string;
  resizeLabel: string;
}

function SortableHeader({
  columnKey,
  label,
  sortable,
  isActiveSort,
  sortDirection,
  width,
  onSort,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  dragLabel,
  resizeLabel,
}: SortableHeaderProps) {
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
    <th
      ref={setNodeRef}
      style={style}
      data-column-key={columnKey}
      className={cn(
        'wms-ops-table-head group relative border-b border-r border-[var(--wms-app-border)] px-1 py-2 font-semibold last:border-r-0',
        columnKey === 'id' && 'wms-ops-table-id-col',
        columnKey === 'actions' && 'wms-ops-table-actions-col',
      )}
    >
      <div className="wms-ops-table-head__layout flex min-w-0 items-center gap-1">
        {columnKey !== 'id' && columnKey !== 'actions' ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={dragLabel}
            title={dragLabel}
            data-no-drag-scroll="true"
            className="wms-ops-table-head__grip hidden min-h-11 min-w-11 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 opacity-60 hover:bg-black/5 hover:opacity-100 active:cursor-grabbing sm:inline-flex dark:hover:bg-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}
        <button type="button" disabled={!sortable} onClick={onSort} className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-1 text-left disabled:cursor-default">
          <span className="truncate">{label}</span>
          {sortable && (isActiveSort ? (sortDirection === 'asc' ? <ArrowUp className="size-3.5 shrink-0" /> : <ArrowDown className="size-3.5 shrink-0" />) : <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" />)}
        </button>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={resizeLabel}
        title={resizeLabel}
        data-no-drag-scroll="true"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        className="wms-ops-col-resize-handle"
      />
    </th>
  );
}

export function AdvancedDataGrid<T extends { id: number }>({
  pageKey,
  title,
  description,
  eyebrow,
  emptyMessage,
  columns: sourceColumns,
  fetchPage,
  toolbarAction,
  toolbarActions,
  refreshKey = 0,
  onRowDoubleClick,
  expandedRowId = null,
  renderExpandedRow,
}: Props<T>) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const enumLanguage = i18n.resolvedLanguage ?? i18n.language;
  const localizedTitle = localizeLegacyUiText(title, enumLanguage);
  const localizedDescription = description ? localizeLegacyUiText(description, enumLanguage) : undefined;
  const resolvedEyebrow = eyebrow ?? buildTerminalEyebrowFromNav(pathname, t, enumLanguage) ?? 'VERII WMS';
  const resolvedEmptyMessage = emptyMessage ?? t('dataGrid.noRecords');
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
  const [runningActionIndex, setRunningActionIndex] = useState<number | null>(null);
  const [cellContext, setCellContext] = useState<GridCellContext<T> | null>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const [gridViewportHeight, setGridViewportHeight] = useState<number | null>(null);
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number; pointerId: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);

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
    if (!cellContext) return;
    const close = () => setCellContext(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCellContext(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', close);
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
      .filter((column) => !EXCLUDED_COLUMN_PREF_KEYS.has(column.key))
      .filter((column) => matchesGridMenuSearch(column.label, columnMenuSearch)),
    [columnMenuSearch, localizedColumns, order],
  );
  const displayColumns = useMemo(
    () => order.filter((key) => visible.includes(key) && !EXCLUDED_COLUMN_PREF_KEYS.has(key)),
    [order, visible],
  );
  const hiddenColumns = useMemo(
    () => order.filter((key) => !visible.includes(key) && !EXCLUDED_COLUMN_PREF_KEYS.has(key)),
    [order, visible],
  );
  const firstMovableIndex = useMemo(() => {
    const index = displayColumns.findIndex((key) => !LOCKED_COLUMN_KEYS.has(key));
    return index < 0 ? displayColumns.length : index;
  }, [displayColumns]);
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
    queryFn: async () => normalizeGridPage<T>(await fetchPage(request)),
    placeholderData: (previous) => previous,
  });
  const activeColumns = useMemo(() => {
    const fromPrefs = order
      .map((key) => localizedColumns.find((column) => column.key === key))
      .filter((column): column is GridColumn<T> => Boolean(column && visible.includes(column.key)));
    // Never render a blank table chrome — fall back to all columns if prefs are corrupt.
    return fromPrefs.length > 0 ? fromPrefs : localizedColumns;
  }, [localizedColumns, order, visible]);
  const tableMinWidthPx = useMemo(
    () => Math.max(960, activeColumns.reduce((sum, column) => sum + resolveColumnWidth(column, widths), 0)),
    [activeColumns, widths],
  );
  const actionColumn = localizedColumns.find((column) => column.key === 'actions');
  const pageRows = query.data?.items ?? [];
  const total = query.data?.totalCount ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? (Math.ceil(total / pageSize) || 1));
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
  const resolvedToolbarActions = toolbarActions ?? (toolbarAction ? [toolbarAction] : []);
  const runAction = async (action: GridToolbarAction, index: number) => {
    setRunningActionIndex(index);
    try {
      await action.run();
      await query.refetch();
    } finally {
      setRunningActionIndex(null);
    }
  };
  const toggleColumn = (key: string) => {
    if (LOCKED_COLUMN_KEYS.has(key) || EXCLUDED_COLUMN_PREF_KEYS.has(key) || columns.find((column) => column.key === key)?.hideable === false) return;
    setVisible((current) => {
      if (current.includes(key)) {
        const next = current.filter((item) => item !== key);
        return next.length === 0 ? current : next;
      }
      return pinLeadingLockedKeys(
        [...current, key].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
        [...LOCKED_COLUMN_KEYS],
      );
    });
  };
  const moveColumnInPopover = (key: string, direction: 'up' | 'down') => {
    if (LOCKED_COLUMN_KEYS.has(key) || EXCLUDED_COLUMN_PREF_KEYS.has(key)) return;
    const visibleOrdered = order.filter((columnKey) => visible.includes(columnKey) && !EXCLUDED_COLUMN_PREF_KEYS.has(columnKey));
    const idx = visibleOrdered.indexOf(key);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= visibleOrdered.length) return;
    if (direction === 'up' && newIdx < firstMovableIndex) return;
    const nextVisibleOrdered = [...visibleOrdered];
    [nextVisibleOrdered[idx], nextVisibleOrdered[newIdx]] = [nextVisibleOrdered[newIdx], nextVisibleOrdered[idx]];
    const hiddenOrExcluded = order.filter(
      (columnKey) => !nextVisibleOrdered.includes(columnKey),
    );
    const nextOrder = pinLeadingLockedKeys([...nextVisibleOrdered, ...hiddenOrExcluded], [...LOCKED_COLUMN_KEYS]);
    setOrder(nextOrder);
    setVisible([
      ...nextVisibleOrdered,
      ...visible.filter((columnKey) => EXCLUDED_COLUMN_PREF_KEYS.has(columnKey)),
    ]);
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
  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;
    const saved = gridScrollPositions.get(pageKey);
    if (typeof saved === 'number') node.scrollLeft = saved;
    const onScroll = () => { gridScrollPositions.set(pageKey, node.scrollLeft); };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [pageKey, pageRows.length, activeColumns.length]);

  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;

    let dragging = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;

    const isBlockedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          '[data-no-drag-scroll="true"], input, textarea, select, option, [contenteditable="true"]',
        ),
      );
    };

    const setAltReady = (active: boolean) => {
      node.classList.toggle('wms-ops-table-h-scroll--alt', active);
      if (!dragging) {
        node.style.cursor = active ? 'grab' : '';
      }
    };
    const setPanning = (active: boolean) => {
      node.classList.toggle('wms-ops-table-h-scroll--panning', active);
      document.body.classList.toggle('wms-ops-grid-panning', active);
      document.documentElement.classList.toggle('wms-ops-grid-panning', active);
      // Force closed-fist cursor immediately on click (child cursor-pointer otherwise sticks).
      node.style.cursor = active ? 'grabbing' : (node.classList.contains('wms-ops-table-h-scroll--alt') ? 'grab' : '');
      document.body.style.cursor = active ? 'grabbing' : '';
      document.documentElement.style.cursor = active ? 'grabbing' : '';
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      dragging = false;
      pointerId = null;
      setPanning(false);
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }
      if (event.altKey) setAltReady(true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.altKey || dragging) return;
      if (isBlockedTarget(event.target)) return;
      dragging = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = node.scrollLeft;
      setAltReady(true);
      setPanning(true);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      node.scrollLeft = startScrollLeft - (event.clientX - startX);
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltReady(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltReady(false);
    };
    const onWindowBlur = () => {
      setAltReady(false);
      if (dragging && pointerId != null) {
        dragging = false;
        pointerId = null;
        setPanning(false);
      }
    };

    node.addEventListener('pointerdown', onPointerDown, true);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      node.removeEventListener('pointerdown', onPointerDown, true);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endDrag);
      node.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      node.classList.remove('wms-ops-table-h-scroll--alt', 'wms-ops-table-h-scroll--panning');
      node.style.cursor = '';
      document.body.classList.remove('wms-ops-grid-panning');
      document.documentElement.classList.remove('wms-ops-grid-panning');
      document.body.style.cursor = '';
      document.documentElement.style.cursor = '';
    };
  }, [pageKey, pageRows.length, activeColumns.length]);

  useEffect(() => {
    const grid = tableScrollRef.current;
    if (!grid) return;
    let frame = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const paginationHeight = paginationRef.current?.getBoundingClientRect().height ?? 52;
        const top = grid.getBoundingClientRect().top;
        const bottomSpace = paginationHeight + 32;
        setGridViewportHeight(Math.max(240, Math.floor(window.innerHeight - top - bottomSpace)));
      });
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(grid.parentElement ?? grid);
    if (paginationRef.current) observer.observe(paginationRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [pageRows.length, showFilters, showColumns, showSearchFields]);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id));
      let newIndex = current.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;
      if (LOCKED_COLUMN_KEYS.has(String(current[0])) && newIndex === 0) newIndex = 1;
      return pinLeadingLockedKeys(arrayMove(current, oldIndex, newIndex), [...LOCKED_COLUMN_KEYS]);
    });
  };
  const handleResizePointerDown = (key: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest('th');
    resizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: resolveColumnWidth(key, widths) || header?.getBoundingClientRect().width || DEFAULT_COLUMN_WIDTH,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, state.startWidth + event.clientX - state.startX);
    setWidths((current) => ({ ...current, [state.key]: nextWidth }));
  };
  const handleResizePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    if (cellContext?.value == null) return;
    try {
      await copyText(cellContext.value);
      toast.success(t('dataGrid.cellCopied'));
      setCellContext(null);
    } catch {
      toast.error(t('dataGrid.cellCopyFailed'));
    }
  };
  const copyRowValues = async () => {
    if (!cellContext) return;
    const copyColumns = activeColumns.filter(
      (column) => column.key !== 'actions' && !column.contextCopyDisabled,
    );
    const clean = (value: string | null) => (value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    const header = copyColumns.map((column) => clean(column.label)).join('\t');
    const values = copyColumns
      .map((column) => clean(getContextValue(column, cellContext.row, enumLanguage)))
      .join('\t');
    try {
      await copyText(`${header}\n${values}`);
      toast.success(t('dataGrid.rowCopied'));
      setCellContext(null);
    } catch {
      toast.error(t('dataGrid.rowCopyFailed'));
    }
  };

  const exportColumns = useMemo(
    () => activeColumns
      .filter((column) => column.key !== 'actions')
      .map((column) => ({ key: column.key, label: column.label })),
    [activeColumns],
  );
  const mapExportRows = (rows: T[]) => rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const column of activeColumns) {
      if (column.key === 'actions') continue;
      mapped[column.key] = getContextValue(column, row, enumLanguage) ?? (row as Record<string, unknown>)[column.key] ?? '';
    }
    return mapped;
  });
  const exportRows = useMemo(() => mapExportRows(pageRows), [activeColumns, enumLanguage, pageRows]);
  const getExportData = async () => {
    const exportPageSize = Math.min(Math.max(total, pageSize), 5000);
    const page = normalizeGridPage<T>(await fetchPage({
      ...request,
      pageNumber: 1,
      pageSize: exportPageSize,
    }));
    return { columns: exportColumns, rows: mapExportRows(page.items) };
  };

  return (

    <OpsListPageShell
      eyebrow={resolvedEyebrow}
      title={localizedTitle}
      description={localizedDescription}
      actions={resolvedToolbarActions.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {resolvedToolbarActions.map((action, index) => {
            const isRunning = runningActionIndex === index;
            return (
              <OpsActionButton
                key={`${action.label}-${index}`}
                type="button"
                onClick={() => void runAction(action, index)}
                disabled={runningActionIndex !== null}
              >
                {action.icon ?? <Plus className={cn('size-3.5', isRunning && 'animate-spin')} aria-hidden />}
                {action.label}
              </OpsActionButton>
            );
          })}
        </div>
      ) : undefined}
    >
      <div className="wms-ops-data-grid min-w-0 space-y-0">
      <div className="wms-ops-data-grid-toolbar flex flex-wrap items-center justify-between gap-2">
        <div className="wms-ops-data-grid-toolbar__start flex min-w-0 flex-wrap items-center gap-2">
          <OpsListSearchField
            value={searchInput}
            placeholder={t('dataGrid.searchPlaceholder')}
            onValueChange={setSearchInput}
            className="md:w-64"
            rightSlot={searchInput ? (
              <button
                type="button"
                aria-label={t('dataGrid.clearSearch')}
                onClick={() => setSearchInput('')}
                className="wms-ops-voice-btn grid place-items-center"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <VoiceSearchButton onResult={(text) => { setSearchInput(text); setPage(1); }} />
            )}
          />
          <OpsActionButton
            type="button"
            variant="secondary"
            className="wms-ops-list-toolbar-btn"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn('size-3.5', query.isFetching && 'animate-spin')} aria-hidden />
            {t('common.refresh')}
          </OpsActionButton>
          {visibleSearchableColumns.length > 0 ? (
            <PopoverPrimitive.Root open={showSearchFields} onOpenChange={(open) => { setShowSearchFields(open); if (!open) setSearchFieldMenuSearch(''); }}>
              <PopoverPrimitive.Trigger asChild>
                <OpsActionButton
                  type="button"
                  variant="secondary"
                  className="wms-ops-list-toolbar-btn"
                  aria-expanded={showSearchFields}
                  aria-haspopup="menu"
                  title={t('dataGrid.searchFields')}
                >
                  <ListFilter className="size-3.5" aria-hidden />
                  <span className="hidden lg:inline">{t('dataGrid.searchFields')}</span>
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-none bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {effectiveSearchFields.length}
                  </span>
                </OpsActionButton>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
                <PopoverPrimitive.Content role="menu" align="start" sideOffset={8} collisionPadding={8} className="wms-ops-list-popover pointer-events-auto z-[4000] w-72 border-0 p-3 shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
                  <div className="wms-ops-list-popover__section-title">{t('dataGrid.searchFields')}</div>
                  <p className="mb-2 px-2 text-xs text-[var(--wms-app-text-muted)]">{t('dataGrid.searchFieldsHelp')}</p>
                  <GridMenuSearch value={searchFieldMenuSearch} onChange={setSearchFieldMenuSearch} placeholder={t('dataGrid.menuSearchPlaceholder')} clearLabel={t('dataGrid.clearMenuSearch')}/>
                  <div className="wms-ops-list-popover__scroll space-y-0.5">
                    {filteredSearchableColumns.length === 0
                      ? <p role="status" className="px-2 py-6 text-center text-sm text-[var(--wms-app-text-muted)]">{t('dataGrid.noMatchingColumns')}</p>
                      : filteredSearchableColumns.map((column) => {
                        const checked = effectiveSearchFields.includes(column.key);
                        const locked = checked && effectiveSearchFields.length === 1;
                        const limitReached = !checked && effectiveSearchFields.length >= MAX_GRID_SEARCH_FIELDS;
                        return (
                          <label
                            key={column.key}
                            className={cn(
                              'flex min-h-8 items-center gap-2 px-2 py-1.5 text-sm',
                              'border border-transparent hover:border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,var(--wms-ops-card-border))] hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_6%,transparent)]',
                              locked && 'opacity-60',
                            )}
                          >
                            <input type="checkbox" checked={checked} disabled={locked || limitReached} onChange={() => toggleSearchField(column.key)} className="wms-ops-list-popover__checkbox size-3.5 shrink-0" />
                            <span className="min-w-0 truncate">{column.label}</span>
                          </label>
                        );
                      })}
                  </div>
                  <button type="button" onClick={resetSearchFields} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--wms-app-border)] px-3 py-2 text-sm hover:bg-[var(--wms-brand-soft)]"><RotateCcw className="size-3.5"/>{t('dataGrid.resetSearchFields')}</button>
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          ) : null}
        </div>

        <div className="wms-ops-data-grid-toolbar__end flex flex-wrap items-center gap-2">
          <PopoverPrimitive.Root
            open={showFilters}
            modal={false}
            onOpenChange={(open) => {
              // Ignore spurious close from nested dropdown focus moves.
              setShowFilters(open);
            }}
          >
            <PopoverPrimitive.Trigger asChild>
              <OpsActionButton
                type="button"
                variant="secondary"
                className={cn('wms-ops-list-toolbar-btn', (showFilters || filters.length > 0) && 'wms-ops-list-toolbar-btn--active')}
                aria-expanded={showFilters}
                aria-haspopup="dialog"
              >
                <Filter className="size-3.5" aria-hidden />
                {t('common.filters')}
                {filters.length > 0 ? (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-none bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {filters.length}
                  </span>
                ) : null}
              </OpsActionButton>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
              <PopoverPrimitive.Content
                align="end"
                sideOffset={8}
                collisionPadding={8}
                data-wms-filter-popover=""
                className="wms-ops-list-popover wms-ops-list-popover--filter pointer-events-auto z-[4000] w-[640px] max-w-[95vw] border-0 p-0 shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onPointerDownOutside={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (
                    target?.closest(
                      '[data-wms-filter-popover], .wms-ops-list-select-content, .wms-ops-list-dropdown, .wms-ops-list-popover, [data-radix-popper-content-wrapper], [role="listbox"], [data-slot="select-content"]',
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
                onFocusOutside={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (
                    target?.closest(
                      '[data-wms-filter-popover], .wms-ops-list-select-content, .wms-ops-list-dropdown, .wms-ops-list-popover, [data-radix-popper-content-wrapper], [role="listbox"], [data-slot="select-content"]',
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <div className="wms-ops-list-popover__header">
                  <h3 className="wms-ops-list-popover__title">{t('advancedFilter.title')}</h3>
                  <button
                    type="button"
                    className="wms-ops-list-popover__close"
                    aria-label={t('common.close')}
                    onClick={() => setShowFilters(false)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="wms-ops-list-popover__body wms-ops-scrollbar max-h-[min(28rem,70vh)] overflow-y-auto p-3">
                  <div className="wms-ops-advanced-filter">
                    <div className="wms-ops-advanced-filter__toolbar">
                      <OpsActionButton type="button" variant="secondary" onClick={addFilter}>
                        <Plus className="size-3.5" aria-hidden />
                        {t('advancedFilter.add')}
                      </OpsActionButton>
                      <OpsActionButton type="button" variant="secondary" onClick={clearFilters}>
                        {t('advancedFilter.clear')}
                      </OpsActionButton>
                      <OpsActionButton type="button" onClick={() => { applyFilters(); }}>
                        <Search className="size-3.5" aria-hidden />
                        {t('advancedFilter.search')}
                        {filters.length > 0 ? (
                          <span className="inline-flex min-w-5 items-center justify-center bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                            {filters.length}
                          </span>
                        ) : null}
                      </OpsActionButton>
                    </div>

                    {filters.length > 0 ? (
                      <div className="wms-ops-advanced-filter__active">
                        {t('advancedFilter.activeInfo')}: {filters.length}
                      </div>
                    ) : null}

                    <div className="wms-ops-advanced-filter__logic">
                      <span className="wms-ops-advanced-filter__logic-label">{t('advancedFilter.logic')}</span>
                      <AppDropdown
                        value={filterLogic}
                        onValueChange={(value) => setFilterLogic(value as 'and' | 'or')}
                        options={filterLogicOptions}
                        ariaLabel={t('dataGrid.filterMatchType')}
                        portalContainer={null}
                        matchTriggerWidth={false}
                        contentClassName="z-[5000] min-w-[16rem] w-max max-w-[min(22rem,calc(100vw-1.5rem))]"
                        className="wms-ops-list-field-trigger h-8 min-w-[14rem] rounded-none shadow-none sm:w-auto"
                      />
                    </div>

                    {draftFilters.length === 0 ? (
                      <p className="text-sm text-slate-500">{t('dataGrid.noFilters')}</p>
                    ) : (
                      <div className="space-y-2">
                        {draftFilters.map((filter, index) => {
                          const selectedColumn = localizedColumns.find((column) => column.key === filter.column) ?? localizedColumns[0];
                          const filterType = inferFilterType(selectedColumn);
                          const valueOptions = selectedColumn.filterOptions ?? (filterType === 'boolean' ? booleanFilterOptions : undefined);
                          return (
                            <div key={`${filter.column}-${index}`} className="wms-ops-advanced-filter__row">
                              <AppDropdown
                                value={filter.column}
                                onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => {
                                  if (number !== index) return item;
                                  const nextColumn = localizedColumns.find((column) => column.key === value) ?? localizedColumns[0];
                                  return { ...item, column: value, operator: defaultFilterOperator(nextColumn), value: '' };
                                }))}
                                options={localizedColumns.filter((column) => column.filterable !== false).map((column) => ({ value: column.key, label: column.label }))}
                                ariaLabel={t('dataGrid.filterColumnAria', { number: index + 1 })}
                                searchable
                                portalContainer={null}
                                contentClassName="z-[5000]"
                                className="wms-ops-list-field-trigger h-8 rounded-none shadow-none"
                              />
                              <AppDropdown
                                value={filter.operator}
                                onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, operator: value } : item))}
                                options={filterOperatorOptions[filterType]}
                                ariaLabel={t('dataGrid.filterOperatorAria', { number: index + 1 })}
                                portalContainer={null}
                                contentClassName="z-[5000]"
                                className="wms-ops-list-field-trigger h-8 rounded-none shadow-none"
                              />
                              {!operatorNeedsValue(filter.operator) ? (
                                <div className="flex h-8 items-center px-2 text-sm text-slate-500">{t('dataGrid.valueNotRequired')}</div>
                              ) : valueOptions ? (
                                <AppDropdown
                                  value={filter.value || null}
                                  onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value } : item))}
                                  options={valueOptions}
                                  ariaLabel={t('dataGrid.filterValueAria', { number: index + 1 })}
                                  portalContainer={null}
                                  contentClassName="z-[5000]"
                                  className="wms-ops-list-field-trigger h-8 rounded-none shadow-none"
                                />
                              ) : filterType === 'date' || filterType === 'datetime' ? (
                                <AppDateInput
                                  type={filterType === 'date' ? 'date' : 'datetime-local'}
                                  value={filter.value}
                                  onChange={(event) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value: event.target.value } : item))}
                                  aria-label={t('dataGrid.filterValueAria', { number: index + 1 })}
                                  className={cn(OPS_FIELD_CLASS, 'h-8 min-h-8 max-h-8 min-w-0 w-full py-0 text-xs')}
                                />
                              ) : (
                                <input
                                  type={filterType === 'number' ? 'number' : 'text'}
                                  value={filter.value}
                                  onChange={(event) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value: event.target.value } : item))}
                                  aria-label={t('dataGrid.filterValueAria', { number: index + 1 })}
                                  className={cn(OPS_FIELD_CLASS, 'h-8 min-h-8 max-h-8 min-w-0 w-full py-0 text-xs')}
                                />
                              )}
                              <button
                                type="button"
                                aria-label={t('advancedFilter.remove')}
                                onClick={() => setDraftFilters((value) => value.filter((_, number) => number !== index))}
                                className="wms-ops-advanced-filter__remove inline-flex items-center justify-center shrink-0"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          <GridExportMenu
            fileName={pageKey}
            columns={exportColumns}
            rows={exportRows}
            getExportData={getExportData}
          />

          <PopoverPrimitive.Root open={showColumns} onOpenChange={(open) => { setShowColumns(open); if (!open) setColumnMenuSearch(''); }}>
            <PopoverPrimitive.Trigger asChild>
              <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" aria-expanded={showColumns} aria-haspopup="menu">
                <Columns3 className="size-3.5" aria-hidden />
                {t('common.columns')}
              </OpsActionButton>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
              <PopoverPrimitive.Content
                role="menu"
                align="end"
                sideOffset={8}
                collisionPadding={8}
                className="wms-ops-list-popover wms-ops-list-popover--columns pointer-events-auto z-[4000] w-80 border-0 p-0 shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
              >
                <div className="space-y-1 p-2">
                  <div className="wms-ops-list-popover__section-title">{t('common.visibleColumns')}</div>
                  <GridMenuSearch value={columnMenuSearch} onChange={setColumnMenuSearch} placeholder={t('dataGrid.menuSearchPlaceholder')} clearLabel={t('dataGrid.clearMenuSearch')} />
                  <div className="wms-ops-list-popover__scroll space-y-0.5">
                    {columnMenuColumns.filter((column) => displayColumns.includes(column.key)).length === 0
                      ? <p role="status" className="px-2 py-6 text-center text-sm text-[var(--wms-app-text-muted)]">{t('dataGrid.noMatchingColumns')}</p>
                      : columnMenuColumns.filter((column) => displayColumns.includes(column.key)).map((column) => {
                        const isLocked = LOCKED_COLUMN_KEYS.has(column.key) || column.hideable === false;
                        const idx = displayColumns.indexOf(column.key);
                        return (
                          <div key={column.key} className="wms-ops-list-popover__row group">
                            <div className="wms-ops-list-popover__move-slot" aria-hidden={isLocked}>
                              {!isLocked ? (
                                <>
                                  <button
                                    type="button"
                                    className="wms-ops-list-popover__icon-btn wms-ops-list-popover__icon-btn--move"
                                    onClick={() => moveColumnInPopover(column.key, 'up')}
                                    disabled={idx <= firstMovableIndex}
                                    aria-label={t('common.moveUp', { defaultValue: 'Up' })}
                                  >
                                    <ArrowUp className="size-3" aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="wms-ops-list-popover__icon-btn wms-ops-list-popover__icon-btn--move"
                                    onClick={() => moveColumnInPopover(column.key, 'down')}
                                    disabled={idx >= displayColumns.length - 1}
                                    aria-label={t('common.moveDown', { defaultValue: 'Down' })}
                                  >
                                    <ArrowDown className="size-3" aria-hidden />
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <span className="wms-ops-list-popover__row-label truncate">{column.label}</span>
                            {!isLocked ? (
                              <button
                                type="button"
                                className="wms-ops-list-popover__icon-btn wms-ops-list-popover__icon-btn--danger shrink-0"
                                onClick={() => toggleColumn(column.key)}
                                title={t('common.hide')}
                                aria-label={t('common.hide')}
                              >
                                <EyeOff className="size-3" aria-hidden />
                              </button>
                            ) : (
                              <span className="wms-ops-list-popover__action-spacer" aria-hidden />
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {hiddenColumns.length > 0 ? (
                    <>
                      <div className="wms-ops-list-popover__divider" />
                      <div className="wms-ops-list-popover__section-title">{t('common.hiddenColumns')}</div>
                      <div className="space-y-0.5">
                        {columnMenuColumns.filter((column) => hiddenColumns.includes(column.key)).map((column) => (
                          <div key={column.key} className="wms-ops-list-popover__row">
                            <span className="wms-ops-list-popover__move-slot" aria-hidden />
                            <span className="wms-ops-list-popover__row-label wms-ops-list-popover__row-label--muted truncate">
                              {column.label}
                            </span>
                            <button
                              type="button"
                              className="wms-ops-list-popover__icon-btn shrink-0"
                              onClick={() => toggleColumn(column.key)}
                              title={t('common.show')}
                              aria-label={t('common.show')}
                            >
                              <Eye className="size-3" aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={resetLayout}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--wms-app-border)] px-3 py-2 text-sm hover:bg-[var(--wms-brand-soft)]"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    {t('dataGrid.resetLayout')}
                  </button>
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
      </div>

      <div
        ref={tableScrollRef}
        style={{ maxHeight: gridViewportHeight ?? undefined }}
        className={cn(
          'relative mt-4 block wms-ops-table-wrap wms-ops-data-grid-wrap wms-ops-scrollbar wms-ops-table-h-scroll overflow-auto border border-[var(--wms-ops-card-border)] max-sm:hidden',
          query.isLoading && 'cursor-wait',
        )}
      >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} autoScroll={false}>
            <table
              className="wms-ops-data-grid wms-ops-table-fixed w-full table-fixed border-collapse text-sm"
              style={{ minWidth: tableMinWidthPx }}
            >
              <colgroup>
                {activeColumns.map((column) => (
                  <col
                    key={column.key}
                    style={{ width: resolveColumnWidth(column, widths) }}
                  />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--wms-app-panel-muted)] text-left text-xs uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                <tr>
                  <SortableContext items={activeColumns.map((column) => column.key)} strategy={horizontalListSortingStrategy}>
                    {activeColumns.map((column) => (
                      <SortableHeader
                        key={column.key}
                        columnKey={column.key}
                        label={column.label}
                        sortable={column.sortable !== false}
                        isActiveSort={sortBy === column.key}
                        sortDirection={sortDirection}
                        width={resolveColumnWidth(column.key, widths)}
                        onSort={() => changeSort(column.key)}
                        onResizePointerDown={handleResizePointerDown(column.key)}
                        onResizePointerMove={handleResizePointerMove}
                        onResizePointerUp={handleResizePointerUp}
                        dragLabel={t('dataGrid.dragColumn', { column: column.label })}
                        resizeLabel={t('dataGrid.resizeColumn', { column: column.label })}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {query.isLoading
                  ? Array.from({ length: Math.min(pageSize, 8) }).map((_, rowIndex) => (
                    <tr key={`skeleton-${rowIndex}`} className="border-b border-[var(--wms-app-border)]">
                      {activeColumns.map((column, columnIndex) => (
                        <td
                          key={column.key}
                          className={cn(
                            'wms-ops-grid-cell border-r border-[var(--wms-app-border)] px-4 py-3 last:border-r-0',
                            column.key === 'id' && 'wms-ops-table-id-col',
                            column.key === 'actions' && 'wms-ops-table-actions-col',
                          )}
                        >
                          <div
                            className={cn(
                              'wms-ops-grid-skeleton',
                              columnIndex % 3 === 0 && 'wms-ops-grid-skeleton--wide',
                              column.key === 'actions' && 'wms-ops-grid-skeleton--actions',
                            )}
                            aria-hidden
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                  : query.isError ? (
                    <tr>
                      <td colSpan={Math.max(activeColumns.length, 1)} className="wms-ops-grid-state-cell">
                        <OpsGridErrorState message={query.error instanceof Error ? query.error.message : t('dataGrid.loadError')} />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(activeColumns.length, 1)} className="wms-ops-grid-state-cell">
                        <OpsGridEmptyState message={resolvedEmptyMessage} />
                      </td>
                    </tr>
                  ) : pageRows.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          'border-b border-[var(--wms-app-border)] hover:bg-[var(--wms-brand-soft)]',
                          onRowDoubleClick && 'cursor-pointer',
                          cellContext?.row.id === row.id && 'bg-[var(--wms-brand-soft)]',
                          expandedRowId === row.id && 'bg-[var(--wms-brand-soft)]',
                        )}
                        onDoubleClick={() => onRowDoubleClick?.(row)}
                      >
                        {activeColumns.map((column) => (
                          <td
                            key={column.key}
                            title={getContextValue(column, row, enumLanguage) ?? undefined}
                            onContextMenu={(event) => openCellContext(event, row, column)}
                            style={{
                              width: resolveColumnWidth(column.key, widths),
                              maxWidth: resolveColumnWidth(column, widths),
                            }}
                            className={cn(
                              'wms-ops-grid-cell overflow-hidden border-r border-[var(--wms-app-border)] px-4 py-3 last:border-r-0',
                              column.key === 'id' && 'wms-ops-table-id-col wms-ops-table-center-col',
                              column.key === 'actions' && 'wms-ops-table-actions-col',
                            )}
                          >
                            <div className="wms-ops-grid-cell__inner min-w-0">
                              {column.key === 'id'
                                ? <span className="wms-ops-table-id-value">{renderGridCell(column, row, enumLanguage)}</span>
                                : renderGridCell(column, row, enumLanguage)}
                            </div>
                          </td>
                        ))}
                      </tr>
                      {expandedRowId === row.id && renderExpandedRow ? (
                        <tr className="border-b border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-brand-soft)_55%,transparent)]">
                          <td colSpan={Math.max(activeColumns.length, 1)} className="px-4 py-4">
                            {renderExpandedRow(row)}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </DndContext>
        {query.isLoading ? (
          <div className="wms-ops-grid-loading-overlay absolute inset-0 z-20 flex items-start justify-center pt-24" aria-live="polite" aria-busy="true">
            <div className="wms-ops-grid-loading-panel">
              <OpsLoadingState message={t('common.loading')} code="FETCH" compact />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 sm:hidden" aria-live="polite">
        {query.isLoading ? (
          <div className="rounded-none border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,transparent)] p-4">
            <OpsLoadingState message={t('common.loading')} code="FETCH" compact />
          </div>
        ) : query.isError ? (
          <OpsGridErrorState message={query.error instanceof Error ? query.error.message : t('dataGrid.loadError')} />
        ) : pageRows.length === 0 ? (
          <OpsGridEmptyState message={resolvedEmptyMessage} />
        ) : pageRows.map((row) => (
          <article
            key={row.id}
            className={cn(
              'overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm',
              onRowDoubleClick && 'cursor-pointer',
            )}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
            {activeColumns.map((column) => (
              <div key={column.key} className={`grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 border-b border-[var(--wms-app-border)] px-3 py-3 last:border-b-0 ${column.key === 'actions' ? 'items-center bg-[var(--wms-brand-soft)]' : 'items-start'}`}>
                <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">{column.label}</span>
                <div className="min-w-0 break-words text-right text-sm [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:touch-manipulation [&>div]:justify-end">{renderGridCell(column, row, enumLanguage)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <div ref={paginationRef} className="wms-ops-grid-pagination mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <OpsActionButton type="button" variant="secondary" className="wms-ops-grid-pagination__size-btn">
                <span>{pageSize}</span>
                <ChevronDown className="size-3.5" aria-hidden />
              </OpsActionButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="wms-ops-list-dropdown w-28">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <DropdownMenuItem key={size} onClick={() => { setPageSize(size); setPage(1); }}>
                  {size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="wms-ops-grid-pagination__info">{t('dataGrid.recordRange', { first, last, total })}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OpsActionButton
            type="button"
            variant="secondary"
            className="wms-ops-grid-pagination__nav-btn"
            onClick={() => setPage((value) => value - 1)}
            disabled={page <= 1 || query.isFetching}
          >
            {t('common.previous')}
          </OpsActionButton>
          <span className="wms-ops-grid-pagination__page px-2">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <OpsActionButton
            type="button"
            variant="secondary"
            className="wms-ops-grid-pagination__nav-btn"
            onClick={() => setPage((value) => value + 1)}
            disabled={page >= totalPages || query.isFetching}
          >
            {t('common.next')}
          </OpsActionButton>
        </div>
      </div>

      </div>

      {cellContext && createPortal(
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-[3999]"
            aria-hidden
            onPointerDown={() => setCellContext(null)}
          />
          <div
            ref={cellMenuRef}
            role="menu"
            aria-label={t('dataGrid.cellMenu')}
            style={{ left: cellContext.x, top: cellContext.y }}
            className="pointer-events-auto fixed z-[4000] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-2 text-sm shadow-2xl"
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
            <button type="button" role="menuitem" onClick={() => void copyRowValues()} className="mt-1 inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-medium hover:bg-[var(--wms-brand-soft)]">
              <Copy className="size-4 text-[var(--wms-brand-primary)]"/>
              {t('dataGrid.copyRow')}
            </button>
            {actionColumn?.render && (
              <div className="mt-2 border-t border-[var(--wms-app-border)] px-2 pt-2" onClick={() => setCellContext(null)}>
                <span className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-app-text-muted)]">{t('dataGrid.rowActions')}</span>
                <div className="[&>div]:flex-wrap">{actionColumn.render(cellContext.row)}</div>
              </div>
            )}
          </div>
        </>,
        getWorkspacePortalRoot() ?? document.body,
      )}
    </OpsListPageShell>
  );

}
