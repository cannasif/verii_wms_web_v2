import type { ReactElement, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

/**
 * Operational modal contract used by WMS modules.
 * Keeps focus trapping, Escape handling, scroll locking and workspace containment
 * consistent while allowing each operation to render its own visible header.
 */
export function ResponsiveDialog({
  open = true,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = false,
}: ResponsiveDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(
          'w-[calc(100%-1rem)] !max-w-4xl overflow-y-auto bg-[var(--wms-app-panel)] p-4 text-[var(--wms-app-text)] shadow-2xl',
          'sm:w-[calc(100%-2rem)] sm:p-6',
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {description ?? title}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
