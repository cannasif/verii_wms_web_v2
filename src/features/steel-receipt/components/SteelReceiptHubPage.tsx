import { ArrowRight, BarChart3, ClipboardCheck, FileSpreadsheet, Layers3, Loader2, Rows3, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

const phases = [
  { key: 'gate', number: '01', items: [
    { key: 'vehicles', href: '/warehouse/goods-receipts/steel/vehicle-check-ins', icon: Truck },
    { key: 'import', href: '/warehouse/goods-receipts/steel/import', icon: FileSpreadsheet },
    { key: 'plans', href: '/warehouse/goods-receipts/steel/plans', icon: Rows3 },
  ] },
  { key: 'quality', number: '02', items: [
    { key: 'inspection', href: '/warehouse/goods-receipts/steel/inspection', icon: ClipboardCheck },
  ] },
  { key: 'putaway', number: '03', items: [
    { key: 'receipt', href: '/warehouse/goods-receipts/steel/receipt', icon: Layers3 },
    { key: 'placement', href: '/warehouse/goods-receipts/steel/placement', icon: Layers3 },
  ] },
  { key: 'report', number: '04', items: [
    { key: 'reports', href: '/warehouse/goods-receipts/steel/reports', icon: BarChart3 },
  ] },
] as const;

export function SteelReceiptHubPage() {
  const { t, moduleReady } = useModuleTranslation('steel-receipt');
  if (!moduleReady) {
    return <section className="grid min-h-[50vh] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></section>;
  }

  return <section className="space-y-6">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('hub.eyebrow')}</p>
      <h1 className="mt-1 text-3xl font-black">{t('hub.title')}</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--wms-app-text-muted)]">{t('hub.description')}</p>
    </header>
    {phases.map((phase) => <section key={phase.key} className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--wms-brand-soft)] font-black text-[var(--wms-brand-primary)]">{phase.number}</span>
        <div><h2 className="text-lg font-black">{t(`hub.phases.${phase.key}.title`)}</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{t(`hub.phases.${phase.key}.description`)}</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {phase.items.map(({ key, href, icon: Icon }) => <Link key={href} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]">
          <div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"><Icon className="size-5" /></span><ArrowRight className="size-5 text-[var(--wms-app-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--wms-brand-primary)]" /></div>
          <h3 className="mt-3 font-black">{t(`hub.cards.${key}.title`)}</h3><p className="mt-1 text-xs leading-5 text-[var(--wms-app-text-muted)]">{t(`hub.cards.${key}.description`)}</p>
        </Link>)}
      </div>
    </section>)}
  </section>;
}
