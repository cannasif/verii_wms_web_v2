import { ArrowRight, ClipboardList, Loader2, PackageCheck, PackagePlus, Rows3, Settings2, UserCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

const phases = [
  { key: 'start', number: '01', items: [
    { key: 'ordered', href: '/warehouse/goods-receipts/new', icon: ClipboardList },
    { key: 'orderless', href: '/warehouse/goods-receipts/orderless', icon: PackagePlus },
    { key: 'direct', href: '/warehouse/goods-receipts/direct', icon: PackageCheck },
  ] },
  { key: 'execute', number: '02', items: [
    { key: 'tasks', href: '/warehouse/goods-receipts/tasks', icon: UsersRound },
    { key: 'assigned', href: '/warehouse/goods-receipts/assigned', icon: UserCheck },
  ] },
  { key: 'manage', number: '03', items: [
    { key: 'records', href: '/warehouse/goods-receipts/list', icon: Rows3 },
    { key: 'settings', href: '/warehouse/goods-receipt-settings', icon: Settings2 },
  ] },
] as const;

export function GoodsReceiptHubPage() {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {phase.items.map(({ key, href, icon: Icon }) => <Link key={href} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]">
          <div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]"><Icon className="size-5" /></div><ArrowRight className="size-5 text-[var(--wms-app-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--wms-brand-primary)]" /></div>
          <h3 className="mt-3 font-black">{t(`hub.cards.${key}.title`)}</h3><p className="mt-1 text-xs leading-5 text-[var(--wms-app-text-muted)]">{t(`hub.cards.${key}.description`)}</p>
        </Link>)}
      </div>
    </section>)}
  </section>;
}
