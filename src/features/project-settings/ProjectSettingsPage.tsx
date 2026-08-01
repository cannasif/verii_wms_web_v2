import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, Clock3, Hash, Loader2, LockKeyhole, Save, TimerReset } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCircuitToggleField } from '@/components/shared/OpsCircuitToggle';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
  formatProjectTime,
  formatProjectYear,
} from '@/lib/project-format';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { projectSettingsApi } from './project-settings.api';
import type { ProjectSettings, UpdateProjectSettings } from './project-settings.types';

type ProjectSettingsForm = UpdateProjectSettings & Pick<ProjectSettings, 'passwordMaximumLength'>;

export function ProjectSettingsPage() {
  const { t } = useModuleTranslation('project-settings');
  const [form, setForm] = useState<ProjectSettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { can, isLoading: isPermissionLoading, refetch: refreshPermissions } = usePermissionAccess();
  const setGlobal = useProjectSettingsStore((state) => state.setSettings);
  const preview = useMemo(() => new Date('2026-07-22T13:45:36Z'), []);

  const numberLocaleOptions: AppDropdownOption[] = useMemo(
    () => [
      { value: 'tr-TR', label: '1.234,50', description: t('numberLocale.trDescription') },
      { value: 'en-US', label: '1,234.50', description: t('numberLocale.enDescription') },
      { value: 'de-DE', label: '1.234,50', description: t('numberLocale.deDescription') },
    ],
    [t],
  );
  const decimalOptions: AppDropdownOption[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, value) => ({
        value: String(value),
        label: t('decimalPlaces.optionLabel', { value }),
      })),
    [t],
  );
  const dateOptions: AppDropdownOption[] = ['dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].map((value) => ({ value, label: value }));
  const timeOptions: AppDropdownOption[] = ['HH:mm', 'HH:mm:ss', 'hh:mm a', 'hh:mm:ss a'].map((value) => ({ value, label: value }));
  const yearOptions: AppDropdownOption[] = useMemo(
    () => [
      { value: 'yyyy', label: t('yearFormat.fourDigit') },
      { value: 'yy', label: t('yearFormat.twoDigit') },
    ],
    [t],
  );
  const timeZoneOptions: AppDropdownOption[] = useMemo(
    () => [
      { value: 'Europe/Istanbul', label: t('timeZone.istanbul') },
      { value: 'UTC', label: 'UTC' },
      { value: 'Europe/Berlin', label: t('timeZone.berlin') },
      { value: 'America/New_York', label: t('timeZone.newYork') },
    ],
    [t],
  );

  useEffect(() => {
    void refreshPermissions();
    projectSettingsApi
      .get()
      .then((settings) => {
        setForm(toForm(settings));
        setGlobal(settings);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : t('errors.loadFailed')));
  }, [refreshPermissions, setGlobal, t]);

  const set = <K extends keyof UpdateProjectSettings>(key: K, value: UpdateProjectSettings[K]): void => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    try {
      const request: UpdateProjectSettings = {
        numberLocale: form.numberLocale,
        decimalPlaces: form.decimalPlaces,
        dateFormat: form.dateFormat,
        timeFormat: form.timeFormat,
        yearFormat: form.yearFormat,
        timeZoneId: form.timeZoneId,
        sendSerialsToErp: form.sendSerialsToErp,
        passwordMinimumLength: form.passwordMinimumLength,
      };
      const result = await projectSettingsApi.update(request);
      setForm(toForm(result));
      setGlobal(result);
      toast.success(t('toast.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="grid min-h-72 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>;
  }

  const canManage = !isPermissionLoading && can('SYSTEM.PROJECT_SETTINGS.MANAGE');

  return (
    <section className="wms-ops-form mx-auto max-w-6xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('description')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Preview icon={<Hash />} label={t('preview.number')} value={formatProjectNumber(1234.5, undefined, form)} />
        <Preview icon={<CalendarDays />} label={t('preview.date')} value={formatProjectDate(preview, form)} />
        <Preview icon={<Clock3 />} label={t('preview.time')} value={formatProjectTime(preview, form)} />
        <Preview icon={<CalendarDays />} label={t('preview.dateTime')} value={formatProjectDateTime(preview, form)} />
        <Preview icon={<TimerReset />} label={t('preview.year')} value={formatProjectYear(preview, form)} />
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('numberLocale.label')}><AppDropdown value={form.numberLocale} onValueChange={(value) => set('numberLocale', value)} options={numberLocaleOptions} ariaLabel={t('numberLocale.label')} testId="number-locale-dropdown" /></Field>
          <Field label={t('decimalPlaces.label')}><AppDropdown value={String(form.decimalPlaces)} onValueChange={(value) => set('decimalPlaces', Number(value))} options={decimalOptions} ariaLabel={t('decimalPlaces.label')} testId="decimal-places-dropdown" /></Field>
          <Field label={t('dateFormat.label')}><AppDropdown value={form.dateFormat} onValueChange={(value) => set('dateFormat', value)} options={dateOptions} ariaLabel={t('dateFormat.label')} testId="date-format-dropdown" /></Field>
          <Field label={t('timeFormat.label')}><AppDropdown value={form.timeFormat} onValueChange={(value) => set('timeFormat', value)} options={timeOptions} ariaLabel={t('timeFormat.label')} testId="time-format-dropdown" /></Field>
          <Field label={t('yearFormat.label')}><AppDropdown value={form.yearFormat} onValueChange={(value) => set('yearFormat', value)} options={yearOptions} ariaLabel={t('yearFormat.label')} testId="year-format-dropdown" /></Field>
          <Field label={t('timeZone.label')}><AppDropdown value={form.timeZoneId} onValueChange={(value) => set('timeZoneId', value)} options={timeZoneOptions} ariaLabel={t('timeZone.label')} searchable searchPlaceholder={t('timeZone.searchPlaceholder')} testId="timezone-dropdown" /></Field>
          <Field label={t('passwordMinLength.label')}>
            <AppInput
              type="number"
              min={5}
              max={form.passwordMaximumLength}
              value={form.passwordMinimumLength}
              onChange={(event) => set('passwordMinimumLength', Number(event.target.value))}
              leadingIcon={<LockKeyhole className="size-4 text-[var(--wms-brand-primary)]" />}
              aria-label={t('passwordMinLength.label')}
              disabled={!canManage}
            />
          </Field>
          <Field label={t('passwordMaxLength.label')}>
            <AppInput
              type="number"
              value={form.passwordMaximumLength}
              disabled
              aria-label={t('passwordMaxLength.label')}
            />
          </Field>
          <div className="md:col-span-2">
            <OpsCircuitToggleField
              checked={form.sendSerialsToErp}
              onCheckedChange={(checked) => set('sendSerialsToErp', checked)}
              disabled={!canManage}
              title={t('sendSerialsToErp.label')}
              description={t('sendSerialsToErp.description')}
              className="rounded-xl border"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[var(--wms-app-border)] bg-slate-50/70 p-4 text-sm dark:bg-white/[.03]">
          <strong>{t('passwordSecurityNotice.label')}</strong> {t('passwordSecurityNotice.text', { max: form.passwordMaximumLength })}
        </div>

        {!isPermissionLoading && !canManage && (
          <p className="mt-4 text-right text-sm text-amber-600 dark:text-amber-300">{t('permissionRequiredNotice')}</p>
        )}
        <div className="mt-5 flex justify-end">
          <OpsActionButton type="submit" variant="primary" disabled={!canManage || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {t('saveButton')}
          </OpsActionButton>
        </div>
      </form>
    </section>
  );
}

function toForm(settings: ProjectSettings): ProjectSettingsForm {
  return {
    numberLocale: settings.numberLocale,
    decimalPlaces: settings.decimalPlaces,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    yearFormat: settings.yearFormat,
    timeZoneId: settings.timeZoneId,
    sendSerialsToErp: settings.sendSerialsToErp ?? true,
    passwordMinimumLength: settings.passwordMinimumLength ?? 6,
    passwordMaximumLength: settings.passwordMaximumLength ?? 15,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return <div className="space-y-1.5"><label className="text-sm font-semibold">{label}</label>{children}</div>;
}

function Preview({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><span className="[&>svg]:size-4">{icon}</span>{label}</div><p className="mt-2 text-lg font-bold">{value}</p></div>;
}
