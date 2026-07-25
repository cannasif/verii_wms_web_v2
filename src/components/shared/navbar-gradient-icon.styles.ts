import { cn } from '@/lib/utils';

export const navbarIconButtonClassName = cn(
  'group shrink-0 rounded-sm border border-transparent bg-transparent p-2.5 outline-none',
  'transition-all duration-300',
  'hover:border-[color-mix(in_oklab,var(--wms-brand-primary)_28%,transparent)] hover:bg-[var(--wms-brand-soft)] hover:shadow-[0_0_18px_var(--wms-brand-shadow)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)] focus-visible:ring-offset-0',
);
