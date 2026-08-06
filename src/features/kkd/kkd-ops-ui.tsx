import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useTheme } from '@/components/theme-provider';
import { OpsCodeBadge } from '@/components/shared/OpsStatusBadge';
import { OpsFieldShell } from '@/components/shared/OpsFieldShell';
import { OpsPageHeader } from '@/components/shared/OpsPageHeader';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OPS_FIELD_CLASS } from '@/components/shared/ops-field-styles';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

/** Mal kabul ızgarasıyla aynı hücre çerçevesi. */
export const KKD_CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2.5 py-2 align-middle last:border-r-0';

/** Başlık hücreleri gövde hücreleriyle aynı çerçeveyi paylaşır. */
export const KKD_HEAD_CELL = cn(KKD_CELL, 'wms-ops-table-head text-left');

/**
 * `wms-ops-list wms-ops-form` kökü, ops yüzey sınıflarının (alan, buton, ızgara,
 * rozet) çalışması için zorunlu; bu yüzden bütün KKD sayfaları bu kabuğu kullanır.
 */
export function KkdPage({
  title,
  description,
  hintLabel = 'Bu sayfa ne yapar?',
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  hintLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const setPageTitle = useUIStore((state) => state.setPageTitle);

  useEffect(() => {
    setPageTitle(title);
    return () => setPageTitle(null);
  }, [setPageTitle, title]);

  return (
    <section className={cn('wms-ops-list wms-ops-form mx-auto w-full max-w-[1500px] space-y-4', className)}>
      <OpsPageHeader title={title} description={description} hintLabel={hintLabel} actions={actions} />
      {children}
    </section>
  );
}

export function KkdPanel({
  title,
  description,
  code,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  code?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';

  return (
    <section
      className={cn(
        'wms-ops-form-card wms-ops-data-grid-shell overflow-hidden rounded-none border border-[var(--wms-ops-card-border)] py-0 shadow-none',
        className,
      )}
    >
      <div className="wms-ops-card-toolbar flex flex-col gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-card-border)_80%,transparent)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="wms-ops-card-heading flex min-w-0 items-start gap-3">
          {icon ? (
            <span
              aria-hidden
              className={cn(
                'grid size-8 shrink-0 place-items-center border border-[color-mix(in_oklab,var(--wms-ops-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_9%,transparent)] text-[var(--wms-ops-accent)]',
                isPremium ? 'rounded-lg' : 'rounded-none',
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h2 className="wms-ops-title">
              <span className="wms-ops-title-main wms-ops-title-main--toolbar">{title}</span>
            </h2>
            {description ? (
              <p className="wms-ops-subtitle font-mono text-sm">
                {!isPremium ? (
                  <span className="wms-ops-subtitle-prefix" aria-hidden>
                    {'> '}
                  </span>
                ) : null}
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions || code ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
            {code ? <OpsCodeBadge>{code}</OpsCodeBadge> : null}
          </div>
        ) : null}
      </div>
      <div className={cn('px-3 py-3 sm:px-4 sm:py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function KkdField({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      {htmlFor ? (
        <label className="wms-ops-entry-label block" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="wms-ops-entry-label block">{label}</span>
      )}
      {children}
      {hint ? (
        <span className="block text-[0.7rem] leading-5 text-[var(--wms-app-text-muted)]">{hint}</span>
      ) : null}
    </div>
  );
}

export function KkdTableShell({
  minWidthClass = 'min-w-[900px]',
  maxHeightClass = 'max-h-[max(20rem,calc(100dvh-30rem))]',
  children,
  className,
}: {
  minWidthClass?: string;
  maxHeightClass?: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        'wms-ops-scrollbar relative block overflow-x-auto overflow-y-auto border border-[var(--wms-ops-card-border)]',
        maxHeightClass,
        className,
      )}
    >
      <table className={cn('wms-ops-data-grid w-full border-collapse text-sm', minWidthClass)}>{children}</table>
    </div>
  );
}

export function KkdMetric({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}): ReactElement {
  const { skin } = useTheme();

  return (
    <div
      className={cn(
        'min-w-0 border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_82%,transparent)] px-3 py-2.5',
        skin === 'premium' ? 'rounded-xl' : 'rounded-none',
        className,
      )}
    >
      <span className="wms-ops-entry-label block">{label}</span>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
      {hint ? <p className="mt-0.5 text-[0.68rem] text-[var(--wms-app-text-muted)]">{hint}</p> : null}
    </div>
  );
}

/** Serbest metin alanları için ops tonlu textarea kabuğu. */
export function KkdTextarea({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  maxLength?: number;
}): ReactElement {
  return (
    <OpsFieldShell>
      <textarea
        className={cn(OPS_FIELD_CLASS, 'min-h-20 w-full resize-y py-2', className)}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </OpsFieldShell>
  );
}

/** Tablo satırlarında kullanılan tema uyumlu seçim kutusu. */
export function KkdRowCheckbox({
  checked,
  disabled,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}): ReactElement {
  return (
    <OpsSkinCheckbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className="mx-auto"
    />
  );
}

/**
 * Politika/kural satırı: başlık + açıklama solda, temanın checkbox'ı sağda.
 * Satırın tamamı tıklanabilir; checkbox kendi tıklamasını yukarı taşımaz.
 */
export function KkdCheckRow({
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
  const { skin } = useTheme();

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        onCheckedChange(!checked);
      }}
      className={cn(
        'flex items-start justify-between gap-3 border p-3 transition',
        skin === 'premium' ? 'rounded-xl' : 'rounded-none',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        checked
          ? 'border-[color-mix(in_oklab,var(--wms-ops-accent)_50%,var(--wms-ops-card-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,var(--wms-ops-field-bg))]'
          : 'border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_82%,transparent)] hover:border-[color-mix(in_oklab,var(--wms-ops-accent)_42%,var(--wms-ops-card-border))]',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[0.8rem] font-semibold leading-snug">{title}</span>
        {description ? (
          <span className="mt-1 block text-[0.72rem] leading-5 text-[var(--wms-app-text-muted)]">{description}</span>
        ) : null}
      </span>
      <OpsSkinCheckbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={typeof title === 'string' ? title : undefined}
        className="mt-0.5"
      />
    </div>
  );
}

export type KkdCalloutTone = 'info' | 'warn' | 'danger' | 'success';

const CALLOUT_SURFACE: Record<KkdCalloutTone, string> = {
  info: 'border-[color-mix(in_oklab,var(--wms-ops-accent)_34%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)]',
  warn: 'border-[color-mix(in_oklab,var(--wms-ops-warm)_36%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-warm)_8%,transparent)]',
  danger: 'border-rose-500/40 bg-rose-500/10',
  success: 'border-emerald-500/40 bg-emerald-500/10',
};

const CALLOUT_ICON: Record<KkdCalloutTone, string> = {
  info: 'text-[var(--wms-ops-accent)]',
  warn: 'text-[var(--wms-ops-warm)]',
  danger: 'text-rose-500',
  success: 'text-emerald-500',
};

export function KkdCallout({
  tone = 'info',
  icon,
  title,
  children,
  actions,
  className,
}: {
  tone?: KkdCalloutTone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}): ReactElement {
  const { skin } = useTheme();

  return (
    <div
      className={cn(
        'flex items-start gap-3 border p-3.5',
        CALLOUT_SURFACE[tone],
        skin === 'premium' ? 'rounded-xl' : 'rounded-none',
        className,
      )}
    >
      {icon ? (
        <span className={cn('mt-0.5 shrink-0', CALLOUT_ICON[tone])} aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <strong className="block text-[0.78rem] font-bold">{title}</strong> : null}
        {children ? (
          <div className="mt-0.5 text-[0.74rem] leading-5 text-[var(--wms-app-text-muted)]">{children}</div>
        ) : null}
        {actions ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/**
 * Tema uyumlu seçilebilir kart (sipariş seçimi gibi tek/çok seçimli listeler).
 * Checkbox'ı tema kendi çiziyor; kart yalnızca yüzeyi sağlar.
 */
export function KkdSelectableCard({
  selected,
  disabled,
  onToggle,
  control,
  children,
  className,
}: {
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  control: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const { skin } = useTheme();

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        onToggle();
      }}
      className={cn(
        'flex items-center gap-3 border p-3 transition',
        skin === 'premium' ? 'rounded-xl' : 'rounded-none',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        selected
          ? 'border-[color-mix(in_oklab,var(--wms-ops-accent)_58%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,var(--wms-ops-field-bg))]'
          : 'border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_82%,transparent)] hover:border-[color-mix(in_oklab,var(--wms-ops-accent)_42%,var(--wms-ops-card-border))]',
        className,
      )}
    >
      {control}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
