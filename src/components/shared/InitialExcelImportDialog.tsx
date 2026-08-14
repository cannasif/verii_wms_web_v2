import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';

export function InitialExcelImportDialog<T>({
  open,
  title,
  description,
  warning,
  templateFileName,
  limitText,
  submitLabel,
  onOpenChange,
  downloadTemplate,
  importFile,
  summarize,
  onImported,
  maxFileSizeMb = 5,
  warningTitle,
  downloadStepDescription,
}: {
  open: boolean;
  title: string;
  description: string;
  warning: string;
  templateFileName: string;
  limitText: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  downloadTemplate: () => Promise<Blob>;
  importFile: (file: File, idempotencyKey: string) => Promise<T>;
  summarize: (result: T) => Array<{ label: string; value: string | number }>;
  onImported: () => Promise<void>;
  maxFileSizeMb?: number;
  warningTitle?: string;
  downloadStepDescription?: string;
}) {
  const { t } = useTranslation('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const maxFileSize = maxFileSizeMb * 1024 * 1024;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    setIdempotencyKey(crypto.randomUUID());
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const selectFile = (selected: File | null) => {
    setResult(null);
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error(t('initialExcelImport.errors.invalidExtension'));
      return setFile(null);
    }
    if (selected.size > maxFileSize) {
      toast.error(maxFileSizeMb === 5 ? t('initialExcelImport.errors.tooLarge') : limitText);
      return setFile(null);
    }
    setFile(selected);
  };

  const download = async () => {
    setBusy('download');
    try {
      const blob = await downloadTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = templateFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(t('initialExcelImport.success.templateDownloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('initialExcelImport.errors.templateDownloadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy('upload');
    try {
      const imported = await importFile(file, idempotencyKey);
      setResult(imported);
      await onImported();
      toast.success(t('initialExcelImport.success.imported'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('initialExcelImport.errors.importFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white"><FileSpreadsheet className="size-5" /></div>
            <div><DialogTitle className="text-xl font-bold">{title}</DialogTitle><p className="text-sm text-slate-500">{description}</p></div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div><strong className="block">{warningTitle ?? t('initialExcelImport.securityRuleTitle')}</strong><p>{warning}</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">{t('initialExcelImport.downloadStepTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">{downloadStepDescription ?? t('initialExcelImport.downloadStepDescription')}</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => void download()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--wms-brand-primary)] disabled:opacity-50">
                {busy === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{t('initialExcelImport.downloadTemplate')}
              </button>
            </section>
            <label className="rounded-xl border border-dashed p-4">
              <Upload className="mb-2 size-6 text-[var(--wms-brand-primary)]" />
              <strong className="block">{t('initialExcelImport.selectFileStepTitle')}</strong>
              <span className="text-xs text-slate-500">{limitText}</span>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm" />
              {file && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{file.name}</p>}
            </label>
          </div>
          {result && <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">{summarize(result).map((item) => <div key={item.label} className="rounded-xl border p-3"><span className="block text-xs text-slate-500">{item.label}</span><strong className="text-xl">{item.value}</strong></div>)}</section>}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" disabled={Boolean(busy)} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">{t('initialExcelImport.close')}</button>
          <button type="button" disabled={!file || Boolean(busy)} onClick={() => void upload()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            {busy === 'upload' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{submitLabel}
          </button>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}
