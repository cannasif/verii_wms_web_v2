import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, LayoutGrid, ListTree, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { cn } from '@/lib/utils';
import { KKD_CELL, KKD_HEAD_CELL, KkdCheckRow, KkdField, KkdPanel, KkdTableShell } from './kkd-ops-ui';
import { kkdApi, type KkdMatrixDetail, type KkdMatrixRule } from './kkd-api';
import { KkdBulkMatrixEditor } from './KkdBulkMatrixEditor';

export type RuleForm = {
  key: string; groupCode: string; groupName: string; stockId: string; stockLabel: string;
  standardCode: string; standardName: string; initialQuantity: string; afterMonths: string;
  afterQuantity: string; recurringQuantity: string; recurringInterval: string; periodType: string;
  frequencyDays: string; frequencyQuantity: string; annualIssueCount: string; annualQuantity: string;
  maxCarryQuantity: string; allowBulkIssue: boolean; isMandatory: boolean; isActive: boolean;
};
type MatrixForm = {
  id?: number; customerId: string; departmentId: string; roleId: string; code: string; name: string;
  effectiveFrom: string; effectiveTo: string; description: string; isActive: boolean; rules: RuleForm[]; rowVersion?: string;
};

const number = (value?: string | number | null): number => Number(value || 0);
const optionalNumber = (value: string): number | null => value.trim() === '' ? null : Number(value);
const newRule = (): RuleForm => ({
  key: crypto.randomUUID(), groupCode: '', groupName: '', stockId: '', stockLabel: '', standardCode: '', standardName: '',
  initialQuantity: '1', afterMonths: '3', afterQuantity: '0', recurringQuantity: '1', recurringInterval: '1',
  periodType: 'Year', frequencyDays: '', frequencyQuantity: '', annualIssueCount: '', annualQuantity: '',
  maxCarryQuantity: '', allowBulkIssue: true, isMandatory: true, isActive: true,
});
const emptyForm = (): MatrixForm => ({
  customerId: '', departmentId: '', roleId: '', code: '', name: '', effectiveFrom: '', effectiveTo: '',
  description: '', isActive: true, rules: [newRule()],
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

export function KkdMatrixManager(): ReactElement {
  const qc = useQueryClient();
  const [form, setForm] = useState<MatrixForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [editorMode, setEditorMode] = useState<'detail'|'bulk'>('detail');
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

  const setHeader = <K extends keyof MatrixForm>(key: K, value: MatrixForm[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const setRule = (key: string, field: keyof RuleForm, value: string | boolean): void =>
    setForm((current) => ({ ...current, rules: current.rules.map((item) => item.key === key ? { ...item, [field]: value } : item) }));

  const load = useMutation({
    mutationFn: kkdApi.matrix,
    onSuccess: (detail: KkdMatrixDetail, id: number) => setForm({
      id, customerId: String(detail.customerId), departmentId: String(detail.departmentId), roleId: String(detail.roleId),
      code: detail.code, name: detail.name, effectiveFrom: detail.effectiveFrom || '', effectiveTo: detail.effectiveTo || '',
      description: detail.description || '', isActive: detail.isActive, rules: detail.rules.map(ruleFromDetail), rowVersion: detail.rowVersion,
    }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Matris yüklenemedi.'),
  });
  const clone = useMutation({
    mutationFn: kkdApi.matrix,
    onSuccess: (detail) => setForm({
      customerId: String(detail.customerId), departmentId: String(detail.departmentId), roleId: String(detail.roleId),
      code: `${detail.code}-KOPYA`, name: `${detail.name} (Kopya)`, effectiveFrom: '', effectiveTo: '',
      description: detail.description || '', isActive: false, rules: detail.rules.map(ruleFromDetail), rowVersion: undefined,
    }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Matris kopyalanamadı.'),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!number(form.customerId) || !number(form.departmentId) || !number(form.roleId)) throw new Error('Cari, departman ve rol seçilmelidir.');
      if (!form.code.trim() || !form.name.trim()) throw new Error('Matris kodu ve adı zorunludur.');
      if (!form.rules.length) throw new Error('En az bir hakediş kuralı eklenmelidir.');
      if (form.rules.some((item) => !item.groupCode.trim())) throw new Error('Her kuralda hakediş grubu seçilmelidir.');
      const payload = {
        customerId: number(form.customerId), departmentId: number(form.departmentId), roleId: number(form.roleId),
        code: form.code, name: form.name, effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
        isActive: form.isActive, description: form.description || null, expectedRowVersion: form.rowVersion || null,
        rules: form.rules.map((item, index) => ({
          groupCode: item.groupCode, groupName: item.groupName || null, stockId: optionalNumber(item.stockId),
          standardCode: item.standardCode || null, standardName: item.standardName || null,
          annualIssueCount: optionalNumber(item.annualIssueCount), annualQuantity: optionalNumber(item.annualQuantity),
          maxCarryQuantity: optionalNumber(item.maxCarryQuantity), allowBulkIssue: item.allowBulkIssue,
          isMandatory: item.isMandatory, sortOrder: index + 1, isActive: item.isActive, description: null,
          phases: [
            { phaseType: 'Initial', offsetMonths: 0, quantity: number(item.initialQuantity), allowBulkIssue: item.allowBulkIssue,
              frequencyDays: null, quantityPerFrequency: null, periodType: null, periodInterval: null, sortOrder: 1, isActive: true },
            ...(number(item.afterQuantity) > 0 ? [{ phaseType: 'AfterMonths', offsetMonths: Math.max(1, number(item.afterMonths)),
              quantity: number(item.afterQuantity), allowBulkIssue: item.allowBulkIssue, frequencyDays: null,
              quantityPerFrequency: null, periodType: null, periodInterval: null, sortOrder: 2, isActive: true }] : []),
            ...(number(item.recurringQuantity) > 0 ? [{ phaseType: 'Recurring', offsetMonths: Math.max(0, number(item.afterMonths)),
              quantity: number(item.recurringQuantity), allowBulkIssue: item.allowBulkIssue,
              frequencyDays: optionalNumber(item.frequencyDays), quantityPerFrequency: optionalNumber(item.frequencyQuantity),
              periodType: item.periodType, periodInterval: Math.max(1, number(item.recurringInterval)), sortOrder: 3, isActive: true }] : []),
          ],
        })),
      };
      const validation = await kkdApi.validateMatrix(payload, form.id);
      if (!validation.isValid) {
        const first = validation.issues[0];
        throw new Error(`${first.rowNumber ? `${first.rowNumber}. satır: ` : ''}${first.message} (${validation.issues.length} hata)`);
      }
      return kkdApi.saveMatrix(payload, form.id);
    },
    onSuccess: async () => { toast.success(form.id ? 'Hak matrisi güncellendi.' : 'Hak matrisi oluşturuldu.'); setForm(emptyForm()); await qc.invalidateQueries({ queryKey: ['kkd', 'matrices'] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Hak matrisi kaydedilemedi.'),
  });
  const submit = (event: FormEvent): void => { event.preventDefault(); save.mutate(); };

  return (
    <div className={cn('grid gap-4', editorMode === 'detail' && '2xl:grid-cols-[minmax(420px,.8fr)_1.2fr]')}>
      <KkdPanel code="MTX_LST" title="Hak matrisi listesi" description="Arayın, düzenleyin veya mevcut matrisi yeni kapsam için kopyalayın."
        actions={<OpsActionButton variant="secondary" onClick={() => void matrices.refetch()}><RefreshCw className="size-3.5" />Yenile</OpsActionButton>}
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0">
        <div className="border-b border-[var(--wms-ops-card-border)] p-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--wms-app-text-muted)]" />
            <AppInput className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Matris kodu veya adıyla ara" /></div>
        </div>
        <KkdTableShell minWidthClass="min-w-[650px]" className="border-0">
          <thead><tr><th className={KKD_HEAD_CELL}>Kod</th><th className={KKD_HEAD_CELL}>Ad</th><th className={KKD_HEAD_CELL}>Kural</th><th className={KKD_HEAD_CELL}>Durum</th><th className={KKD_HEAD_CELL}>İşlemler</th></tr></thead>
          <tbody>{matrices.isLoading ? <tr><td colSpan={5}><OpsLoadingState code="FETCH" message="Matrisler yükleniyor…" compact /></td></tr>
            : visibleMatrices.length === 0 ? <tr><td colSpan={5}><OpsGridEmptyState message="Hak matrisi bulunamadı." /></td></tr>
            : visibleMatrices.map((item) => <tr key={item.id} className={cn(form.id === item.id && 'bg-cyan-500/5')}>
              <td className={cn(KKD_CELL, 'font-mono font-bold')}>{item.code}</td><td className={KKD_CELL}>{item.name}</td>
              <td className={KKD_CELL}>{item.ruleCount}</td><td className={KKD_CELL}><OpsStatusBadge tone={item.isActive ? 'active' : 'neutral'}>{item.isActive ? 'Aktif' : 'Pasif'}</OpsStatusBadge></td>
              <td className={KKD_CELL}><div className="flex gap-1"><OpsActionButton variant="secondary" title="Düzenle" onClick={() => load.mutate(item.id)}><Pencil className="size-3.5" /></OpsActionButton>
                <OpsActionButton variant="secondary" title="Kopyala" onClick={() => clone.mutate(item.id)}><Copy className="size-3.5" /></OpsActionButton></div></td></tr>)}</tbody>
        </KkdTableShell>
      </KkdPanel>

      <KkdPanel code={form.id ? 'MTX_EDIT' : 'MTX_NEW'} title={form.id ? 'Hak matrisini düzenle' : 'Yeni hak matrisi'}
        description="Önce kapsamı belirleyin; ardından aynı matrise ihtiyaç kadar stok veya grup kuralı ekleyin."
        actions={<OpsActionButton variant="secondary" onClick={() => setForm(emptyForm())}><Plus className="size-3.5" />Yeni</OpsActionButton>}>
        <form className="grid gap-4" onSubmit={submit}>
          <section className="grid gap-3 rounded-xl border border-[var(--wms-ops-card-border)] p-3 md:grid-cols-2 xl:grid-cols-3">
            <KkdField label="Entegre cari"><PagedAppDropdown queryKey="kkd-matrix-customer" fetchPage={kkdApi.customersPaged}
              toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })} value={form.customerId || null}
              onValueChange={(value) => setHeader('customerId', value)} placeholder="Cari seçin" searchable minSearchLength={1} searchFields={['code','name']} className={OPS_SELECT_TRIGGER_CLASS} /></KkdField>
            <KkdField label="Departman"><OpsSelect value={form.departmentId} options={(departments.data ?? []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))}
              onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value, roleId: '' }))} placeholder="Departman seçin" searchable /></KkdField>
            <KkdField label="Rol"><OpsSelect value={form.roleId} options={(roles.data ?? []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))}
              onValueChange={(value) => setHeader('roleId', value)} placeholder="Önce departman seçin" disabled={!form.departmentId} searchable /></KkdField>
            <KkdField label="Matris kodu"><AppInput value={form.code} onChange={(event) => setHeader('code', event.target.value)} /></KkdField>
            <KkdField label="Matris adı"><AppInput value={form.name} onChange={(event) => setHeader('name', event.target.value)} /></KkdField>
            <KkdCheckRow checked={form.isActive} onCheckedChange={(value) => setHeader('isActive', value)} title="Aktif matris" description="Hak hesabında kullanılır." />
            <KkdField label="Başlangıç"><AppDateInput value={form.effectiveFrom} onChange={(event) => setHeader('effectiveFrom', event.target.value)} /></KkdField>
            <KkdField label="Bitiş"><AppDateInput value={form.effectiveTo} onChange={(event) => setHeader('effectiveTo', event.target.value)} /></KkdField>
            <KkdField label="Açıklama"><AppInput value={form.description} onChange={(event) => setHeader('description', event.target.value)} /></KkdField>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>Hakediş kuralları · {form.rules.length.toLocaleString('tr-TR')} satır</strong><p className="text-xs text-[var(--wms-app-text-muted)]">Detaylı kartlarla tekil çalışın veya binlerce satırı toplu çalışma alanında yönetin.</p></div>
            <div className="flex flex-wrap gap-2"><OpsActionButton variant={editorMode === 'detail' ? 'primary' : 'secondary'} type="button" onClick={() => setEditorMode('detail')}><ListTree className="size-3.5" />Detaylı düzenleme</OpsActionButton>
              <OpsActionButton variant={editorMode === 'bulk' ? 'primary' : 'secondary'} type="button" onClick={() => setEditorMode('bulk')}><LayoutGrid className="size-3.5" />Toplu düzenleme</OpsActionButton>
              {editorMode === 'detail' ? <OpsActionButton variant="secondary" type="button" onClick={() => setForm((current) => ({ ...current, rules: [...current.rules, newRule()] }))}><Plus className="size-3.5" />Kural ekle</OpsActionButton> : null}</div></div>
          {editorMode === 'bulk' ? <KkdBulkMatrixEditor rules={form.rules} createRule={newRule} onChange={(rules) => setForm((current) => ({ ...current, rules }))} />
            : <div className="grid gap-3">{form.rules.map((item, index) => <RuleEditor key={item.key} item={item} index={index}
              setRule={setRule} remove={() => setForm((current) => ({ ...current, rules: current.rules.filter((rule) => rule.key !== item.key) }))}
              duplicate={() => setForm((current) => ({ ...current, rules: [...current.rules.slice(0,index+1), { ...item, key: crypto.randomUUID(), stockId: '', stockLabel: '' }, ...current.rules.slice(index+1)] }))} />)}</div>}
          <div className="sticky bottom-2 z-10 flex justify-end gap-2 rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface)]/95 p-3 backdrop-blur">
            {form.id ? <OpsActionButton variant="secondary" type="button" onClick={() => setForm(emptyForm())}><X className="size-3.5" />Vazgeç</OpsActionButton> : null}
            <OpsActionButton variant="primary" type="submit" loading={save.isPending}><Save className="size-3.5" />{form.id ? 'Değişiklikleri kaydet' : 'Matrisi oluştur'}</OpsActionButton>
          </div>
        </form>
      </KkdPanel>
    </div>
  );
}

