import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, ScanBarcode, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { formatProjectNumber } from '@/lib/project-format';
import {
  warehouseBarcodeApi,
  type ResolvedWarehouseBarcode,
  type WarehouseBarcodePurpose,
} from './barcode-resolution.api';

interface Props {
  branchCode: string;
  purpose: WarehouseBarcodePurpose;
  warehouseId?: number | null;
  expectedStockId?: number | null;
  disabled?: boolean;
  title?: string;
  description?: string;
  onResolved: (value: ResolvedWarehouseBarcode) => void;
}

export function WarehouseBarcodeScanner({
  branchCode,
  purpose,
  warehouseId,
  expectedStockId,
  disabled,
  title = 'Barkod okut',
  description = 'Ürün etiketini, GS1 barkodunu veya seri barkodunu okutun.',
  onResolved,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<ResolvedWarehouseBarcode>();

  const resolve = async () => {
    const value = barcode.trim();
    if (!value) return toast.error('Okutulacak barkod zorunludur.');
    setBusy(true);
    try {
      const result = await warehouseBarcodeApi.resolve({
        barcode: value,
        branchCode,
        purpose,
        warehouseId,
        expectedStockId,
      });
      setResolved(result);
      onResolved(result);
      setBarcode('');
      toast.success(`${result.stockCode} barkodu çözümlendi.`);
    } catch (error) {
      setResolved(undefined);
      toast.error(error instanceof Error ? error.message : 'Barkod çözümlenemedi.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500">
            <ScanBarcode className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-black">{title}</h3>
            <p className="text-xs leading-5 text-slate-500">{description}</p>
            <input
              ref={inputRef}
              autoFocus
              className="input mt-3 w-full font-mono text-base"
              value={barcode}
              disabled={disabled || busy}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void resolve();
                }
              }}
              placeholder="Barkodu okutun veya yapıştırın ve Enter’a basın"
              aria-label="Depo barkodu"
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={disabled || busy || !barcode.trim()}
          onClick={() => void resolve()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ScanBarcode className="size-5" />}
          Çözümle
        </button>
      </div>

      {resolved && (
        <div className="mt-4 grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 md:grid-cols-2 xl:grid-cols-4">
          <Result label="Stok" value={`${resolved.stockCode} · ${resolved.stockName}`} />
          <Result label="Seri / Lot" value={`${resolved.serialNo || '—'} / ${resolved.lotNo || '—'}`} />
          <Result
            label="Miktar"
            value={resolved.quantity != null
              ? `${formatProjectNumber(resolved.quantity)} ${resolved.unitCode}`
              : 'Barkodda miktar yok'}
          />
          <Result label="Kaynak" value={sourceLabel(resolved.source)} />
          <div className="md:col-span-2 xl:col-span-4">
            {resolved.missingFields.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                <CheckCircle2 className="size-4" /> Barkod operasyon için gerekli takip bilgilerini sağlıyor.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-500">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                Eksik veya seçilmesi gereken alanlar: {resolved.missingFields.join(', ')}
              </p>
            )}
          </div>
          {resolved.balanceCandidates.length > 0 && (
            <div className="md:col-span-2 xl:col-span-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Uygun mevcut stok boyutları
              </p>
              <div className="flex flex-wrap gap-2">
                {resolved.balanceCandidates.slice(0, 8).map((candidate) => (
                  <span key={candidate.balanceId} className="rounded-lg border px-3 py-2 text-xs">
                    <strong>{candidate.locationCode}</strong>
                    {' · '}
                    {candidate.serialNo || candidate.lotNo || 'Takipsiz'}
                    {' · '}
                    {formatProjectNumber(candidate.availableQuantity)} {candidate.unitCode}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </div>
  );
}

function sourceLabel(value: string) {
  return ({
    GoodsReceiptLabel: 'Mal kabul etiketi',
    WarehouseInboundLabel: 'Ambar giriş etiketi',
    GeneratedBarcode: 'Sistem etiketi',
    GS1: 'GS1 barkodu',
    SerialBalance: 'Mevcut seri bakiyesi',
    StockAlias: 'Stok barkod alanı',
  } as Record<string, string>)[value] ?? value;
}
