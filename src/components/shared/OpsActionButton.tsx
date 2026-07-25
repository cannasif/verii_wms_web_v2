import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, forwardRef, type ReactElement } from 'react';

type OpsActionButtonVariant = 'primary' | 'secondary';

interface OpsActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OpsActionButtonVariant;
  asChild?: boolean;
}

export const OpsActionButton = forwardRef<HTMLButtonElement, OpsActionButtonProps>(function OpsActionButton(
  {
    variant = 'primary',
    className,
    asChild = false,
    type = 'button',
    ...props
  },
  ref,
): ReactElement {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        'wms-ops-action-btn',
        variant === 'primary' ? 'wms-ops-action-btn--primary' : 'wms-ops-action-btn--secondary',
        className,
      )}
      {...props}
    />
  );
});
