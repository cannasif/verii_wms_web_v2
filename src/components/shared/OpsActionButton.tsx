import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import {
  useAsyncActionGuard,
  type AsyncActionHandler,
} from '@/hooks/useAsyncActionGuard';
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

type OpsActionButtonVariant = 'primary' | 'secondary';

interface OpsActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: OpsActionButtonVariant;
  asChild?: boolean;
  /** Temaya özel buton içi dönen loading göstergesi */
  loading?: boolean;
  loadingLabel?: ReactNode;
  /** Promise sonuçlanana kadar ortak tek-tıklama/loading korumasını gerektiğinde kapatır. */
  guardAsyncAction?: boolean;
  onClick?: AsyncActionHandler<MouseEvent<HTMLButtonElement>>;
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
    onClick,
    guardAsyncAction = true,
    ...props
  },
  ref,
): ReactElement {
  const Comp = asChild ? Slot : 'button';
  const hasClickAction = typeof onClick === 'function';
  const guarded = useAsyncActionGuard(
    onClick,
    guardAsyncAction && hasClickAction && !asChild && !disabled && !loading,
  );
  const effectiveLoading = loading || guarded.busy;
  const label = effectiveLoading ? (loadingLabel ?? children) : children;
  const classes = cn(
    'wms-ops-action-btn',
    variant === 'primary' ? 'wms-ops-action-btn--primary' : 'wms-ops-action-btn--secondary',
    effectiveLoading && 'wms-ops-action-btn--loading',
    className,
  );

  // Slot requires a single child — keep asChild path unwrapped.
  if (asChild) {
    return (
      <Comp
        ref={ref}
        aria-busy={loading || undefined}
        className={classes}
        onClick={onClick}
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
      disabled={disabled || effectiveLoading}
      aria-busy={effectiveLoading || undefined}
      className={classes}
      onClick={hasClickAction ? guarded.run : undefined}
      {...props}
    >
      <span
        className={cn(
          'wms-ops-action-btn__content',
          effectiveLoading && 'wms-ops-action-btn__content--busy',
        )}
      >
        {label}
      </span>
      {effectiveLoading ? (
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
