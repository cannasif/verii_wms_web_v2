import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { useAuthStore } from '@/stores/auth-store';
import { packingApi } from './packing-api';
import type { PackingPolicy } from './types';

const POLICY = 'processPolicy.packing';
const TOGGLE_KEYS = [
  'requirePacking',
  'allowPartialPacking',
  'allowMixedStock',
  'allowMixedLot',
  'allowMixedCustomer',
  'requireSerialLotScan',
  'requireWeight',
  'requireDimensions',
  'requireSscc',
  'autoGenerateSscc',
  'autoPrintLabelOnClose',
  'allowReopen',
  'allowRepack',
] as const;

export function PackingPolicyPage() {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branch = useAuthStore(x => x.branch?.code ?? '0');
  const [form, setForm] = useState<PackingPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void packingApi.policy(branch).then(setForm).catch((error: Error) => toast.error(error.message));
  }, [branch]);

  const closeOptions = useMemo(
    () => ([
      { value: 'Manual', label: t(`${POLICY}.closePolicy.Manual`) },
      { value: 'AutoWhenComplete', label: t(`${POLICY}.closePolicy.AutoWhenComplete`) },
    ] as const),
    [language, t],
  );

  const releaseOptions = useMemo(
    () => ([
      { value: 'Manual', label: t(`${POLICY}.releasePolicy.Manual`) },
      { value: 'OnClose', label: t(`${POLICY}.releasePolicy.OnClose`) },
    ] as const),
    [language, t],
  );

  const set = <K extends keyof PackingPolicy>(key: K, value: PackingPolicy[K]) =>
    setForm(current => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await packingApi.updatePolicy(form));
      toast.success(t(`${POLICY}.saveSuccess`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.saveError`));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="grid min-h-72 place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5" data-no-auto-localize="true">
      <header>
        <div className="flex items-center gap-2 text-cyan-500">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">{t(`${POLICY}.eyebrow`)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-black">{t(`${POLICY}.title`)}</h1>
        <p className="text-sm text-slate-500">{t(`${POLICY}.description`)}</p>
      </header>

      <div className="space-y-5 rounded-2xl border bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TOGGLE_KEYS.map(key => (
            <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>{t(`${POLICY}.toggles.${key}`)}</span>
              <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
            </label>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span>{t(`${POLICY}.fields.weightTolerance`)}</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={form.weightTolerancePercent}
              onChange={e => set('weightTolerancePercent', Number(e.target.value))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t(`${POLICY}.fields.closePolicy`)}</span>
            <AppDropdown
              value={form.closePolicy}
              onValueChange={v => set('closePolicy', v as PackingPolicy['closePolicy'])}
              options={closeOptions.map(o => ({ value: o.value, label: o.label }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t(`${POLICY}.fields.releasePolicy`)}</span>
            <AppDropdown
              value={form.releasePolicy}
              onValueChange={v => set('releasePolicy', v as PackingPolicy['releasePolicy'])}
              options={releaseOptions.map(o => ({ value: o.value, label: o.label }))}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 font-bold text-slate-950"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t(`${POLICY}.save`)}
          </button>
        </div>
      </div>
    </section>
  );
}
