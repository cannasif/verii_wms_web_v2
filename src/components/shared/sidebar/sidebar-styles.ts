import { cn } from '@/lib/utils';

export const sidebarMotionClassName = cn(
  // Width animation forces the whole workspace to reflow on every frame. It is
  // especially expensive when the sidebar is a filtered/composited surface.
  // Keep mobile movement on the compositor and switch desktop width instantly.
  'transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
  'motion-reduce:transition-none',
);

export const sidebarShellClassName = cn(
  // An almost opaque panel preserves the glass-like hierarchy without forcing
  // Chrome to continuously re-raster a full-height backdrop-filter layer.
  'border-[var(--wms-app-border)] bg-[color-mix(in_srgb,var(--wms-app-panel)_97%,var(--wms-app-background))]',
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

/** Single quiet chip — no rainbow idle tones (they clash with terminal + PNG marks). */
export const sidebarIconBoxClassName = (isActive: boolean): string =>
  cn(
    'flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-sm border p-1 transition-all duration-200',
    isActive
      ? 'border-[color-mix(in_oklab,var(--wms-brand-primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)] text-[var(--wms-brand-primary)] shadow-[0_0_10px_color-mix(in_oklab,var(--wms-brand-primary)_18%,transparent)]'
      : 'border-slate-200/70 bg-slate-100/55 text-slate-600 shadow-none dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300',
  );

export const sidebarLeafAccentClassName = cn(
  'relative ps-4',
  'before:absolute before:start-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2',
  'before:bg-[image:var(--wms-brand-gradient)] before:shadow-[0_0_8px_var(--wms-brand-shadow)] before:content-[""]',
);

export const sidebarActiveDotClassName =
  'size-1.5 shrink-0 bg-[var(--wms-brand-primary)] shadow-[0_0_8px_var(--wms-brand-shadow)]';
