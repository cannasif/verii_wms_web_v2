import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { Download, FileSpreadsheet, Plus, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSelect } from '@/components/shared/OpsSelect';
import type { RuleForm } from './KkdMatrixManager';
import { kkdApi } from './kkd-api';

type Props = { rules: RuleForm[]; onChange: (rules: RuleForm[]) => void; createRule: () => RuleForm };
type EditableField = keyof Pick<RuleForm, 'initialQuantity'|'afterMonths'|'afterQuantity'|'recurringQuantity'|'recurringInterval'|'annualIssueCount'|'annualQuantity'|'maxCarryQuantity'|'allowBulkIssue'|'isMandatory'|'isActive'>;

const PAGE_SIZE = 100;
const MAX_ROWS = 5000;
const bool = (value: unknown, fallback = true): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  if (['1','true','evet','e','yes'].includes(normalized)) return true;
  if (['0','false','hayır','hayir','h','no'].includes(normalized)) return false;
  return fallback;
};
const text = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  return '';
};
const toRule = (row: Record<string, unknown>, createRule: () => RuleForm): RuleForm => ({
  ...createRule(),
  groupCode: text(row, 'Hakediş Grubu', 'HakedişGrubu', 'GroupCode', 'Grup Kodu'),
  groupName: text(row, 'Grup Adı', 'GroupName'), stockId: text(row, 'Stok ID', 'StockId'),
  stockLabel: text(row, 'Stok', 'Stock', 'Stok Adı'), standardCode: text(row, 'Standart', 'StandardCode'),
  standardName: text(row, 'Standart Adı', 'StandardName'), initialQuantity: text(row, 'İlk Teslim', 'InitialQuantity') || '0',
  afterMonths: text(row, 'Kaç Ay Sonra', 'AfterMonths') || '3', afterQuantity: text(row, 'Ara Teslim', 'AfterQuantity') || '0',
  recurringQuantity: text(row, 'Periyodik Miktar', 'RecurringQuantity') || '0',
  recurringInterval: text(row, 'Periyot Aralığı', 'RecurringInterval') || '1', periodType: text(row, 'Periyot', 'PeriodType') || 'Year',
  frequencyDays: text(row, 'Sıklık Gün', 'FrequencyDays'), frequencyQuantity: text(row, 'Sıklık Miktarı', 'FrequencyQuantity'),
  annualIssueCount: text(row, 'Yıllık Teslim Sayısı', 'AnnualIssueCount'), annualQuantity: text(row, 'Yıllık Miktar', 'AnnualQuantity'),
  maxCarryQuantity: text(row, 'Devreden Üst Sınır', 'MaxCarryQuantity'), allowBulkIssue: bool(row['Toplu Teslim'] ?? row.AllowBulkIssue),
  isMandatory: bool(row['Zorunlu'] ?? row.IsMandatory), isActive: bool(row['Aktif'] ?? row.IsActive),
});

