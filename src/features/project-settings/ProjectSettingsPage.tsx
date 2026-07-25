import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, Clock3, Hash, Loader2, Save, TimerReset } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
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

const numberLocaleOptions: AppDropdownOption[] = [
  { value: 'tr-TR', label: '1.234,50', description: 'Türkçe sayı biçimi' },
  { value: 'en-US', label: '1,234.50', description: 'İngilizce sayı biçimi' },
  { value: 'de-DE', label: '1.234,50', description: 'Almanca sayı biçimi' },
];
const decimalOptions: AppDropdownOption[] = Array.from({ length: 7 }, (_, value) => ({
  value: String(value),
  label: `${value} basamak`,
}));
const dateOptions: AppDropdownOption[] = ['dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].map((value) => ({ value, label: value }));
const timeOptions: AppDropdownOption[] = ['HH:mm', 'HH:mm:ss', 'hh:mm a', 'hh:mm:ss a'].map((value) => ({ value, label: value }));
const yearOptions: AppDropdownOption[] = [
  { value: 'yyyy', label: '4 haneli (2026)' },
  { value: 'yy', label: '2 haneli (26)' },
];
const timeZoneOptions: AppDropdownOption[] = [
  { value: 'Europe/Istanbul', label: 'İstanbul (UTC+3)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'America/New_York', label: 'New York' },
];

export function ProjectSettingsPage() {
  const [form, setForm] = useState<UpdateProjectSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const { can, isLoading: isPermissionLoading, refetch: refreshPermissions } = usePermissionAccess();
  const setGlobal = useProjectSettingsStore((state) => state.setSettings);
  const preview = useMemo(() => new Date('2026-07-22T13:45:36Z'), []);

  useEffect(() => {
    void refreshPermissions();
    projectSettingsApi
      .get()
      .then((settings) => {
        setForm(toForm(settings));
        setGlobal(settings);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Ayarlar alınamadı.'));
  }, [refreshPermissions, setGlobal]);

  const set = <K extends keyof UpdateProjectSettings>(key: K, value: UpdateProjectSettings[K]): void => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    try {
      const result = await projectSettingsApi.update(form);
      setForm(toForm(result));
      setGlobal(result);
      toast.success('Proje ayarları kaydedildi ve uygulandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="grid min-h-72 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>;
  }

  const canManage = !isPermissionLoading && can('SYSTEM.PROJECT_SETTINGS.MANAGE');

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">Sistem</p>
        <h1 className="mt-1 text-2xl font-bold">Genel Proje Ayarları</h1>
        <p className="mt-1 text-sm text-slate-500">Tüm kullanıcılar için sayı, miktar, tarih, saat, yıl ve zaman dilimi gösterimini merkezi olarak yönetin.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Preview icon={<Hash />} label="Sayı" value={formatProjectNumber(1234.5, undefined, form)} />
        <Preview icon={<CalendarDays />} label="Tarih" value={formatProjectDate(preview, form)} />
        <Preview icon={<Clock3 />} label="Saat" value={formatProjectTime(preview, form)} />
        <Preview icon={<CalendarDays />} label="Tarih / Saat" value={formatProjectDateTime(preview, form)} />
        <Preview icon={<TimerReset />} label="Yıl" value={formatProjectYear(preview, form)} />
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Sayı biçimi"><AppDropdown value={form.numberLocale} onValueChange={(value) => set('numberLocale', value)} options={numberLocaleOptions} ariaLabel="Sayı biçimi" testId="number-locale-dropdown" /></Field>
          <Field label="Ondalık basamak"><AppDropdown value={String(form.decimalPlaces)} onValueChange={(value) => set('decimalPlaces', Number(value))} options={decimalOptions} ariaLabel="Ondalık basamak" testId="decimal-places-dropdown" /></Field>
          <Field label="Tarih biçimi"><AppDropdown value={form.dateFormat} onValueChange={(value) => set('dateFormat', value)} options={dateOptions} ariaLabel="Tarih biçimi" testId="date-format-dropdown" /></Field>
          <Field label="Saat biçimi"><AppDropdown value={form.timeFormat} onValueChange={(value) => set('timeFormat', value)} options={timeOptions} ariaLabel="Saat biçimi" testId="time-format-dropdown" /></Field>
          <Field label="Yıl biçimi"><AppDropdown value={form.yearFormat} onValueChange={(value) => set('yearFormat', value)} options={yearOptions} ariaLabel="Yıl biçimi" testId="year-format-dropdown" /></Field>
          <Field label="Zaman dilimi"><AppDropdown value={form.timeZoneId} onValueChange={(value) => set('timeZoneId', value)} options={timeZoneOptions} ariaLabel="Zaman dilimi" searchable searchPlaceholder="Zaman dilimi ara..." testId="timezone-dropdown" /></Field>
        </div>

        <div className="mt-5 rounded-xl border border-[var(--wms-app-border)] bg-slate-50/70 p-4 text-sm dark:bg-white/[.03]">
          <strong>Canlı örnek:</strong> Ayarı seçtiğiniz anda üstteki kartlar değişir. Kayıt sonrasında açık ekranlardaki ortak grid ve WMS miktar/tarih alanları yeni biçimi kullanır.
        </div>

        {!isPermissionLoading && !canManage && (
          <p className="mt-4 text-right text-sm text-amber-600 dark:text-amber-300">Bu ayarları kaydetmek için proje ayarları yönetme yetkisi gereklidir.</p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={!canManage || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Ayarları Kaydet
          </button>
        </div>
      </form>
    </section>
  );
}

function toForm(settings: ProjectSettings): UpdateProjectSettings {
  return {
    numberLocale: settings.numberLocale,
    decimalPlaces: settings.decimalPlaces,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    yearFormat: settings.yearFormat,
    timeZoneId: settings.timeZoneId,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return <div className="space-y-1.5"><label className="text-sm font-semibold">{label}</label>{children}</div>;
}

function Preview({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><span className="[&>svg]:size-4">{icon}</span>{label}</div><p className="mt-2 text-lg font-bold">{value}</p></div>;
}
