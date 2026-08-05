import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Factory, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { getShellPortalRoot } from '@/lib/workspace-portal';
import { useAuthStore } from '@/stores/auth-store';
import { productionTransferApi, type ProductionTransferPolicy } from '@/features/production-transfer/api';
import { productionApi } from './api';
import type { ProductionSourceWorkOrder, PreparedNetsisProductionWorkOrder } from './types';

export function ProductionWorkOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { can } = usePermissionAccess();
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const [policy,setPolicy]=useState<ProductionTransferPolicy>();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ProductionSourceWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PreparedNetsisProductionWorkOrder>();
  const [detailLoading, setDetailLoading] = useState<string>();

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try { setRows(await productionApi.sourceWorkOrders(term)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Üretim iş emirleri yüklenemedi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{void productionTransferApi.policy(branchCode).then(setPolicy).catch((error:Error)=>toast.error(error.message));},[branchCode]);

  const open = async (workOrderNumber: string) => {
    setDetailLoading(workOrderNumber);
    try { setSelected(await productionApi.prepareSourceWorkOrder(workOrderNumber)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'İş emri reçetesi hazırlanamadı.'); }
    finally { setDetailLoading(undefined); }
  };

  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">Üretim / {policy?.productionOrderSource==='WmsIntegrationTables'?policy.wmsSourceSystemCode:'Netsis ERP'} kaynağı</p>
      <h1 className="mt-1 text-2xl font-black">Üretime transfer iş emirleri</h1>
      <p className="mt-2 max-w-4xl text-sm text-[var(--wms-app-text-muted)]">Şube politikasında seçilen kaynaktaki iş emrini ve reçetesini inceleyin; WMS üretim emrine veya üretim transferine aktarın.</p>
    </header>
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3.5 size-4 text-[var(--wms-app-text-muted)]"/><input className="input pl-10" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void load(search);}} placeholder="İş emri veya mamul ara..."/></div>
        <button type="button" disabled={loading} onClick={()=>void load(search)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 font-bold text-[var(--wms-brand-primary)]"><Search className="size-4"/>Ara</button>
        <button type="button" disabled={loading} onClick={()=>void load()} title="Açık iş emirlerini yenile" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-4 font-bold"><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/>Yenile</button>
      </div>
      <div className="max-h-[calc(100dvh-22rem)] overflow-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--wms-app-surface)] text-xs uppercase text-[var(--wms-app-text-muted)]"><tr>{['İş emri','Kaynak','Mamul','Miktar / birim','Tarih','Proje','Depo akışı',''].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead>
          <tbody>{rows.map(row=><tr key={row.workOrderNumber} onClick={()=>void open(row.workOrderNumber)} className="cursor-pointer border-t border-[var(--wms-app-border)] transition hover:bg-[var(--wms-brand-soft)]">
            <td className="p-3 font-mono font-black text-[var(--wms-brand-primary)]">{row.workOrderNumber}</td>
            <td className="p-3"><span className="rounded-full border border-[var(--wms-app-border)] px-2 py-1 text-xs font-bold">{row.sourceSystemCode}</span>{row.revisionNumber>1&&<div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Rev. {row.revisionNumber}</div>}</td>
            <td className="p-3"><strong>{row.stockCode}</strong><div className="max-w-80 truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div></td>
            <td className="p-3 text-right font-bold">{formatProjectNumber(row.workOrderQuantity)} {row.unitCode??''}</td>
            <td className="p-3">{formatProjectDate(row.workOrderDate)}</td>
            <td className="p-3">{row.projectCode||'—'}</td>
            <td className="p-3">{row.issueWarehouseCode} → {row.warehouseCode}</td>
            <td className="p-3 text-right">{detailLoading===row.workOrderNumber?<Loader2 className="ml-auto size-4 animate-spin"/>:<span className="font-bold text-[var(--wms-brand-primary)]">Reçeteyi aç →</span>}</td>
          </tr>)}</tbody>
        </table>
        {loading&&rows.length===0&&<p className="p-8 text-center text-sm text-[var(--wms-app-text-muted)]">İş emirleri yükleniyor…</p>}
        {!loading&&rows.length===0&&<p className="p-8 text-center text-sm text-[var(--wms-app-text-muted)]">Seçili kaynakta transfere hazır açık iş emri bulunamadı.</p>}
      </div>
    </section>
    {selected&&<WorkOrderDrawer value={selected} close={()=>setSelected(undefined)} createPlan={()=>navigate('/warehouse/production/new',{state:{netsisProduction:selected}})} createTransfer={()=>navigate('/warehouse/production-transfers/new',{state:{netsisProduction:selected}})} canCreatePlan={can('WMS.PRODUCTION.CREATE')} canCreateTransfer={can('WMS.PRODUCTION_TRANSFER.CREATE')}/>} 
  </section>;
}

function WorkOrderDrawer({value,close,createPlan,createTransfer,canCreatePlan,canCreateTransfer}:{value:PreparedNetsisProductionWorkOrder;close:()=>void;createPlan:()=>void;createTransfer:()=>void;canCreatePlan:boolean;canCreateTransfer:boolean}){
  const blocked=value.mappingErrors.length>0||value.isClosed;
  const shellRoot=getShellPortalRoot();
  if(!shellRoot)return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[1] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
      <aside role="dialog" aria-modal="true" aria-label={`${value.workOrderNumber} reçete detayı`} className="flex max-h-[min(90dvh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel-strong)] shadow-2xl" onMouseDown={e=>e.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--wms-app-border)] bg-[var(--wms-app-panel-strong)] p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">İş emri / reçete doğrulaması</p><h2 className="mt-1 font-mono text-2xl font-black">{value.workOrderNumber}</h2><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{value.productCode} · {value.productName}</p></div><button type="button" onClick={close} className="rounded-lg border border-[var(--wms-app-border)] p-2"><X className="size-5"/></button></header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="İş emri miktarı" value={`${formatProjectNumber(value.plannedQuantity)} ${value.unitCode}`}/><Stat label="Proje" value={value.projectCode||'—'}/><Stat label="Çıkış deposu" value={`${value.sourceWarehouseCode} · ${value.sourceWarehouseName??'Eşleşmedi'}`}/><Stat label="Üretim deposu" value={`${value.targetWarehouseCode} · ${value.targetWarehouseName??'Eşleşmedi'}`}/></div>
          {value.existingProductionOrderId&&<div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><strong>Bu Netsis iş emri daha önce WMS’e alındı.</strong><div className="mt-1">WMS belgesi: {value.existingProductionDocumentNo}. Yeni WMS emri oluşturulamaz; bağlı transfer hazırlanabilir.</div></div>}
          {value.mappingErrors.length>0&&<div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm"><strong>Aktarım öncesi ERP mirror eşlemeleri tamamlanmalı:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{value.mappingErrors.map(error=><li key={error}>{error}</li>)}</ul></div>}
          <section><h3 className="mb-3 font-black">Reçete bileşenleri</h3><div className="overflow-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[var(--wms-app-surface)] text-left text-xs uppercase text-[var(--wms-app-text-muted)]"><tr>{['Bileşen','Birim','Reçete','Fire','Toplam ihtiyaç','Eşleme'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{value.materials.map((row,index)=><tr key={`${row.stockCode}-${row.operationNumber}-${index}`} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{row.stockCode}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div></td><td className="p-3">{row.unitCode}</td><td className="p-3 text-right">{formatProjectNumber(row.recipeQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(row.wasteQuantity)}</td><td className="p-3 text-right font-black text-[var(--wms-brand-primary)]">{formatProjectNumber(row.requiredQuantity)}</td><td className={`p-3 text-xs font-bold ${row.mappingError?'text-red-500':'text-emerald-500'}`}>{row.mappingError??'Hazır'}</td></tr>)}</tbody></table></div></section>
        </div>
        <div className="grid shrink-0 gap-2 border-t border-[var(--wms-app-border)] bg-[var(--wms-app-panel-strong)] p-5 sm:grid-cols-2"><button type="button" disabled={blocked||Boolean(value.existingProductionOrderId)||!canCreatePlan} onClick={createPlan} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-4 font-black text-[var(--wms-brand-primary)] disabled:opacity-40"><Factory className="size-5"/>WMS emri hazırla</button><button type="button" disabled={blocked||!canCreateTransfer} onClick={createTransfer} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 font-black text-[var(--wms-brand-on-primary)] disabled:opacity-40"><ArrowRightLeft className="size-5"/>Doğrudan transfer hazırla</button></div>
      </aside>
    </div>,
    shellRoot,
  );
}

function Stat({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><p className="text-xs text-[var(--wms-app-text-muted)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>;}
