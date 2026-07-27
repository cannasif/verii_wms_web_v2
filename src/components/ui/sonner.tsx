import type { CSSProperties, ReactElement } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

function OpsToastTag({
  children,
  className,
}: {
  children: string;
  className?: string;
}): ReactElement {
  return (
    <span className={cn('wms-ops-toast__tag', className)} aria-hidden>
      <span className="wms-ops-toast__tag-bracket">[</span>
      {children}
      <span className="wms-ops-toast__tag-bracket">]</span>
    </span>
  );
}

export function Toaster({ ...props }: ToasterProps): ReactElement {
  const { resolvedTheme, skin } = useTheme();
  const isPremium = skin === 'premium';

  return (
    <Sonner
      theme={resolvedTheme}
      className="wms-ops-toaster"
      position="bottom-right"
      closeButton
      gap={10}
      offset={18}
      toastOptions={{
        classNames: {
          toast: 'wms-ops-toast',
          title: 'wms-ops-toast__title',
          description: 'wms-ops-toast__description',
          content: 'wms-ops-toast__content',
          icon: 'wms-ops-toast__icon',
          closeButton: 'wms-ops-toast__close',
          actionButton: 'wms-ops-toast__action',
          cancelButton: 'wms-ops-toast__cancel',
        },
      }}
      icons={{
        success: <OpsToastTag className="wms-ops-toast__tag--success">OK</OpsToastTag>,
        info: <OpsToastTag className="wms-ops-toast__tag--info">INF</OpsToastTag>,
        warning: <OpsToastTag className="wms-ops-toast__tag--warn">WRN</OpsToastTag>,
        error: <OpsToastTag className="wms-ops-toast__tag--error">ERR</OpsToastTag>,
        loading: (
          <span className="wms-ops-toast__loading">
            <OpsToastTag className="wms-ops-toast__tag--run">RUN</OpsToastTag>
            <Loader2Icon className="size-3 animate-spin" aria-hidden />
          </span>
        ),
      }}
      style={
        {
          '--border-radius': isPremium ? '0.95rem' : '0px',
          '--width': '22rem',
        } as CSSProperties
      }
      {...props}
    />
  );
}
