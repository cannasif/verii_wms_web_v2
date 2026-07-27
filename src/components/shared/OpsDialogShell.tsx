import { type ReactElement, type ReactNode } from 'react';
import { DialogContent, type DialogPortalRoot } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Shared v1-style ops dialog shell for CRUD / master-data forms.
 * Use with DialogHeader (__header), scroll body, and DialogFooter (wms-ops-actions).
 */
export function OpsDialogContent({
  children,
  className,
  size = 'lg',
  showCloseButton = true,
  portalRoot = 'body',
}: {
  children: ReactNode;
  className?: string;
  size?: 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  portalRoot?: DialogPortalRoot;
}): ReactElement {
  const sizeClass =
    size === 'full'
      ? 'sm:max-w-6xl'
      : size === 'xl'
        ? 'sm:max-w-4xl'
        : size === 'md'
          ? 'sm:max-w-xl'
          : 'sm:max-w-3xl';

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      portalRoot={portalRoot}
      tone="ops"
      className={cn(
        'wms-ops-form wms-ops-erp-skin wms-ops-detail-dialog flex max-h-[min(90dvh,880px)] flex-col gap-0 overflow-hidden border-0 p-0 shadow-none',
        sizeClass,
        className,
      )}
    >
      {children}
    </DialogContent>
  );
}

export function OpsDialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <header className={cn('wms-ops-detail-dialog__header shrink-0 border-b px-5 py-4 pr-14', className)}>
      {children}
    </header>
  );
}

export function OpsDialogBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={cn('wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function OpsDialogFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <footer className={cn('wms-ops-actions wms-ops-detail-dialog__footer shrink-0 border-t px-5 py-4', className)}>
      {children}
    </footer>
  );
}

export function OpsDialogFormField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}): ReactElement {
  return (
    <div className={cn('wms-ops-form-item', className)}>
      <label htmlFor={htmlFor} className="wms-ops-prelabel-form-label">
        {label}
      </label>
      {children}
    </div>
  );
}
