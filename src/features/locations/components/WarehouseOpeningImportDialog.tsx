import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import {
  warehouseOpeningImportApi,
  type WarehouseOpeningImportResult,
  type WarehouseOpeningPreview,
} from '../api/warehouse-opening-import.api';

const MAX_FILE_SIZE = 64 * 1024 * 1024;

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
  const { t } = useModuleTranslation('locations');
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
      toast.error(t('warehouseOpening.errors.invalidExtension'));
      return setFile(null);
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error(t('warehouseOpening.errors.tooLarge'));
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
      toast.success(t('warehouseOpening.success.templateDownloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('warehouseOpening.errors.templateDownloadFailed'));
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
      toast.success(t('warehouseOpening.success.preValidated'));
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : t('warehouseOpening.errors.preValidationFailed'));
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
      toast.success(t('warehouseOpening.success.imported'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('warehouseOpening.errors.importFailed'));
    } finally {
      setBusy(null);
    }
  };

  const cards = preview ? [
    [t('warehouseOpening.cards.warehouse'), preview.warehouseCount],
    [t('warehouseOpening.cards.newShelf'), preview.newLocationCount],
    [t('warehouseOpening.cards.existingShelf'), preview.existingLocationCount],
    [t('warehouseOpening.cards.balanceRow'), preview.balanceRowCount],
    [t('warehouseOpening.cards.stock'), preview.distinctStockCount],
    [t('warehouseOpening.cards.serial'), preview.serialCount],
    [t('warehouseOpening.cards.totalQuantity'), preview.totalQuantity.toLocaleString('tr-TR')],
    [t('warehouseOpening.cards.batch'), preview.batchCount],
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
              <DialogTitle className="text-xl font-bold">{t('warehouseOpening.title')}</DialogTitle>
              <p className="text-sm text-slate-500">{t('warehouseOpening.description')}</p>
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <strong className="block">{t('warehouseOpening.atomicImportTitle')}</strong>
              <p>{t('warehouseOpening.atomicImportDescription')}</p>
            </div>
          </div>

          <ol className="grid gap-3 md:grid-cols-3">
            <Step number="1" title={t('warehouseOpening.steps.template')} active={!file} complete={Boolean(file)} />
            <Step number="2" title={t('warehouseOpening.steps.preValidation')} active={Boolean(file) && !preview} complete={Boolean(preview)} />
            <Step number="3" title={t('warehouseOpening.steps.confirmAndSave')} active={Boolean(preview) && !result} complete={Boolean(result)} />
          </ol>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">{t('warehouseOpening.downloadTemplateTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {t('warehouseOpening.downloadTemplateDescription')}
              </p>
              <button type="button" disabled={Boolean(busy)} onClick={() => void download()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--wms-brand-primary)] disabled:opacity-50">
                {busy === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {t('warehouseOpening.downloadTemplate')}
              </button>
            </section>
            <label className="rounded-xl border border-dashed p-4">
              <Upload className="mb-2 size-6 text-[var(--wms-brand-primary)]" />
              <strong className="block">{t('warehouseOpening.selectFileTitle')}</strong>
              <span className="text-xs text-slate-500">{t('warehouseOpening.selectFileLimit')}</span>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm" />
              {file && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{file.name}</p>}
            </label>
          </div>

          {preview && (
            <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                <FileCheck2 className="size-5" />{t('warehouseOpening.preValidationSuccess')}
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
              <div>
                <strong className="block">{t('warehouseOpening.importCompleteTitle')}</strong>
                <span>
                  {t('warehouseOpening.importCompleteSummary', {
                    created: result.locations?.createdRows ?? 0,
                    balances: result.balances.totalRows,
                  })}
                </span>
              </div>
            </div>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" disabled={Boolean(busy)} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">{t('warehouseOpening.close')}</button>
          {!result && (
            preview ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void commit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy === 'commit' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {t('warehouseOpening.confirmImport')}
              </button>
            ) : (
              <button type="button" disabled={!file || Boolean(busy)} onClick={() => void validate()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy === 'preview' ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                {t('warehouseOpening.preValidate')}
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
