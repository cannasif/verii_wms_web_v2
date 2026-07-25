import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function OpsCircuitToggle({
  checked,
  onCheckedChange,
  disabled,
  compact = false,
  horizontal = false,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  horizontal?: boolean;
  'aria-label'?: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'wms-ops-circuit-toggle',
        compact && 'wms-ops-circuit-toggle--compact',
        horizontal && 'wms-ops-circuit-toggle--horizontal',
        checked && 'wms-ops-circuit-toggle--on',
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="wms-ops-circuit-toggle__housing" aria-hidden>
        <span className="wms-ops-circuit-toggle__rail" />
        <span className="wms-ops-circuit-toggle__lever" />
      </span>
    </button>
  );
}

export function OpsCircuitToggleField({
  checked,
  onCheckedChange,
  title,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        'wms-ops-circuit-toggle-field flex items-center justify-between gap-3 p-2.5',
        checked && 'wms-ops-circuit-toggle-field--on',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="wms-ops-circuit-toggle-field__title">{title}</div>
        {description ? (
          <div className="wms-ops-circuit-toggle-field__description">{description}</div>
        ) : null}
      </div>
      <OpsCircuitToggle
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={typeof title === 'string' ? title : undefined}
      />
    </div>
  );
}

export function OpsCircuitToggleInline({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}): ReactElement {
  return (
    <div className="wms-ops-circuit-toggle-inline">
      <OpsCircuitToggle
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </div>
  );
}
