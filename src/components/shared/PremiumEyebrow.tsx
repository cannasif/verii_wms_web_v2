import { Fragment, useMemo, type ReactElement, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findNavTrail, WMS_NAV_ITEMS, resolveNavItemTitle, type NavItem } from './nav-items';

/**
 * Premium skin'de terminal eyebrow'u ("GİRİŞ_OP / MAL_KABUL") yerine
 * navigasyon ağacındaki gerçek tam adlardan minimal breadcrumb üretir
 * ("Giriş Operasyonları › Mal Kabul › Liste"). Route eşleşmezse string'i
 * okunaklı hale getirerek gösterir.
 */
export function PremiumEyebrow({ eyebrow }: { eyebrow: ReactNode }): ReactElement {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const segments = useMemo(() => {
    const trail = findNavTrail(WMS_NAV_ITEMS, pathname);
    if (trail && trail.length > 0) {
      const resolve = (item: NavItem): string => resolveNavItemTitle(t, language, item);
      const labels = trail.map(resolve);
      // Derin ağaçta minimal kalsın: operasyon grubu + ara grup + sayfa.
      if (labels.length > 3) {
        return [labels[1], labels[labels.length - 2], labels[labels.length - 1]];
      }
      return labels;
    }
    if (typeof eyebrow === 'string') {
      return eyebrow
        .split('/')
        .map((segment) => segment.replace(/_/g, ' ').trim().toLocaleLowerCase('tr'))
        .filter(Boolean);
    }
    return null;
  }, [eyebrow, language, pathname, t]);

  if (!segments) {
    return <div className="wms-premium-crumbs">{eyebrow}</div>;
  }

  return (
    <nav className="wms-premium-crumbs" aria-label={t('common.breadcrumb', { defaultValue: 'Breadcrumb' })}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment}-${index}`}>
          {index > 0 ? <ChevronRight className="wms-premium-crumbs__sep" aria-hidden /> : null}
          <span
            className={cn(
              'wms-premium-crumbs__item',
              index === segments.length - 1 && 'wms-premium-crumbs__item--current',
            )}
          >
            {segment}
          </span>
        </Fragment>
      ))}
    </nav>
  );
}

export function buildTerminalEyebrowFromNav(
  pathname: string,
  t: ReturnType<typeof useTranslation>['t'],
  language: string,
): ReactNode | null {
  const trail = findNavTrail(WMS_NAV_ITEMS, pathname);
  if (!trail || trail.length < 1) return null;
  const pick = trail.length > 3
    ? [trail[1], trail[trail.length - 2], trail[trail.length - 1]]
    : trail.length > 2
      ? [trail[1], trail[trail.length - 1]]
      : trail;
  const labels = pick.map((item) =>
    resolveNavItemTitle(t, language, item)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/gi, 'I')
      .toLocaleUpperCase('tr-TR')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
  ).filter(Boolean);
  if (!labels.length) return null;
  return (
    <>
      {labels.map((label, index) => (
        <Fragment key={`${label}-${index}`}>
          {index > 0 ? <span className="mx-2 opacity-60">/</span> : null}
          <span>{label}</span>
        </Fragment>
      ))}
    </>
  );
}
