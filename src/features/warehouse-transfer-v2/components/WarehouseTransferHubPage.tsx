import { ArrowRight,ClipboardList,Loader2,PackageCheck,PackageOpen,Rows3,Settings2,Truck,UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

const cards=[
  {key:'orderedErp',href:'/warehouse/transfers/new',icon:ClipboardList},
  {key:'orderedStock',href:'/warehouse/transfers/new',icon:UserRoundCog},
  {key:'directErp',href:'/warehouse/transfers/new',icon:Truck},
  {key:'directStock',href:'/warehouse/transfers/new',icon:PackageOpen},
];
export function WarehouseTransferHubPage(){
  const{t,moduleReady}=useModuleTranslation('warehouse-transfer-v2');
  if(!moduleReady)return <section className="grid min-h-[50vh] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></section>;
  return <section className="space-y-6">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('title')}</p><h1 className="mt-1 text-3xl font-black">{t('hubTitle')}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--wms-app-text-muted)]">{t('hubDescription')}</p></header>
    <section><div className="mb-3"><h2 className="text-lg font-black">{t('hub.startTitle')}</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{t('hub.startDescription')}</p></div><div className="grid gap-3 md:grid-cols-2">{cards.map(({key,href,icon:Icon})=><Link key={key} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]"><div className="flex justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"><Icon className="size-5"/></div><ArrowRight className="size-5 text-[var(--wms-app-text-muted)] group-hover:text-[var(--wms-brand-primary)]"/></div><h3 className="mt-3 font-black">{t(`hub.cards.${key}.title`)}</h3><p className="mt-1 text-xs leading-5 text-[var(--wms-app-text-muted)]">{t(`hub.cards.${key}.description`)}</p></Link>)}</div></section>
    <section><div className="mb-3"><h2 className="text-lg font-black">{t('hub.executeTitle')}</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{t('hub.executeDescription')}</p></div><div className="grid gap-3 md:grid-cols-3"><Disabled title={t('hub.source.title')} text={t('hub.source.description')} badge={t('hub.operationSlice')} icon={PackageOpen}/><Disabled title={t('hub.target.title')} text={t('hub.target.description')} badge={t('hub.operationSlice')} icon={PackageCheck}/><Link to="/warehouse/transfers/list" className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4"><Rows3 className="size-6 text-[var(--wms-brand-primary)]"/><h3 className="mt-3 font-black">{t('hub.records.title')}</h3><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{t('hub.records.description')}</p></Link></div></section>
    <Link to="/warehouse/transfers/settings" className="flex items-center justify-between rounded-2xl border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] p-5"><div className="flex items-center gap-3"><Settings2 className="size-6 text-[var(--wms-brand-primary)]"/><div><h3 className="font-black">{t('hub.settings.title')}</h3><p className="text-xs text-[var(--wms-app-text-muted)]">{t('hub.settings.description')}</p></div></div><ArrowRight className="size-5"/></Link>
  </section>;
}
function Disabled({title,text,badge,icon:Icon}:{title:string;text:string;badge:string;icon:typeof PackageOpen}){return <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 opacity-65"><div className="flex justify-between"><Icon className="size-6 text-[var(--wms-brand-primary)]"/><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-500">{badge}</span></div><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{text}</p></div>}