function RuleEditor({ item, index, setRule, remove, duplicate }: { item: RuleForm; index: number;
  setRule: (key: string, field: keyof RuleForm, value: string | boolean) => void; remove: () => void; duplicate: () => void }): ReactElement {
  return <details className="rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface-subtle)]" open={index === 0}>
    <summary className="cursor-pointer list-none px-4 py-3"><div className="flex items-center justify-between gap-3"><div><strong>#{index + 1} {item.groupCode || 'Yeni kural'}</strong>
      <p className="text-xs text-[var(--wms-app-text-muted)]">{item.stockLabel || 'Grup bazlı hakediş'}</p></div><div className="flex gap-1" onClick={(event) => event.preventDefault()}>
      <OpsActionButton variant="secondary" type="button" title="Kuralı kopyala" onClick={duplicate}><Copy className="size-3.5" /></OpsActionButton>
      <OpsActionButton variant="secondary" type="button" title="Kuralı kaldır" onClick={remove}><Trash2 className="size-3.5 text-rose-500" /></OpsActionButton></div></div></summary>
    <div className="grid gap-3 border-t border-[var(--wms-ops-card-border)] p-4 md:grid-cols-2 xl:grid-cols-3">
      <KkdField label="Hakediş grubu" hint="KKD kategorisidir; ERP stok grubundan farklı olabilir."><PagedAppDropdown queryKey="kkd-entitlement-groups" fetchPage={kkdApi.entitlementGroupsPaged}
        toOption={(option) => ({ value: option.code, label: `${option.code} · ${option.name}`, description: `${option.ruleCount} kural` })}
        value={item.groupCode || null} onValueChange={(value) => setRule(item.key, 'groupCode', value)} placeholder="Hakediş grubu seçin"
        searchable minSearchLength={1} searchFields={['code','name']} className={OPS_SELECT_TRIGGER_CLASS} /></KkdField>
      <KkdField label="Stok" hint="Boşsa hakediş grubu içindeki tüm ERP stok grubuna uygulanır."><PagedAppDropdown queryKey="kkd-matrix-stock" fetchPage={(request) => kkdApi.stocksPaged(request)}
        toOption={(stock) => ({ value: String(stock.id), label: `${stock.code} · ${stock.name}`, description: [stock.groupCode, stock.unitCode].filter(Boolean).join(' · ') })}
        staticOptions={item.stockId ? [{ value: item.stockId, label: item.stockLabel || `Stok #${item.stockId}` }] : [{ value: '', label: 'Grup bazlı uygula' }]}
        value={item.stockId || null} onValueChange={(value) => { setRule(item.key, 'stockId', value); if (!value) setRule(item.key, 'stockLabel', ''); }}
        placeholder="İsteğe bağlı stok seçin" searchable minSearchLength={1} searchFields={['code','name']} className={OPS_SELECT_TRIGGER_CLASS} /></KkdField>
      <KkdField label="Standart"><AppInput value={item.standardCode} onChange={(event) => setRule(item.key, 'standardCode', event.target.value)} placeholder="EN / TS standardı" /></KkdField>
      <KkdField label="İlk teslim"><AppInput type="number" min="0" step="any" value={item.initialQuantity} onChange={(event) => setRule(item.key, 'initialQuantity', event.target.value)} /></KkdField>
      <KkdField label="Kaç ay sonra"><AppInput type="number" min="1" value={item.afterMonths} onChange={(event) => setRule(item.key, 'afterMonths', event.target.value)} /></KkdField>
      <KkdField label="Ara teslim"><AppInput type="number" min="0" step="any" value={item.afterQuantity} onChange={(event) => setRule(item.key, 'afterQuantity', event.target.value)} /></KkdField>
      <KkdField label="Periyodik miktar"><AppInput type="number" min="0" step="any" value={item.recurringQuantity} onChange={(event) => setRule(item.key, 'recurringQuantity', event.target.value)} /></KkdField>
      <KkdField label="Periyot"><OpsSelect value={item.periodType} onValueChange={(value) => setRule(item.key, 'periodType', value)} options={[{value:'Day',label:'Gün'},{value:'Month',label:'Ay'},{value:'Year',label:'Yıl'}]} /></KkdField>
      <KkdField label="Periyot aralığı"><AppInput type="number" min="1" value={item.recurringInterval} onChange={(event) => setRule(item.key, 'recurringInterval', event.target.value)} /></KkdField>
      <KkdField label="Sıklık (gün)"><AppInput type="number" min="1" value={item.frequencyDays} onChange={(event) => setRule(item.key, 'frequencyDays', event.target.value)} /></KkdField>
      <KkdField label="Sıklık miktarı"><AppInput type="number" min="0" step="any" value={item.frequencyQuantity} onChange={(event) => setRule(item.key, 'frequencyQuantity', event.target.value)} /></KkdField>
      <KkdField label="Yıllık teslim sayısı"><AppInput type="number" min="1" value={item.annualIssueCount} onChange={(event) => setRule(item.key, 'annualIssueCount', event.target.value)} /></KkdField>
      <KkdField label="Yıllık miktar"><AppInput type="number" min="0" step="any" value={item.annualQuantity} onChange={(event) => setRule(item.key, 'annualQuantity', event.target.value)} /></KkdField>
      <KkdField label="Devreden üst sınır"><AppInput type="number" min="0" step="any" value={item.maxCarryQuantity} onChange={(event) => setRule(item.key, 'maxCarryQuantity', event.target.value)} /></KkdField>
      <div className="grid gap-2 sm:grid-cols-2 xl:col-span-3"><KkdCheckRow checked={item.allowBulkIssue} onCheckedChange={(value) => setRule(item.key, 'allowBulkIssue', value)} title="Toplu teslim" description="Tek işlemde dönem miktarı verilebilir." />
        <KkdCheckRow checked={item.isMandatory} onCheckedChange={(value) => setRule(item.key, 'isMandatory', value)} title="Zorunlu KKD" description="Personele atanması zorunludur." /></div>
    </div>
  </details>;
}
