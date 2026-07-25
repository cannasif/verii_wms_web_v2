import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type React from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { AuthBackground } from './AuthBackground';
import { WmsBackgroundAnimation } from './WmsBackgroundAnimation';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import logo from '@/assets/v3riiwms.png';

export function ForgotPasswordPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { mutate: requestPasswordReset, isPending } = useForgotPassword();
  const [isBgAnimationPaused] = useState(true);

  const schema = z.object({
    email: z.string().email(t('auth.validation.emailInvalid')),
  });

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = (data: FormData): void => {
    requestPasswordReset(data.email);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#070d1f] text-white">
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

      <div className="absolute inset-0 z-0 transition-opacity duration-1000 opacity-100">
        <div className="absolute left-[-12%] top-[-12%] h-[58vw] w-[58vw] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[58vw] w-[58vw] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#070d1f]/60 to-[#070d1f]" />
      </div>

      <AuthBackground isActive isPaused={isBgAnimationPaused} />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        <LanguageSwitcher variant="pill" />
      </div>

      <div className="relative z-10 flex h-full w-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px] -translate-y-16 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1228]/70 shadow-[0_0_10px_2px_rgba(255,255,255,0.04),inset_0_0_10px_2px_rgba(255,255,255,0.04),0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="relative overflow-hidden px-6 pt-12 pb-16 sm:px-10">
            <WmsBackgroundAnimation isPaused={isBgAnimationPaused} />
            <div className="relative z-10 mb-8 text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <img src={logo} alt="V3RII WMS" className="h-32 w-auto object-contain" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                {t('auth.forgotPassword.title')}
              </h1>
              <p className="text-sm text-slate-400">
                {t('auth.forgotPassword.description')}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <div className="group relative">
                        <Mail
                          className={`pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 ${fieldState.invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}`}
                          size={18}
                        />
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder={t('auth.forgotPassword.emailPlaceholder')}
                            className={`h-14 rounded-xl px-12 pr-4 text-sm text-white placeholder:text-slate-500 ${fieldState.invalid
                              ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                              : 'border border-white/15 bg-black/25 focus-visible:!border-cyan-500 focus-visible:!ring-cyan-500/35'
                              }`}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs text-red-400" />
                    </FormItem>
                  )}
                />

                <div className="space-y-6 pt-2">
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-linear-to-r from-cyan-600 via-blue-600 to-orange-400 text-sm font-semibold uppercase tracking-wide text-white hover:opacity-95 shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
                    disabled={isPending}
                  >
                    {isPending ? t('auth.forgotPassword.processing') : t('auth.forgotPassword.submitButton')}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                    onClick={() => navigate('/auth/login')}
                  >
                    <ArrowLeft size={18} className="mr-2" />
                    {t('auth.forgotPassword.backToLogin')}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
