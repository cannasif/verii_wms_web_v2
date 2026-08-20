import { FileSpreadsheet, Layers3, Table2 } from 'lucide-react';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';

export function KkdImportTypeDialog({
  open,
  onOpenChange,
  onSimple,
  onDetailed,
  allowSimple,
  allowDetailed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSimple: () => void;
  onDetailed: () => void;
  allowSimple: boolean;
  allowDetailed: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OpsDialogContent size="lg">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">KKD Excel aktarım tipini seçin</DialogTitle>
              <p className="text-sm text-slate-500">İhtiyacınıza uygun şablonla devam edin.</p>
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={onSimple}
            disabled={!allowSimple}
            className="group rounded-2xl border-2 border-emerald-400 bg-emerald-50/60 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-950/20"
          >
            <span className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-600 text-white"><Table2 className="size-5" /></span>
            <span className="flex items-center gap-2 text-lg font-bold">Basit matris <small className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">Önerilen</small></span>
            <span className="mt-2 block text-sm leading-6 text-slate-600 dark:text-slate-300">
              Müşterinin kullandığı gibi bölüm ve görev satırları; KKD ürünleri ile dönemler kolonlarda. Önizleme yapar, hatalı satır varsa hiçbir kayıt değiştirmez.
            </span>
          </button>
          <button
            type="button"
            onClick={onDetailed}
            disabled={!allowDetailed}
            className="group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mb-4 grid size-11 place-items-center rounded-xl bg-slate-700 text-white"><Layers3 className="size-5" /></span>
            <span className="text-lg font-bold">Detaylı tanım çalışma kitabı</span>
            <span className="mt-2 block text-sm leading-6 text-slate-600 dark:text-slate-300">
              Departman, rol, personel, matris, kural ve dönem sayfalarının tamamını yönetir. İleri seviye toplu bakım içindir.
            </span>
          </button>
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5">Vazgeç</button>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}
