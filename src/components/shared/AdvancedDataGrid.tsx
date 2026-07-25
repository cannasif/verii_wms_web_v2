import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  GripVertical,
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
  saveGridPreferences,
  type GridPreferences,
} from '@/lib/grid-preferences';
import { useAuthStore } from '@/stores/auth-store';
import { AppDropdown, type AppDropdownOption } from './AppDropdown';

export interface GridFilter { column: string; operator: string; value: string }
export interface GridRequest { pageNumber?: number; page?: number; pageSize: number; search: string | null; sortBy?: string | null; sortDirection?: 'asc' | 'desc'; filterLogic: 'and' | 'or'; filters: GridFilter[] }
export interface GridPage<T> { items: T[]; pageNumber: number; page?: number; pageSize: number; totalCount: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean }
export type GridFilterType = 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum' | 'guid';
export interface GridColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  filterable?: boolean;
  sortable?: boolean;
  hideable?: boolean;
  filterType?: GridFilterType;
  filterOptions?: AppDropdownOption[];
}
interface Props<T extends { id: number }> { pageKey: string; title: string; description?: string; columns: GridColumn<T>[]; fetchPage: (request: GridRequest) => Promise<GridPage<T>>; toolbarAction?: { label: string; run: () => Promise<void> } }

const MIN_COLUMN_WIDTH = 80;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_DROPDOWN_OPTIONS: AppDropdownOption[] = PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }));
const FILTER_LOGIC_OPTIONS: AppDropdownOption[] = [{ value: 'and', label: 'Tümü (AND)' }, { value: 'or', label: 'Herhangi biri (OR)' }];
const FILTER_OPERATOR_OPTIONS: Record<GridFilterType, AppDropdownOption[]> = {
  text: [
    { value: 'contains', label: 'İçerir' }, { value: 'notContains', label: 'İçermez' },
    { value: 'equals', label: 'Eşittir' }, { value: 'notEquals', label: 'Eşit değildir' },
    { value: 'startsWith', label: 'İle başlar' }, { value: 'endsWith', label: 'İle biter' },
    { value: 'isNull', label: 'Boştur' }, { value: 'isNotNull', label: 'Boş değildir' },
  ],
  number: [
    { value: 'equals', label: 'Eşittir' }, { value: 'notEquals', label: 'Eşit değildir' },
    { value: 'gt', label: 'Büyüktür' }, { value: 'gte', label: 'Büyük veya eşittir' },
    { value: 'lt', label: 'Küçüktür' }, { value: 'lte', label: 'Küçük veya eşittir' },
    { value: 'isNull', label: 'Boştur' }, { value: 'isNotNull', label: 'Boş değildir' },
  ],
  date: [
    { value: 'equals', label: 'Tarihe eşittir' }, { value: 'gt', label: 'Tarihten sonradır' },
    { value: 'gte', label: 'Tarih veya sonrasıdır' }, { value: 'lt', label: 'Tarihten öncedir' },
    { value: 'lte', label: 'Tarih veya öncesidir' }, { value: 'isNull', label: 'Boştur' },
    { value: 'isNotNull', label: 'Boş değildir' },
  ],
  datetime: [
    { value: 'equals', label: 'Zamana eşittir' }, { value: 'gt', label: 'Zamandan sonradır' },
    { value: 'gte', label: 'Zaman veya sonrasıdır' }, { value: 'lt', label: 'Zamandan öncedir' },
    { value: 'lte', label: 'Zaman veya öncesidir' }, { value: 'isNull', label: 'Boştur' },
    { value: 'isNotNull', label: 'Boş değildir' },
  ],
  boolean: [{ value: 'equals', label: 'Eşittir' }, { value: 'notEquals', label: 'Eşit değildir' }],
  enum: [{ value: 'equals', label: 'Eşittir' }, { value: 'notEquals', label: 'Eşit değildir' }],
  guid: [
    { value: 'equals', label: 'Eşittir' }, { value: 'notEquals', label: 'Eşit değildir' },
    { value: 'isNull', label: 'Boştur' }, { value: 'isNotNull', label: 'Boş değildir' },
  ],
};
const BOOLEAN_FILTER_OPTIONS: AppDropdownOption[] = [{ value: 'true', label: 'Evet' }, { value: 'false', label: 'Hayır' }];

