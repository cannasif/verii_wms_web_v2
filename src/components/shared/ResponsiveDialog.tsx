import type { ReactElement, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type DialogPortalRoot,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ResponsiveDialogVariant = 'detail' | 'lookup';

interface ResponsiveDialogProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  /** detail = ops detail DNA; lookup = ops lookup DNA (borders/radii/scroll per skin). */
  variant?: ResponsiveDialogVariant;
  /** Default body — full-viewport center like v1. */
  portalRoot?: DialogPortalRoot;
  /**
   * When true, renders the standard ops header from title/description.
   * Default true for v1 parity; pass false for rich custom headers (detail + action strips).
   */
  framed?: boolean;
}

/**
 * Operational modal contract used by WMS modules.
 * v1 parity: viewport-centered, ops shell, built-in close, inner scroll body.
 */
export function ResponsiveDialog({
  open = true,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  variant = 'detail',
  portalRoot = 'body',
  framed = true,
}: ResponsiveDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        showCloseButton={showCloseButton}
        portalRoot={portalRoot}
        tone="ops"
        onInteractOutside={(event) => {
          if (!showCloseButton) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!showCloseButton) event.preventDefault();
        }}
        className={cn(
          variant === 'lookup' ? 'wms-ops-lookup-dialog' : 'wms-ops-detail-dialog',
          'wms-ops-form flex !h-auto max-h-[min(90dvh,880px)] w-[calc(100%-1rem)] !max-w-4xl flex-col gap-0 overflow-hidden border-0 p-0 shadow-none',
          'sm:w-[calc(100%-2rem)]',
          className,
        )}
      >
        {framed ? (
          <>
            <header className={cn(
              variant === 'lookup' ? 'wms-ops-lookup-dialog__header' : 'wms-ops-detail-dialog__header',
              'shrink-0 px-5 py-4',
              showCloseButton && 'pr-14',
            )}>
              <DialogTitle
                className={cn(
                  variant === 'lookup' ? 'wms-ops-lookup-dialog__title' : 'wms-ops-detail-dialog__title',
                  'text-left',
                )}
              >
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription
                  className={cn(
                    variant === 'lookup' ? 'wms-ops-lookup-dialog__description' : 'wms-ops-detail-dialog__description',
                    'mt-1 text-left normal-case tracking-normal',
                  )}
                >
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
              )}
            </header>
            <div className="wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </>
        ) : (
          <>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
            <div className="wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
