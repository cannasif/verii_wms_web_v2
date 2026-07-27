import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { smtpApi as systemApi } from '../api/smtp.api';

const S = 'smtpSettings';
const initial = { host: 'smtp.gmail.com', port: 587, enableSsl: true, username: '', password: '', fromEmail: '', fromName: 'V3RII WMS', timeout: 30 };

const FIELD_KEYS = ['host', 'port', 'username', 'password', 'fromEmail', 'fromName', 'timeout'] as const;

export function SmtpSettingsPage() {
  const { t } = useTranslation('common');
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void systemApi.getSmtp().then(x => setForm(v => ({ ...v, ...x, password: '' }))).catch(() => {});
  }, []);

  const set = (key: string, value: unknown) => setForm(v => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await systemApi.updateSmtp(form);
    setMessage(t(`${S}.saveSuccess`));
  };

  const test = async () => {
    const to = window.prompt(t(`${S}.testPrompt`));
    if (!to) return;
    await systemApi.testSmtp(to);
    setMessage(t(`${S}.testSuccess`));
  };

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6" data-no-auto-localize="true">
      <h1 className="text-2xl font-bold">{t(`${S}.title`)}</h1>
      <p className="mt-1 text-sm text-slate-500">{t(`${S}.description`)}</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        {FIELD_KEYS.map(key => (
          <label key={key} className="space-y-1 text-sm">
            <span>{t(`${S}.fields.${key}`)}</span>
            <input
              type={key === 'password' ? 'password' : key === 'port' || key === 'timeout' ? 'number' : 'text'}
              value={String(form[key as keyof typeof form] ?? '')}
              onChange={e => set(key, key === 'port' || key === 'timeout' ? Number(e.target.value) : e.target.value)}
              className="h-10 w-full rounded-xl border bg-transparent px-3"
            />
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.enableSsl} onChange={e => set('enableSsl', e.target.checked)} />
          {t(`${S}.enableSsl`)}
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => void test()} className="rounded-xl border px-4 py-2">{t(`${S}.sendTest`)}</button>
          <button type="submit" className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-white">{t(`${S}.save`)}</button>
        </div>
        {message && <p className="text-sm text-emerald-600 sm:col-span-2">{message}</p>}
      </form>
    </section>
  );
}
