import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { AuthPageShell } from './AuthPageShell';

export function ForgotPasswordPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { mutate: requestPasswordReset, isPending } = useForgotPassword();
  const schema = z.object({ email: z.string().email(t('auth.validation.emailInvalid')) });
  type FormData = z.infer<typeof schema>;
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <AuthPageShell
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => requestPasswordReset(data.email))}
          className="space-y-6"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-center rounded-l-xl border-r border-white/10 bg-black/30">
                    <Mail
                      className={fieldState.invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                      size={18}
                    />
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      id="forgot-email"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder={t('auth.forgotPassword.emailPlaceholder')}
                      className={`auth-field-input h-12 min-w-0 rounded-xl pl-14 pr-4 text-sm text-white placeholder:text-slate-500 ${
                        fieldState.invalid
                          ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                          : 'border border-white/10 bg-white/[0.03] focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
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
              className="auth-login-submit mt-2 h-12 w-full rounded-xl bg-linear-to-r from-cyan-600 via-blue-600 to-orange-400 text-sm font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:brightness-105 hover:shadow-[0_0_16px_rgba(56,132,246,0.30)]"
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
    </AuthPageShell>
  );
}
