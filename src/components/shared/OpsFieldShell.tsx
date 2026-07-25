import { type ReactElement, type ReactNode, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface OpsFieldShellProps extends ComponentProps<'div'> {
  children: ReactNode;
}

export function OpsFieldShell({
  children,
  className,
  'aria-invalid': ariaInvalid,
  ...props
}: OpsFieldShellProps): ReactElement {
  const hasError = ariaInvalid === true || ariaInvalid === 'true';

  return (
    <div
      className={cn('wms-ops-field-shell', hasError && 'wms-ops-field-shell--error', className)}
      aria-invalid={ariaInvalid}
      {...props}
    >
      {children}
    </div>
  );
}
