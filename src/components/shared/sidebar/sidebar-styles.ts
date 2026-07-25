import { cn } from '@/lib/utils';

export const sidebarMotionClassName = cn(
  'will-change-[width,transform]',
  'transition-[width,transform] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
  'motion-reduce:transition-none',
);

export const sidebarShellClassName = cn(
  'border-[var(--wms-app-border)] bg-[color-mix(in_srgb,var(--wms-app-panel)_88%,transparent)] backdrop-blur-xl',
  'shadow-[1px_0_0_rgba(15,23,42,0.04)] dark:shadow-[1px_0_0_rgba(255,255,255,0.04)]',
);

export const sidebarLabelClassName = (isOpen: boolean): string =>
  cn(
    'overflow-hidden whitespace-nowrap text-start transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
    isOpen ? 'max-w-[12rem] opacity-100' : 'max-w-0 opacity-0',
  );

export const sidebarItemHoverClassName =
  'hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)]';

export const sidebarActiveParentClassName = cn(
  'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]',
  'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--wms-brand-primary)_22%,transparent)]',
);

export const sidebarActiveLeafClassName = cn(
  'bg-[var(--wms-brand-soft)] font-semibold text-[var(--wms-brand-primary)]',
  'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--wms-brand-primary)_22%,transparent)]',
);

export const sidebarIconBoxClassName = (isActive: boolean, idleToneClass: string): string =>
  cn(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border shadow-xs transition-all duration-200',
    'border-slate-200 dark:border-slate-800',
    isActive
      ? 'border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)] shadow-[0_0_12px_var(--wms-brand-shadow)]'
      : idleToneClass,
  );

export const sidebarLeafAccentClassName = cn(
  'relative ps-4',
  'before:absolute before:start-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2',
  'before:bg-[image:var(--wms-brand-gradient)] before:shadow-[0_0_8px_var(--wms-brand-shadow)] before:content-[""]',
);

export const sidebarActiveDotClassName =
  'size-1.5 shrink-0 bg-[var(--wms-brand-primary)] shadow-[0_0_8px_var(--wms-brand-shadow)]';
