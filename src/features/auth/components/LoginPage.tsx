import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { AuthBackground } from './AuthBackground';
import { LoginIntroFlowCard, LoginIntroHeadline } from './LoginIntroPanel';
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

  if (sessionStatus === 'restoring' || sessionStatus === 'unavailable') {
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
    <div data-wms-auth-surface="true" className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#070d1f] text-white">
      <style>{`
        input { color-scheme: dark; }
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

      <div className="pointer-events-auto fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
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

      <div className="relative z-10 mx-auto box-border flex min-h-dvh w-full flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-6 sm:pt-8 lg:px-6 xl:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:grid-rows-[auto_auto] lg:gap-x-8 lg:gap-y-4 lg:pt-8 xl:gap-x-10 xl:pt-10">
          <div className="hidden lg:col-start-1 lg:row-start-1 lg:flex lg:max-w-[760px] lg:flex-col lg:justify-end lg:gap-5 lg:self-end lg:px-1 xl:gap-6 xl:px-2">
            <LoginIntroHeadline />
            <LoginIntroFlowCard isAnimationPaused={isBgAnimationPaused} />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-6 lg:col-start-2 lg:row-start-1 lg:flex-none lg:items-end lg:justify-end lg:self-end lg:py-0 xl:pr-2 [@media(max-height:720px)]:py-2">
            <div className="w-full max-w-[480px] min-w-0">
              <div className="overflow-hidden rounded-2xl border border-sky-400/15 bg-[#0b1228]/70 shadow-[0_0_24px_2px_rgba(56,132,246,0.10),inset_0_0_14px_1px_rgba(96,150,255,0.05),0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl">
                <div className="relative overflow-hidden px-4 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-12 [@media(max-height:720px)]:px-4 [@media(max-height:720px)]:pb-5 [@media(max-height:720px)]:pt-5">
                  <div className="relative z-10 mb-4 text-center sm:mb-6 [@media(max-height:720px)]:mb-3">
                    <div className="mx-auto mb-3 flex justify-center sm:mb-4 [@media(max-height:720px)]:mb-2">
                      <img src={logo} alt="V3RII WMS" className="h-20 w-auto max-w-[85%] object-contain sm:h-32 md:h-36 [@media(max-height:720px)]:h-16" />
                    </div>
                    <h1 className="text-xs tracking-tight text-white/70 sm:text-sm">{t('auth.login.title')}</h1>
                  </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4" noValidate>
                  <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <div className="group relative">
                          <div className="absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-center rounded-l-xl border-r border-white/10 bg-black/30">
                            <Building2
                              className={fieldState.invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                              size={18}
                            />
                          </div>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger
                                data-testid="login-branch"
                                className={`auth-field-input !h-12 !w-full min-w-0 rounded-xl pl-14 pr-4 text-sm text-white focus:ring-0 ${fieldState.invalid
                                  ? 'auth-field-invalid border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                                  : 'border border-white/10 bg-white/[0.03] focus:border-cyan-400/70 focus-visible:!border-cyan-400/70'
                                  }`}
                              >
                                <SelectValue placeholder={t('auth.login.selectBranch')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="auth-select-content border-sky-400/20 !bg-[#0b1733] text-white shadow-[0_0_24px_rgba(56,132,246,0.18)]">
                              {branches?.length ? (
                                branches.map((branch) => (
                                  <SelectItem key={branch.id} value={branch.id} className="h-12 cursor-pointer focus:!bg-sky-500/25 focus:!text-white data-[state=checked]:!text-sky-300">
                                    {branch.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-branch" disabled className="h-12 focus:text-white">
                                  {t('auth.login.branchNotFound')}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
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
                          <div className="group relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-center rounded-l-xl border-r border-white/10 bg-black/30">
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
                                className={`auth-field-input h-12 min-w-0 rounded-xl pl-14 pr-4 text-sm text-white placeholder:text-slate-500 ${invalid
                                  ? 'auth-field-invalid border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                                  : 'border border-white/10 bg-white/[0.03] focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
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
                          <div className="group relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-center rounded-l-xl border-r border-white/10 bg-black/30">
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
                                autoComplete="current-password"
                                placeholder={t('auth.login.passwordPlaceholder')}
                                className={`auth-field-input h-12 min-w-0 rounded-xl pl-14 pr-11 text-sm text-white placeholder:text-slate-500 ${invalid
                                  ? 'auth-field-invalid border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                                  : 'border border-white/10 bg-white/[0.03] focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
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

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-cyan-300 transition hover:text-cyan-200 hover:underline"
                      onClick={() => navigate('/auth/forgot-password')}
                    >
                      {t('auth.login.forgotPassword')}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="auth-login-submit mt-2 h-12 w-full rounded-xl bg-linear-to-r from-cyan-600 via-blue-600 to-orange-400 text-sm font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:brightness-105 hover:shadow-[0_0_16px_rgba(56,132,246,0.30)]"
                    disabled={isPending}
                  >
                    {isPending ? t('auth.login.loggingIn') : t('auth.login.loginButton')}
                  </Button>
                </form>
              </Form>
                </div>
              </div>
            </div>
          </div>

          <footer className="mx-auto w-full max-w-[480px] shrink-0 pb-4 pt-5 sm:pt-6 lg:col-start-2 lg:row-start-2 lg:mx-0 lg:ml-auto lg:mt-2 lg:w-full lg:max-w-[480px] lg:pt-5 xl:mr-2 xl:pt-6 [@media(max-height:720px)]:pb-2 [@media(max-height:720px)]:pt-3">
            <div className="grid w-full grid-cols-7 items-center gap-0 rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-1.5">
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
    </div>
  );
}
