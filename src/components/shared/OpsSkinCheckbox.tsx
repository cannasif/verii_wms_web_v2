import { type ReactElement } from 'react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

/**
 * Skin-aware ops checkbox.
 * - Terminal: v1 `.wms-ops-access-control-terminal-checkbox` (corner + fill glow)
 * - Premium: v1 goods-receipt `.wms-ops-order-checkbox` (soft tick + brand glow)
 */
export function OpsSkinCheckbox({
  checked,
  onCheckedChange,
  disabled,
  title,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  'aria-label'?: string;
}): ReactElement {
  const { skin } = useTheme();

  if (skin === 'premium') {
    return (
      <label
        className={cn(
          'wms-ops-order-checkbox',
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
        title={title}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span className="wms-ops-order-checkbox__mark" aria-hidden />
      </label>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className={cn(
        'wms-ops-access-control-terminal-checkbox shrink-0',
        checked && 'wms-ops-access-control-terminal-checkbox--checked',
        disabled && 'opacity-50',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onCheckedChange(!checked);
      }}
    >
      <span className="wms-ops-access-control-terminal-checkbox__corner wms-ops-access-control-terminal-checkbox__corner--tl" aria-hidden />
      <span className="wms-ops-access-control-terminal-checkbox__corner wms-ops-access-control-terminal-checkbox__corner--tr" aria-hidden />
      <span className="wms-ops-access-control-terminal-checkbox__corner wms-ops-access-control-terminal-checkbox__corner--bl" aria-hidden />
      <span className="wms-ops-access-control-terminal-checkbox__corner wms-ops-access-control-terminal-checkbox__corner--br" aria-hidden />
      <span className="wms-ops-access-control-terminal-checkbox__fill" aria-hidden />
    </button>
  );
}
