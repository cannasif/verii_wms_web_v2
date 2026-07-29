import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import {
  warehouseOpeningImportApi,
  type WarehouseOpeningImportResult,
  type WarehouseOpeningPreview,
} from '../api/warehouse-opening-import.api';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export function WarehouseOpeningImportDialog({
  open,
  branchCode,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  branchCode: string;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WarehouseOpeningPreview | null>(null);
  const [result, setResult] = useState<WarehouseOpeningImportResult | null>(null);
  const [busy, setBusy] = useState<'download' | 'preview' | 'commit' | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const selectFile = (selected: File | null) => {
    setPreview(null);
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Yalnızca .xlsx uzantılı Excel dosyaları yüklenebilir.');
      return setFile(null);
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('Excel dosyası en fazla 8 MB olabilir.');
      return setFile(null);
    }
    setFile(selected);
  };

  const download = async () => {
    setBusy('download');
    try {
      const blob = await warehouseOpeningImportApi.downloadTemplate(branchCode);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `wms-v2-depo-acilis-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('Tek dosyalı depo açılış şablonu indirildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Şablon indirilemedi.');
    } finally {
      setBusy(null);
    }
  };

  const validate = async () => {
    if (!file) return;
    setBusy('preview');
    try {
      const value = await warehouseOpeningImportApi.preview(file, branchCode);
      setPreview(value);
      setResult(null);
      toast.success('Dosya kayıt yapılmadan başarıyla doğrulandı.');
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : 'Ön doğrulama tamamlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!file || !preview) return;
    setBusy('commit');
    try {
      const value = await warehouseOpeningImportApi.commit(
        file,
        branchCode,
        preview.fileHash,
        idempotencyKey,
      );
      setResult(value);
      await onImported();
      toast.success('Raflar ve ilk stok/seri bakiyeleri birlikte kaydedildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Depo açılış aktarımı tamamlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const cards = preview ? [
    ['Depo', preview.warehouseCount],
    ['Yeni raf', preview.newLocationCount],
    ['Mevcut raf', preview.existingLocationCount],
    ['Bakiye satırı', preview.balanceRowCount],
    ['Stok', preview.distinctStockCount],
    ['Seri', preview.serialCount],
    ['Toplam miktar', preview.totalQuantity.toLocaleString('tr-TR')],
  ] : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Tek Excel ile Depo Açılışı</DialogTitle>
              <p className="text-sm text-slate-500">Raf hiyerarşisini ve ilk stok, lot ve seri bakiyelerini tek atomik işlemde oluşturun.</p>
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <strong className="block">Atomik aktarım</strong>
              <p>Aynı depo ve raf yüzlerce satırda tekrarlanabilir. Raf bir kez çözülür; her stok/seri satırı ayrı açılış hareketine dönüşür. Tek bir hatada hiçbir kayıt kalıcı olmaz.</p>
            </div>
          </div>

          <ol className="grid gap-3 md:grid-cols-3">
            <Step number="1" title="Şablon" active={!file} complete={Boolean(file)} />
            <Step number="2" title="Ön doğrulama" active={Boolean(file) && !preview} complete={Boolean(preview)} />
            <Step number="3" title="Onay ve kayıt" active={Boolean(preview) && !result} complete={Boolean(result)} />
          </ol>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">Güncel şablonu indirin</h3>
              <p className="mt-1 text-sm text-slate-500">Şablon aktif depo, raf, stok ve YAP referanslarını içerir.</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => void download()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--wms-brand-primary)] disabled:opacity-50">
                {busy === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Şablonu indir
              </button>
            </section>
            <label className="rounded-xl border border-dashed p-4">
              <Upload className="mb-2 size-6 text-[var(--wms-brand-primary)]" />
              <strong className="block">Doldurulan dosyayı seçin</strong>
              <span className="text-xs text-slate-500">En fazla 8 MB ve 2.000 satır</span>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm" />
              {file && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{file.name}</p>}
            </label>
          </div>

          {preview && (
            <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                <FileCheck2 className="size-5" />Ön doğrulama başarılı
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cards.map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border bg-white p-3 dark:bg-slate-950">
                    <span className="block text-xs text-slate-500">{label}</span>
                    <strong className="text-xl">{value}</strong>
                  </div>
                ))}
              </div>
              {preview.warnings.map((warning) => <p key={warning} className="text-sm text-amber-700 dark:text-amber-300">• {warning}</p>)}
            </section>
          )}

          {result && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="size-6" />
              <div><strong className="block">Aktarım tamamlandı</strong><span>{result.locations?.createdRows ?? 0} yeni raf ve {result.balances.totalRows} bakiye satırı işlendi.</span></div>
            </div>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" disabled={Boolean(busy)} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">Kapat</button>
          {!result && (
            preview ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void commit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy === 'commit' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Aktarımı onayla
              </button>
            ) : (
              <button type="button" disabled={!file || Boolean(busy)} onClick={() => void validate()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy === 'preview' ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                Ön doğrula
              </button>
            )
          )}
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function Step({ number, title, active, complete }: { number: string; title: string; active: boolean; complete: boolean }) {
  return <li className={`flex items-center gap-3 rounded-xl border p-3 ${complete ? 'border-emerald-400' : active ? 'border-[var(--wms-brand-primary)]' : 'opacity-60'}`}><span className="grid size-7 place-items-center rounded-full border text-xs font-bold">{complete ? '✓' : number}</span><strong className="text-sm">{title}</strong></li>;
}
