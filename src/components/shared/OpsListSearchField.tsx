import { type KeyboardEventHandler, type ReactElement, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OpsFieldShell } from './OpsFieldShell';
import { OPS_FIELD_CLASS } from './ops-field-styles';

interface OpsListSearchFieldProps {
  value: string;
  placeholder: string;
  /** Hover bilgilendirmesi (ör. Enter ile rozet). */
  title?: string;
  onValueChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  rightSlot?: ReactNode;
  className?: string;
}

export function OpsListSearchField({
  value,
  placeholder,
  title,
  onValueChange,
  onKeyDown,
  rightSlot,
  className,
}: OpsListSearchFieldProps): ReactElement {
  const tip = title || (!value.trim() ? placeholder : undefined);
  return (
    <OpsFieldShell
      className={cn('wms-ops-list-search', className)}
      title={tip}
    >
      <Search className="wms-ops-list-search__icon size-3.5" aria-hidden />
      <Input
        value={value}
        placeholder={placeholder}
        title={tip}
        aria-label={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          OPS_FIELD_CLASS,
          'h-9 w-full min-w-0 truncate border bg-transparent pl-8 text-xs shadow-none outline-none ring-0 focus-visible:ring-0',
          rightSlot ? 'pr-9' : 'pr-3',
        )}
      />
      {rightSlot ? <div className="wms-ops-list-search__voice">{rightSlot}</div> : null}
    </OpsFieldShell>
  );
}
