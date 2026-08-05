import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Ban, Boxes, ChevronDown, ChevronRight, Factory, ListChecks, Play, RefreshCw, Save, Settings2, Trash2, UserPlus } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { WarehouseTransferDraftPage, type ProductionTransferInitialSource } from '@/features/warehouse-transfer-v2/components/WarehouseTransferDraftPage';
import { WarehouseTransferListPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferListPage';
import { WarehouseTransferOperationPage } from '@/features/warehouse-transfer-v2/WarehouseTransferOperationPage';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import { productionTransferApi, type ProductionTaskBoard, type ProductionTransferPolicy } from './api';
import type { LocationOption, WarehouseOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import type { PreparedNetsisProductionWorkOrder } from '@/features/production/types';
import { kkdApi } from '@/features/kkd/kkd-api';

export function ProductionTransferHubPage() {
  const { t } = useModuleTranslation('production-transfer');
  const {can}=usePermissionAccess();
  const materialRequests=useQuery({queryKey:['kkd','material-requests','configuration'],queryFn:kkdApi.materialRequestConfiguration,enabled:can('WMS.KKD.DISTRIBUTION.OPERATE')});
  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('eyebrow')}</p>
      <h1 className="mt-1 text-2xl font-black">{t('title')}</h1>
      <p className="mt-2 max-w-4xl text-sm text-[var(--wms-app-text-muted)]">{t('description')}</p>
    </header>
    <div className="grid gap-4 md:grid-cols-3">
      <Card href="/warehouse/production-transfers/new" icon={<Factory/>} title={t('cards.create.title')} text={t('cards.create.text')}/>
      <Card href="/warehouse/production-transfers/list" icon={<ListChecks/>} title={t('cards.list.title')} text={t('cards.list.text')}/>
      {can('WMS.PRODUCTION_TRANSFER.ASSIGN')&&<Card href="/warehouse/production-transfers/task-pool" icon={<UserPlus/>} title="Yönetici görev havuzu" text="Tüm üretim transferi görevlerini, kalan işi ve depo çalışanı yükünü tek ekranda yönetin."/>}
      {can('WMS.KKD.DISTRIBUTION.OPERATE')&&materialRequests.data?.isEnabled&&<Card href="/warehouse/production-transfers/material-requests" icon={<Boxes/>} title="Malzeme talep siparişleri" text="Personel kartını okutun; bağlı carinin Netsis açık siparişlerini getirip KKD dağıtımına hazırlayın."/>}
      <Card href="/warehouse/production-transfers/settings" icon={<Settings2/>} title={t('cards.settings.title')} text={t('cards.settings.text')}/>
    </div>
  </section>;
}
export function ProductionTransferTaskPoolPage(){
  const {can}=usePermissionAccess();
  const query=useQuery({queryKey:['production-transfer','task-pool'],queryFn:productionTransferApi.taskPool});
  const materialRequests=useQuery({queryKey:['kkd','material-requests','configuration'],queryFn:kkdApi.materialRequestConfiguration,enabled:can('WMS.KKD.DISTRIBUTION.OPERATE')});
  return <section className="space-y-5"><header><p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">Depo iş merkezi / yönetici</p><h1 className="mt-2 text-2xl font-black">Görev havuzu</h1><p className="text-sm text-[var(--wms-app-text-muted)]">Üretim transferlerini ve etkinleştirilmişse Netsis açık siparişlerinden gelen personel malzeme taleplerini aynı iş merkezinden yönetin.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)]">Üretim transfer görevleri</span>{materialRequests.data?.isEnabled&&<Link className="rounded-xl border border-[var(--wms-app-border)] px-4 py-2 text-sm font-bold hover:border-[var(--wms-brand-primary)]" to="/warehouse/production-transfers/material-requests">Malzeme talep siparişleri</Link>}</div></header><section className="overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Transfer','Görev','Depo','Tür','Durum','Planlanan','Yapılan','Kalan','Atananlar','İşlem'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{query.data?.map(row=><tr key={row.taskId} className="border-b border-[var(--wms-app-border)]"><td className="p-3"><strong>{row.documentNo}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{row.transferStatus}</div></td><td className="p-3 font-bold">{row.taskNo}</td><td className="p-3">#{row.warehouseId}</td><td className="p-3">{row.taskType}</td><td className="p-3">{row.taskStatus}</td><td className="p-3 text-right">{row.plannedQuantity}</td><td className="p-3 text-right text-emerald-500">{row.processedQuantity}</td><td className="p-3 text-right text-amber-500">{row.remainingQuantity}</td><td className="p-3">{row.assignedUsers.join(', ')||'Atanmamış'}</td><td className="p-3"><Link className="font-bold text-[var(--wms-brand-primary)]" to={`/warehouse/production-transfers/${row.transferId}/operations`}>Aç / ata →</Link></td></tr>)}</tbody></table>{query.isLoading&&<p className="p-4 text-sm text-[var(--wms-app-text-muted)]">Görevler yükleniyor…</p>}{query.data?.length===0&&<p className="p-4 text-sm text-[var(--wms-app-text-muted)]">Aktif üretim transfer görevi bulunamadı.</p>}</section></section>;
}
export function ProductionTransferDraftPage(){
  const location=useLocation();
  const source=(location.state as {netsisProduction?:PreparedNetsisProductionWorkOrder}|null)?.netsisProduction;
  const initial:ProductionTransferInitialSource|undefined=source?.sourceWarehouseId&&source.targetWarehouseId&&source.materials.every(x=>x.stockId)?{
    workOrderNumber:source.workOrderNumber,projectCode:source.projectCode,
    existingProductionHeaderId:source.existingProductionHeaderId,existingProductionOrderId:source.existingProductionOrderId,
    sourceWarehouse:{id:source.sourceWarehouseId,code:source.sourceWarehouseCode},
    targetWarehouse:{id:source.targetWarehouseId,code:source.targetWarehouseCode},
    materials:source.materials.map(x=>({stockId:x.stockId!,stockCode:x.stockCode,stockName:x.stockName,unitCode:x.unitCode,yapCodeId:x.yapCodeId,configurationCode:x.configurationCode,quantity:x.requiredQuantity})),
  }:undefined;
  return <WarehouseTransferDraftPage variant="production" initialProductionSource={initial}/>;
}
export function ProductionTransferListPage(){return <WarehouseTransferListPage variant="production"/>;}
export function ProductionTransferOperationPage(){
  return <div className="space-y-5">
    <ProductionTaskPanel/>
    <WarehouseTransferOperationPage variant="production"/>
  </div>;
}

export function ProductionTransferPolicyPage(){
  const {t}=useModuleTranslation('production-transfer');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[form,setForm]=useState<ProductionTransferPolicy>();
  const[busy,setBusy]=useState(false);
  useEffect(()=>{void productionTransferApi.policy(branchCode).then(setForm).catch((e:Error)=>toast.error(e.message));},[branchCode]);
  if(!form)return <div className="p-8 text-center text-[var(--wms-app-text-muted)]">{t('policy.loading')}</div>;
  const set=<K extends keyof ProductionTransferPolicy>(key:K,value:ProductionTransferPolicy[K])=>setForm(x=>x?{...x,[key]:value}:x);
  const save=async()=>{setBusy(true);try{setForm(await productionTransferApi.updatePolicy(form));toast.success(t('policy.saved'));}catch(e){toast.error(e instanceof Error?e.message:t('policy.saveFailed'));}finally{setBusy(false);}};
  return <section className="space-y-5">
    <header><div className="flex items-center gap-2 text-[var(--wms-brand-primary)]"><Factory/><span className="text-xs font-bold uppercase tracking-widest">{t('policy.eyebrow')}</span></div><h1 className="mt-2 text-2xl font-black">{t('policy.title')}</h1><p className="text-sm text-[var(--wms-app-text-muted)]">{t('policy.description')}</p></header>
    <Panel title={t('policy.sections.order')}><ToggleGrid>
      <Toggle label={t('policy.fields.requireProductionOrderReference')} value={form.requireProductionOrderReference} set={v=>set('requireProductionOrderReference',v)}/>
      <Toggle label={t('policy.fields.allowManualTransfer')} value={form.allowManualTransfer} set={v=>set('allowManualTransfer',v)}/>
      <Toggle label={t('policy.fields.allowAutomaticGeneration')} value={form.allowAutomaticGeneration} set={v=>set('allowAutomaticGeneration',v)}/>
      <Toggle label={t('policy.fields.checkMaterialAvailability')} value={form.checkMaterialAvailability} set={v=>set('checkMaterialAvailability',v)}/>
      <Toggle label={t('policy.fields.blockOnShortage')} value={form.blockOnShortage} set={v=>set('blockOnShortage',v)}/>
      <Toggle label={t('policy.fields.requireTaskAssignment')} value={form.requireTaskAssignment} set={v=>set('requireTaskAssignment',v)}/>
    </ToggleGrid></Panel>
    <Panel title={t('policy.sections.execution')}><ToggleGrid>
      <Toggle label={t('policy.fields.requireSourceProductionLocation')} value={form.requireSourceProductionLocation} set={v=>set('requireSourceProductionLocation',v)}/>
      <Toggle label={t('policy.fields.requireTargetProductionLocation')} value={form.requireTargetProductionLocation} set={v=>set('requireTargetProductionLocation',v)}/>
      <Toggle label={t('policy.fields.allowPartialSupply')} value={form.allowPartialSupply} set={v=>set('allowPartialSupply',v)}/>
      <Toggle label={t('policy.fields.allowOverIssue')} value={form.allowOverIssue} set={v=>set('allowOverIssue',v)}/>
      <Toggle label={t('policy.fields.requireApproval')} value={form.requireApproval} set={v=>set('requireApproval',v)}/>
      <label className="space-y-1.5 text-sm"><span className="font-semibold text-[var(--wms-app-text)]">{t('policy.fields.overIssueTolerancePercent')}</span><input className="input" type="number" min={0} max={100} step=".01" disabled={!form.allowOverIssue} value={form.overIssueTolerancePercent} onChange={e=>set('overIssueTolerancePercent',Number(e.target.value))}/></label>
      <label className="space-y-1.5 text-sm"><span className="font-semibold text-[var(--wms-app-text)]">İptalde stok nereye dönsün?</span><select className="input" value={form.cancellationReturnPolicy} onChange={e=>set('cancellationReturnPolicy',e.target.value as ProductionTransferPolicy['cancellationReturnPolicy'])}><option value="OriginalSourceLocation">Özgün kaynak raf</option><option value="WarehouseDefaultReturnLocation">Deponun varsayılan iade rafı</option><option value="ManagerSelectionRequired">Yönetici seçim yapmak zorunda</option></select></label>
    </ToggleGrid></Panel>
    <TransferReturnLocationPanel branchCode={branchCode}/>
    <div className="flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-3 font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"><Save className="size-4"/>{busy?t('policy.saving'):t('policy.save')}</button></div>
  </section>;
}

function ProductionTaskPanel(){
  const id=Number(useParams().id);
  const currentUserId=useAuthStore(x=>x.user?.id);
  const{can}=usePermissionAccess();
  const queryClient=useQueryClient();
  const boardQueryKey=['production-transfer','board',id] as const;
  const boardQuery=useQuery({queryKey:boardQueryKey,queryFn:()=>productionTransferApi.taskBoard(id),enabled:Number.isFinite(id)&&id>0});
  const board=boardQuery.data;
  const[selectedUsers,setSelectedUsers]=useState<Record<number,number>>({});
  const[handoffReasons,setHandoffReasons]=useState<Record<number,string>>({});
  const[expandedWorkloadUserIds,setExpandedWorkloadUserIds]=useState<Set<number>>(new Set());
  const toggleWorkloadExpanded=(userId:number)=>setExpandedWorkloadUserIds(current=>{
    const next=new Set(current);
    if(next.has(userId))next.delete(userId);else next.add(userId);
    return next;
  });
  const[busy,setBusy]=useState(false);
  const canAssign=can('WMS.PRODUCTION_TRANSFER.ASSIGN');
  const canCancel=can('WMS.PRODUCTION_TRANSFER.CANCEL');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[policy,setPolicy]=useState<ProductionTransferPolicy>();
  const[returnLocationValue,setReturnLocationValue]=useState<string|null>(null);
  const[cancelReason,setCancelReason]=useState('');
  useEffect(()=>{
    if(!Number.isFinite(id)||id<=0)return;
    void productionTransferApi.policy(branchCode).then(setPolicy).catch((e:Error)=>toast.error(e.message));
  },[branchCode,id]);
  if(boardQuery.isLoading)return <section className="animate-pulse rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><div className="h-4 w-40 rounded bg-[var(--wms-app-border)]"/><div className="mt-3 h-24 rounded-xl bg-[var(--wms-app-border)]/60"/></section>;
  if(!board||board.tasks.length===0)return null;
  const run=async(action:()=>Promise<ProductionTaskBoard>)=>{setBusy(true);try{queryClient.setQueryData(boardQueryKey,await action());}catch(e){toast.error(e instanceof Error?e.message:'İşlem başarısız.');}finally{setBusy(false);}};
  return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">Üretim transfer görevi</p><h2 className="text-xl font-black">{board.documentNo}</h2></div><span className="rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs font-bold">{board.transferStatus}</span></div>
    <div className="space-y-4">{board.tasks.map(task=><article key={task.taskId} className="rounded-xl border border-[var(--wms-app-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{task.taskNo}</strong><span className="ml-2 text-xs text-[var(--wms-app-text-muted)]">{task.status}</span>{task.completedAtUtc&&<span className="ml-2 text-xs text-[var(--wms-app-text-muted)]">· {new Date(task.completedAtUtc).toLocaleString('tr-TR')}</span>}</div>
        <div className="flex flex-wrap gap-2">{task.taskType!=='CancellationReturn'&&task.lines.some(x=>x.missingQuantity>0)&&!['Completed','Cancelled'].includes(task.status)&&<button disabled={busy} onClick={()=>void run(()=>productionTransferApi.refreshRoute(id,task.taskId))} className="inline-flex items-center gap-2 rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-500"><RefreshCw className="size-4"/>Rotayı güncelle</button>}{task.assignments.some(x=>x.userId===currentUserId)&&!['InProgress','PartiallyCompleted','Completed','Cancelled'].includes(task.status)&&<button disabled={busy} onClick={()=>void run(()=>productionTransferApi.startTask(id,task.taskId))} className="inline-flex items-center gap-2 rounded-lg bg-[var(--wms-brand-primary)] px-3 py-2 text-xs font-bold text-[var(--wms-brand-on-primary)]"><Play className="size-4"/>Bu işi yapıyorum</button>}{task.taskType==='CancellationReturn'&&task.startedBy===currentUserId&&task.status==='InProgress'&&<button disabled={busy} onClick={()=>void run(()=>productionTransferApi.completeCancellationReturn(id,task.taskId))} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save className="size-4"/>Rafa geri koymayı tamamla</button>}</div></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-[var(--wms-app-text-muted)]"><tr><th className="p-2">Stok</th><th className="p-2">Kaynak raf</th><th className="p-2 text-right">İstenen</th><th className="p-2 text-right">Rezerve</th><th className="p-2 text-right">Eksik</th><th className="p-2 text-right">Toplanan</th></tr></thead><tbody>{task.lines.map(line=><tr key={line.taskLineId} className="border-t border-[var(--wms-app-border)]"><td className="p-2"><strong>{line.stockCode}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</div></td><td className="p-2">{line.sourceLocationCode??'—'}<div className="text-xs text-[var(--wms-app-text-muted)]">{line.sourceLocationName}</div></td><td className="p-2 text-right">{line.requestedQuantity}</td><td className="p-2 text-right text-emerald-500">{line.reservedQuantity}</td><td className="p-2 text-right text-red-500">{line.missingQuantity}</td><td className="p-2 text-right">{line.processedQuantity}</td></tr>)}</tbody></table></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{task.assignments.map(a=><span key={a.userId} className="inline-flex items-center gap-2 rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs"><span>{a.username}{a.isPrimary?' · Birincil':''}</span>{canAssign&&<button title="Atamayı kaldır" disabled={busy} onClick={()=>void run(()=>productionTransferApi.removeAssignment(id,task.taskId,a.userId))}><Trash2 className="size-3.5 text-red-500"/></button>}</span>)}
        {canAssign&&<><select className="input min-w-52" value={selectedUsers[task.taskId]??''} onChange={e=>setSelectedUsers(x=>({...x,[task.taskId]:Number(e.target.value)}))}><option value="">Depo çalışanı seçin</option>{board.eligibleAssignees.filter(u=>(u.warehouseIds.length===0||u.warehouseIds.includes(task.warehouseId))&&!task.assignments.some(a=>a.userId===u.userId)).map(u=><option key={u.userId} value={u.userId}>{u.username}</option>)}</select><button disabled={busy||!selectedUsers[task.taskId]} onClick={()=>void run(()=>productionTransferApi.assignTask(id,task.taskId,selectedUsers[task.taskId]))} className="inline-flex items-center gap-2 rounded-lg border border-[var(--wms-brand-primary)] px-3 py-2 text-xs font-bold text-[var(--wms-brand-primary)]"><UserPlus className="size-4"/>Ata</button>{task.assignments.length>0&&!['Completed','Cancelled'].includes(task.status)&&task.lines.some(line=>line.processedQuantity<line.requestedQuantity)&&<><input className="input min-w-56" value={handoffReasons[task.taskId]??''} onChange={e=>setHandoffReasons(x=>({...x,[task.taskId]:e.target.value}))} placeholder="Devir nedeni (opsiyonel)"/><button disabled={busy||!selectedUsers[task.taskId]} onClick={()=>void run(()=>productionTransferApi.handoffTask(id,task.taskId,selectedUsers[task.taskId],handoffReasons[task.taskId]))} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"><UserPlus className="size-4"/>Kalan işi devret</button></>}</>}
      </div>
    </article>)}</div>
    {canAssign&&board.workloads.length>0&&<div className="mt-4 grid gap-2 md:grid-cols-3">{board.workloads.map(w=>{
      const myTasks=board.tasks.filter(t=>t.assignments.some(a=>a.userId===w.userId));
      const activeTask=myTasks.find(t=>t.status==='InProgress'&&t.startedBy===w.userId);
      const activeProgress=activeTask?(()=>{
        const planned=activeTask.lines.reduce((s,l)=>s+l.requestedQuantity,0);
        const processed=activeTask.lines.reduce((s,l)=>s+Math.min(l.requestedQuantity,l.processedQuantity),0);
        return{planned,processed,percent:planned<=0?0:Math.round(processed*10000/planned)/100};
      })():null;
      const expanded=expandedWorkloadUserIds.has(w.userId);
      return <div key={w.userId} className="rounded-xl bg-[var(--wms-app-surface)] p-3 text-sm">
        <button type="button" onClick={()=>toggleWorkloadExpanded(w.userId)} className="flex w-full items-center justify-between gap-2 text-left">
          <strong>{w.username}</strong>
          {expanded?<ChevronDown className="size-4 text-[var(--wms-app-text-muted)]"/>:<ChevronRight className="size-4 text-[var(--wms-app-text-muted)]"/>}
        </button>
        <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Atanan {w.assignedTaskCount} · Tamamlanan {w.completedTaskCount}</div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--wms-app-border)]"><span className="block h-full bg-emerald-500" style={{width:`${Math.min(100,Math.max(0,w.completionPercent))}%`}}/></div>
        <div className="mt-1 text-xs font-bold">{w.processedQuantity} / {w.plannedQuantity} · %{w.completionPercent}</div>
        {expanded&&<div className="mt-3 space-y-2 border-t border-[var(--wms-app-border)] pt-2">
          {activeTask&&activeProgress&&<div className="rounded-lg bg-[var(--wms-brand-primary)]/10 p-2">
            <div className="flex items-center justify-between text-xs font-bold"><span>Şu an yapıyor: {activeTask.taskNo}</span><span>%{activeProgress.percent}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--wms-app-border)]"><span className="block h-full bg-[var(--wms-brand-primary)]" style={{width:`${Math.min(100,Math.max(0,activeProgress.percent))}%`}}/></div>
            <div className="mt-1 text-[.7rem] text-[var(--wms-app-text-muted)]">{activeProgress.processed} / {activeProgress.planned}</div>
          </div>}
          <div className="space-y-1">
            <div className="text-[.65rem] font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Atanmış İşler ({myTasks.length})</div>
            {myTasks.length===0&&<p className="text-xs text-[var(--wms-app-text-muted)]">Atanmış görev yok.</p>}
            {myTasks.map(t=><div key={t.taskId} className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${t.taskId===activeTask?.taskId?'bg-[var(--wms-brand-primary)]/10 font-bold':''}`}>
              <span>{t.taskNo}</span><span className="text-[var(--wms-app-text-muted)]">{t.status}</span>
            </div>)}
          </div>
        </div>}
      </div>;
    })}</div>}
    {canCancel&&!['Cancelled','Completed'].includes(board.transferStatus)&&<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4"><h3 className="flex items-center gap-2 font-black text-red-500"><Ban className="size-4"/>Transferi iptal et</h3><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Toplanmamış rezervasyonlar çözülür; hareket görmüş stok politika uyarınca özgün veya iade rafına döner. ERP belgesi varsa önce doğrulanmış ERP iptali tamamlanır.</p><div className="mt-3 grid gap-3 lg:grid-cols-3">{policy?.cancellationReturnPolicy==='ManagerSelectionRequired'&&<PagedAppDropdown<LocationOption> queryKey={['production-cancel-return-location',board.sourceWarehouseId]} fetchPage={request=>warehouseTransferApi.locations(request,board.sourceWarehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} value={returnLocationValue} onValueChange={setReturnLocationValue} placeholder="İade rafını seçin" searchable/>}<input className="input lg:col-span-2" value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="İptal nedeni (en az 5 karakter)"/><button disabled={busy||cancelReason.trim().length<5||(policy?.cancellationReturnPolicy==='ManagerSelectionRequired'&&!returnLocationValue)} onClick={()=>void (async()=>{setBusy(true);try{await productionTransferApi.cancel(id,cancelReason,returnLocationValue?Number(returnLocationValue):undefined);toast.success('Transfer ve bağlı stok hareketleri güvenli biçimde iptal edildi.');queryClient.setQueryData(boardQueryKey,await productionTransferApi.taskBoard(id));}catch(e){toast.error(e instanceof Error?e.message:'İptal başarısız.');}finally{setBusy(false);}})()} className="rounded-lg border border-red-500 px-4 py-2 text-sm font-bold text-red-500 disabled:opacity-50">İptali uygula</button></div></div>}
  </section>;
}

function TransferReturnLocationPanel({branchCode}:{branchCode:string}){
  const[warehouseValue,setWarehouseValue]=useState<string|null>(null);
  const[locationValue,setLocationValue]=useState<string|null>(null);
  const[busy,setBusy]=useState(false);
  const warehouseId=Number(warehouseValue||0);
  useEffect(()=>{if(!warehouseId){setLocationValue(null);return;}void productionTransferApi.returnSetting(warehouseId).then(x=>setLocationValue(x.defaultTransferReturnLocationId?String(x.defaultTransferReturnLocationId):null)).catch((e:Error)=>toast.error(e.message));},[warehouseId]);
  const save=async()=>{if(!warehouseId)return;setBusy(true);try{const result=await productionTransferApi.updateReturnSetting(warehouseId,locationValue?Number(locationValue):undefined);setLocationValue(result.defaultTransferReturnLocationId?String(result.defaultTransferReturnLocationId):null);toast.success('Varsayılan transfer iade rafı kaydedildi.');}catch(e){toast.error(e instanceof Error?e.message:'Ayar kaydedilemedi.');}finally{setBusy(false);}};
  return <Panel title="Depo varsayılan transfer iade rafı"><p className="mb-4 text-sm text-[var(--wms-app-text-muted)]">Özgün raf kullanılamadığında veya politika varsayılan iade rafını istediğinde stok bu aktif yerleştirme rafına yönlendirilir.</p><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><PagedAppDropdown<WarehouseOption> queryKey={['production-return-warehouse',branchCode]} fetchPage={r=>warehouseTransferApi.warehouses(r,branchCode)} toOption={x=>({value:String(x.id),label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouseValue} onValueChange={setWarehouseValue} placeholder="Depo seçin" searchable/><PagedAppDropdown<LocationOption> queryKey={['production-return-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} value={locationValue} onValueChange={setLocationValue} placeholder="Varsayılan iade rafını seçin" searchable/><button disabled={busy||warehouseId<=0} onClick={()=>void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--wms-brand-primary)] px-5 py-3 font-bold text-[var(--wms-brand-primary)] disabled:opacity-50"><Save className="size-4"/>Rafı kaydet</button></div></Panel>;
}

function Card({href,icon,title,text}:{href:string;icon:ReactNode;title:string;text:string}){return <Link to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]"><div className="flex items-center justify-between text-[var(--wms-brand-primary)]">{icon}<ArrowRight className="size-5 transition group-hover:translate-x-1"/></div><h2 className="mt-4 font-black">{title}</h2><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{text}</p></Link>;}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 font-black text-[var(--wms-brand-primary)]"><Boxes className="size-5"/>{title}</h2>{children}</section>;}
function ToggleGrid({children}:{children:ReactNode}){return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;}
function Toggle({label,value,set}:{label:string;value:boolean;set:(v:boolean)=>void}){return <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-3 text-sm text-[var(--wms-app-text)]"><span className="font-semibold">{label}</span><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)} className="size-4 accent-[var(--wms-brand-primary)]"/></label>;}
