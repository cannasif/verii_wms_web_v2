import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput } from '@/components/shared/AppInput';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import {
  kkdApi,
  type KkdCustomerLookup,
  type KkdSimpleMatrixWorkbookImportResult,
  type KkdSimpleMatrixWorkbookIssue,
  type KkdSimpleMatrixWorkbookPreview,
} from './kkd-api';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function KkdSimpleMatrixImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ value: string; label: string }>();
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<KkdSimpleMatrixWorkbookPreview | null>(null);
  const [result, setResult] = useState<KkdSimpleMatrixWorkbookImportResult | null>(null);
  const [busy, setBusy] = useState<'download' | 'preview' | 'commit' | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setCustomerId('');
    setSelectedCustomer(undefined);
    setEffectiveFrom(new Date().toLocaleDateString('en-CA'));
    setFile(null);
    setPreview(null);
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const resetValidation = () => {
    setPreview(null);
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
  };

  const selectFile = (selected: File | null) => {
    resetValidation();
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Yalnızca .xlsx dosyası seçebilirsiniz.');
      return setFile(null);
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('Dosya 15 MB sınırını aşamaz.');
      return setFile(null);
    }
    setFile(selected);
  };

  const download = async () => {
    if (!customerId) return toast.error('Önce cari seçin.');
    setBusy('download');
    try {
      const blob = await kkdApi.downloadSimpleMatrixWorkbook(Number(customerId));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `WMS_KKD_Basit_Matris_${new Date().toLocaleDateString('en-CA').replace(/-/g, '')}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('Müşteriye özel basit şablon indirildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Şablon indirilemedi.');
    } finally {
      setBusy(null);
    }
  };

  const validate = async () => {
    if (!file || !customerId || !effectiveFrom) return;
    setBusy('preview');
    try {
      const value = await kkdApi.previewSimpleMatrixWorkbook(file, Number(customerId), effectiveFrom);
      setPreview(value);
      setResult(null);
      if (value.canCommit) toast.success('Dosya doğrulandı; uygulanmaya hazır.');
      else toast.error(`${value.errors.length} hata bulundu. Hiçbir kayıt değiştirilmedi.`);
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : 'Dosya önizlenemedi.');
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!file || !customerId || !effectiveFrom || !preview?.canCommit) return;
    setBusy('commit');
    try {
      const value = await kkdApi.importSimpleMatrixWorkbook(
        file,
        Number(customerId),
        effectiveFrom,
        preview.fileHash,
        preview.stateHash,
        idempotencyKey,
      );
      setResult(value);
      await onImported();
      toast.success('Basit KKD matrisi uygulandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KKD matrisi uygulanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const canValidate = Boolean(file && customerId && effectiveFrom);
  const cards = preview ? [
    ['Kaynak satır', preview.sourceRowCount],
    ['Matris', preview.matrixCount],
    ['Yeni', preview.createCount],
    ['Güncelleme', preview.updateCount],
    ['Kural', preview.ruleCount],
    ['Dönem', preview.phaseCount],
    ['Tekrarlı satır', preview.duplicateRowCount],
    ['Hata / uyarı', `${preview.errors.length} / ${preview.warnings.length}`],
  ] : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-600 text-white"><FileSpreadsheet className="size-5" /></div>
            <div>
              <DialogTitle className="text-xl font-bold">Basit KKD matris aktarımı</DialogTitle>
              <p className="text-sm text-slate-500">Referans dosyanızdaki gibi dört başlık satırlı, geniş ve kolay matris.</p>
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div><strong className="block">Önizleme zorunludur</strong><p>Excel tarayıcıda işlenmez. Sunucu bölüm, görev, stok ve dönemleri doğrular; hata varsa hiçbir matris değişmez. Sıfır yazılan şablon kapsamındaki hak kaldırılır, boş hücre de sıfır kabul edilir.</p></div>
          </div>

          <ol className="grid gap-3 md:grid-cols-3">
            <Step number="1" title="Cari ve dosya" active={!preview} complete={Boolean(preview)} />
            <Step number="2" title="Sunucuda önizleme" active={Boolean(file) && !preview} complete={Boolean(preview?.canCommit)} />
            <Step number="3" title="Onayla ve uygula" active={Boolean(preview?.canCommit) && !result} complete={Boolean(result)} />
          </ol>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold">
              <span>Cari *</span>
              <PagedAppDropdown<KkdCustomerLookup>
                value={customerId}
                onValueChange={(value) => { setCustomerId(value); resetValidation(); }}
                onOptionChange={(option) => setSelectedCustomer(option)}
                queryKey="kkd-simple-matrix-customers"
                fetchPage={kkdApi.customersPaged}
                toOption={(item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` })}
                selectedOption={selectedCustomer}
                placeholder="Cari ara ve seç"
                ariaLabel="Cari"
                searchFields={['code', 'name']}
                sortBy="code"
                portalContainer={null}
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              <span>Geçerlilik başlangıcı *</span>
              <AppDateInput value={effectiveFrom} onChange={(event) => { setEffectiveFrom(event.target.value); resetValidation(); }} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">1. Müşteriye özel şablonu indirin</h3>
              <p className="mt-1 text-sm text-slate-500">Mevcut matrisler ve canlı bölüm/görev/stok referansları dosyaya eklenir.</p>
              <button type="button" disabled={!customerId || Boolean(busy)} onClick={() => void download()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50 dark:text-emerald-300">
                {busy === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Basit şablonu indir
              </button>
            </section>
            <label className="rounded-xl border border-dashed p-4">
              <Upload className="mb-2 size-6 text-emerald-600" />
              <strong className="block">2. Doldurulan dosyayı seçin</strong>
              <span className="text-xs text-slate-500">Yalnızca .xlsx · en fazla 15 MB · 5.000 görev satırı</span>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm" />
              {file && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{file.name}</p>}
            </label>
          </div>

          {preview && (
            <section className={`space-y-3 rounded-xl border p-4 ${preview.canCommit ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'}`}>
              <div className={`flex items-center gap-2 font-semibold ${preview.canCommit ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                <FileCheck2 className="size-5" />{preview.canCommit ? 'Önizleme başarılı; dosya uygulanabilir.' : 'Hatalar düzeltilmeden dosya uygulanamaz.'}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cards.map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-3 dark:bg-slate-950"><span className="block text-xs text-slate-500">{label}</span><strong className="text-xl">{value}</strong></div>)}
              </div>
              <IssueList title="Hatalar" issues={preview.errors} tone="error" />
              <IssueList title="Uyarılar" issues={preview.warnings} tone="warning" />
            </section>
          )}

          {result && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="size-6" />
              <div><strong className="block">Aktarım tamamlandı</strong><span>{result.created} yeni, {result.updated} güncellenen; toplam {result.processed} matris işlendi.</span></div>
            </div>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" disabled={Boolean(busy)} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">Kapat</button>
          {!result && (preview?.canCommit ? (
            <button type="button" disabled={Boolean(busy)} onClick={() => void commit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
              {busy === 'commit' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Onayla ve uygula
            </button>
          ) : (
            <button type="button" disabled={!canValidate || Boolean(busy)} onClick={() => void validate()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
              {busy === 'preview' ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}Sunucuda önizle
            </button>
          ))}
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function Step({ number, title, active, complete }: { number: string; title: string; active: boolean; complete: boolean }) {
  return <li className={`flex items-center gap-3 rounded-xl border p-3 ${complete ? 'border-emerald-400' : active ? 'border-[var(--wms-brand-primary)]' : 'opacity-60'}`}><span className="grid size-7 place-items-center rounded-full border text-xs font-bold">{complete ? '✓' : number}</span><strong className="text-sm">{title}</strong></li>;
}

function IssueList({ title, issues, tone }: { title: string; issues: KkdSimpleMatrixWorkbookIssue[]; tone: 'error' | 'warning' }) {
  if (issues.length === 0) return null;
  return (
    <div className={`rounded-xl border bg-white p-3 text-sm dark:bg-slate-950 ${tone === 'error' ? 'border-red-300' : 'border-amber-300'}`}>
      <strong className={tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>{title} ({issues.length})</strong>
      <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {issues.map((issue, index) => <li key={`${issue.code}-${issue.row ?? 0}-${issue.cell ?? ''}-${index}`}>• {formatIssue(issue)}</li>)}
      </ul>
    </div>
  );
}

function formatIssue(issue: KkdSimpleMatrixWorkbookIssue): string {
  const location = [issue.sheet, issue.cell ?? (issue.row ? `${issue.row}. satır` : null)].filter(Boolean).join(' / ');
  return location ? `${location}: ${issue.message}` : issue.message;
}
