import {ArrowRight,ClipboardList,PackageCheck,PackagePlus,Rows3,Settings2,UserCheck,UsersRound} from 'lucide-react';
import {Link} from 'react-router-dom';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

const phases=[
  {number:'01',titleKey:'hub.phases.start.title',descriptionKey:'hub.phases.start.description',items:[
    {titleKey:'hub.items.fromOrder.title',descriptionKey:'hub.items.fromOrder.description',href:'/warehouse/warehouse-inbounds/new',icon:ClipboardList},
    {titleKey:'hub.items.orderless.title',descriptionKey:'hub.items.orderless.description',href:'/warehouse/warehouse-inbounds/orderless',icon:PackagePlus},
    {titleKey:'hub.items.direct.title',descriptionKey:'hub.items.direct.description',href:'/warehouse/warehouse-inbounds/direct',icon:PackageCheck},
  ]},
  {number:'02',titleKey:'hub.phases.execute.title',descriptionKey:'hub.phases.execute.description',items:[
    {titleKey:'hub.items.tasks.title',descriptionKey:'hub.items.tasks.description',href:'/warehouse/warehouse-inbounds/tasks',icon:UsersRound},
    {titleKey:'hub.items.assigned.title',descriptionKey:'hub.items.assigned.description',href:'/warehouse/warehouse-inbounds/assigned',icon:UserCheck},
  ]},
  {number:'03',titleKey:'hub.phases.manage.title',descriptionKey:'hub.phases.manage.description',items:[
    {titleKey:'hub.items.records.title',descriptionKey:'hub.items.records.description',href:'/warehouse/warehouse-inbounds/list',icon:Rows3},
    {titleKey:'hub.items.settings.title',descriptionKey:'hub.items.settings.description',href:'/warehouse/warehouse-inbounds/settings',icon:Settings2},
  ]},
];

export function WarehouseInboundHubPage(){
  const { t } = useModuleTranslation('warehouse-inbound');

  return <section className="wms-ops-form space-y-6">
    <header className="wms-ops-form-card rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6"><p className="wms-ops-eyebrow text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('hub.eyebrow')}</p><h1 className="wms-ops-title-main mt-1 text-3xl font-black">{t('hub.title')}</h1><p className="wms-ops-subtitle mt-2 max-w-4xl text-sm leading-6 text-[var(--wms-app-text-muted)]"><span className="wms-ops-subtitle-prefix" aria-hidden>&gt; </span>{t('hub.description')}</p></header>
    {phases.map(phase=><section key={phase.number} className="space-y-3"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--wms-brand-soft)] font-black text-[var(--wms-brand-primary)]">{phase.number}</span><div><h2 className="text-lg font-black">{t(phase.titleKey)}</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{t(phase.descriptionKey)}</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{phase.items.map(({titleKey,descriptionKey,href,icon:Icon})=><Link key={href} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"><Icon className="size-5"/></div><ArrowRight className="size-5 text-[var(--wms-app-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--wms-brand-primary)]"/></div><h3 className="mt-3 font-black">{t(titleKey)}</h3><p className="mt-1 text-xs leading-5 text-[var(--wms-app-text-muted)]">{t(descriptionKey)}</p></Link>)}</div></section>)}
  </section>;
}
