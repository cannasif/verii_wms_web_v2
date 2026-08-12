import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Copy, LayoutGrid, ListTree, Pencil, Plus, Power, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { cn } from '@/lib/utils';
import type { PagedResponse } from '@/types/api';
import { KKD_CELL, KKD_HEAD_CELL, KkdCheckRow, KkdField, KkdPanel, KkdTableShell } from './kkd-ops-ui';
import {
  kkdApi,
  type KkdCustomerLookup,
  type KkdEntitlementGroupLookup,
  type KkdLookup,
  type KkdMatrix,
  type KkdMatrixDetail,
  type KkdMatrixRule,
  type KkdStockLookup,
} from './kkd-api';
import { KkdBulkMatrixEditor } from './KkdBulkMatrixEditor';

export type RuleForm = {
  key: string; groupCode: string; groupName: string; stockId: string; stockLabel: string;
  standardCode: string; standardName: string; initialQuantity: string; afterMonths: string;
  afterQuantity: string; recurringQuantity: string; recurringInterval: string; periodType: string;
  frequencyDays: string; frequencyQuantity: string; annualIssueCount: string; annualQuantity: string;
  maxCarryQuantity: string; allowBulkIssue: boolean; isMandatory: boolean; isActive: boolean;
};
type MatrixForm = {
  id?: number;
  customerId: string;
  customerLabel: string;
  departmentId: string;
  departmentLabel: string;
  roleId: string;
  roleLabel: string;
  code: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  isActive: boolean;
  rules: RuleForm[];
  rowVersion?: string;
};

const number = (value?: string | number | null): number => Number(value || 0);
const optionalNumber = (value: string): number | null => value.trim() === '' ? null : Number(value);
const lookupLabel = (item: { code: string; name: string }): string => `${item.code} · ${item.name}`;

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

function pageLocalLookups(
  items: KkdLookup[],
  search: string,
  pageNumber: number,
  pageSize: number,
): PagedResponse<KkdLookup> {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = query
    ? items.filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase('tr-TR').includes(query))
    : items;
  const start = (pageNumber - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  const totalCount = filtered.length;
  return {
    data,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1))),
    hasPreviousPage: pageNumber > 1,
    hasNextPage: start + pageSize < totalCount,
  };
}

const newRule = (): RuleForm => ({
  key: crypto.randomUUID(), groupCode: '', groupName: '', stockId: '', stockLabel: '', standardCode: '', standardName: '',
  initialQuantity: '1', afterMonths: '3', afterQuantity: '0', recurringQuantity: '1', recurringInterval: '1',
  periodType: 'Year', frequencyDays: '', frequencyQuantity: '', annualIssueCount: '', annualQuantity: '',
  maxCarryQuantity: '', allowBulkIssue: true, isMandatory: true, isActive: true,
});
const emptyForm = (): MatrixForm => ({
  customerId: '',
  customerLabel: '',
  departmentId: '',
  departmentLabel: '',
  roleId: '',
  roleLabel: '',
  code: '',
  name: '',
  effectiveFrom: '',
  effectiveTo: '',
  description: '',
  isActive: true,
  rules: [newRule()],
});
const phase = (rule: KkdMatrixRule, type: string) => rule.phases.find((item) => item.phaseType === type);
const ruleFromDetail = (rule: KkdMatrixRule): RuleForm => {
  const initial = phase(rule, 'Initial');
  const after = phase(rule, 'AfterMonths');
  const recurring = phase(rule, 'Recurring');
  return {
    key: crypto.randomUUID(), groupCode: rule.groupCode, groupName: rule.groupName || '',
    stockId: rule.stockId ? String(rule.stockId) : '',
    stockLabel: rule.stockId ? `${rule.stockCode || rule.stockId} · ${rule.stockName || ''}` : '',
    standardCode: rule.standardCode || '', standardName: rule.standardName || '',
    initialQuantity: String(initial?.quantity ?? 0), afterMonths: String(after?.offsetMonths ?? 3),
    afterQuantity: String(after?.quantity ?? 0), recurringQuantity: String(recurring?.quantity ?? 0),
    recurringInterval: String(recurring?.periodInterval ?? 1), periodType: recurring?.periodType || 'Year',
    frequencyDays: recurring?.frequencyDays ? String(recurring.frequencyDays) : '',
    frequencyQuantity: recurring?.quantityPerFrequency ? String(recurring.quantityPerFrequency) : '',
    annualIssueCount: rule.annualIssueCount ? String(rule.annualIssueCount) : '',
    annualQuantity: rule.annualQuantity == null ? '' : String(rule.annualQuantity),
    maxCarryQuantity: rule.maxCarryQuantity == null ? '' : String(rule.maxCarryQuantity),
    allowBulkIssue: rule.allowBulkIssue, isMandatory: rule.isMandatory, isActive: rule.isActive,
  };
};

