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
  searchable?: boolean;
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
  searchable,
  'aria-invalid': ariaInvalid,
}: OpsSelectProps): ReactElement {
  return (
    <OpsFieldShell className={className} aria-invalid={ariaInvalid}>
      <AppDropdown
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        searchable={searchable}
        className={cn(OPS_SELECT_TRIGGER_CLASS, triggerClassName)}
      />
    </OpsFieldShell>
  );
}
