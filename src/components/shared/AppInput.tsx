import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarDays, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AppDatePickerPanel } from '@/components/shared/AppDatePickerPanel';
import {
  maskManualDateTyping,
  normalizeManualDateInput,
  toDisplayDateValue,
} from '@/components/shared/app-date-input.utils';
import { cn } from '@/lib/utils';

const MOBILE_DATE_PICKER_QUERY = '(max-width: 767px)';

function prefersMobileDatePicker(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_DATE_PICKER_QUERY).matches;
}

export interface AppInputProps extends ComponentPropsWithoutRef<'input'> {
  leadingIcon?: ReactNode;
  trailingContent?: ReactNode;
  invalid?: boolean;
  /**
   * `ops` (varsayılan): Terminal field shell.
   * `plain`: Auth yüzeyleri — ops underline / mono DNA yok.
   */
  tone?: 'ops' | 'plain';
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className, leadingIcon, trailingContent, invalid, disabled, tone = 'ops', ...props },
  ref,
): ReactElement {
  const opsTone = tone === 'ops';
  const localRef = useRef<HTMLInputElement | null>(null);

  const setRefs = (node: HTMLInputElement | null): void => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (invalid) {
      el.style.setProperty('border-color', '#ef4444', 'important');
      el.style.setProperty(
        'background-color',
        'color-mix(in oklab, #ef4444 12%, var(--wms-ops-field-bg, #0d0d14))',
        'important',
      );
      el.style.setProperty(
        'box-shadow',
        '0 0 0 1px rgb(239 68 68 / 55%), 0 0 0 3px rgb(239 68 68 / 22%)',
        'important',
      );
      el.style.setProperty('outline', 'none', 'important');
    } else {
      el.style.removeProperty('border-color');
      el.style.removeProperty('background-color');
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('outline');
    }
  }, [invalid]);

  return (
    <span
      className={cn(
        'app-input-shell',
        opsTone && 'wms-ops-field-shell',
        opsTone && invalid && 'wms-ops-field-shell--error',
        leadingIcon && 'app-input-shell--leading',
        trailingContent && 'app-input-shell--trailing',
      )}
      data-disabled={disabled || undefined}
      data-invalid={invalid ? 'true' : undefined}
      aria-invalid={invalid ? true : undefined}
    >
      {leadingIcon ? <span className="app-input-shell__leading" aria-hidden>{leadingIcon}</span> : null}
      <input
        ref={setRefs}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        className={cn(
          'input app-input-control',
          opsTone && 'wms-ops-field',
          invalid && 'wms-ops-field--invalid',
          className,
        )}
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
  {
    type = 'date',
    className,
    placeholder,
    disabled,
    readOnly,
    value,
    onChange,
    min,
    max,
    onClick,
    onBlur,
    onFocus,
    ...props
  },
  forwardedRef,
): ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [useMobilePicker, setUseMobilePicker] = useState(prefersMobileDatePicker);
  const [draft, setDraft] = useState<string | null>(null);
  const lastValidValue = useRef('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stringValue = typeof value === 'string' ? value : value == null ? '' : String(value);
  const inputReadOnly = Boolean(readOnly);
  const pickerDisabled = disabled || inputReadOnly;
  const isDateMode = type === 'date';
  const displayValue = draft ?? (isDateMode ? toDisplayDateValue(stringValue) : stringValue);

  useEffect(() => {
    lastValidValue.current = stringValue;
  }, [stringValue]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_DATE_PICKER_QUERY);
    const sync = (): void => setUseMobilePicker(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const setRefs = (node: HTMLInputElement | null): void => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const emitChange = (nextValue: string): void => {
    onChange?.({
      target: { value: nextValue, name: props.name ?? '' },
      currentTarget: { value: nextValue, name: props.name ?? '' },
    } as ChangeEvent<HTMLInputElement>);
  };

  const openPicker = (): void => {
    if (pickerDisabled) return;
    setOpen(true);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (isDateMode) {
      const masked = maskManualDateTyping(event.target.value);
      setDraft(masked);
      const iso = normalizeManualDateInput(masked, 'date');
      if (iso) emitChange(iso);
      return;
    }
    emitChange(event.target.value);
  };

  const handleInputBlur = (event: FocusEvent<HTMLInputElement>): void => {
    onBlur?.(event);
    if (inputReadOnly || disabled) {
      setDraft(null);
      return;
    }
    const source = draft ?? (isDateMode ? toDisplayDateValue(stringValue) : stringValue);
    const normalized = normalizeManualDateInput(source, type);
    setDraft(null);
    if (normalized === null) {
      emitChange(lastValidValue.current);
      return;
    }
    emitChange(normalized);
  };

  const handleInputFocus = (event: FocusEvent<HTMLInputElement>): void => {
    onFocus?.(event);
    if (isDateMode && !inputReadOnly && !disabled) {
      setDraft(toDisplayDateValue(stringValue));
    }
    requestAnimationFrame(() => {
      event.currentTarget.select();
    });
  };

  const handleInputClick = (event: MouseEvent<HTMLInputElement>): void => {
    onClick?.(event);
    if (!inputReadOnly && !disabled) {
      event.currentTarget.select();
    }
  };

  const Icon = type === 'time' ? Clock3 : CalendarDays;
  const resolvedPlaceholder = placeholder ?? (
    type === 'date'
      ? t('dateInput.placeholderDate')
      : type === 'time'
        ? t('dateInput.placeholderTime')
        : t('dateInput.placeholderDateTime')
  );

  const pickerPanel = (
    <AppDatePickerPanel
      mode={type}
      value={stringValue}
      min={typeof min === 'string' ? min : undefined}
      max={typeof max === 'string' ? max : undefined}
      onChange={(next) => {
        setDraft(null);
        emitChange(next);
      }}
      onClose={() => setOpen(false)}
    />
  );

  const inputShell = (
    <AppInput
      {...props}
      ref={setRefs}
      type="text"
      inputMode={isDateMode ? 'numeric' : 'text'}
      autoComplete="off"
      spellCheck={false}
      readOnly={inputReadOnly}
      disabled={disabled}
      value={displayValue}
      placeholder={resolvedPlaceholder}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn('app-date-input', inputReadOnly && 'app-date-input--readonly', className)}
      onChange={handleInputChange}
      onBlur={handleInputBlur}
      onFocus={handleInputFocus}
      onClick={handleInputClick}
      trailingContent={(
        <button
          type="button"
          tabIndex={-1}
          disabled={pickerDisabled}
          aria-label={type === 'date'
            ? t('dateInput.openDate')
            : type === 'time'
              ? t('dateInput.openTime')
              : t('dateInput.openDateTime')}
          className="app-input-shell__picker disabled:pointer-events-none disabled:opacity-45"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPicker();
          }}
        >
          <Icon className="size-4" />
        </button>
      )}
    />
  );

  if (useMobilePicker) {
    return (
      <>
        {inputShell}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="wms-date-picker-dialog gap-0 p-0 sm:max-w-sm" showCloseButton={false}>
            <div className="wms-date-picker-dialog__header">
              {type === 'date'
                ? t('dateInput.openDate')
                : type === 'time'
                  ? t('dateInput.openTime')
                  : t('dateInput.openDateTime')}
            </div>
            <div className="p-3">{pickerPanel}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <span className="block w-full min-w-0">{inputShell}</span>
      </PopoverPrimitive.Anchor>
      {/* Body portal avoids workspace transform/overflow shifting the calendar. */}
      <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={16}
          avoidCollisions
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'wms-floating-surface wms-date-picker-popover z-[2000] rounded-xl text-[var(--wms-app-text)] outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          {pickerPanel}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
