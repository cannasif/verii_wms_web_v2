import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Boxes, Factory, ListChecks, Save, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { WarehouseTransferDraftPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferDraftPage';
import { WarehouseTransferListPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferListPage';
import { WarehouseTransferOperationPage } from '@/features/warehouse-transfer-v2/WarehouseTransferOperationPage';
import { useAuthStore } from '@/stores/auth-store';
import { productionTransferApi, type ProductionTransferPolicy } from './api';

export function ProductionTransferHubPage() {
  const { t } = useModuleTranslation('production-transfer');
  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-orange-500/15 via-[var(--wms-app-panel)] to-cyan-500/10 p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-500">{t('eyebrow')}</p>
      <h1 className="mt-1 text-2xl font-black">{t('title')}</h1>
      <p className="mt-2 max-w-4xl text-sm text-slate-500">{t('description')}</p>
    </header>
    <div className="grid gap-4 md:grid-cols-3">
      <Card href="/warehouse/production-transfers/new" icon={<Factory/>} title={t('cards.create.title')} text={t('cards.create.text')}/>
      <Card href="/warehouse/production-transfers/list" icon={<ListChecks/>} title={t('cards.list.title')} text={t('cards.list.text')}/>
      <Card href="/warehouse/production-transfers/settings" icon={<Settings2/>} title={t('cards.settings.title')} text={t('cards.settings.text')}/>
    </div>
  </section>;
}
export function ProductionTransferDraftPage(){return <WarehouseTransferDraftPage variant="production"/>;}
export function ProductionTransferListPage(){return <WarehouseTransferListPage variant="production"/>;}
export function ProductionTransferOperationPage(){return <WarehouseTransferOperationPage variant="production"/>;}

export function ProductionTransferPolicyPage(){
  const {t}=useModuleTranslation('production-transfer');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[form,setForm]=useState<ProductionTransferPolicy>();
  const[busy,setBusy]=useState(false);
  useEffect(()=>{void productionTransferApi.policy(branchCode).then(setForm).catch((e:Error)=>toast.error(e.message));},[branchCode]);
  if(!form)return <div className="p-8 text-center">{t('policy.loading')}</div>;
  const set=<K extends keyof ProductionTransferPolicy>(key:K,value:ProductionTransferPolicy[K])=>setForm(x=>x?{...x,[key]:value}:x);
  const save=async()=>{setBusy(true);try{setForm(await productionTransferApi.updatePolicy(form));toast.success(t('policy.saved'));}catch(e){toast.error(e instanceof Error?e.message:t('policy.saveFailed'));}finally{setBusy(false);}};
  return <section className="space-y-5">
    <header><div className="flex items-center gap-2 text-orange-500"><Factory/><span className="text-xs font-bold uppercase tracking-widest">{t('policy.eyebrow')}</span></div><h1 className="mt-2 text-2xl font-black">{t('policy.title')}</h1><p className="text-sm text-slate-500">{t('policy.description')}</p></header>
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
      <label className="space-y-1.5 text-sm"><span className="font-semibold">{t('policy.fields.overIssueTolerancePercent')}</span><input className="input" type="number" min={0} max={100} step=".01" disabled={!form.allowOverIssue} value={form.overIssueTolerancePercent} onChange={e=>set('overIssueTolerancePercent',Number(e.target.value))}/></label>
    </ToggleGrid></Panel>
    <div className="flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Save className="size-4"/>{busy?t('policy.saving'):t('policy.save')}</button></div>
  </section>;
}

function Card({href,icon,title,text}:{href:string;icon:ReactNode;title:string;text:string}){return <Link to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-500/40"><div className="flex items-center justify-between text-orange-500">{icon}<ArrowRight className="size-5 transition group-hover:translate-x-1"/></div><h2 className="mt-4 font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></Link>;}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 font-black text-orange-500"><Boxes className="size-5"/>{title}</h2>{children}</section>;}
function ToggleGrid({children}:{children:ReactNode}){return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;}
function Toggle({label,value,set}:{label:string;value:boolean;set:(v:boolean)=>void}){return <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-3 text-sm"><span className="font-semibold">{label}</span><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)} className="size-4"/></label>;}
