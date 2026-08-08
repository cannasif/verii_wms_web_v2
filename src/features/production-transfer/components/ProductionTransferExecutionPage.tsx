import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { productionTransferApi, type ProductionTransferExecution } from '../api';
import { ProductionTransferPickingSection } from './ProductionTransferPickingSection';
import { ProductionTransferReturnSection } from './ProductionTransferReturnSection';

export function ProductionTransferExecutionPage() {
  const { t } = useModuleTranslation('production-transfer');
  const id = Number(useParams().id);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { can } = usePermissionAccess();
  const [execution, setExecution] = useState<ProductionTransferExecution>();
  const [hasActiveReturnTask, setHasActiveReturnTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erpBusy, setErpBusy] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [shortageConfirmed, setShortageConfirmed] = useState(false);
  const [shortageReason, setShortageReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [result, board] = await Promise.all([
        productionTransferApi.execution(id),
        productionTransferApi.taskBoard(id),
      ]);
      setExecution(result);
      setHasActiveReturnTask(board.tasks.some((task) =>
        (task.taskType === 'AssignmentReturn' || task.taskType === 'CancellationReturn')
        && task.assignments.some((assignment) => assignment.userId === currentUserId)
        && !['Completed', 'Cancelled'].includes(task.status)));
      setLoadError(undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Üretim transferi açılamadı.');
    }
  }, [currentUserId, id]);

  useEffect(() => { void load(); }, [load]);

  const hasShortage = (execution?.shortageQuantity ?? 0) > 0;
  const canConfirmRequester = !execution?.requestedByUserId
    || execution.requestedByUserId === currentUserId
    || can('WMS.PRODUCTION_TRANSFER.APPROVE');

  const confirmHandover = async () => {
    if (!execution) return;
    setBusy(true);
    try {
      const result = await productionTransferApi.confirmHandover(id, hasShortage ? shortageConfirmed : false, shortageReason);
      setExecution(result);
      if (result.erpIntegrationStatus === 'Succeeded') {
        toast.success(t('execution.erp.postedWithCompletion'));
      } else if (result.erpIntegrationStatus === 'Failed') {
        toast.warning(t('execution.erp.failedAfterCompletion'));
      } else if (result.erpIntegrationStatus === 'CommitUncertain') {
        toast.warning(t('execution.erp.uncertainAfterCompletion'));
      } else toast.success(result.residualDocumentNo
        ? `Teslim tamamlandı. Kalan miktar için ${result.residualDocumentNo} oluşturuldu.`
        : 'Üretim transferi teslim edildi ve tamamlandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfer teslimi onaylanamadı.');
    } finally { setBusy(false); }
  };

  const postErp = async () => {
    if (!execution) return;
    setErpBusy(true);
    try {
      const result = await productionTransferApi.postErp(id);
      setExecution(result);
      if (result.erpIntegrationStatus === 'Succeeded') toast.success(t('execution.erp.retrySucceeded'));
      else if (result.erpIntegrationStatus === 'CommitUncertain') toast.warning(t('execution.erp.uncertainAfterCompletion'));
      else toast.error(result.erpErrorMessage || t('execution.erp.retryFailed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('execution.erp.retryFailed'));
    } finally { setErpBusy(false); }
  };

  if (loadError) return <section className="wms-ops-form-card p-5"><p className="font-bold text-red-500">{loadError}</p><button className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--wms-brand-primary)]" onClick={() => void load()}><RefreshCw className="size-4" />Tekrar dene</button></section>;
  if (!execution) return <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>;

  const pickingStage = execution.workflowStatus === 'Planned' || execution.workflowStatus === 'Picking';
  const handoverStage = execution.workflowStatus === 'AwaitingHandover';
  const completed = execution.workflowStatus === 'Completed' || execution.workflowStatus === 'CompletedWithShortage';
  const showReturnSection = hasActiveReturnTask;
  const showPickingSection = pickingStage && !showReturnSection;

  return <section className="space-y-5">
    <header className="wms-ops-form-card p-5">
      <Link to="/warehouse/production-transfers/list" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--wms-brand-primary)]">
        <ArrowLeft className="size-4" />Transfer kayıtlarına dön
      </Link>
      {!showReturnSection ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Step active={pickingStage} done={!pickingStage} number="01" title="Barkodlu toplama" text="Kalemleri tablodan takip edin, barkodla toplayın veya rotayı güncelleyin." />
          <Step active={handoverStage} done={completed} number="02" title="Fiziksel teslim onayı" text="Talep sahibi malzemeyi alınca tam veya eksik teslimi onaylasın." />
        </div>
      ) : null}
    </header>

    {showReturnSection && (
      <ProductionTransferReturnSection
        transferId={id}
        documentNo={execution.documentNo}
        onBoardChange={(board) => setHasActiveReturnTask(board.tasks.some((task) =>
          (task.taskType === 'AssignmentReturn' || task.taskType === 'CancellationReturn')
          && task.assignments.some((assignment) => assignment.userId === currentUserId)
          && !['Completed', 'Cancelled'].includes(task.status)))}
      />
    )}

    {showPickingSection && (
      <ProductionTransferPickingSection
        transferId={id}
        execution={execution}
        onExecutionChange={setExecution}
      />
    )}

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
      <div className={cn(
        'mt-5 rounded-xl border p-4',
        execution.erpIntegrationStatus === 'Succeeded' && 'border-emerald-500/40 bg-emerald-500/10',
        execution.erpIntegrationStatus === 'Failed' && 'border-red-500/40 bg-red-500/10',
        execution.erpIntegrationStatus === 'CommitUncertain' && 'border-amber-500/50 bg-amber-500/10',
      )}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <strong className="block">{t('execution.erp.title')}</strong>
            <span className="mt-1 block text-sm text-[var(--wms-app-text-muted)]">{t(`execution.erp.status.${execution.erpIntegrationStatus}`)}</span>
            {execution.erpDocumentNo && <span className="mt-2 block text-xs font-bold">{t('execution.erp.documentNo')}: {execution.erpDocumentNo}</span>}
            {execution.erpErrorMessage && <span className="mt-2 block text-xs text-red-600">{execution.erpErrorMessage}</span>}
          </div>
          {can('WMS.PRODUCTION_TRANSFER.APPROVE')
            && execution.erpPostingPolicy !== 'Disabled'
            && ['Pending','Failed'].includes(execution.erpIntegrationStatus) && (
            <OpsActionButton variant="secondary" loading={erpBusy} onClick={() => void postErp()}>
              <RefreshCw className="size-4" />{t('execution.erp.retry')}
            </OpsActionButton>
          )}
        </div>
      </div>
      {execution.residualTransferId && <div className="mt-5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4"><strong>Kalan iş emri oluşturuldu</strong><p className="mt-1 text-sm">Eksik miktarlar yeni belgeye taşındı; tamamlanan transfer tekrar açılamaz.</p><Link className="mt-3 inline-flex items-center gap-2 font-bold text-[var(--wms-brand-primary)]" to={`/warehouse/production-transfers/${execution.residualTransferId}/operations`}>{execution.residualDocumentNo || `#${execution.residualTransferId}`} iş emrine git</Link></div>}
    </section>}
  </section>;
}