export function KkdBulkMatrixEditor({ rules, onChange, createRule }: Props): ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<EditableField>('initialQuantity');
  const [bulkValue, setBulkValue] = useState('');
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return rules.filter((rule) => !term || `${rule.groupCode} ${rule.groupName} ${rule.stockId} ${rule.stockLabel} ${rule.standardCode}`.toLocaleLowerCase('tr-TR').includes(term));
  }, [rules, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);
  const update = (key: string, field: keyof RuleForm, value: string | boolean): void =>
    onChange(rules.map((row) => row.key === key ? { ...row, [field]: value } : row));
  const togglePage = (checked: boolean): void => setSelected((current) => {
    const next = new Set(current); visible.forEach((row) => checked ? next.add(row.key) : next.delete(row.key)); return next;
  });
  const applyBulk = (): void => {
    if (!selected.size) { toast.error('Önce değiştirilecek satırları seçin.'); return; }
    const booleanField = ['allowBulkIssue','isMandatory','isActive'].includes(bulkField);
    const value = booleanField ? bool(bulkValue) : bulkValue;
    onChange(rules.map((row) => selected.has(row.key) ? { ...row, [bulkField]: value } : row));
    toast.success(`${selected.size} kural topluca güncellendi.`);
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!rows.length) throw new Error('Dosyada veri satırı bulunamadı.');
      if (rows.length > MAX_ROWS) throw new Error(`Tek dosyada en fazla ${MAX_ROWS.toLocaleString('tr-TR')} satır içe aktarılabilir.`);
      const prepared = rows.map((row) => ({ rule: toRule(row, createRule), stockCode: text(row, 'Stok Kodu', 'StockCode') }));
      const codes = prepared.filter((item) => !item.rule.stockId && item.stockCode).map((item) => item.stockCode);
      const resolved = codes.length ? await kkdApi.resolveStocks(codes) : [];
      const stockMap = new Map(resolved.filter((item) => item.isFound).map((item) => [item.requestedCode.toUpperCase(), item]));
      const missing = resolved.filter((item) => !item.isFound).map((item) => item.requestedCode);
      if (missing.length) throw new Error(`ERP stok aynasında bulunamayan ${missing.length} kod var: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
      const imported = prepared.map(({ rule, stockCode }) => {
        const stock = stockMap.get(stockCode.toUpperCase());
        return stock ? { ...rule, stockId: String(stock.id), stockLabel: `${stock.code} · ${stock.name}` } : rule;
      });
      onChange(imported); setSelected(new Set()); setPage(1);
      toast.success(`${imported.length.toLocaleString('tr-TR')} kural çalışma alanına alındı. Kaydetmeden önce doğrulayabilirsiniz.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Dosya okunamadı.'); }
  };
  const exportFile = async (): Promise<void> => {
    const XLSX = await import('xlsx');
    const data = rules.map((row) => ({
      'Hakediş Grubu': row.groupCode, 'Grup Adı': row.groupName, 'Stok ID': row.stockId,
      'Stok Kodu': row.stockLabel.split(' · ')[0] || '', Stok: row.stockLabel,
      Standart: row.standardCode, 'İlk Teslim': row.initialQuantity, 'Kaç Ay Sonra': row.afterMonths,
      'Ara Teslim': row.afterQuantity, 'Periyodik Miktar': row.recurringQuantity, Periyot: row.periodType,
      'Periyot Aralığı': row.recurringInterval, 'Yıllık Teslim Sayısı': row.annualIssueCount,
      'Yıllık Miktar': row.annualQuantity, 'Devreden Üst Sınır': row.maxCarryQuantity,
      'Toplu Teslim': row.allowBulkIssue, Zorunlu: row.isMandatory, Aktif: row.isActive,
    }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), 'Hak Matrisi');
    XLSX.writeFile(workbook, `kkd-hak-matrisi-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return <section className="grid gap-3 rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface-subtle)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><strong>Toplu matris çalışma alanı</strong><p className="text-xs text-[var(--wms-app-text-muted)]">Excel içe aktarın, 100 satırlık hızlı sayfalarda düzenleyin ve seçili satırlara tek işlem uygulayın.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={fileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void importFile(event)} />
        <OpsActionButton type="button" variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" />Excel içe aktar</OpsActionButton>
        <OpsActionButton type="button" variant="secondary" onClick={() => void exportFile()}><Download className="size-3.5" />Excel dışa aktar</OpsActionButton>
        <OpsActionButton type="button" variant="secondary" onClick={() => onChange([...rules, createRule()])}><Plus className="size-3.5" />Satır ekle</OpsActionButton></div>
    </div>
    <div className="grid gap-2 rounded-lg border border-[var(--wms-ops-card-border)] p-2 lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--wms-app-text-muted)]" /><AppInput className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Grup, stok, standart ara" /></div>
      <OpsSelect value={bulkField} onValueChange={(value) => setBulkField(value as EditableField)} options={[
        {value:'initialQuantity',label:'İlk teslim'},{value:'afterMonths',label:'Kaç ay sonra'},{value:'afterQuantity',label:'Ara teslim'},
        {value:'recurringQuantity',label:'Periyodik miktar'},{value:'recurringInterval',label:'Periyot aralığı'},
        {value:'annualIssueCount',label:'Yıllık teslim sayısı'},{value:'annualQuantity',label:'Yıllık miktar'},
        {value:'maxCarryQuantity',label:'Devreden üst sınır'},{value:'allowBulkIssue',label:'Toplu teslim'},
        {value:'isMandatory',label:'Zorunlu'},{value:'isActive',label:'Aktif'},
      ]} />
      {['allowBulkIssue','isMandatory','isActive'].includes(bulkField)
        ? <OpsSelect value={bulkValue} onValueChange={setBulkValue} options={[{value:'true',label:'Evet'},{value:'false',label:'Hayır'}]} placeholder="Değer" />
        : <AppInput value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Yeni değer" />}
      <OpsActionButton type="button" variant="secondary" onClick={applyBulk}><FileSpreadsheet className="size-3.5" />{selected.size} satıra uygula</OpsActionButton>
      <OpsActionButton type="button" variant="secondary" onClick={() => { onChange(rules.filter((row) => !selected.has(row.key))); setSelected(new Set()); }} disabled={!selected.size}><Trash2 className="size-3.5 text-rose-500" />Seçilenleri sil</OpsActionButton>
    </div>
    <div className="overflow-auto rounded-lg border border-[var(--wms-ops-card-border)]">
      <table className="min-w-[1680px] w-full text-xs"><thead className="sticky top-0 z-10 bg-[var(--wms-app-surface)]"><tr>
        <th className="p-2"><input type="checkbox" checked={visible.length > 0 && visible.every((row) => selected.has(row.key))} onChange={(e) => togglePage(e.target.checked)} /></th>
        {['#','Hakediş grubu','Grup adı','Stok ID','Stok','Standart','İlk teslim','Ay','Ara teslim','Periyodik','Periyot','Aralık','Yıllık sayı','Yıllık miktar','Devreden','Toplu','Zorunlu','Aktif'].map((label) => <th key={label} className="whitespace-nowrap p-2 text-left">{label}</th>)}</tr></thead>
        <tbody>{visible.map((row) => { const index = rules.findIndex((item) => item.key === row.key); return <tr key={row.key} className="border-t border-[var(--wms-ops-card-border)]">
          <td className="p-2"><input type="checkbox" checked={selected.has(row.key)} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(row.key); else next.delete(row.key); return next; })} /></td>
          <td className="p-2 font-mono">{index + 1}</td>
          {(['groupCode','groupName','stockId','stockLabel','standardCode','initialQuantity','afterMonths','afterQuantity','recurringQuantity'] as const).map((field) => <td key={field} className="p-1"><AppInput className="h-8 min-w-24" value={row[field]} onChange={(e) => update(row.key, field, e.target.value)} /></td>)}
          <td className="p-1"><OpsSelect value={row.periodType} onValueChange={(value) => update(row.key,'periodType',value)} options={[{value:'Day',label:'Gün'},{value:'Month',label:'Ay'},{value:'Year',label:'Yıl'}]} /></td>
          {(['recurringInterval','annualIssueCount','annualQuantity','maxCarryQuantity'] as const).map((field) => <td key={field} className="p-1"><AppInput className="h-8 min-w-20" value={row[field]} onChange={(e) => update(row.key, field, e.target.value)} /></td>)}
          {(['allowBulkIssue','isMandatory','isActive'] as const).map((field) => <td key={field} className="p-2 text-center"><input type="checkbox" checked={row[field]} onChange={(e) => update(row.key, field, e.target.checked)} /></td>)}
        </tr>; })}</tbody></table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wms-app-text-muted)]"><span>{filtered.length.toLocaleString('tr-TR')} / {rules.length.toLocaleString('tr-TR')} kural · Sayfada en fazla {PAGE_SIZE}</span>
      <div className="flex items-center gap-2"><OpsActionButton type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Önceki</OpsActionButton><span>{Math.min(page,pageCount)} / {pageCount}</span><OpsActionButton type="button" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Sonraki</OpsActionButton></div></div>
  </section>;
}
