import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarDays, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AppDatePickerPanel } from '@/components/shared/AppDatePickerPanel';
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
  return (
    <span
      className={cn(
        'app-input-shell',
        opsTone && 'wms-ops-field-shell',
        leadingIcon && 'app-input-shell--leading',
        trailingContent && 'app-input-shell--trailing',
      )}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      aria-invalid={opsTone ? (invalid || undefined) : undefined}
    >
      {leadingIcon ? <span className="app-input-shell__leading" aria-hidden>{leadingIcon}</span> : null}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn('input app-input-control', opsTone && 'wms-ops-field', className)}
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
    ...props
  },
  forwardedRef,
): ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [useMobilePicker, setUseMobilePicker] = useState(prefersMobileDatePicker);
  const stringValue = typeof value === 'string' ? value : value == null ? '' : String(value);
  const pickerDisabled = disabled || readOnly;

  useEffect(() => {
    const media = window.matchMedia(MOBILE_DATE_PICKER_QUERY);
    const sync = (): void => setUseMobilePicker(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

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

  const Icon = type === 'time' ? Clock3 : CalendarDays;
  const resolvedPlaceholder = placeholder ?? (
    type === 'date'
      ? 'YYYY-MM-DD'
      : type === 'time'
        ? 'HH:mm'
        : 'YYYY-MM-DD HH:mm'
  );

  const pickerPanel = (
    <AppDatePickerPanel
      mode={type}
      value={stringValue}
      min={typeof min === 'string' ? min : undefined}
      max={typeof max === 'string' ? max : undefined}
      onChange={emitChange}
      onClose={() => setOpen(false)}
    />
  );

  const inputShell = (
    <AppInput
      {...props}
      ref={forwardedRef}
      type="text"
      inputMode="none"
      readOnly
      disabled={disabled}
      value={stringValue}
      placeholder={resolvedPlaceholder}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn('app-date-input cursor-pointer', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openPicker();
      }}
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
          onClick={openPicker}
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
            <div className="border-b border-[var(--wms-app-border)] px-4 py-3 text-sm font-bold">
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
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={16}
          avoidCollisions
          className={cn(
            'wms-floating-surface wms-date-picker-popover z-[2000] outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          {pickerPanel}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
