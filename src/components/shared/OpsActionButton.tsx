import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactElement,
  type ReactNode,
} from 'react';

type OpsActionButtonVariant = 'primary' | 'secondary';

interface OpsActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OpsActionButtonVariant;
  asChild?: boolean;
  /** Temaya özel buton içi dönen loading göstergesi */
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export const OpsActionButton = forwardRef<HTMLButtonElement, OpsActionButtonProps>(function OpsActionButton(
  {
    variant = 'primary',
    className,
    asChild = false,
    type = 'button',
    loading = false,
    loadingLabel,
    disabled,
    children,
    ...props
  },
  ref,
): ReactElement {
  const Comp = asChild ? Slot : 'button';
  const label = loading ? (loadingLabel ?? children) : children;
  const classes = cn(
    'wms-ops-action-btn',
    variant === 'primary' ? 'wms-ops-action-btn--primary' : 'wms-ops-action-btn--secondary',
    loading && 'wms-ops-action-btn--loading',
    className,
  );

  // Slot requires a single child — keep asChild path unwrapped.
  if (asChild) {
    return (
      <Comp
        ref={ref}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      <span
        className={cn(
          'wms-ops-action-btn__content',
          loading && 'wms-ops-action-btn__content--busy',
        )}
      >
        {label}
      </span>
      {loading ? (
        <span className="wms-ops-action-btn__spinner-slot" aria-hidden>
          <span className="wms-ops-action-btn__spinner">
            <span className="wms-ops-action-btn__spinner-ring" />
            <span className="wms-ops-action-btn__spinner-orbit" />
            <span className="wms-ops-action-btn__spinner-core" />
          </span>
        </span>
      ) : null}
    </Comp>
  );
});
