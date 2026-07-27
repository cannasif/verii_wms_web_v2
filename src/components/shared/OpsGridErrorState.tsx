import { type ReactElement } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

function resolveHttpCode(message: string): string | null {
  const statusMatch = message.match(/status code (\d+)/i);
  return statusMatch ? `HTTP ${statusMatch[1]}` : null;
}

export function OpsGridErrorState({ message }: { message: string }): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const httpCode = resolveHttpCode(message);

  if (isPremium) {
    return (
      <div className="wms-ops-grid-error wms-ops-terminal-state wms-ops-terminal-state--error" role="alert">
        <div className="wms-ops-grid-empty__icon" aria-hidden>
          <AlertTriangle className="size-5" strokeWidth={1.75} />
        </div>
        <div className="wms-ops-terminal-state__detail">{message}</div>
      </div>
    );
  }

  return (
    <div className="wms-ops-grid-error wms-ops-terminal-state wms-ops-terminal-state--error" role="alert">
      <div className="wms-ops-terminal-state__line">
        <span className="wms-ops-terminal-state__prompt" aria-hidden>
          {'>'}
        </span>
        <span className="wms-ops-terminal-state__tag">ERR</span>
        {httpCode ? <span className="wms-ops-terminal-state__code">{httpCode}</span> : null}
      </div>
      <div className="wms-ops-terminal-state__detail">{message}</div>
    </div>
  );
}
