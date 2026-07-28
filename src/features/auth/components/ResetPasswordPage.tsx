import { useEffect, useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type React from 'react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useResetPassword } from '../hooks/useResetPassword';
import { authApi } from '../api/auth-api';
import { AuthPageShell } from './AuthPageShell';

export function ResetPasswordPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { mutate: resetPassword, isPending } = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState({ minimumLength: 6, maximumLength: 15 });
  const schema = useMemo(
    () => z.object({
      token: z.string().min(1, t('auth.validation.tokenRequired')),
      newPassword: z.string()
        .min(passwordPolicy.minimumLength, t('auth.validation.newPasswordMinLength', { min: passwordPolicy.minimumLength }))
        .max(passwordPolicy.maximumLength, t('auth.validation.newPasswordMaxLength', { max: passwordPolicy.maximumLength })),
      confirmPassword: z.string()
        .min(passwordPolicy.minimumLength, t('auth.validation.confirmPasswordRequired'))
        .max(passwordPolicy.maximumLength, t('auth.validation.newPasswordMaxLength', { max: passwordPolicy.maximumLength })),
    }).refine((data) => data.newPassword === data.confirmPassword, {
      message: t('auth.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    }),
    [passwordPolicy.maximumLength, passwordPolicy.minimumLength, t],
  );
  type FormData = z.infer<typeof schema>;
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { token: token ?? '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    authApi.getPasswordPolicy().then(setPasswordPolicy).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) {
      toast.error(t('auth.resetPassword.invalidToken'));
      const timer = window.setTimeout(() => navigate('/auth/login', { replace: true }), 1500);
      return () => window.clearTimeout(timer);
    }
    form.setValue('token', token);
  }, [form, navigate, t, token]);

  const submit = (data: FormData): void => {
    if (!token) {
      toast.error(t('auth.resetPassword.tokenNotFound'));
      return;
    }
    resetPassword({ token: data.token, newPassword: data.newPassword });
  };

  return (
    <AuthPageShell
      title={t('auth.resetPassword.title')}
      description={t('auth.resetPassword.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
          <PasswordField
            form={form}
            name="newPassword"
            label={t('auth.resetPassword.newPasswordLabel')}
            placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
            visible={showPassword}
            toggle={() => setShowPassword((value) => !value)}
            maxLength={passwordPolicy.maximumLength}
          />
          <PasswordField
            form={form}
            name="confirmPassword"
            label={t('auth.resetPassword.confirmPasswordLabel')}
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
            visible={showConfirmPassword}
            toggle={() => setShowConfirmPassword((value) => !value)}
            maxLength={passwordPolicy.maximumLength}
          />
          <Button
            type="submit"
            className="auth-login-submit mt-2 h-12 w-full rounded-xl bg-linear-to-r from-cyan-600 via-blue-600 to-orange-400 text-sm font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:brightness-105 hover:shadow-[0_0_16px_rgba(56,132,246,0.30)]"
            disabled={isPending || !token}
          >
            {isPending ? t('auth.resetPassword.processing') : t('auth.resetPassword.submitButton')}
          </Button>
        </form>
      </Form>
    </AuthPageShell>
  );
}

function PasswordField({
  form,
  name,
  label,
  placeholder,
  visible,
  toggle,
  maxLength,
}: {
  form: UseFormReturn<{ token: string; newPassword: string; confirmPassword: string }>;
  name: 'newPassword' | 'confirmPassword';
  label: string;
  placeholder: string;
  visible: boolean;
  toggle: () => void;
  maxLength: number;
}): React.JSX.Element {
  const { t } = useTranslation('common');
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-center rounded-l-xl border-r border-white/10 bg-black/30">
              <Lock
                className={fieldState.invalid ? 'text-red-400' : 'text-slate-400 group-focus-within:text-cyan-300'}
                size={18}
              />
            </div>
            <FormControl>
              <Input
                {...field}
                id={`reset-${name}`}
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={maxLength}
                aria-label={label}
                placeholder={placeholder}
                className={`auth-field-input h-12 min-w-0 rounded-xl pl-14 pr-11 text-sm text-white placeholder:text-slate-500 ${
                  fieldState.invalid
                    ? 'border-2 border-red-500 bg-red-950/25 ring-2 ring-red-500/40 focus-visible:!border-red-500 focus-visible:!ring-2 focus-visible:!ring-red-500/40'
                    : 'border border-white/10 bg-white/[0.03] focus-visible:!border-cyan-400/70 focus-visible:!ring-cyan-500/25'
                }`}
              />
            </FormControl>
            <button
              type="button"
              onClick={toggle}
              aria-label={visible ? t('auth.resetPassword.hidePassword') : t('auth.resetPassword.showPassword')}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors hover:text-cyan-300"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FormMessage className="text-xs text-red-400" />
        </FormItem>
      )}
    />
  );
}
