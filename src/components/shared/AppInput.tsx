import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  { type = 'date', className, placeholder, ...props },
  forwardedRef,
): ReactElement {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [useCompactInput, setUseCompactInput] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px), (pointer: coarse)');
    const sync = (): void => setUseCompactInput(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const setRef = (node: HTMLInputElement | null): void => {
    inputRef.current = node;
    assignRef(forwardedRef, node);
  };
  const openPicker = (): void => {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;
    input.focus();
    if (useCompactInput) return;
    try { input.showPicker?.(); } catch { /* Focus is the cross-browser fallback. */ }
  };
  const Icon = type === 'time' ? Clock3 : CalendarDays;

  return (
    <AppInput
      {...props}
      ref={setRef}
      type={useCompactInput ? 'text' : type}
      inputMode={useCompactInput ? 'numeric' : props.inputMode}
      placeholder={placeholder ?? (useCompactInput
        ? type === 'date'
          ? 'YYYY-MM-DD'
          : type === 'time'
            ? 'HH:mm'
            : 'YYYY-MM-DDTHH:mm'
        : undefined)}
      pattern={useCompactInput
        ? type === 'date'
          ? '\\d{4}-\\d{2}-\\d{2}'
          : type === 'time'
            ? '\\d{2}:\\d{2}'
            : '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}'
        : props.pattern}
      className={cn('app-date-input', className)}
      trailingContent={(
        <button
          type="button"
          tabIndex={-1}
          disabled={useCompactInput}
          aria-label={type === 'date'
            ? t('dateInput.openDate')
            : type === 'time'
              ? t('dateInput.openTime')
              : t('dateInput.openDateTime')}
          className="app-input-shell__picker disabled:pointer-events-none disabled:opacity-45"
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
