import { type ReactElement } from 'react';
import { AppDropdown, type AppDropdownOption } from './AppDropdown';
import { cn } from '@/lib/utils';
import { OpsFieldShell } from './OpsFieldShell';
import { OPS_SELECT_TRIGGER_CLASS } from './ops-field-styles';

interface OpsSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AppDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  searchable?: boolean;
  /** Dar tetikleyicide seçenek metinlerinin kesilmemesi için false verin. */
  matchTriggerWidth?: boolean;
  /** Dialog içinde `null` verin; workspace portalının arkasında kalmayı önler. */
  portalContainer?: HTMLElement | null;
  'aria-invalid'?: boolean;
}

export function OpsSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  searchable,
  matchTriggerWidth,
  portalContainer,
  'aria-invalid': ariaInvalid,
}: OpsSelectProps): ReactElement {
  return (
    <OpsFieldShell className={className} aria-invalid={ariaInvalid}>
      <AppDropdown
        tone="plain"
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        searchable={searchable}
        matchTriggerWidth={matchTriggerWidth}
        portalContainer={portalContainer}
        contentClassName={cn('wms-ops-list-select-content', contentClassName)}
        className={cn(OPS_SELECT_TRIGGER_CLASS, triggerClassName)}
      />
    </OpsFieldShell>
  );
}
