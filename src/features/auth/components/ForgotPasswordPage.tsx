import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { AppInput } from '@/components/shared/AppInput';
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
          className="space-y-5"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <label htmlFor="forgot-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {t('auth.forgotPassword.emailLabel')}
                </label>
                <FormControl>
                  <AppInput
                    {...field}
                    id="forgot-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    leadingIcon={<Mail className="size-4" />}
                    invalid={fieldState.invalid}
                    placeholder={t('auth.forgotPassword.emailPlaceholder')}
                    className="h-[3.25rem] border-white/15 bg-[#070e1f]/75 text-white placeholder:text-slate-500"
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-400" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-[3.25rem] w-full rounded-[0.875rem] bg-linear-to-r from-cyan-500 via-blue-600 to-violet-600 text-xs font-bold uppercase tracking-[0.1em] text-white sm:text-sm"
            disabled={isPending}
          >
            {isPending ? t('auth.forgotPassword.processing') : t('auth.forgotPassword.submitButton')}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-[3.25rem] w-full rounded-[0.875rem] border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            onClick={() => navigate('/auth/login')}
          >
            <ArrowLeft className="mr-2 size-4" />
            {t('auth.forgotPassword.backToLogin')}
          </Button>
        </form>
      </Form>
    </AuthPageShell>
  );
}
