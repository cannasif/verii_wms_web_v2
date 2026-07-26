import { ArrowRight, ClipboardList, Loader2, PackageCheck, Settings2, ShoppingCart, Truck, UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

const cards = [
  { key: 'orderedAssigned', icon: ClipboardList },
  { key: 'stockAssigned', icon: UserRoundCog },
  { key: 'orderedDirect', icon: ShoppingCart },
  { key: 'stockDirect', icon: Truck },
] as const;

export function ShippingHubPage() {
  const { t, moduleReady } = useModuleTranslation('shipping-v2');
  if (!moduleReady) {
    return <section className="grid min-h-[50vh] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></section>;
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('title')}</p>
        <h1 className="mt-1 text-3xl font-black">{t('hub.title')}</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--wms-app-text-muted)]">{t('hub.description')}</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map(({ key, icon: Icon }) => (
          <Link key={key} to="/warehouse/shipments/new" className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]">
            <Icon className="size-6 text-[var(--wms-brand-primary)]" />
            <h2 className="mt-3 font-black">{t(`hub.cards.${key}.title`)}</h2>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{t(`hub.cards.${key}.description`)}</p>
            <ArrowRight className="ml-auto mt-3 size-4 text-[var(--wms-app-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--wms-brand-primary)]" />
          </Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link to="/warehouse/shipments/list" className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
          <PackageCheck className="text-[var(--wms-brand-primary)]" />
          <h3 className="mt-2 font-black">{t('hub.records.title')}</h3>
          <p className="text-sm text-[var(--wms-app-text-muted)]">{t('hub.records.description')}</p>
        </Link>
        <Link to="/warehouse/shipments/settings" className="rounded-2xl border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] p-5">
          <Settings2 className="text-[var(--wms-brand-primary)]" />
          <h3 className="mt-2 font-black">{t('hub.settings.title')}</h3>
          <p className="text-sm text-[var(--wms-app-text-muted)]">{t('hub.settings.description')}</p>
        </Link>
      </div>
    </section>
  );
}
