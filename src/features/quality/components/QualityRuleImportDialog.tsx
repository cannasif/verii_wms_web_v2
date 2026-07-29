import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from "@/components/shared/OpsDialogShell";
import {
  qualityApi,
  type QualityRuleImportResult,
  type QualityRuleImportRow,
} from "../api/quality.api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function QualityRuleImportDialog({
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
  const [result, setResult] = useState<QualityRuleImportResult | null>(null);
  const [busy, setBusy] = useState<"download" | "upload" | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [open]);

  const selectFile = (selected: File | null) => {
    setResult(null);
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Yalnızca .xlsx uzantılı Excel dosyaları yüklenebilir.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("Excel dosyası en fazla 5 MB olabilir.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const download = async () => {
    setBusy("download");
    try {
      const blob = await qualityApi.downloadRuleImportTemplate(branchCode);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "wms-kalite-kurallari-aktarim-sablonu.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("Güncel stok gruplarıyla Excel şablonu indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Şablon indirilemedi.");
    } finally {
      setBusy(null);
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy("upload");
    try {
      const imported = await qualityApi.importRules(file, branchCode);
      setResult(imported);
      if (imported.createdCount > 0) await onImported();
      const message = `${imported.createdCount} kural oluşturuldu; ${imported.skippedCount} atlandı, ${imported.failedCount} başarısız.`;
      if (imported.failedCount > 0) toast.warning(message);
      else toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel dosyası aktarılamadı.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Excel ile Kalite Kuralı Ekle</DialogTitle>
              <p className="text-sm text-slate-500">Stok ve stok grubu kurallarını kontrollü biçimde toplu oluşturun.</p>
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <strong className="block">Mevcut kurallar değiştirilmez</strong>
              <p>Aynı stok veya stok grubu için aktif kural varsa satır atlanır. Güncelleme ve pasife alma işlemleri kalite kuralları ekranından yapılır.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">1. Güncel şablonu indirin</h3>
              <p className="mt-1 text-sm text-slate-500">Şablondaki “Stok Grupları” sayfası seçili şubenin güncel ve tekil grup kodlarını içerir.</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => void download()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--wms-brand-primary)] disabled:opacity-50">
                {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Şablonu indir
              </button>
            </section>
            <label className="rounded-xl border border-dashed p-4">
              <Upload className="mb-2 size-6 text-[var(--wms-brand-primary)]" />
              <strong className="block">2. Doldurulan dosyayı seçin</strong>
              <span className="text-xs text-slate-500">En fazla 5 MB ve 1.000 veri satırı</span>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm" />
              {file && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{file.name}</p>}
            </label>
          </div>
          {result && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ResultCard label="Toplam" value={result.totalRows} />
                <ResultCard label="Oluşturuldu" value={result.createdCount} />
                <ResultCard label="Atlandı" value={result.skippedCount} />
                <ResultCard label="Başarısız" value={result.failedCount} />
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900"><tr><th className="p-2">Satır</th><th className="p-2">Durum</th><th className="p-2">Kapsam</th><th className="p-2">Kod</th><th className="p-2">Açıklama</th></tr></thead>
                  <tbody>{result.rows.map((row) => <ResultRow key={row.rowNumber} row={row} />)}</tbody>
                </table>
              </div>
            </section>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button type="button" disabled={Boolean(busy)} onClick={() => onOpenChange(false)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">Kapat</button>
          <button type="button" disabled={!file || Boolean(busy)} onClick={() => void upload()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Kuralları oluştur
          </button>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border p-3"><span className="block text-xs text-slate-500">{label}</span><strong className="text-xl">{value}</strong></div>;
}

function ResultRow({ row }: { row: QualityRuleImportRow }) {
  const icon = row.status === "Created"
    ? <CheckCircle2 className="size-4 text-emerald-600" />
    : row.status === "Skipped"
      ? <AlertTriangle className="size-4 text-amber-600" />
      : <XCircle className="size-4 text-red-600" />;
  return <tr className="border-t"><td className="p-2">{row.rowNumber}</td><td className="p-2"><span className="inline-flex items-center gap-1">{icon}{row.status}</span></td><td className="p-2">{row.scopeType}</td><td className="p-2">{row.scopeCode || "-"}</td><td className="p-2">{row.message}</td></tr>;
}
