import { useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type React from 'react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { AppInput } from '@/components/shared/AppInput';
import { useResetPassword } from '../hooks/useResetPassword';
import { AuthPageShell } from './AuthPageShell';

export function ResetPasswordPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { mutate: resetPassword, isPending } = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const schema = z.object({
    token: z.string().min(1, t('auth.validation.tokenRequired')),
    newPassword: z.string().min(15, t('auth.validation.newPasswordMinLength')),
    confirmPassword: z.string().min(15, t('auth.validation.confirmPasswordRequired')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.validation.passwordsMismatch'),
    path: ['confirmPassword'],
  });
  type FormData = z.infer<typeof schema>;
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { token: token ?? '', newPassword: '', confirmPassword: '' },
  });

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
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
          <PasswordField
            form={form}
            name="newPassword"
            label={t('auth.resetPassword.newPasswordLabel')}
            placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
            visible={showPassword}
            toggle={() => setShowPassword((value) => !value)}
          />
          <PasswordField
            form={form}
            name="confirmPassword"
            label={t('auth.resetPassword.confirmPasswordLabel')}
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
            visible={showConfirmPassword}
            toggle={() => setShowConfirmPassword((value) => !value)}
          />
          <Button
            type="submit"
            className="h-[3.25rem] w-full rounded-[0.875rem] bg-linear-to-r from-cyan-500 via-blue-600 to-violet-600 text-sm font-bold uppercase tracking-[0.1em] text-white"
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
}: {
  form: UseFormReturn<{ token: string; newPassword: string; confirmPassword: string }>;
  name: 'newPassword' | 'confirmPassword';
  label: string;
  placeholder: string;
  visible: boolean;
  toggle: () => void;
}): React.JSX.Element {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <label htmlFor={`reset-${name}`} className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            {label}
          </label>
          <FormControl>
            <AppInput
              {...field}
              id={`reset-${name}`}
              type={visible ? 'text' : 'password'}
              autoComplete={name === 'newPassword' ? 'new-password' : 'new-password'}
              leadingIcon={<Lock className="size-4" />}
              trailingContent={(
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="grid size-11 place-items-center rounded-lg text-slate-400 hover:text-white"
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
              invalid={fieldState.invalid}
              placeholder={placeholder}
              className="h-[3.25rem] border-white/15 bg-[#070e1f]/75 text-white placeholder:text-slate-500"
            />
          </FormControl>
          <FormMessage className="text-xs text-red-400" />
        </FormItem>
      )}
    />
  );
}
