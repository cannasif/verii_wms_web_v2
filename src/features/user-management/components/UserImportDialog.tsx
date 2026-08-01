import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { userManagementApi } from '../api/user-management.api';
import type { UserImportResult, UserImportRowStatus } from '../types/user-management.types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface UserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}

export function UserImportDialog({ open, onOpenChange, onImported }: UserImportDialogProps) {
  const { t } = useModuleTranslation('user-management');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UserImportResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const selectFile = (selected: File | null) => {
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error(t('import.errors.invalidExtension'));
      if (inputRef.current) inputRef.current.value = '';
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error(t('import.errors.fileTooLarge'));
      if (inputRef.current) inputRef.current.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const importResult = await userManagementApi.importUsers(file);
      setResult(importResult);
      if (importResult.createdCount > 0) await onImported();
      if (importResult.failedCount > 0) {
        toast.warning(t('import.toast.createdWithFailures', { created: importResult.createdCount, failed: importResult.failedCount }));
      } else {
        toast.success(t('import.toast.createdSuccess', { created: importResult.createdCount }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('import.errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const blob = await userManagementApi.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'wms-kullanici-aktarim-sablonu.xlsx';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(t('import.toast.templateDownloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('import.errors.templateDownloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!uploading) onOpenChange(nextOpen); }}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{t('import.title')}</DialogTitle>
              <p className="text-sm text-slate-500">{t('import.description')}</p>
            </div>
          </div>
        </OpsDialogHeader>

        <OpsDialogBody className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <strong className="block">{t('import.warningTitle')}</strong>
                <p>{t('import.warningText')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
            <section className="rounded-xl border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{t('import.step1Title')}</h3>
                  <p className="text-sm text-slate-500">{t('import.step1Description')}</p>
                </div>
                <OpsActionButton
                  type="button"
                  variant="secondary"
                  disabled={downloading}
                  onClick={() => void downloadTemplate()}
                >
                  {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                  {downloading ? t('import.downloadPreparing') : t('import.downloadButton')}
                </OpsActionButton>
              </div>

              <label className="block rounded-xl border border-dashed p-6 text-center transition hover:border-[var(--wms-brand-primary)]">
                <Upload className="mx-auto mb-2 size-7 text-[var(--wms-brand-primary)]" />
                <strong className="block text-sm">{t('import.step2Title')}</strong>
                <span className="mt-1 block text-xs text-slate-500">{t('import.step2Limit')}</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="mt-4 block w-full text-sm"
                  disabled={uploading}
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">
                  <strong>{file.name}</strong>
                  <span className="ml-2 text-slate-500">{t('import.fileSizeKb', { size: (file.size / 1024).toFixed(1) })}</span>
                </div>
              )}
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">{t('import.multiGroupTitle')}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t('import.multiGroupDescriptionPrefix')}
                <strong> {t('import.multiGroupDescriptionBold')}</strong> {t('import.multiGroupDescriptionSuffix')}
              </p>
              <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900">
                {t('import.multiGroupHintPrefix')}
                <strong> {t('import.multiGroupHintBold')}</strong> {t('import.multiGroupHintSuffix')}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t('import.groupsSheetNote')}
              </p>
            </section>
          </div>

          {result && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ResultCard label={t('import.summary.total')} value={result.totalRows} tone="neutral" />
                <ResultCard label={t('import.summary.created')} value={result.createdCount} tone="created" />
                <ResultCard label={t('import.summary.skipped')} value={result.skippedCount} tone="skipped" />
                <ResultCard label={t('import.summary.failed')} value={result.failedCount} tone="failed" />
              </div>
              <div className="max-h-64 overflow-auto rounded-xl border">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2">{t('import.table.row')}</th>
                      <th className="px-3 py-2">{t('import.table.status')}</th>
                      <th className="px-3 py-2">{t('import.table.username')}</th>
                      <th className="px-3 py-2">{t('import.table.email')}</th>
                      <th className="px-3 py-2">{t('import.table.message')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.username ?? ''}`} className="border-t">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2"><Status status={row.status} t={t} /></td>
                        <td className="px-3 py-2">{row.username || '-'}</td>
                        <td className="px-3 py-2">{row.email || '-'}</td>
                        <td className="px-3 py-2">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </OpsDialogBody>

        <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
          <OpsActionButton type="button" variant="secondary" disabled={uploading} onClick={() => onOpenChange(false)}>
            {t('import.closeButton')}
          </OpsActionButton>
          <OpsActionButton type="button" variant="primary" disabled={!file || uploading} onClick={() => void upload()}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {uploading ? t('import.creatingButton') : t('import.createUsersButton')}
          </OpsActionButton>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function ResultCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'created' | 'skipped' | 'failed' }) {
  const toneClass = {
    neutral: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
    created: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    skipped: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    failed: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
  }[tone];
  return <div className={`rounded-xl border p-3 ${toneClass}`}><span className="block text-xs text-slate-500">{label}</span><strong className="text-xl">{value}</strong></div>;
}

function Status({ status, t }: { status: UserImportRowStatus; t: (key: string) => string }) {
  if (status === 'Created') return <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-4" /> {t('import.status.created')}</span>;
  if (status === 'Skipped') return <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="size-4" /> {t('import.status.skipped')}</span>;
  return <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="size-4" /> {t('import.status.failed')}</span>;
}