function inferFilterType<T>(column: GridColumn<T>): GridFilterType {
  if (column.filterType) return column.filterType;
  const key = column.key.toLowerCase();
  if (/(correlationid$|operationcode$|traceid$|requestid$)/.test(key)) return 'guid';
  if (/(^id$|id$|count$|quantity$|amount$|percent$|priority$|number$|lineno$|sequenceno$|version$|dpi$|widthmm$|heightmm$|warehousecode$)/.test(key)) return 'number';
  if (/(status$|type$|mode$|scope$|policy$|direction$)/.test(key)) return 'enum';
  if (/(atutc$|datetime$|createdat$|updatedat$|occurredat$)/.test(key)) return 'datetime';
  if (/(date$|day$)/.test(key)) return 'date';
  if (/^(is|has|can|allow|require)[a-z]/.test(key)) return 'boolean';
  return 'text';
}

function defaultFilterOperator<T>(column: GridColumn<T>): string {
  return FILTER_OPERATOR_OPTIONS[inferFilterType(column)][0].value;
}

function operatorNeedsValue(operator: string): boolean {
  return operator !== 'isNull' && operator !== 'isNotNull';
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
}

function SortableHeader({ columnKey, label, sortable, isActiveSort, sortDirection, width, onSort, onResizeStart }: SortableHeaderProps) {
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
          aria-label={`${label} kolonunu taşı`}
          title="Kolonu sürükleyerek taşı"
          className="cursor-grab touch-none rounded-md p-1 text-slate-400 opacity-60 hover:bg-black/5 hover:opacity-100 active:cursor-grabbing dark:hover:bg-white/10"
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
        aria-label={`${label} kolon genişliğini değiştir`}
        title="Kolon genişliğini değiştir"
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-[var(--wms-brand-primary)]/30"
      />
    </th>
  );
}