function Step({ active, done, number, title, text }: { active: boolean; done: boolean; number: string; title: string; text: string }) { return <div className={cn('rounded-xl border p-4', active ? 'border-[var(--wms-brand-primary)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)]' : 'border-[var(--wms-app-border)]', done && 'border-emerald-500/40')}><div className="flex items-center gap-3"><span className={cn('grid size-9 place-items-center rounded-full text-xs font-black', done ? 'bg-emerald-500 text-white' : 'bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)]')}>{done ? <CheckCircle2 className="size-5" /> : number}</span><span><strong className="block">{title}</strong><span className="text-xs text-[var(--wms-app-text-muted)]">{text}</span></span></div></div>; }
function LineSummary({ execution }: { execution: ProductionTransferExecution }) {
  const pickedLines = execution.lines.filter((line) => line.pickedQuantity > 0);
  return <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full min-w-[680px] text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">Stok</th><th className="p-3 text-right">Talep</th><th className="p-3 text-right">Toplanan/Teslim</th><th className="p-3 text-right">Eksik</th></tr></thead><tbody>{pickedLines.map((line) => <tr key={line.lineId} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{line.stockCode}</strong><span className="block text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span></td><td className="p-3 text-right">{formatProjectNumber(line.requestedQuantity)} {line.unitCode}</td><td className="p-3 text-right text-emerald-600">{formatProjectNumber(line.pickedQuantity)}</td><td className="p-3 text-right text-amber-600">{formatProjectNumber(line.shortageQuantity)}</td></tr>)}</tbody></table></div>;
}
