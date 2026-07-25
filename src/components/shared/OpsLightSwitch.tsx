import { type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { playSwitchClick } from '@/lib/ui-sound';

export function OpsLightSwitch({
  checked,
  onCheckedChange,
  disabled,
  onLabel = 'ON',
  offLabel = 'OFF',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
  'aria-label'?: string;
}): ReactElement {
  const handleToggle = (): void => {
    if (disabled) return;
    playSwitchClick();
    onCheckedChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'wms-ops-light-switch',
        'wms-ops-light-switch--horizontal',
        checked && 'wms-ops-light-switch--on',
        disabled && 'wms-ops-light-switch--disabled',
      )}
      onClick={handleToggle}
    >
      <span className="wms-ops-light-switch__plate" aria-hidden>
        <span className="wms-ops-light-switch__screw wms-ops-light-switch__screw--tl" />
        <span className="wms-ops-light-switch__screw wms-ops-light-switch__screw--tr" />
        <span className="wms-ops-light-switch__screw wms-ops-light-switch__screw--bl" />
        <span className="wms-ops-light-switch__screw wms-ops-light-switch__screw--br" />
        <span className="wms-ops-light-switch__label wms-ops-light-switch__label--off">{offLabel}</span>
        <span className="wms-ops-light-switch__track">
          <span className="wms-ops-light-switch__lever" />
        </span>
        <span className="wms-ops-light-switch__label wms-ops-light-switch__label--on">{onLabel}</span>
        <span className="wms-ops-light-switch__glow" />
      </span>
    </button>
  );
}
