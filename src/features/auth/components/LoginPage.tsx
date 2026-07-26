import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation, Trans } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { type LoginRequest } from '../types/auth';
import { useLogin } from '../hooks/useLogin';
import { useBranches } from '../hooks/useBranches';
import { useAuthStore } from '@/stores/auth-store';
import { isTokenValid } from '@/utils/jwt';
import type React from 'react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { AuthBackground } from './AuthBackground';
import logo from '@/assets/v3riiwms.png';
import { Building2, Eye, EyeOff, Lock, Mail, Pause, Play, TriangleAlert } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import GlobalIcon from '@hugeicons/core-free-icons/GlobalIcon';
import InstagramIcon from '@hugeicons/core-free-icons/InstagramIcon';
import Linkedin01Icon from '@hugeicons/core-free-icons/Linkedin01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import TelegramIcon from '@hugeicons/core-free-icons/TelegramIcon';
import TelephoneIcon from '@hugeicons/core-free-icons/TelephoneIcon';
import WhatsappIcon from '@hugeicons/core-free-icons/WhatsappIcon';
import { SessionRecoveryPage } from './SessionRecoveryPage';

export function LoginPage(): React.JSX.Element {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: branches } = useBranches();
  const { mutate: loginMutate, isPending } = useLogin(branches);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isBgAnimationPaused, setIsBgAnimationPaused] = useState(true);

  const loginRequestSchema = useMemo(
    () =>
      z.object({
        identifier: z.string().trim().min(1, t('auth.validation.identifierRequired')).max(200, t('auth.validation.identifierTooLong')),
        password: z.string().min(1, t('auth.validation.passwordRequired')),
        branchId: z.string().min(1, t('auth.validation.branchRequired')),
      }),
    [t],
  );

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      identifier: '',
      password: '',
      branchId: '',
    },
  });

  useEffect(() => {
    if (searchParams.get('sessionExpired') !== 'true') {
      return;
    }

    if (!token || !isTokenValid(token)) {
      logout(false);
      toast.warning(t('auth.login.sessionExpired'));
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, i18n.language, token, logout, t]);

  useEffect(() => {
    if (!token || !isTokenValid(token)) {
      return;
    }

    if (!user) {
      return;
    }

    navigate('/', { replace: true });
  }, [token, user, navigate]);

  if (sessionStatus === 'restoring' || sessionStatus === 'recovery-required') {
    return <SessionRecoveryPage />;
  }

  const onSubmit = (data: LoginRequest): void => {
    form.clearErrors('root');
    loginMutate(data, {
      onError: (error: Error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        const raw = (error.message ?? '').trim();
        const message =
          status === 401 ? (raw || t('auth.login.wrongCredentials')) : (raw || t('auth.login.loginError'));
        form.setError('root', { type: 'server', message });
      },
    });
  };

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#070d1f] text-white">
      <style>{`
        input { color-scheme: dark; }
        .auth-login-control.input {
          height: 3.25rem;
          padding-left: 3.5rem !important;
          padding-right: 1rem !important;
          border-radius: 0.875rem;
          background: rgba(7, 14, 31, 0.72);
        }
        .auth-login-control--password.input {
          padding-right: 3.5rem !important;
        }
        .auth-login-select {
          height: 3.25rem !important;
          padding-left: 3.5rem !important;
          padding-right: 1rem !important;
          border-radius: 0.875rem;
          background: rgba(7, 14, 31, 0.72);
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #0b1228 inset !important;
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
            caret-color: white;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-1000 opacity-100">
        <div className="absolute left-[-12%] top-[-12%] h-[58vw] max-h-[520px] w-[58vw] max-w-[520px] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[58vw] max-h-[520px] w-[58vw] max-w-[520px] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#070d1f]/60 to-[#070d1f]" />
      </div>

      <AuthBackground isActive isPaused={isBgAnimationPaused} />

      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={() => setIsBgAnimationPaused((p) => !p)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-[#0b1228]/80 text-cyan-300/80 shadow-[0_0_14px_rgba(56,132,246,0.20)] transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(56,132,246,0.40)]"
          title={isBgAnimationPaused ? t('auth.login.startAnimation') : t('auth.login.stopAnimation')}
          aria-label={isBgAnimationPaused ? t('auth.login.startAnimation') : t('auth.login.stopAnimation')}
        >
          {isBgAnimationPaused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="relative z-10 mx-auto box-border flex min-h-dvh w-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20 sm:px-6 sm:pt-24 lg:px-10">
        <main className="flex flex-1 items-center justify-center pb-6 lg:justify-end lg:pb-10 lg:pr-[clamp(1rem,7vw,8rem)]">
          <div className="w-full max-w-[520px] min-w-0">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[#0a132b]/85 shadow-[0_0_0_1px_rgba(59,130,246,0.04),0_28px_80px_rgba(0,0,0,0.55),0_0_45px_rgba(14,165,233,0.08)] backdrop-blur-2xl">
              <div className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/80 to-transparent" />
              <div className="relative overflow-hidden px-5 pb-7 pt-7 sm:px-9 sm:pb-9 sm:pt-9">
                <div className="relative z-10 mb-7 text-center">
                  <img
                    src={logo}
                    alt="V3RII WMS"
                    className="mx-auto w-[190px] max-w-[72%] object-contain drop-shadow-[0_10px_24px_rgba(236,72,153,0.12)] sm:w-[220px]"
                  />
                  <div className="mx-auto mt-5 h-px w-16 bg-linear-to-r from-transparent via-cyan-300/60 to-transparent" />
                  <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/65 sm:text-xs">
                    {t('auth.login.title')}
                  </p>
                </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <div className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                        {t('auth.login.branch')}
                      </div>
                      <div className="group relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center">
                          <Building2
                            className={fieldState.invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                            size={18}
                          />
                        </div>
                        <AppDropdown
                          value={field.value}
                          onValueChange={field.onChange}
                          options={(branches ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
                          placeholder={t('auth.login.selectBranch')}
                          emptyText={t('auth.login.branchNotFound')}
                          ariaLabel={t('auth.login.selectBranch')}
                          searchable
                          searchPlaceholder={t('common.search')}
                          className={`auth-login-select !w-full min-w-0 text-sm text-white transition-all ${fieldState.invalid
                            ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                            : 'border border-white/15 hover:border-cyan-300/40 focus-visible:!border-cyan-400/70'
                          }`}
                          contentClassName="border-sky-400/20 !bg-[#0b1733] !text-white shadow-[0_0_24px_rgba(56,132,246,0.18)]"
                          testId="login-branch"
                        />
                      </div>
                      <FormMessage className="text-xs text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field, fieldState }) => {
                    const authFailed = !!form.formState.errors.root;
                    const invalid = Boolean(fieldState.error) || authFailed;
                    return (
                      <FormItem>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300" htmlFor="login-identifier">
                          {t('auth.login.identifierPlaceholder')}
                        </label>
                        <div className="group relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center">
                            <Mail
                              className={invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                              size={18}
                            />
                          </div>
                          <FormControl>
                            <Input
                              {...field}
                              id="login-identifier"
                              type="text"
                              inputMode="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="username"
                              placeholder={t('auth.login.identifierPlaceholder')}
                              className={`auth-login-control min-w-0 text-sm text-white placeholder:text-slate-500 ${invalid
                                ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                                : 'border border-white/15 transition-all duration-200 hover:border-cyan-300/40 focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
                                }`}
                              onChange={(e) => {
                                form.clearErrors('root');
                                field.onChange(e);
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-xs text-red-400" />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => {
                    const authFailed = !!form.formState.errors.root;
                    const invalid = Boolean(fieldState.error) || authFailed;
                    return (
                      <FormItem>
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300" htmlFor="login-password">
                            {t('auth.login.password')}
                          </label>
                          <button
                            type="button"
                            className="text-xs font-medium text-cyan-300 transition hover:text-cyan-100 hover:underline"
                            onClick={() => navigate('/auth/forgot-password')}
                          >
                            {t('auth.login.forgotPassword')}
                          </button>
                        </div>
                        <div className="group relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center">
                            <Lock
                              className={invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                              size={18}
                            />
                          </div>
                          <FormControl>
                            <Input
                              {...field}
                              id="login-password"
                              type={isPasswordVisible ? 'text' : 'password'}
                              placeholder={t('auth.login.passwordPlaceholder')}
                              className={`auth-login-control auth-login-control--password min-w-0 text-sm text-white placeholder:text-slate-500 ${invalid
                                ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                                : 'border border-white/15 transition-all duration-200 hover:border-cyan-300/40 focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
                                }`}
                              onChange={(e) => {
                                form.clearErrors('root');
                                field.onChange(e);
                              }}
                              onKeyDown={(e) => setCapsLockActive(e.getModifierState('CapsLock'))}
                              onKeyUp={(e) => setCapsLockActive(e.getModifierState('CapsLock'))}
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() => setIsPasswordVisible((prev) => !prev)}
                            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors hover:text-cyan-300"
                          >
                            {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <div className="min-h-[18px]">
                          {form.formState.errors.root ? (
                            <p className="text-xs text-red-400" role="alert">
                              {form.formState.errors.root.message}
                            </p>
                          ) : fieldState.error ? (
                            <FormMessage className="text-xs text-red-400" />
                          ) : capsLockActive ? (
                            <div className="mt-1 flex w-fit items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-300">
                              <TriangleAlert size={12} />
                              {t('auth.login.capsLockOn')}
                            </div>
                          ) : null}
                        </div>
                      </FormItem>
                    );
                  }}
                />

                <Button
                  type="submit"
                  className="mt-2 h-[3.25rem] w-full rounded-[0.875rem] border border-white/10 bg-linear-to-r from-cyan-500 via-blue-600 to-violet-600 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_34px_rgba(37,99,235,0.34)]"
                  disabled={isPending}
                >
                  {isPending ? t('auth.login.loggingIn') : t('auth.login.loginButton')}
                </Button>
              </form>
            </Form>
              </div>
            </div>

            <p className="mt-4 px-3 text-center text-[0.62rem] font-medium uppercase leading-relaxed tracking-[0.1em] text-white/45 sm:mt-5 sm:text-xs sm:tracking-[0.16em]">
              <Trans
                i18nKey="auth.login.slogan"
                components={{
                  brand: (
                    <span
                      lang="en"
                      className="bg-linear-to-r from-pink-400 to-yellow-400 bg-clip-text font-bold text-transparent border-b border-pink-500/20 pb-0.5"
                    >
                      v3rii
                    </span>
                  ),
                }}
              />
            </p>
          </div>
        </main>

        <footer className="shrink-0 pb-1 pt-2 [@media(max-height:900px)]:hidden">
          <div className="mx-auto grid w-full max-w-[360px] grid-cols-7 items-center gap-1 rounded-2xl border border-white/10 bg-[#0a132b]/55 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <a
              href="tel:+905070123018"
              aria-label={t('auth.login.title')}
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-lime-400/10 hover:text-lime-300 hover:shadow-[0_0_14px_rgba(132,204,22,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={TelephoneIcon} size={20} strokeWidth={1.8} />
            </a>

            <a
              href="https://v3rii.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Website"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-cyan-400/10 hover:text-cyan-300 hover:shadow-[0_0_14px_rgba(34,211,238,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={GlobalIcon} size={20} strokeWidth={1.8} />
            </a>

            <a
              href="mailto:info@v3rii.com"
              aria-label="E-mail"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-orange-400/10 hover:text-orange-300 hover:shadow-[0_0_14px_rgba(251,146,60,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={Mail01Icon} size={20} strokeWidth={1.8} />
            </a>

            <a
              href="https://wa.me/905070123018"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-emerald-400/10 hover:text-emerald-300 hover:shadow-[0_0_14px_rgba(52,211,153,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={WhatsappIcon} size={20} strokeWidth={1.8} />
            </a>

            <button
              type="button"
              onClick={() => toast.info(t('auth.login.comingSoon'))}
              aria-label="Telegram"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-sky-400/10 hover:text-sky-300 hover:shadow-[0_0_14px_rgba(56,189,248,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={TelegramIcon} size={20} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => toast.info(t('auth.login.comingSoon'))}
              aria-label="Instagram"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-fuchsia-400/10 hover:text-fuchsia-300 hover:shadow-[0_0_14px_rgba(232,121,249,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={InstagramIcon} size={20} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => toast.info(t('auth.login.comingSoon'))}
              aria-label="LinkedIn"
              className="flex aspect-square w-full items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-blue-400/10 hover:text-blue-300 hover:shadow-[0_0_14px_rgba(96,165,250,0.35)] sm:rounded-xl"
            >
              <HugeiconsIcon icon={Linkedin01Icon} size={20} strokeWidth={1.8} />
            </button>
          </div>

        </footer>
      </div>
    </div>
  );
}
