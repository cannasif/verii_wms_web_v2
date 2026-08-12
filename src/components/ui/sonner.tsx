import type { CSSProperties, ReactElement } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
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

function PremiumToastIcon({
  children,
  className,
}: {
  children: ReactElement;
  className?: string;
}): ReactElement {
  return (
    <span className={cn('wms-premium-toast__icon', className)} aria-hidden>
      {children}
    </span>
  );
}

const terminalIcons = {
  success: <OpsToastTag className="wms-ops-toast__tag--success">OK</OpsToastTag>,
  info: <OpsToastTag className="wms-ops-toast__tag--info">INF</OpsToastTag>,
  warning: <OpsToastTag className="wms-ops-toast__tag--warn">WRN</OpsToastTag>,
  error: <OpsToastTag className="wms-ops-toast__tag--error">ERR</OpsToastTag>,
  loading: (
    <span className="wms-ops-toast__loading">
      <OpsToastTag className="wms-ops-toast__tag--run">RUN</OpsToastTag>
      <Loader2 className="size-3 animate-spin" aria-hidden />
    </span>
  ),
} as const;

const premiumIcons = {
  success: (
    <PremiumToastIcon className="wms-premium-toast__icon--success">
      <CheckCircle2 className="size-4" strokeWidth={2.25} />
    </PremiumToastIcon>
  ),
  info: (
    <PremiumToastIcon className="wms-premium-toast__icon--info">
      <Info className="size-4" strokeWidth={2.25} />
    </PremiumToastIcon>
  ),
  warning: (
    <PremiumToastIcon className="wms-premium-toast__icon--warn">
      <TriangleAlert className="size-4" strokeWidth={2.25} />
    </PremiumToastIcon>
  ),
  error: (
    <PremiumToastIcon className="wms-premium-toast__icon--error">
      <CircleAlert className="size-4" strokeWidth={2.25} />
    </PremiumToastIcon>
  ),
  loading: (
    <PremiumToastIcon className="wms-premium-toast__icon--run">
      <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
    </PremiumToastIcon>
  ),
} as const;

export function Toaster({ ...props }: ToasterProps): ReactElement {
  const { resolvedTheme, skin } = useTheme();
  const isPremium = skin === 'premium';

  return (
    <Sonner
      theme={resolvedTheme}
      className={cn('wms-ops-toaster', isPremium && 'wms-ops-toaster--premium')}
      position="bottom-right"
      closeButton
      expand
      gap={12}
      offset={18}
      visibleToasts={5}
      toastOptions={{
        classNames: {
          toast: cn('wms-ops-toast', isPremium && 'wms-premium-toast'),
          title: 'wms-ops-toast__title',
          description: 'wms-ops-toast__description',
          content: 'wms-ops-toast__content',
          icon: 'wms-ops-toast__icon',
          closeButton: 'wms-ops-toast__close',
          actionButton: 'wms-ops-toast__action',
          cancelButton: 'wms-ops-toast__cancel',
        },
      }}
      icons={isPremium ? premiumIcons : terminalIcons}
      style={
        {
          '--border-radius': isPremium ? '0.95rem' : '0px',
          '--width': isPremium ? '23rem' : '22rem',
        } as CSSProperties
      }
      {...props}
    />
  );
}
