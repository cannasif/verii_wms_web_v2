import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authApi } from '../api/auth-api';

export const useForgotPassword = () => {
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
    onSuccess: (response) => {
      if (response.success) {
        toast.success(response.message || t('auth.forgotPassword.successMessage'));
        return;
      }
      toast.error(response.message || t('auth.forgotPassword.errorMessage'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('auth.forgotPassword.errorMessage'));
    },
  });
};