function buildMatrixPayload(form: MatrixForm, isActive = form.isActive) {
  return {
    customerId: number(form.customerId),
    departmentId: number(form.departmentId),
    roleId: number(form.roleId),
    code: form.code,
    name: form.name,
    effectiveFrom: form.effectiveFrom || null,
    effectiveTo: form.effectiveTo || null,
    isActive,
    description: form.description || null,
    expectedRowVersion: form.rowVersion || null,
    rules: form.rules.map((item, index) => ({
      groupCode: item.groupCode,
      groupName: item.groupName || null,
      stockId: optionalNumber(item.stockId),
      standardCode: item.standardCode || null,
      standardName: item.standardName || null,
      annualIssueCount: optionalNumber(item.annualIssueCount),
      annualQuantity: optionalNumber(item.annualQuantity),
      maxCarryQuantity: optionalNumber(item.maxCarryQuantity),
      allowBulkIssue: item.allowBulkIssue,
      isMandatory: item.isMandatory,
      sortOrder: index + 1,
      isActive: item.isActive,
      description: null,
      phases: [
        {
          phaseType: 'Initial',
          offsetMonths: 0,
          quantity: number(item.initialQuantity),
          allowBulkIssue: item.allowBulkIssue,
          frequencyDays: null,
          quantityPerFrequency: null,
          periodType: null,
          periodInterval: null,
          sortOrder: 1,
          isActive: true,
        },
        ...(number(item.afterQuantity) > 0
          ? [{
              phaseType: 'AfterMonths',
              offsetMonths: Math.max(1, number(item.afterMonths)),
              quantity: number(item.afterQuantity),
              allowBulkIssue: item.allowBulkIssue,
              frequencyDays: null,
              quantityPerFrequency: null,
              periodType: null,
              periodInterval: null,
              sortOrder: 2,
              isActive: true,
            }]
          : []),
        ...(number(item.recurringQuantity) > 0
          ? [{
              phaseType: 'Recurring',
              offsetMonths: Math.max(0, number(item.afterMonths)),
              quantity: number(item.recurringQuantity),
              allowBulkIssue: item.allowBulkIssue,
              frequencyDays: optionalNumber(item.frequencyDays),
              quantityPerFrequency: optionalNumber(item.frequencyQuantity),
              periodType: item.periodType,
              periodInterval: Math.max(1, number(item.recurringInterval)),
              sortOrder: 3,
              isActive: true,
            }]
          : []),
      ],
    })),
  };
}

function formFromDetail(
  detail: KkdMatrixDetail,
  id: number | undefined,
  labels: { customerLabel?: string; departmentLabel?: string; roleLabel?: string },
): MatrixForm {
  return {
    id,
    customerId: String(detail.customerId),
    customerLabel: labels.customerLabel || `Cari #${detail.customerId}`,
    departmentId: String(detail.departmentId),
    departmentLabel: labels.departmentLabel || `Departman #${detail.departmentId}`,
    roleId: String(detail.roleId),
    roleLabel: labels.roleLabel || `Rol #${detail.roleId}`,
    code: detail.code,
    name: detail.name,
    effectiveFrom: detail.effectiveFrom || '',
    effectiveTo: detail.effectiveTo || '',
    description: detail.description || '',
    isActive: detail.isActive,
    rules: detail.rules.map(ruleFromDetail),
    rowVersion: detail.rowVersion,
  };
}

