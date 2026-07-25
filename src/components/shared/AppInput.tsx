import {
  forwardRef,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppInputProps extends ComponentPropsWithoutRef<'input'> {
  leadingIcon?: ReactNode;
  trailingContent?: ReactNode;
  invalid?: boolean;
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className, leadingIcon, trailingContent, invalid, disabled, ...props },
  ref,
): ReactElement {
  return (
    <span
      className={cn(
        'app-input-shell',
        leadingIcon && 'app-input-shell--leading',
        trailingContent && 'app-input-shell--trailing',
      )}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      {leadingIcon ? <span className="app-input-shell__leading" aria-hidden>{leadingIcon}</span> : null}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn('input app-input-control', className)}
        {...props}
      />
      {trailingContent ? <span className="app-input-shell__trailing">{trailingContent}</span> : null}
    </span>
  );
});

export interface AppDateInputProps extends Omit<AppInputProps, 'type' | 'leadingIcon' | 'trailingContent'> {
  type?: 'date' | 'datetime-local' | 'time';
}

export const AppDateInput = forwardRef<HTMLInputElement, AppDateInputProps>(function AppDateInput(
  { type = 'date', className, ...props },
  forwardedRef,
): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRef = (node: HTMLInputElement | null): void => {
    inputRef.current = node;
    assignRef(forwardedRef, node);
  };
  const openPicker = (): void => {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;
    input.focus();
    try { input.showPicker?.(); } catch { /* Focus is the cross-browser fallback. */ }
  };
  const Icon = type === 'time' ? Clock3 : CalendarDays;

  return (
    <AppInput
      {...props}
      ref={setRef}
      type={type}
      className={cn('app-date-input', className)}
      trailingContent={(
        <button
          type="button"
          tabIndex={-1}
          aria-label={type === 'date' ? 'Takvimi aç' : type === 'time' ? 'Saat seçiciyi aç' : 'Tarih ve saat seçiciyi aç'}
          className="app-input-shell__picker"
          onClick={openPicker}
        >
          <Icon className="size-4" />
        </button>
      )}
    />
  );
});

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
