import { useState } from 'react';
import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

export function SessionRecoveryPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const init = useAuthStore((state) => state.init);
  const logout = useAuthStore((state) => state.logout);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const sessionError = useAuthStore((state) => state.sessionError);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await init();
    } finally {
      setIsRetrying(false);
    }
  };

  const busy = isRetrying || sessionStatus === 'restoring';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#070d1f] p-4 text-white sm:p-6">
      <section className="w-full max-w-lg rounded-[1.75rem] border border-cyan-300/20 bg-[#0a132b]/95 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
          {busy ? <RefreshCw className="animate-spin" size={30} /> : <WifiOff size={30} />}
        </div>
        <h1 className="mt-6 text-xl font-bold sm:text-2xl">
          {t('auth.sessionRecovery.title')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {t('auth.sessionRecovery.description')}
        </p>
        {sessionError ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">
            {t('auth.sessionRecovery.connectionUnavailable')}
          </p>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => void retry()}
            disabled={busy}
            className="h-12 rounded-xl bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <RefreshCw className={busy ? 'animate-spin' : ''} size={17} />
            {busy
              ? t('auth.sessionRecovery.retrying')
              : t('auth.sessionRecovery.retry')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => logout()}
            className="h-12 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <ShieldCheck size={17} />
            {t('auth.sessionRecovery.signOut')}
          </Button>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          {t('auth.sessionRecovery.safetyNote')}
        </p>
      </section>
    </main>
  );
}