export function AdvancedDataGrid<T extends { id: number }>({ pageKey, title, description, columns: sourceColumns, fetchPage, toolbarAction }: Props<T>) {
  const columns = useMemo(() => sourceColumns.map((column) => (column.key === 'id' || column.key === 'actions') ? { ...column, hideable: false } : column), [sourceColumns]);
  const userId = useAuthStore((state) => state.user?.id);
  const preferenceColumns = useMemo(() => columns.map(({ key, sortable, hideable }) => ({ key, sortable, hideable: (key === 'id' || key === 'actions') ? false : hideable })), [columns]);
  const storageKey = getGridPreferenceKey(pageKey, userId);
  const initialPreferences = useMemo(() => loadGridPreferences(pageKey, userId, preferenceColumns), [pageKey, userId, preferenceColumns]);
  const [loadedKey, setLoadedKey] = useState(storageKey);
  const [visible, setVisible] = useState<string[]>(initialPreferences.visible);
  const [order, setOrder] = useState<string[]>(initialPreferences.order);
  const [widths, setWidths] = useState<Record<string, number>>(initialPreferences.widths);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string | null>(initialPreferences.sortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialPreferences.sortDirection);
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<GridFilter[]>([]);
  const [filters, setFilters] = useState<GridFilter[]>([]);
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and');
  const [actionRunning, setActionRunning] = useState(false);
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
    setPageSize(preferences.pageSize);
    setSortBy(preferences.sortBy);
    setSortDirection(preferences.sortDirection);
    setPage(1);
    setLoadedKey(storageKey);
  }, [loadedKey, pageKey, preferenceColumns, storageKey, userId]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    const timer = window.setTimeout(() => {
      const preferences: GridPreferences = { version: 1, visible, order, widths, sortBy, sortDirection, pageSize };
      saveGridPreferences(pageKey, userId, preferences);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadedKey, order, pageKey, pageSize, sortBy, sortDirection, storageKey, userId, visible, widths]);

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

  const request = useMemo<GridRequest>(() => ({ pageNumber: page, pageSize, search: search || null, sortBy, sortDirection, filterLogic, filters }), [page, pageSize, search, sortBy, sortDirection, filterLogic, filters]);
  const query = useQuery({ queryKey: ['advanced-grid', pageKey, request], queryFn: () => fetchPage(request), placeholderData: (previous) => previous });
  const activeColumns = order.map((key) => columns.find((column) => column.key === key)).filter((column): column is GridColumn<T> => Boolean(column && visible.includes(column.key)));
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
    setSortBy(defaults.sortBy);
    setSortDirection(defaults.sortDirection);
    setPageSize(defaults.pageSize);
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

  return <section className="min-h-[calc(100vh-8rem)] rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">V3RII WMS</p><h1 className="mt-1 text-2xl font-bold">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
      <div className="flex flex-wrap gap-2">
        <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ara..." className="h-10 w-64 rounded-xl border border-[var(--wms-app-border)] bg-transparent pl-9 pr-9 text-sm outline-none"/>{searchInput && <button type="button" aria-label="Aramayı temizle" onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-4"/></button>}</label>
        <div className="relative">
          <button type="button" onClick={() => setShowColumns((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm"><Columns3 className="size-4"/>Kolonlar</button>
          {showColumns && <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3 shadow-xl">
            <p className="mb-2 text-xs text-slate-500">Başlıklardaki tutamaçlarla kolonları taşıyabilirsiniz.</p>
            {order.map((key) => {
              const column = columns.find((item) => item.key === key);
              return column ? <label key={key} className={`flex items-center gap-2 py-1.5 text-sm ${column.hideable === false ? 'opacity-60' : ''}`}>
                <input type="checkbox" checked={visible.includes(key)} disabled={column.hideable === false} onChange={() => toggleColumn(key)}/>
                <span className="truncate">{column.label}</span>
                {column.hideable === false && <small className="ml-auto text-[10px] uppercase text-slate-400">Sabit</small>}
              </label> : null;
            })}
            <button type="button" onClick={resetLayout} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw className="size-4"/>Düzeni sıfırla</button>
          </div>}
        </div>
        <button type="button" onClick={() => setShowFilters((value) => !value)} className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm"><Filter className="size-4"/>Gelişmiş Filtre{filters.length > 0 && <span className="rounded-full bg-[var(--wms-brand-primary)] px-1.5 text-xs text-white">{filters.length}</span>}</button>
        <button type="button" aria-label="Verileri yenile" onClick={() => query.refetch()} className="h-10 rounded-xl border border-[var(--wms-app-border)] p-2.5"><RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`}/></button>
        {toolbarAction && <button type="button" onClick={runAction} disabled={actionRunning} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`size-4 ${actionRunning ? 'animate-spin' : ''}`}/>{toolbarAction.label}</button>}
      </div>
    </div>
    {showFilters && <div className="mb-4 rounded-xl border border-[var(--wms-app-border)] bg-slate-50/60 p-4 dark:bg-white/[.03]">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><strong className="text-sm">Filtreler</strong><AppDropdown value={filterLogic} onValueChange={(value) => setFilterLogic(value as 'and' | 'or')} options={FILTER_LOGIC_OPTIONS} ariaLabel="Filtre eşleşme türü" className="h-9 w-44" /></div><button type="button" onClick={addFilter} className="inline-flex items-center gap-1 text-sm text-[var(--wms-brand-primary)]"><Plus className="size-4"/>Filtre ekle</button></div>
      {draftFilters.length === 0 ? <p className="text-sm text-slate-500">Henüz filtre eklenmedi.</p> : <div className="space-y-2">{draftFilters.map((filter, index) => {
        const selectedColumn = columns.find((column) => column.key === filter.column) ?? columns[0];
        const filterType = inferFilterType(selectedColumn);
        const valueOptions = selectedColumn.filterOptions ?? (filterType === 'boolean' ? BOOLEAN_FILTER_OPTIONS : undefined);
        return <div key={`${filter.column}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_190px_1fr_40px]">
          <AppDropdown value={filter.column} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => {
            if (number !== index) return item;
            const nextColumn = columns.find((column) => column.key === value) ?? columns[0];
            return { ...item, column: value, operator: defaultFilterOperator(nextColumn), value: '' };
          }))} options={columns.filter((column) => column.filterable !== false).map((column) => ({ value: column.key, label: column.label }))} ariaLabel={`${index + 1}. filtre kolonu`} searchable className="h-10" />
          <AppDropdown value={filter.operator} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, operator: value } : item))} options={FILTER_OPERATOR_OPTIONS[filterType]} ariaLabel={`${index + 1}. filtre operatörü`} className="h-10" />
          {!operatorNeedsValue(filter.operator) ? <div className="flex items-center rounded-lg border px-3 text-sm text-slate-500">Değer gerektirmez</div>
            : valueOptions ? <AppDropdown value={filter.value || null} onValueChange={(value) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value } : item))} options={valueOptions} ariaLabel={`${index + 1}. filtre değeri`} className="h-10" />
              : <input type={filterType === 'number' ? 'number' : filterType === 'date' ? 'date' : filterType === 'datetime' ? 'datetime-local' : 'text'} value={filter.value} onChange={(event) => setDraftFilters((items) => items.map((item, number) => number === index ? { ...item, value: event.target.value } : item))} className="rounded-lg border bg-transparent px-3 py-2 text-sm"/>}
          <button type="button" aria-label="Filtreyi kaldır" onClick={() => setDraftFilters((value) => value.filter((_, number) => number !== index))} className="rounded-lg border p-2"><Trash2 className="size-4"/></button>
        </div>;
      })}</div>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={clearFilters} className="rounded-lg border px-3 py-2 text-sm">Temizle</button><button type="button" onClick={applyFilters} className="rounded-lg bg-[var(--wms-brand-primary)] px-3 py-2 text-sm text-white">Uygula</button></div>
    </div>}
    <div className="overflow-hidden rounded-xl border border-[var(--wms-app-border)]"><div className="overflow-x-auto"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><table className={`w-full min-w-[760px] border-collapse text-sm ${Object.keys(widths).length ? 'table-fixed' : ''}`}><thead className="bg-slate-100/90 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-white/[.06] dark:text-slate-300"><tr><SortableContext items={activeColumns.map((column) => column.key)} strategy={horizontalListSortingStrategy}>{activeColumns.map((column) => <SortableHeader key={column.key} columnKey={column.key} label={column.label} sortable={column.sortable !== false} isActiveSort={sortBy === column.key} sortDirection={sortDirection} width={widths[column.key]} onSort={() => changeSort(column.key)} onResizeStart={(event) => startResize(event, column.key)}/>)}</SortableContext></tr></thead><tbody>{query.isLoading ? <tr><td colSpan={activeColumns.length} className="h-40 text-center">Yükleniyor...</td></tr> : query.isError ? <tr><td colSpan={activeColumns.length} className="h-40 text-center text-red-500">{query.error instanceof Error ? query.error.message : 'Veri alınamadı.'}</td></tr> : !query.data?.items.length ? <tr><td colSpan={activeColumns.length} className="h-40 text-center text-slate-500">Kayıt bulunamadı.</td></tr> : query.data.items.map((row) => <tr key={row.id} className="border-b border-[var(--wms-app-border)] hover:bg-[var(--wms-brand-soft)]">{activeColumns.map((column) => <td key={column.key} style={widths[column.key] ? { width: widths[column.key], maxWidth: widths[column.key] } : undefined} className="overflow-hidden border-r border-[var(--wms-app-border)] px-4 py-3 last:border-r-0"><div className="truncate">{column.render(row)}</div></td>)}</tr>)}</tbody></table></DndContext></div></div>
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-slate-500"><span>{first}-{last} / {total} kayıt</span><AppDropdown value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={PAGE_SIZE_DROPDOWN_OPTIONS} ariaLabel="Sayfa başına kayıt" className="h-9 w-20" /></div><div className="flex items-center gap-2"><button type="button" aria-label="Önceki sayfa" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="size-4"/></button><span>Sayfa {page} / {totalPages}</span><button type="button" aria-label="Sonraki sayfa" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="size-4"/></button></div></div>
  </section>;
}
