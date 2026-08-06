import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Barcode, CheckCircle2, ClipboardCheck, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { formatProjectNumber } from '@/lib/project-format';
import { localizeEnumValue } from '@/lib/enum-localization';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { productionTransferApi, type ProductionTransferExecution } from '../api';

export function ProductionTransferExecutionPage() {
  const id = Number(useParams().id);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { can } = usePermissionAccess();
  const [execution, setExecution] = useState<ProductionTransferExecution>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [activeLineId, setActiveLineId] = useState<number>();
  const [barcode, setBarcode] = useState('');
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [partialReason, setPartialReason] = useState('');
  const [shortageConfirmed, setShortageConfirmed] = useState(false);
  const [shortageReason, setShortageReason] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await productionTransferApi.execution(id);
      setExecution(result);
      setLoadError(undefined);
      setActiveLineId((current) => {
        if (current && result.lines.some((line) => line.lineId === current && line.remainingToPickQuantity > 0)) return current;
        return result.lines.find((line) => line.remainingToPickQuantity > 0)?.lineId;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Üretim transferi açılamadı.');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (execution?.workflowStatus === 'Picking' || execution?.workflowStatus === 'Planned') barcodeRef.current?.focus(); }, [execution?.workflowStatus, activeLineId]);

  const activeLine = execution?.lines.find((line) => line.lineId === activeLineId);
  const hasShortage = (execution?.shortageQuantity ?? 0) > 0;
  const canConfirmRequester = !execution?.requestedByUserId
    || execution.requestedByUserId === currentUserId
    || can('WMS.PRODUCTION_TRANSFER.APPROVE');
  const progress = useMemo(() => !execution?.requestedQuantity ? 0
    : Math.min(100, Math.round(execution.pickedQuantity * 100 / execution.requestedQuantity)), [execution]);

  const scan = async () => {
    if (!activeLine || !barcode.trim()) return;
    setBusy(true);
    try {
      const result = await productionTransferApi.scanPick(id, activeLine.lineId, barcode);
      setExecution(result.execution);
      setBarcode('');
      const next = result.execution.lines.find((line) => line.remainingToPickQuantity > 0)?.lineId;
      setActiveLineId(next);
      toast.success(`${result.stockCode}: ${formatProjectNumber(result.acceptedQuantity)} birim doğrulandı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Barkod doğrulanamadı.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  };

  const completePicking = async () => {
    if (!execution) return;
    setBusy(true);
    try {
      const result = await productionTransferApi.completePicking(id, hasShortage ? partialConfirmed : false, partialReason);
      setExecution(result);
      toast.success('Toplama tamamlandı. Malzeme teslim onayı bekliyor.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Toplama tamamlanamadı.');
    } finally { setBusy(false); }
  };

  const confirmHandover = async () => {
    if (!execution) return;
    setBusy(true);
    try {
      const result = await productionTransferApi.confirmHandover(id, hasShortage ? shortageConfirmed : false, shortageReason);
      setExecution(result);
      toast.success(result.residualDocumentNo
        ? `Teslim tamamlandı. Kalan miktar için ${result.residualDocumentNo} oluşturuldu.`
        : 'Üretim transferi teslim edildi ve tamamlandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfer teslimi onaylanamadı.');
    } finally { setBusy(false); }
  };

  if (loadError) return <section className="wms-ops-form-card p-5"><p className="font-bold text-red-500">{loadError}</p><button className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--wms-brand-primary)]" onClick={() => void load()}><RefreshCw className="size-4" />Tekrar dene</button></section>;
  if (!execution) return <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>;

  const pickingStage = execution.workflowStatus === 'Planned' || execution.workflowStatus === 'Picking';
  const handoverStage = execution.workflowStatus === 'AwaitingHandover';
  const completed = execution.workflowStatus === 'Completed' || execution.workflowStatus === 'CompletedWithShortage';

  return <section className="space-y-5">
    <header className="wms-ops-form-card p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <Link to="/warehouse/production-transfers/list" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--wms-brand-primary)]"><ArrowLeft className="size-4" />Transfer kayıtlarına dön</Link>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--wms-app-text-muted)]">İki adımlı üretim transferi</p>
          <h1 className="mt-1 text-2xl font-black">{execution.documentNo}</h1>
          <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{execution.sourceWarehouseCode} · {execution.sourceWarehouseName} → {execution.targetWarehouseCode} · {execution.targetWarehouseName}</p>
        </div>
        <OpsStatusBadge tone={completed ? 'done' : handoverStage ? 'pending' : 'active'}>{localizeEnumValue(execution.workflowStatus)}</OpsStatusBadge>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Step active={pickingStage} done={!pickingStage} number="01" title="Barkodlu toplama" text="Her kalemi doğru barkodla doğrula ve bekleme rafına al." />
        <Step active={handoverStage} done={completed} number="02" title="Fiziksel teslim onayı" text="Talep sahibi malzemeyi alınca tam veya eksik teslimi onaylasın." />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Talep" value={execution.requestedQuantity} />
        <Metric label="Toplanan" value={execution.pickedQuantity} />
        <Metric label="Teslim edilen" value={execution.handedOverQuantity} />
        <Metric label="Eksik" value={execution.shortageQuantity} danger={hasShortage} />
        <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-3"><span className="text-xs text-[var(--wms-app-text-muted)]">Bekleme rafı</span><strong className="mt-1 block">{execution.waitingLocationCode ? `${execution.waitingLocationCode} · ${execution.waitingLocationName}` : 'Tanımlı değil'}</strong></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--wms-app-border)]"><span className="block h-full bg-[var(--wms-brand-primary)] transition-all" style={{ width: `${progress}%` }} /></div>
    </header>

    {pickingStage && <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.55fr)]">
      <div className="wms-ops-form-card p-5">
        <div className="mb-4 flex items-center gap-2"><ClipboardCheck className="size-5 text-[var(--wms-brand-primary)]" /><div><h2 className="font-black">Toplanacak kalemler</h2><p className="text-xs text-[var(--wms-app-text-muted)]">Okutacağınız kalemi seçin. Başka stoğa ait barkod API tarafından reddedilir.</p></div></div>
        <div className="space-y-2">{execution.lines.map((line) => {
          const done = line.remainingToPickQuantity <= 0;
          const active = line.lineId === activeLineId;
          return <button key={line.lineId} disabled={done || busy} onClick={() => setActiveLineId(line.lineId)} className={cn('flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition', active ? 'border-[var(--wms-brand-primary)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_9%,transparent)]' : 'border-[var(--wms-app-border)] bg-[var(--wms-app-surface)]', done && 'opacity-60')}>
            <span className="min-w-0"><strong>#{line.lineNo} · {line.stockCode}</strong><span className="block truncate text-xs text-[var(--wms-app-text-muted)]">{line.stockName || '—'} · {line.trackingType}</span></span>
            <span className="shrink-0 text-right text-sm"><strong>{formatProjectNumber(line.pickedQuantity)} / {formatProjectNumber(line.requestedQuantity)} {line.unitCode}</strong><span className="block text-xs text-[var(--wms-app-text-muted)]">Kalan {formatProjectNumber(line.remainingToPickQuantity)}</span></span>
          </button>;
        })}</div>
      </div>

      <aside className="space-y-4">
        <div className="wms-ops-form-card p-5">
          <div className="flex items-center gap-2"><Barcode className="size-5 text-[var(--wms-brand-primary)]" /><h2 className="font-black">Barkod doğrulama</h2></div>
          {activeLine ? <>
            <div className="mt-4 rounded-xl bg-[var(--wms-app-surface)] p-4"><span className="text-xs text-[var(--wms-app-text-muted)]">Şimdi beklenen stok</span><strong className="mt-1 block text-lg">{activeLine.stockCode}</strong><span className="text-sm">{activeLine.stockName}</span></div>
            <label className="mt-4 block text-xs font-bold">Barkod / seri / etiket</label>
            <div className="mt-1 flex gap-2"><input ref={barcodeRef} className="input min-w-0 flex-1" value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void scan(); } }} placeholder="Barkodu okutun" autoComplete="off" /><OpsActionButton variant="primary" loading={busy} disabled={!barcode.trim()} onClick={() => void scan()}><Barcode className="size-4" />Onayla</OpsActionButton></div>
            <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">Doğru barkod stok hareketini tek transaction içinde kaynak raftan {execution.waitingLocationCode || 'bekleme rafına'} taşır.</p>
          </> : <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-600"><CheckCircle2 className="mb-2 size-5" />Açık toplama kalemi kalmadı.</div>}
        </div>
        {execution.canCompletePicking && <div className="wms-ops-form-card p-5">
          <h2 className="font-black">Toplamayı bitir</h2>
          {hasShortage && <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3"><p className="flex items-center gap-2 text-sm font-bold text-amber-600"><AlertTriangle className="size-4" />{formatProjectNumber(execution.shortageQuantity)} birim henüz toplanmadı.</p><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={partialConfirmed} onChange={(event) => setPartialConfirmed(event.target.checked)} className="mt-1" />Eksik toplamayı bilinçli olarak teslim aşamasına taşıyorum.</label><textarea className="input mt-3 min-h-20 w-full" value={partialReason} onChange={(event) => setPartialReason(event.target.value)} placeholder="Eksik toplama nedeni" /></div>}
          <OpsActionButton className="mt-4 w-full justify-center" variant="primary" loading={busy} disabled={hasShortage && (!partialConfirmed || partialReason.trim().length < 5)} onClick={() => void completePicking()}><PackageCheck className="size-4" />Toplamayı bitir ve teslim beklemeye al</OpsActionButton>
        </div>}
      </aside>
    </section>}

    {handoverStage && <section className="wms-ops-form-card p-5">
      <div className="flex items-start gap-3"><PackageCheck className="mt-1 size-6 text-[var(--wms-brand-primary)]" /><div><h2 className="text-xl font-black">Talep sahibi teslim onayı</h2><p className="text-sm text-[var(--wms-app-text-muted)]">Malzemeler {execution.waitingLocationCode} · {execution.waitingLocationName} rafında bekliyor. Fiziksel teslim gerçekleşmeden onaylamayın.</p></div></div>
      <div className="mt-4 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-4"><span className="text-xs text-[var(--wms-app-text-muted)]">Teslim alacak kişi</span><strong className="mt-1 block">{execution.requestedByName || (execution.requestedByUserId ? `Kullanıcı #${execution.requestedByUserId}` : 'Emri oluşturan kullanıcı')}</strong></div>
      <LineSummary execution={execution} />
      {!canConfirmRequester && <div className="mt-5 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm font-bold text-red-600">Bu teslimi yalnızca emri isteyen kişi onaylayabilir. Yönetici müdahalesi için üretim transferi onay yetkisi gerekir.</div>}
      {hasShortage && <div className="mt-5 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4"><h3 className="flex items-center gap-2 font-black text-amber-600"><AlertTriangle className="size-5" />Eksik transfer uyarısı</h3><p className="mt-1 text-sm">Talep {formatProjectNumber(execution.requestedQuantity)}, teslim edilecek {formatProjectNumber(execution.pickedQuantity)}, eksik {formatProjectNumber(execution.shortageQuantity)}. Onaydan sonra mevcut transfer eksik tamamlanır ve yalnız kalan miktarlar için yeni iş emri oluşturulur.</p><label className="mt-4 flex items-start gap-2 text-sm font-bold"><input type="checkbox" className="mt-1" checked={shortageConfirmed} onChange={(event) => setShortageConfirmed(event.target.checked)} />Eksik transferi ve yeni kalan iş emri oluşturulmasını onaylıyorum.</label><textarea className="input mt-3 min-h-24 w-full" value={shortageReason} onChange={(event) => setShortageReason(event.target.value)} placeholder="Eksik teslim nedeni (en az 5 karakter)" /></div>}
      <div className="mt-5 flex justify-end"><OpsActionButton variant="primary" loading={busy} disabled={!canConfirmRequester || (hasShortage && (!shortageConfirmed || shortageReason.trim().length < 5))} onClick={() => void confirmHandover()}><CheckCircle2 className="size-4" />Transferi onayla</OpsActionButton></div>
    </section>}

    {completed && <section className="wms-ops-form-card border-emerald-500/40 p-5">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-1 size-7 text-emerald-500" /><div><h2 className="text-xl font-black">Transfer tamamlandı</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{execution.handoverConfirmedAtUtc ? new Date(execution.handoverConfirmedAtUtc).toLocaleString('tr-TR') : ''} tarihinde fiziksel teslim onaylandı.</p></div></div>
      <LineSummary execution={execution} />
      {execution.residualTransferId && <div className="mt-5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4"><strong>Kalan iş emri oluşturuldu</strong><p className="mt-1 text-sm">Eksik miktarlar yeni belgeye taşındı; tamamlanan transfer tekrar açılamaz.</p><Link className="mt-3 inline-flex items-center gap-2 font-bold text-[var(--wms-brand-primary)]" to={`/warehouse/production-transfers/${execution.residualTransferId}/operations`}>{execution.residualDocumentNo || `#${execution.residualTransferId}`} iş emrine git</Link></div>}
    </section>}
  </section>;
}

function Step({ active, done, number, title, text }: { active: boolean; done: boolean; number: string; title: string; text: string }) { return <div className={cn('rounded-xl border p-4', active ? 'border-[var(--wms-brand-primary)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)]' : 'border-[var(--wms-app-border)]', done && 'border-emerald-500/40')}><div className="flex items-center gap-3"><span className={cn('grid size-9 place-items-center rounded-full text-xs font-black', done ? 'bg-emerald-500 text-white' : 'bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)]')}>{done ? <CheckCircle2 className="size-5" /> : number}</span><span><strong className="block">{title}</strong><span className="text-xs text-[var(--wms-app-text-muted)]">{text}</span></span></div></div>; }
function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) { return <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-3"><span className="text-xs text-[var(--wms-app-text-muted)]">{label}</span><strong className={cn('mt-1 block text-lg', danger && 'text-amber-600')}>{formatProjectNumber(value)}</strong></div>; }
function LineSummary({ execution }: { execution: ProductionTransferExecution }) { return <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full min-w-[680px] text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">Stok</th><th className="p-3 text-right">Talep</th><th className="p-3 text-right">Toplanan/Teslim</th><th className="p-3 text-right">Eksik</th></tr></thead><tbody>{execution.lines.map((line) => <tr key={line.lineId} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{line.stockCode}</strong><span className="block text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span></td><td className="p-3 text-right">{formatProjectNumber(line.requestedQuantity)} {line.unitCode}</td><td className="p-3 text-right text-emerald-600">{formatProjectNumber(line.pickedQuantity)}</td><td className="p-3 text-right text-amber-600">{formatProjectNumber(line.shortageQuantity)}</td></tr>)}</tbody></table></div>; }
