import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCircuitToggleField } from '@/components/shared/OpsCircuitToggle';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { smtpApi as systemApi } from '../api/smtp.api';

const S = 'smtpSettings';
const initial = { host: 'smtp.gmail.com', port: 587, enableSsl: true, username: '', password: '', fromEmail: '', fromName: 'V3RII WMS', timeout: 30 };

const FIELD_KEYS = ['host', 'port', 'username', 'password', 'fromEmail', 'fromName', 'timeout'] as const;

export function SmtpSettingsPage() {
  const { t } = useTranslation('common');
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void systemApi.getSmtp().then(x => setForm(v => ({ ...v, ...x, password: '' }))).catch(() => {});
  }, []);

  const set = (key: string, value: unknown) => setForm(v => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await systemApi.updateSmtp(form);
      setMessage(t(`${S}.saveSuccess`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.errors.smtpSettingsUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const to = testEmail.trim();
    if (!to) return;
    setTesting(true);
    try {
      await systemApi.testSmtp(to);
      setMessage(t(`${S}.testSuccess`));
      setTestOpen(false);
      setTestEmail('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${S}.testPrompt`));
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="wms-ops-form mx-auto max-w-4xl rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6" data-no-auto-localize="true">
      <h1 className="text-2xl font-bold">{t(`${S}.title`)}</h1>
      <p className="mt-1 text-sm text-slate-500">{t(`${S}.description`)}</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        {FIELD_KEYS.map(key => (
          <div key={key} className="space-y-1.5 text-sm">
            <label className="font-medium" htmlFor={`smtp-${key}`}>{t(`${S}.fields.${key}`)}</label>
            <AppInput
              id={`smtp-${key}`}
              type={key === 'password' ? 'password' : key === 'port' || key === 'timeout' ? 'number' : 'text'}
              value={String(form[key as keyof typeof form] ?? '')}
              onChange={e => set(key, key === 'port' || key === 'timeout' ? Number(e.target.value) : e.target.value)}
              autoComplete={key === 'password' ? 'new-password' : 'off'}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <OpsCircuitToggleField
            checked={form.enableSsl}
            onCheckedChange={(checked) => set('enableSsl', checked)}
            title={t(`${S}.enableSsl`)}
          />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <OpsActionButton type="button" variant="secondary" onClick={() => { setTestEmail(''); setTestOpen(true); }}>
            {t(`${S}.sendTest`)}
          </OpsActionButton>
          <OpsActionButton type="submit" variant="primary" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t(`${S}.save`)}
          </OpsActionButton>
        </div>
        {message && <p className="text-sm text-emerald-600 sm:col-span-2">{message}</p>}
      </form>

      <Dialog open={testOpen} onOpenChange={(open) => { if (!open && !testing) setTestOpen(false); }}>
        <OpsDialogContent size="md" className="wms-ops-access-control-dialog">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{t(`${S}.sendTest`)}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{t(`${S}.testPrompt`)}</p>
            </div>
          </OpsDialogHeader>
          <OpsDialogBody>
            <AppInput
              autoFocus
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="name@example.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void sendTest();
                }
              }}
            />
          </OpsDialogBody>
          <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
            <OpsActionButton type="button" variant="secondary" disabled={testing} onClick={() => setTestOpen(false)}>
              {t('common.cancel')}
            </OpsActionButton>
            <OpsActionButton type="button" variant="primary" disabled={testing || !testEmail.trim()} onClick={() => void sendTest()}>
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t(`${S}.sendTest`)}
            </OpsActionButton>
          </OpsDialogFooter>
        </OpsDialogContent>
      </Dialog>
    </section>
  );
}