export function KkdMatrixManager(): ReactElement {
  const qc = useQueryClient();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();
  const [form, setForm] = useState<MatrixForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [editorMode, setEditorMode] = useState<'detail' | 'bulk'>('detail');
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [departmentLookupOpen, setDepartmentLookupOpen] = useState(false);
  const [roleLookupOpen, setRoleLookupOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<KkdMatrix | null>(null);
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const roles = useQuery({
    queryKey: ['kkd', 'roles', form.departmentId],
    queryFn: () => kkdApi.roles(number(form.departmentId)),
    enabled: number(form.departmentId) > 0,
  });
  const visibleMatrices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return (matrices.data ?? []).filter((item) => !term || `${item.code} ${item.name}`.toLocaleLowerCase('tr-TR').includes(term));
  }, [matrices.data, search]);

  useEffect(() => {
    if (!form.roleId || !roles.data?.length) return;
    const role = roles.data.find((item) => String(item.id) === form.roleId);
    if (!role) return;
    const label = lookupLabel(role);
    setForm((current) => (current.roleLabel === label ? current : { ...current, roleLabel: label }));
  }, [form.roleId, roles.data]);

  // Keep the list panel height equal to the form panel (xl+); overflow scrolls inside.
  useEffect(() => {
    const node = formAnchorRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => {
      if (!mq.matches) {
        setListHeight(undefined);
        return;
      }
      setListHeight(Math.round(node.getBoundingClientRect().height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    mq.addEventListener('change', update);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);

  const setHeader = <K extends keyof MatrixForm>(key: K, value: MatrixForm[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const setRule = (key: string, field: keyof RuleForm, value: string | boolean): void =>
    setForm((current) => ({
      ...current,
      rules: current.rules.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  const patchRule = (key: string, patch: Partial<RuleForm>): void =>
    setForm((current) => ({
      ...current,
      rules: current.rules.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  const addRule = (): void =>
    setForm((current) => ({ ...current, rules: [...current.rules, newRule()] }));

  const resolveLabels = (detail: KkdMatrixDetail) => {
    const department = departments.data?.find((item) => item.id === detail.departmentId);
    return {
      customerLabel: `Cari #${detail.customerId}`,
      departmentLabel: department ? lookupLabel(department) : `Departman #${detail.departmentId}`,
      roleLabel: `Rol #${detail.roleId}`,
    };
  };

  const load = useMutation({
    mutationFn: kkdApi.matrix,
    onSuccess: (detail: KkdMatrixDetail, id: number) => {
      setForm(formFromDetail(detail, id, resolveLabels(detail)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Matris yüklenemedi.'),
  });
  const clone = useMutation({
    mutationFn: kkdApi.matrix,
    onSuccess: (detail) => {
      const next = formFromDetail(detail, undefined, resolveLabels(detail));
      setForm({
        ...next,
        code: `${detail.code}-KOPYA`,
        name: `${detail.name} (Kopya)`,
        effectiveFrom: '',
        effectiveTo: '',
        isActive: false,
        rowVersion: undefined,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Matris kopyalanamadı.'),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!number(form.customerId) || !number(form.departmentId) || !number(form.roleId)) {
        throw new Error('Cari, departman ve rol seçilmelidir.');
      }
      if (!form.code.trim() || !form.name.trim()) throw new Error('Matris kodu ve adı zorunludur.');
      if (!form.rules.length) throw new Error('En az bir hakediş kuralı eklenmelidir.');
      if (form.rules.some((item) => !item.groupCode.trim())) throw new Error('Her kuralda hakediş grubu seçilmelidir.');
      const payload = buildMatrixPayload(form);
      const validation = await kkdApi.validateMatrix(payload, form.id);
      if (!validation.isValid) {
        const first = validation.issues[0];
        throw new Error(`${first.rowNumber ? `${first.rowNumber}. satır: ` : ''}${first.message} (${validation.issues.length} hata)`);
      }
      return kkdApi.saveMatrix(payload, form.id);
    },
    onSuccess: async () => {
      toast.success(form.id ? 'Hak matrisi güncellendi.' : 'Hak matrisi oluşturuldu.');
      setForm(emptyForm());
      await qc.invalidateQueries({ queryKey: ['kkd', 'matrices'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Hak matrisi kaydedilemedi.'),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: KkdMatrix) => {
      const detail = await kkdApi.matrix(row.id);
      const nextForm = formFromDetail(detail, row.id, resolveLabels(detail));
      const payload = buildMatrixPayload(nextForm, !row.isActive);
      const validation = await kkdApi.validateMatrix(payload, row.id);
      if (!validation.isValid) {
        const first = validation.issues[0];
        throw new Error(first?.message || 'Matris doğrulanamadı.');
      }
      return kkdApi.saveMatrix(payload, row.id);
    },
    onSuccess: async (_data, row) => {
      toast.success(row.isActive ? 'Hak matrisi pasife alındı.' : 'Hak matrisi aktifleştirildi.');
      setStatusConfirm(null);
      if (form.id === row.id) {
        setForm((current) => ({ ...current, isActive: !row.isActive }));
      }
      await qc.invalidateQueries({ queryKey: ['kkd', 'matrices'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Durum güncellenemedi.'),
  });

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] xl:items-start">
      <div ref={formAnchorRef} className="min-w-0 max-w-full overflow-hidden">
      <KkdPanel
        code={form.id ? 'MTX_EDIT' : 'MTX_NEW'}
        title={form.id ? 'Hak matrisini düzenle' : 'Yeni hak matrisi'}
        description="Önce kapsamı belirleyin; ardından aynı matrise ihtiyaç kadar stok veya grup kuralı ekleyin."
        className="min-w-0 max-w-full"
        actions={
          <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setForm(emptyForm())}>
            <Plus className="size-3.5" />
            Yeni
          </OpsActionButton>
        }
      >
        <form className="grid min-w-0 max-w-full gap-4" onSubmit={submit}>
          <section className="grid min-w-0 gap-3 rounded-xl border border-[var(--wms-ops-card-border)] p-3 md:grid-cols-2 xl:grid-cols-3">
            <KkdField label="Entegre cari">
              <PagedLookupDialog<KkdCustomerLookup>
                variant="ops"
                triggerMode="combobox"
                autoSearchMinLength={1}
                open={customerLookupOpen}
                onOpenChange={setCustomerLookupOpen}
                title="Entegre cari seç"
                description="Cari kodu veya adıyla arayın; arama ikonu veya çift tık ile liste penceresini açın."
                value={form.customerLabel}
                placeholder="Cari yazın veya seçin"
                searchPlaceholder="Cari ara"
                emptyText="Cari bulunamadı."
                queryKey={['kkd', 'matrix-customer-lookup']}
                fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                  toPagedResponse(
                    await kkdApi.customersPaged({
                      pageNumber,
                      pageSize,
                      search,
                      searchFields: ['code', 'name'],
                      sortBy: 'code',
                      sortDirection: 'asc',
                      signal: signal ?? new AbortController().signal,
                    }),
                  )
                }
                getKey={(item) => String(item.id)}
                getLabel={lookupLabel}
                onSelect={(item) => {
                  const label = lookupLabel(item);
                  setForm((current) => ({
                    ...current,
                    customerId: String(item.id),
                    customerLabel: label,
                  }));
                }}
              />
            </KkdField>
            <KkdField label="Departman">
              <PagedLookupDialog<KkdLookup>
                variant="ops"
                triggerMode="combobox"
                autoSearchMinLength={1}
                open={departmentLookupOpen}
                onOpenChange={setDepartmentLookupOpen}
                title="Departman seç"
                description="Kod veya ad yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
                value={form.departmentLabel}
                placeholder="Departman yazın veya seçin"
                searchPlaceholder="Departman ara"
                emptyText="Departman bulunamadı."
                queryKey={['kkd', 'matrix-department-lookup']}
                fetchPage={async ({ pageNumber, pageSize, search }) =>
                  pageLocalLookups(departments.data ?? [], search, pageNumber, pageSize)
                }
                getKey={(item) => String(item.id)}
                getLabel={lookupLabel}
                onSelect={(item) => {
                  const label = lookupLabel(item);
                  setForm((current) => ({
                    ...current,
                    departmentId: String(item.id),
                    departmentLabel: label,
                    roleId: '',
                    roleLabel: '',
                  }));
                }}
              />
            </KkdField>
            <KkdField label="Rol" hint={!form.departmentId ? 'Önce departman seçin.' : undefined}>
              <PagedLookupDialog<KkdLookup>
                variant="ops"
                triggerMode="combobox"
                autoSearchMinLength={1}
                disabled={!form.departmentId}
                open={roleLookupOpen}
                onOpenChange={setRoleLookupOpen}
                title="Rol seç"
                description="Yalnızca seçilen departmana bağlı roller listelenir."
                value={form.roleLabel}
                placeholder={form.departmentId ? 'Rol yazın veya seçin' : 'Önce departman seçin'}
                searchPlaceholder="Rol ara"
                emptyText="Bu departmanda rol bulunamadı."
                queryKey={['kkd', 'matrix-role-lookup', form.departmentId || 'none']}
                fetchPage={async ({ pageNumber, pageSize, search }) =>
                  pageLocalLookups(roles.data ?? [], search, pageNumber, pageSize)
                }
                getKey={(item) => String(item.id)}
                getLabel={lookupLabel}
                onSelect={(item) => {
                  const label = lookupLabel(item);
                  setForm((current) => ({
                    ...current,
                    roleId: String(item.id),
                    roleLabel: label,
                  }));
                }}
              />
            </KkdField>
            <KkdField label="Matris kodu">
              <AppInput value={form.code} onChange={(event) => setHeader('code', event.target.value)} />
            </KkdField>
            <KkdField label="Matris adı">
              <AppInput value={form.name} onChange={(event) => setHeader('name', event.target.value)} />
            </KkdField>
            <KkdField label="Aktif">
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_88%,transparent)] px-3">
                <OpsSkinCheckbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setHeader('isActive', checked)}
                  aria-label="Aktif"
                />
                <span className="text-sm font-medium text-[var(--wms-app-text)]">
                  {form.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </label>
            </KkdField>
            <KkdField label="Başlangıç">
              <AppDateInput value={form.effectiveFrom} onChange={(event) => setHeader('effectiveFrom', event.target.value)} />
            </KkdField>
            <KkdField label="Bitiş">
              <AppDateInput value={form.effectiveTo} onChange={(event) => setHeader('effectiveTo', event.target.value)} />
            </KkdField>
            <KkdField label="Açıklama">
              <AppInput value={form.description} onChange={(event) => setHeader('description', event.target.value)} />
            </KkdField>
          </section>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <strong>Hakediş kuralları · {form.rules.length.toLocaleString('tr-TR')} satır</strong>
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  Detaylı kartlarla tekil çalışın veya binlerce satırı toplu çalışma alanında yönetin.
                </p>
              </div>
            </div>
            <div className="wms-ops-kkd-matrix-editor-tabs wms-ops-detail-dialog w-full min-w-0">
              <Tabs
                value={editorMode}
                onValueChange={(value) => setEditorMode(value as 'detail' | 'bulk')}
                className="gap-0"
              >
                <TabsList
                  className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-2')}
                  data-active-index={editorMode === 'detail' ? 0 : 1}
                >
                  <span className="wms-ops-detail-tab-indicator" aria-hidden />
                  <TabsTrigger value="detail" className="wms-ops-detail-main-tab" title="Detaylı düzenleme">
                    <ListTree className="size-3.5 shrink-0" />
                    Detaylı düzenleme
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="wms-ops-detail-main-tab" title="Toplu düzenleme">
                    <LayoutGrid className="size-3.5 shrink-0" />
                    Toplu düzenleme
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          {editorMode === 'bulk' ? (
            <div className="min-w-0 max-w-full">
              <KkdBulkMatrixEditor
                rules={form.rules}
                createRule={newRule}
                onChange={(rules) => setForm((current) => ({ ...current, rules }))}
              />
            </div>
          ) : (
            <div className="grid gap-3">
              {form.rules.map((item, index) => (
                <RuleEditor
                  key={item.key}
                  item={item}
                  index={index}
                  setRule={setRule}
                  patchRule={patchRule}
                  remove={() =>
                    setForm((current) => ({
                      ...current,
                      rules: current.rules.filter((rule) => rule.key !== item.key),
                    }))
                  }
                  duplicate={() =>
                    setForm((current) => ({
                      ...current,
                      rules: [
                        ...current.rules.slice(0, index + 1),
                        { ...item, key: crypto.randomUUID(), stockId: '', stockLabel: '' },
                        ...current.rules.slice(index + 1),
                      ],
                    }))
                  }
                />
              ))}
              <div className="flex justify-end">
                <OpsActionButton variant="secondary" type="button" onClick={addRule}>
                  <Plus className="size-3.5" />
                  Kural ekle
                </OpsActionButton>
              </div>
            </div>
          )}
          <div className="sticky bottom-2 z-10 flex justify-end gap-2 rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface)]/95 p-3 backdrop-blur">
            {form.id ? (
              <OpsActionButton variant="secondary" type="button" onClick={() => setForm(emptyForm())}>
                <X className="size-3.5" />
                Vazgeç
              </OpsActionButton>
            ) : null}
            <OpsActionButton variant="primary" type="submit" loading={save.isPending}>
              <Save className="size-3.5" />
              {form.id ? 'Değişiklikleri kaydet' : 'Matrisi oluştur'}
            </OpsActionButton>
          </div>
        </form>
      </KkdPanel>
      </div>

      <div
        className="min-h-0 min-w-0 xl:overflow-hidden"
        style={listHeight ? { height: listHeight } : undefined}
      >
      <KkdPanel
        code="MTX_LST"
        title="Hak matrisi listesi"
        description="Arayın, düzenleyin veya mevcut matrisi yeni kapsam için kopyalayın."
        className="flex h-full min-h-0 min-w-0 flex-col"
        actions={
          <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => void matrices.refetch()}>
            <RefreshCw className="size-3.5" />
            Yenile
          </OpsActionButton>
        }
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="shrink-0 border-b border-[var(--wms-ops-card-border)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--wms-app-text-muted)]" />
            <AppInput
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Matris kodu veya adıyla ara"
            />
          </div>
        </div>
        <KkdTableShell fill minWidthClass="min-w-[650px]" className="border-0" maxHeightClass={false}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={KKD_HEAD_CELL}>Kod</th>
              <th className={KKD_HEAD_CELL}>Ad</th>
              <th className={KKD_HEAD_CELL}>Kural</th>
              <th className={KKD_HEAD_CELL}>Durum</th>
              <th className={cn(KKD_HEAD_CELL, 'w-[1%] whitespace-nowrap')}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {matrices.isLoading ? (
              <tr>
                <td colSpan={5} className="wms-ops-grid-state-cell">
                  <OpsLoadingState code="FETCH" message="Matrisler yükleniyor…" compact />
                </td>
              </tr>
            ) : visibleMatrices.length === 0 ? (
              <tr>
                <td colSpan={5} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Hak matrisi bulunamadı." />
                </td>
              </tr>
            ) : (
              visibleMatrices.map((item) => (
                <tr key={item.id} className={cn(form.id === item.id && 'bg-cyan-500/5')}>
                  <td className={cn(KKD_CELL, 'font-mono font-bold')}>{item.code}</td>
                  <td className={KKD_CELL}>{item.name}</td>
                  <td className={KKD_CELL}>{item.ruleCount}</td>
                  <td className={KKD_CELL}>
                    <OpsStatusBadge tone={item.isActive ? 'active' : 'neutral'}>
                      {item.isActive ? 'Aktif' : 'Pasif'}
                    </OpsStatusBadge>
                  </td>
                  <td className={KKD_CELL}>
                    <div className="wms-ops-row-actions">
                      <button
                        type="button"
                        title="Düzenle"
                        aria-label="Düzenle"
                        className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--lg"
                        disabled={load.isPending}
                        onClick={() => load.mutate(item.id)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Kopyala"
                        aria-label="Kopyala"
                        className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--lg"
                        disabled={clone.isPending}
                        onClick={() => clone.mutate(item.id)}
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        type="button"
                        title={item.isActive ? 'Pasife al' : 'Aktifleştir'}
                        aria-label={item.isActive ? 'Pasife al' : 'Aktifleştir'}
                        className={cn(
                          'wms-ops-grid-icon-btn wms-ops-grid-icon-btn--lg',
                          item.isActive && 'wms-ops-grid-icon-btn--danger',
                        )}
                        disabled={toggleActive.isPending}
                        onClick={() => setStatusConfirm(item)}
                      >
                        <Power className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </KkdTableShell>
      </KkdPanel>
      </div>

      <ResponsiveDialog
        open={Boolean(statusConfirm)}
        onClose={() => {
          if (!toggleActive.isPending) setStatusConfirm(null);
        }}
        title={statusConfirm?.isActive ? 'Matrisi pasife al' : 'Matrisi aktifleştir'}
        description="Bu işlem hak motorundaki matris durumunu değiştirir."
        className="!max-w-md"
      >
        {statusConfirm ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--wms-app-text-muted)]">
              <span className="font-semibold text-[var(--wms-app-text)]">
                {statusConfirm.code} · {statusConfirm.name}
              </span>
              {statusConfirm.isActive
                ? ' kaydını pasife almak istediğine emin misin? Pasif matrisler hak hesabına katılmaz.'
                : ' kaydını yeniden aktifleştirmek istediğine emin misin?'}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <OpsActionButton
                type="button"
                variant="secondary"
                disabled={toggleActive.isPending}
                onClick={() => setStatusConfirm(null)}
              >
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant={statusConfirm.isActive ? 'secondary' : 'primary'}
                className={statusConfirm.isActive ? 'wms-ops-action-btn--danger' : undefined}
                loading={toggleActive.isPending}
                loadingLabel={statusConfirm.isActive ? 'Pasife alınıyor…' : 'Aktifleştiriliyor…'}
                onClick={() => toggleActive.mutate(statusConfirm)}
              >
                <Power className="size-3.5 shrink-0" />
                {statusConfirm.isActive ? 'Pasife al' : 'Aktifleştir'}
              </OpsActionButton>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}

function RuleEditor({
  item,
  index,
  setRule,
  patchRule,
  remove,
  duplicate,
}: {
  item: RuleForm;
  index: number;
  setRule: (key: string, field: keyof RuleForm, value: string | boolean) => void;
  patchRule: (key: string, patch: Partial<RuleForm>) => void;
  remove: () => void;
  duplicate: () => void;
}): ReactElement {
  const [groupLookupOpen, setGroupLookupOpen] = useState(false);
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const groupLabel = item.groupCode
    ? item.groupName
      ? `${item.groupCode} · ${item.groupName}`
      : item.groupCode
    : '';

  return (
    <details
      className="group wms-ops-kkd-rule-card rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface-subtle)]"
      open={index === 0}
    >
      <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-[var(--wms-ops-accent)] transition-transform duration-200 group-open:rotate-180"
            />
            <div className="min-w-0">
              <strong>
                #{index + 1} {item.groupCode || 'Yeni kural'}
              </strong>
              <p className="text-xs text-[var(--wms-app-text-muted)]">{item.stockLabel || 'Grup bazlı hakediş'}</p>
            </div>
          </div>
          <div className="flex gap-1" onClick={(event) => event.preventDefault()}>
            <button
              type="button"
              className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--lg"
              title="Kuralı kopyala"
              aria-label="Kuralı kopyala"
              onClick={duplicate}
            >
              <Copy className="size-4" />
            </button>
            <button
              type="button"
              className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--lg wms-ops-grid-icon-btn--danger"
              title="Kuralı kaldır"
              aria-label="Kuralı kaldır"
              onClick={remove}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </summary>
      <div className="grid gap-3 border-t border-[var(--wms-ops-card-border)] p-4 md:grid-cols-2 xl:grid-cols-3">
        <KkdField label="Hakediş grubu" hint="KKD kategorisidir; ERP stok grubundan farklı olabilir.">
          <PagedLookupDialog<KkdEntitlementGroupLookup>
            variant="ops"
            triggerMode="combobox"
            autoSearchMinLength={1}
            open={groupLookupOpen}
            onOpenChange={setGroupLookupOpen}
            title="Hakediş grubu seç"
            description="Kod veya ad yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
            value={groupLabel}
            placeholder="Hakediş grubu yazın veya seçin"
            searchPlaceholder="Grup ara"
            emptyText="Hakediş grubu bulunamadı — yazdığınız metin yeni grup kodu olarak kullanılabilir."
            queryKey={['kkd', 'matrix-entitlement-group-lookup']}
            fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
              toPagedResponse(
                await kkdApi.entitlementGroupsPaged({
                  pageNumber,
                  pageSize,
                  search,
                  searchFields: ['code', 'name'],
                  sortBy: 'code',
                  sortDirection: 'asc',
                  signal: signal ?? new AbortController().signal,
                }),
              )
            }
            getKey={(group) => group.code}
            getLabel={(group) => `${group.code} · ${group.name}`}
            onSelect={(group) =>
              patchRule(item.key, {
                groupCode: group.code,
                groupName: group.name,
                stockId: '',
                stockLabel: '',
              })
            }
            onComboboxTextChange={(text) =>
              patchRule(item.key, { groupCode: text.trim(), groupName: '', stockId: '', stockLabel: '' })
            }
          />
        </KkdField>
        <KkdField label="Stok" hint="Boşsa hakediş grubu içindeki tüm ERP stok grubuna uygulanır.">
          <PagedLookupDialog<KkdStockLookup>
            variant="ops"
            triggerMode="combobox"
            autoSearchMinLength={1}
            open={stockLookupOpen}
            onOpenChange={setStockLookupOpen}
            title="Stok seç"
            description="İsteğe bağlı stok seçin; arama ikonu veya çift tık ile liste penceresini açın."
            value={item.stockLabel}
            placeholder="İsteğe bağlı stok yazın veya seçin"
            searchPlaceholder="Stok ara"
            emptyText="Stok bulunamadı."
            queryKey={['kkd', 'matrix-stock-lookup', item.groupCode || 'all']}
            fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
              toPagedResponse(
                await kkdApi.stocksPaged(
                  {
                    pageNumber,
                    pageSize,
                    search,
                    searchFields: ['code', 'name'],
                    sortBy: 'code',
                    sortDirection: 'asc',
                    signal: signal ?? new AbortController().signal,
                  },
                  item.groupCode || undefined,
                ),
              )
            }
            getKey={(stock) => String(stock.id)}
            getLabel={(stock) => `${stock.code} · ${stock.name}`}
            onSelect={(stock) =>
              patchRule(item.key, {
                stockId: String(stock.id),
                stockLabel: `${stock.code} · ${stock.name}`,
              })
            }
          />
        </KkdField>
        <KkdField label="Standart">
          <AppInput
            value={item.standardCode}
            onChange={(event) => setRule(item.key, 'standardCode', event.target.value)}
            placeholder="EN / TS standardı"
          />
        </KkdField>
        <KkdField label="İlk teslim">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.initialQuantity}
            onChange={(event) => setRule(item.key, 'initialQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Kaç ay sonra">
          <AppInput
            type="number"
            min="1"
            value={item.afterMonths}
            onChange={(event) => setRule(item.key, 'afterMonths', event.target.value)}
          />
        </KkdField>
        <KkdField label="Ara teslim">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.afterQuantity}
            onChange={(event) => setRule(item.key, 'afterQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Periyodik miktar">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.recurringQuantity}
            onChange={(event) => setRule(item.key, 'recurringQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Periyot">
          <OpsSelect
            value={item.periodType}
            onValueChange={(value) => setRule(item.key, 'periodType', value)}
            options={[
              { value: 'Day', label: 'Gün' },
              { value: 'Month', label: 'Ay' },
              { value: 'Year', label: 'Yıl' },
            ]}
          />
        </KkdField>
        <KkdField label="Periyot aralığı">
          <AppInput
            type="number"
            min="1"
            value={item.recurringInterval}
            onChange={(event) => setRule(item.key, 'recurringInterval', event.target.value)}
          />
        </KkdField>
        <KkdField label="Sıklık (gün)">
          <AppInput
            type="number"
            min="1"
            value={item.frequencyDays}
            onChange={(event) => setRule(item.key, 'frequencyDays', event.target.value)}
          />
        </KkdField>
        <KkdField label="Sıklık miktarı">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.frequencyQuantity}
            onChange={(event) => setRule(item.key, 'frequencyQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Yıllık teslim sayısı">
          <AppInput
            type="number"
            min="1"
            value={item.annualIssueCount}
            onChange={(event) => setRule(item.key, 'annualIssueCount', event.target.value)}
          />
        </KkdField>
        <KkdField label="Yıllık miktar">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.annualQuantity}
            onChange={(event) => setRule(item.key, 'annualQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Devreden üst sınır">
          <AppInput
            type="number"
            min="0"
            step="any"
            value={item.maxCarryQuantity}
            onChange={(event) => setRule(item.key, 'maxCarryQuantity', event.target.value)}
          />
        </KkdField>
        <div className="grid gap-2 sm:grid-cols-2 xl:col-span-3">
          <KkdCheckRow
            checked={item.allowBulkIssue}
            onCheckedChange={(value) => setRule(item.key, 'allowBulkIssue', value)}
            title="Toplu teslim"
            description="Tek işlemde dönem miktarı verilebilir."
          />
          <KkdCheckRow
            checked={item.isMandatory}
            onCheckedChange={(value) => setRule(item.key, 'isMandatory', value)}
            title="Zorunlu KKD"
            description="Personele atanması zorunludur."
          />
        </div>
      </div>
    </details>
  );
}
