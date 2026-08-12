/* eslint-disable react-refresh/only-export-components -- shared generator screen kit intentionally exports hooks and view primitives */
import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { generatorProductionApi } from './api';
import './generator-production.css';

export const gpPanel = 'gp-panel rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]';
export const gpField = 'min-h-11 w-full rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] px-3 text-sm text-[var(--wms-app-text)] outline-none focus:border-[var(--wms-brand-primary)]';
export const gpPrimaryButton = 'gp-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:cursor-not-allowed disabled:opacity-50';
export const gpSecondaryButton = 'gp-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-4 text-sm font-bold hover:border-[var(--wms-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50';

const processLinks = [
  { code: '01', label: 'Merkez', href: '/warehouse/production/generator' },
  { code: '02', label: 'Projeler', href: '/warehouse/production/generator/projects' },
  { code: '03', label: 'Planlama', href: '/warehouse/production/generator/planning' },
  { code: '04', label: 'Gantt', href: '/warehouse/production/generator/gantt' },
  { code: '05', label: 'Canlı Hat', href: '/warehouse/production/generator/station-board' },
  { code: '06', label: 'Analiz', href: '/warehouse/production/generator/reports' },
  { code: '07', label: 'Tanımlar', href: '/warehouse/production/generator/definitions' },
];

function isProcessLinkActive(pathname: string, code: string, href: string): boolean {
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  if (code === '03') {
    return ['/warehouse/production/generator/planning', '/warehouse/production/generator/scenarios', '/warehouse/production/generator/assistant', '/warehouse/production/generator/revisions'].some(matches);
  }

  if (code === '05') {
    return ['/warehouse/production/generator/station-board', '/warehouse/production/generator/andon', '/warehouse/production/generator/factory-map', '/warehouse/production/generator/materials', '/warehouse/production/generator/outbound'].some(matches);
  }

  return matches(href);
}

export function GeneratorPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }): ReactElement {
  const location = useLocation();
  return <header className="gp-hero"><div className="gp-hero__main"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--wms-brand-primary)]">{eyebrow}</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-1 max-w-3xl text-sm text-[var(--wms-app-text-muted)]">{description}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div><nav className="gp-process-nav" aria-label="Jeneratör üretim süreçleri">{processLinks.map((item) => { const active = isProcessLinkActive(location.pathname, item.code, item.href); return <Link key={item.href} className={`gp-process-nav__item ${active ? 'is-active' : ''}`} to={item.href}><span className="gp-process-nav__code">{item.code}</span>{item.label}</Link>; })}</nav></header>;
}

export function GeneratorMetric({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number | string; hint?: string }): ReactElement {
  return <article className={`${gpPanel} gp-metric p-4`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{label}</span><span className="gp-metric__icon"><Icon className="size-5 text-[var(--wms-brand-primary)]" /></span></div><strong className="mt-3 block text-3xl font-black tracking-tight">{value}</strong>{hint && <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{hint}</p>}</article>;
}

export function GeneratorStatus({ status }: { status: string }): ReactElement {
  const label: Record<string, string> = { Draft: 'Taslak', ReadyToPlan: 'Planlamaya hazır', Planned: 'Planlandı', Ready: 'Hazır', Released: 'Serbest', InProgress: 'Üretimde', Paused: 'Duraklatıldı', Blocked: 'Bloke', OnHold: 'Beklemede', Completed: 'Tamamlandı', Cancelled: 'İptal' };
  const tone = status === 'Completed' ? 'bg-emerald-500/15 text-emerald-500' : ['Blocked', 'Cancelled'].includes(status) ? 'bg-red-500/15 text-red-500' : status === 'InProgress' ? 'bg-sky-500/15 text-sky-500' : status === 'Paused' ? 'bg-amber-500/15 text-amber-500' : 'bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)] text-[var(--wms-brand-primary)]';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label[status] ?? status}</span>;
}

export function GeneratorTag({ children, tone = 'normal' }: { children: ReactNode; tone?: 'normal' | 'warning' | 'danger' | 'success' }): ReactElement {
  const colors = tone === 'danger' ? 'bg-red-500/15 text-red-500' : tone === 'warning' ? 'bg-amber-500/15 text-amber-500' : tone === 'success' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)] text-[var(--wms-brand-primary)]';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${colors}`}>{children}</span>;
}

export function GeneratorLoading({ text = 'Veriler yükleniyor…' }: { text?: string }): ReactElement { return <div className={`${gpPanel} p-6 text-sm text-[var(--wms-app-text-muted)]`}>{text}</div>; }
export function GeneratorEmpty({ text }: { text: string }): ReactElement { return <div className={`${gpPanel} p-6 text-sm text-[var(--wms-app-text-muted)]`}>{text}</div>; }

export function useGeneratorProjects() {
  return useQuery({ queryKey: ['generator-production', 'projects'], queryFn: () => generatorProductionApi.projects({ pageNumber: 1, pageSize: 200, search: '', filterLogic: 'and', filters: [] }) });
}

export function useGeneratorDefinitions() {
  return useQuery({ queryKey: ['generator-production', 'definitions'], queryFn: generatorProductionApi.definitions });
}

export function useGeneratorWideSchedule(live = false) {
  const definitions = useGeneratorDefinitions();
  const policy = definitions.data?.policy;
  const range = useMemo(() => {
    if (!policy) return undefined;
    const from = new Date(); from.setDate(from.getDate() - policy.schedulePastDays); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setDate(to.getDate() + policy.scheduleFutureDays); to.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [policy]);
  return useQuery({
    queryKey: ['generator-production', 'schedule', range?.from, range?.to],
    queryFn: () => generatorProductionApi.schedule(range!.from, range!.to),
    enabled: Boolean(range),
    refetchInterval: live && policy ? policy.andonRefreshSeconds * 1_000 : undefined,
  });
}

export function generatorPartLabel(part: string): string { return ({ Stator: 'Stator', Rotor: 'Rotor', Stiffener: 'Taşıyıcı kol', FinalAssembly: 'Final montaj', Common: 'Ortak', Outbound: 'Sevkiyat' } as Record<string, string>)[part] ?? part; }
export function generatorError(error: unknown): string { return error instanceof Error ? error.message : 'İşlem tamamlanamadı.'; }
