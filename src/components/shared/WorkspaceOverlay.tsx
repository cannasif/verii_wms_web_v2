import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { getWorkspacePortalRoot } from '@/lib/workspace-portal';

interface WorkspaceOverlayProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceOverlay({ children, className }: WorkspaceOverlayProps): ReactElement | null {
  const workspaceRoot = getWorkspacePortalRoot();
  if (!workspaceRoot) return null;

  return createPortal(
    <div
      className={cn(
        'pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-[2px]',
        className,
      )}
    >
      {children}
    </div>,
    workspaceRoot,
  );
}
