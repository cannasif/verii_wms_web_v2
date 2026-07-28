import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { userManagementApi } from '../api/user-management.api';
import type { UserImportResult, UserImportRowStatus } from '../types/user-management.types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface UserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}

export function UserImportDialog({ open, onOpenChange, onImported }: UserImportDialogProps) {
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
      toast.error('Yalnızca .xlsx uzantılı Excel dosyaları yüklenebilir.');
      if (inputRef.current) inputRef.current.value = '';
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('Excel dosyası en fazla 5 MB olabilir.');
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
        toast.warning(`${importResult.createdCount} kullanıcı oluşturuldu; ${importResult.failedCount} satır başarısız.`);
      } else {
        toast.success(`${importResult.createdCount} yeni kullanıcı oluşturuldu.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Excel dosyası yüklenemedi.');
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
      toast.success('Güncel yetki gruplarıyla Excel şablonu indirildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Excel şablonu indirilemedi.');
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
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">Excel ile Kullanıcı Ekle</DialogTitle>
              <p className="text-sm text-slate-500">Onaylı şablonu yükleyerek toplu yeni kullanıcı kaydı oluşturun.</p>
            </div>
          </div>
        </OpsDialogHeader>

        <OpsDialogBody className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <strong className="block">Yalnızca yeni kayıt oluşturulur</strong>
                <p>Mevcut kullanıcılar güncellenmez, pasife alınmaz veya silinmez. Kullanıcı adı ya da e-posta zaten mevcutsa ilgili satır değiştirilmeden atlanır.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
            <section className="rounded-xl border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">1. Şablonu hazırlayın</h3>
                  <p className="text-sm text-slate-500">Başlıkları ve sıralamayı değiştirmeden “Kullanıcılar” sayfasını doldurun.</p>
                </div>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void downloadTemplate()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--wms-brand-primary)] disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {downloading ? 'Hazırlanıyor…' : 'Güncel Excel Şablonunu İndir'}
                </button>
              </div>

              <label className="block rounded-xl border border-dashed p-6 text-center transition hover:border-[var(--wms-brand-primary)]">
                <Upload className="mx-auto mb-2 size-7 text-[var(--wms-brand-primary)]" />
                <strong className="block text-sm">2. Doldurulan .xlsx dosyasını seçin</strong>
                <span className="mt-1 block text-xs text-slate-500">En fazla 5 MB ve 500 veri satırı</span>
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
                  <span className="ml-2 text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">Çoklu yetki grubu seçimi</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Şablon indirilirken o anda aktif olan yetki grupları API’den okunur ve her biri ayrı bir
                <strong> true / false</strong> açılır seçim kolonu olarak eklenir.
              </p>
              <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900">
                Aynı kullanıcıyı birden fazla gruba atamak için ilgili grup kolonlarının her birinde
                <strong> true</strong> seçin. Seçilmeyenleri boş veya false bırakabilirsiniz.
              </div>
              <p className="mt-3 text-xs text-slate-500">
                “Yetki Grupları” sayfası indirme anındaki aktif grupların ID, ad ve açıklamalarını da içerir.
              </p>
            </section>
          </div>

          {result && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ResultCard label="Toplam" value={result.totalRows} tone="neutral" />
                <ResultCard label="Oluşturuldu" value={result.createdCount} tone="created" />
                <ResultCard label="Atlandı" value={result.skippedCount} tone="skipped" />
                <ResultCard label="Başarısız" value={result.failedCount} tone="failed" />
              </div>
              <div className="max-h-64 overflow-auto rounded-xl border">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2">Satır</th>
                      <th className="px-3 py-2">Durum</th>
                      <th className="px-3 py-2">Kullanıcı</th>
                      <th className="px-3 py-2">E-posta</th>
                      <th className="px-3 py-2">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.username ?? ''}`} className="border-t">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2"><Status status={row.status} /></td>
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

        <OpsDialogFooter>
          <button type="button" disabled={uploading} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">Kapat</button>
          <button type="button" disabled={!file || uploading} onClick={() => void upload()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? 'Aktarılıyor…' : 'Yeni Kullanıcıları Oluştur'}
          </button>
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

function Status({ status }: { status: UserImportRowStatus }) {
  if (status === 'Created') return <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-4" /> Oluşturuldu</span>;
  if (status === 'Skipped') return <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="size-4" /> Atlandı</span>;
  return <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="size-4" /> Başarısız</span>;
}
