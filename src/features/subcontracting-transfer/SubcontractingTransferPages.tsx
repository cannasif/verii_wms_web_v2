import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BriefcaseBusiness, ListChecks, Save, Settings2, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { WarehouseTransferDraftPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferDraftPage';
import { WarehouseTransferListPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferListPage';
import { WarehouseTransferOperationPage } from '@/features/warehouse-transfer-v2/WarehouseTransferOperationPage';
import { useAuthStore } from '@/stores/auth-store';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { parameterGuidance, parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';
import { subcontractingTransferApi, type SubcontractingTransferPolicy } from './api';

export function SubcontractingTransferHubPage(){
  const{t}=useModuleTranslation('subcontracting-transfer');
  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('eyebrow')}</p><h1 className="mt-1 text-2xl font-black">{t('title')}</h1><p className="mt-2 max-w-4xl text-sm text-[var(--wms-app-text-muted)]">{t('description')}</p></header>
    <div className="grid gap-4 md:grid-cols-3">
      <Card href="/warehouse/subcontracting-transfers/new" icon={<Truck/>} title={t('cards.create.title')} text={t('cards.create.text')}/>
      <Card href="/warehouse/subcontracting-transfers/list" icon={<ListChecks/>} title={t('cards.list.title')} text={t('cards.list.text')}/>
      <Card href="/warehouse/subcontracting-transfers/settings" icon={<Settings2/>} title={t('cards.settings.title')} text={t('cards.settings.text')}/>
    </div>
  </section>;
}
export function SubcontractingTransferDraftPage(){return <WarehouseTransferDraftPage variant="subcontracting"/>;}
export function SubcontractingTransferListPage(){return <WarehouseTransferListPage variant="subcontracting"/>;}
export function SubcontractingTransferOperationPage(){return <WarehouseTransferOperationPage variant="subcontracting"/>;}
export function SubcontractingIssueDraftPage(){return <WarehouseTransferDraftPage variant="subcontracting" fixedSubcontractingDirection="IssueToSupplier"/>;}
export function SubcontractingIssueListPage(){return <WarehouseTransferListPage variant="subcontracting" subcontractingDirection="IssueToSupplier"/>;}
export function SubcontractingReceiptDraftPage(){return <WarehouseTransferDraftPage variant="subcontracting" fixedSubcontractingDirection="ReceiptFromSupplier"/>;}
export function SubcontractingReceiptListPage(){return <WarehouseTransferListPage variant="subcontracting" subcontractingDirection="ReceiptFromSupplier"/>;}

export function SubcontractingTransferPolicyPage(){
  const{t}=useModuleTranslation('subcontracting-transfer');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[form,setForm]=useState<SubcontractingTransferPolicy>();
  const[busy,setBusy]=useState(false);
  useEffect(()=>{void subcontractingTransferApi.policy(branchCode).then(setForm).catch((e:Error)=>toast.error(e.message));},[branchCode]);
  if(!form)return <div className="p-8 text-center text-[var(--wms-app-text-muted)]">{t('policy.loading')}</div>;
  const set=<K extends keyof SubcontractingTransferPolicy>(key:K,value:SubcontractingTransferPolicy[K])=>setForm(x=>x?{...x,[key]:value}:x);
  const save=async()=>{setBusy(true);try{setForm(await subcontractingTransferApi.updatePolicy(form));toast.success(t('policy.saved'));}catch(e){toast.error(e instanceof Error?e.message:t('policy.saveFailed'));}finally{setBusy(false);}};
  return <section className="space-y-5">
    <header><div className="flex items-center gap-2 text-[var(--wms-brand-primary)]"><BriefcaseBusiness/><span className="text-xs font-bold uppercase tracking-widest">{t('policy.eyebrow')}</span></div><h1 className="mt-2 text-2xl font-black">{t('policy.title')}</h1><p className="text-sm text-[var(--wms-app-text-muted)]">{t('policy.description')}</p></header>
    <ParameterPageGuide translationKey="subcontracting" title="Fason transfer ayar rehberi" description="Sipariş ve tedarikçi bağından kısmi giriş/çıkış, kalite, onay, görev ve fazla dönüş toleransına kadar her alanın sonucunu açıklar."/>
    <Panel title={t('policy.sections.document')}><ToggleGrid>
      <Toggle guideKey="requireSupplier" label={t('policy.fields.requireSupplier')} value={form.requireSupplier} set={v=>set('requireSupplier',v)}/>
      <Toggle guideKey="requireSubcontractOrderForReceipt" label={t('policy.fields.requireSubcontractOrderForReceipt')} value={form.requireSubcontractOrderForReceipt} set={v=>set('requireSubcontractOrderForReceipt',v)}/>
      <Toggle guideKey="requireIssueBeforeReceipt" label={t('policy.fields.requireIssueBeforeReceipt')} value={form.requireIssueBeforeReceipt} set={v=>set('requireIssueBeforeReceipt',v)}/>
      <Toggle guideKey="allowOrderlessIssue" label={t('policy.fields.allowOrderlessIssue')} value={form.allowOrderlessIssue} set={v=>set('allowOrderlessIssue',v)}/>
      <Toggle guideKey="allowOrderlessReceipt" label={t('policy.fields.allowOrderlessReceipt')} value={form.allowOrderlessReceipt} set={v=>set('allowOrderlessReceipt',v)}/>
      <Toggle guideKey="allowSupplierToSupplier" label={t('policy.fields.allowSupplierToSupplier')} value={form.allowSupplierToSupplier} set={v=>set('allowSupplierToSupplier',v)}/>
    </ToggleGrid></Panel>
    <Panel title={t('policy.sections.execution')}><ToggleGrid>
      <Toggle guideKey="allowPartialIssue" label={t('policy.fields.allowPartialIssue')} value={form.allowPartialIssue} set={v=>set('allowPartialIssue',v)}/>
      <Toggle guideKey="allowPartialReceipt" label={t('policy.fields.allowPartialReceipt')} value={form.allowPartialReceipt} set={v=>set('allowPartialReceipt',v)}/>
      <Toggle guideKey="requireQualityOnReceipt" label={t('policy.fields.requireQualityOnReceipt')} value={form.requireQualityOnReceipt} set={v=>set('requireQualityOnReceipt',v)}/>
      <Toggle guideKey="requireTaskAssignment" label={t('policy.fields.requireTaskAssignment')} value={form.requireTaskAssignment} set={v=>set('requireTaskAssignment',v)}/>
      <Toggle guideKey="requireApproval" label={t('policy.fields.requireApproval')} value={form.requireApproval} set={v=>set('requireApproval',v)}/>
      <Toggle guideKey="allowOverReceipt" label={t('policy.fields.allowOverReceipt')} value={form.allowOverReceipt} set={v=>set('allowOverReceipt',v)}/>
      <div className="space-y-1.5 text-sm"><span className="font-semibold text-[var(--wms-app-text)]">{t('policy.fields.overReceiptTolerancePercent')}</span><input className="input" type="number" min={0} max={100} step=".01" disabled={!form.allowOverReceipt} value={form.overReceiptTolerancePercent} onChange={e=>set('overReceiptTolerancePercent',Number(e.target.value))}/><ParameterFieldGuide guidance={parameterGuidance('subcontracting','overReceiptTolerancePercent',form.overReceiptTolerancePercent)} currentValue={`%${form.overReceiptTolerancePercent}`}/></div>
      <div className="space-y-1.5 text-sm"><span className="font-semibold text-[var(--wms-app-text)]">{t('policy.fields.defaultLeadTimeDays')}</span><input className="input" type="number" min={0} max={3650} value={form.defaultLeadTimeDays} onChange={e=>set('defaultLeadTimeDays',Number(e.target.value))}/><ParameterFieldGuide guidance={parameterGuidance('subcontracting','defaultLeadTimeDays',form.defaultLeadTimeDays)} currentValue={`${form.defaultLeadTimeDays} gün`}/></div>
    </ToggleGrid></Panel>
    <div className="flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-3 font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"><Save className="size-4"/>{busy?t('policy.saving'):t('policy.save')}</button></div>
  </section>;
}

function Card({href,icon,title,text}:{href:string;icon:ReactNode;title:string;text:string}){return <Link to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]"><div className="flex items-center justify-between text-[var(--wms-brand-primary)]">{icon}<ArrowRight className="size-5 transition group-hover:translate-x-1"/></div><h2 className="mt-4 font-black">{title}</h2><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{text}</p></Link>;}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 font-black text-[var(--wms-brand-primary)]"><BriefcaseBusiness className="size-5"/>{title}</h2>{children}</section>;}
function ToggleGrid({children}:{children:ReactNode}){return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;}
function Toggle({label,value,set,guideKey}:{label:string;value:boolean;set:(v:boolean)=>void;guideKey:string}){return <ParameterToggleCard title={label} checked={value} onCheckedChange={set} guidance={parameterToggleGuidance('subcontracting',guideKey)}/>;}
