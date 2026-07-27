import { type ReactElement } from 'react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface OpsLoadingStateProps {
  message: string;
  compact?: boolean;
  code?: string;
  className?: string;
}

export function OpsLoadingState({
  message,
  compact = false,
  code = 'SYNC',
  className,
}: OpsLoadingStateProps): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';

  if (isPremium) {
    return (
      <div
        className={cn('wms-premium-loading', compact && 'wms-premium-loading--compact', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="wms-premium-loading__orbit" aria-hidden>
          <span className="wms-premium-loading__ring" />
          <span className="wms-premium-loading__core" />
        </div>
        <div className="wms-premium-loading__message">{message}</div>
      </div>
    );
  }

  return (
    <div
      className={cn('wms-ops-loading-state', compact && 'wms-ops-loading-state--compact', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="wms-ops-terminal-state__line">
        <span className="wms-ops-terminal-state__prompt" aria-hidden>
          {'>'}
        </span>
        <span className="wms-ops-terminal-state__tag wms-ops-loading-state__tag">RUN</span>
        <span className="wms-ops-terminal-state__code">{code}</span>
      </div>
      <div className="wms-ops-loading-state__bar" aria-hidden>
        <span className="wms-ops-loading-state__bar-scan" />
      </div>
      <div className="wms-ops-terminal-state__detail">{message}</div>
    </div>
  );
}
