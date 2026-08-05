import { useMemo, useState, type ReactElement } from 'react';
import { Barcode, Plus, ScanLine, Trash2, WandSparkles } from 'lucide-react';
import { AppDateInput } from '@/components/shared/AppInput';
import { cn } from '@/lib/utils';

export type TrackingMode = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';

export type TrackingPlanRow = {
  localId: string;
  quantity: number;
  lotNo?: string;
  serialNo?: string;
  handlingUnitNo?: string;
  manufacturingDate?: string;
  expirationDate?: string;
};

type Props = {
  mode: TrackingMode;
  quantity: number;
  value: TrackingPlanRow[];
  onChange: (value: TrackingPlanRow[]) => void;
  requireHandlingUnit?: boolean;
  showDates?: boolean;
  accent?: 'cyan' | 'violet';
  compact?: boolean;
};

export function TrackingPlanEditor({
  mode,
  quantity,
  value,
  onChange,
  requireHandlingUnit = false,
  showDates = false,
  accent = 'cyan',
  compact = false,
}: Props): ReactElement | null {
  const [barcode, setBarcode] = useState('');
  const [activeLot, setActiveLot] = useState('');
  const serialMode = mode === 'Serial' || mode === 'LotAndSerial';
  const lotMode = mode === 'Lot' || mode === 'LotAndSerial';
  const distributed = useMemo(() => value.reduce((sum, row) => sum + Number(row.quantity || 0), 0), [value]);
  const remaining = Math.max(0, Number(quantity || 0) - distributed);
  const duplicateSerials = useMemo(() => {
    const seen = new Set<string>(); const duplicates = new Set<string>();
    value.forEach((row) => { const key = row.serialNo?.trim().toLocaleUpperCase('tr-TR'); if (!key) return; if (seen.has(key)) duplicates.add(key); seen.add(key); });
    return duplicates;
  }, [value]);

  if (mode === 'None') return null;

  const add = (seed: Partial<TrackingPlanRow> = {}): void => {
    onChange([...value, {
      localId: crypto.randomUUID(),
      quantity: serialMode ? 1 : Math.max(remaining, 0.000001),
      lotNo: lotMode ? activeLot.trim() || undefined : undefined,
      ...seed,
    }]);
  };
  const scan = (): void => {
    const code = barcode.trim();
    if (!code) return;
    if (serialMode) {
      if (value.some((row) => row.serialNo?.trim().toLocaleUpperCase('tr-TR') === code.toLocaleUpperCase('tr-TR'))) return;
      add({ serialNo: code, lotNo: lotMode ? activeLot.trim() || undefined : undefined, quantity: 1 });
    } else {
      const existing = value.find((row) => row.lotNo?.trim().toLocaleUpperCase('tr-TR') === code.toLocaleUpperCase('tr-TR'));
      if (existing) {
        onChange(value.map((row) => row.localId === existing.localId ? { ...row, quantity: row.quantity + Math.max(remaining, 0) } : row));
      } else add({ lotNo: code, quantity: Math.max(remaining, 0.000001) });
    }
    setBarcode('');
  };
  const generateSerialRows = (): void => {
    if (!serialMode || !Number.isInteger(quantity) || quantity < 1 || quantity > 500) return;
    onChange(Array.from({ length: quantity }, (_, index) => value[index] ?? ({
      localId: crypto.randomUUID(), quantity: 1, lotNo: lotMode ? activeLot.trim() || undefined : undefined,
    })));
  };
  const patch = (id: string, next: Partial<TrackingPlanRow>): void => onChange(value.map((row) => row.localId === id ? { ...row, ...next } : row));

  return (
    <section className={cn('mt-4 rounded-xl border border-[var(--wms-app-border)] bg-black/[.018] dark:bg-white/[.018]', compact ? 'p-3' : 'p-4')}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-black"><ScanLine className={cn('size-4', accent === 'violet' ? 'text-violet-500' : 'text-cyan-500')}/>Seri / lot ve barkod planı</div>
          <p className="mt-1 text-xs text-slate-500">Okuyucu barkodu klavye gibi gönderir. Barkodu okutun veya yapıştırıp Enter’a basın.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto] xl:w-[34rem]">
          {lotMode && serialMode && <input className="input sm:col-span-2" value={activeLot} onChange={(event) => setActiveLot(event.target.value)} placeholder="Aktif lot — seri okutmalarına uygulanır"/>}
          <div className="relative">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"/>
            <input
              className="input !pl-10 font-mono"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); scan(); } }}
              placeholder={serialMode ? 'Seri barkodunu okutun' : 'Lot barkodunu okutun'}
              aria-label={serialMode ? 'Seri barkodu' : 'Lot barkodu'}
            />
          </div>
          <button type="button" onClick={scan} disabled={!barcode.trim() || (serialMode && remaining < 1)} className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-40', accent === 'violet' ? 'bg-violet-600' : 'bg-cyan-600')}><ScanLine className="size-4"/>Okut</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/[.035] px-3 py-2 text-xs dark:bg-white/[.04]">
        <span>Dağıtılan <strong>{distributed}</strong> / <strong>{quantity}</strong> · Kalan <strong className={remaining ? 'text-amber-500' : 'text-emerald-500'}>{remaining}</strong></span>
        <div className="flex flex-wrap gap-2">
          {serialMode && <button type="button" onClick={generateSerialRows} disabled={!Number.isInteger(quantity) || quantity < 1 || quantity > 500} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"><WandSparkles className="size-3.5"/>Miktardan seri satırı üret</button>}
          <button type="button" onClick={() => add()} disabled={remaining <= 0} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"><Plus className="size-3.5"/>Manuel satır</button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {value.map((row, index) => {
          const duplicate = Boolean(row.serialNo && duplicateSerials.has(row.serialNo.trim().toLocaleUpperCase('tr-TR')));
          return (
            <div key={row.localId} className={cn('grid gap-2 rounded-xl border p-2', duplicate ? 'border-red-500/60 bg-red-500/5' : 'border-[var(--wms-app-border)]', 'sm:grid-cols-2 xl:grid-cols-[3rem_7rem_minmax(9rem,1fr)_minmax(10rem,1fr)_minmax(9rem,1fr)_9rem_9rem_auto]')}>
              <span className="self-center text-center text-xs font-black text-slate-500">#{index + 1}</span>
              <input aria-label={`Takip ${index + 1} miktarı`} className="input" type="number" min="0.000001" step="0.000001" disabled={serialMode} value={row.quantity} onChange={(event) => patch(row.localId, { quantity: Number(event.target.value) })}/>
              {lotMode ? <input aria-label={`Takip ${index + 1} lotu`} className="input font-mono" value={row.lotNo ?? ''} onChange={(event) => patch(row.localId, { lotNo: event.target.value })} placeholder="Lot no"/> : <span className="hidden xl:block"/>}
              {serialMode ? <div><input aria-label={`Takip ${index + 1} serisi`} data-wms-error-target="serial" data-wms-error-keys={row.serialNo ?? ''} className={cn('input font-mono', duplicate && '!border-red-500')} value={row.serialNo ?? ''} onChange={(event) => patch(row.localId, { serialNo: event.target.value })} placeholder="Seri no"/>{duplicate && <span className="mt-1 block text-[.65rem] text-red-500">Tekrarlı seri</span>}</div> : <span className="hidden xl:block"/>}
              {requireHandlingUnit ? <input aria-label={`Takip ${index + 1} paleti`} className="input font-mono" value={row.handlingUnitNo ?? ''} onChange={(event) => patch(row.localId, { handlingUnitNo: event.target.value })} placeholder="Palet / kasa"/> : <span className="hidden xl:block"/>}
              {showDates ? <AppDateInput aria-label={`Takip ${index + 1} üretim tarihi`} value={row.manufacturingDate ?? ''} onChange={(event) => patch(row.localId, { manufacturingDate: event.target.value })}/> : <span className="hidden xl:block"/>}
              {showDates ? <AppDateInput aria-label={`Takip ${index + 1} son kullanma tarihi`} value={row.expirationDate ?? ''} onChange={(event) => patch(row.localId, { expirationDate: event.target.value })}/> : <span className="hidden xl:block"/>}
              <button type="button" aria-label={`Takip ${index + 1} satırını sil`} onClick={() => onChange(value.filter((item) => item.localId !== row.localId))} className="grid size-10 place-items-center justify-self-end rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 className="size-4"/></button>
            </div>
          );
        })}
        {!value.length && <p className="rounded-lg border border-dashed border-[var(--wms-app-border)] p-4 text-center text-xs text-slate-500">Henüz seri/lot satırı yok. Barkod okutun veya manuel satır ekleyin.</p>}
      </div>
    </section>
  );
}
