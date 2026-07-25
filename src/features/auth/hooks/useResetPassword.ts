import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authApi } from '../api/auth-api';

export const useResetPassword = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) => authApi.resetPassword(data),
    onSuccess: (response) => {
      if (response.success) {
        toast.success(response.message || t('auth.resetPassword.successRedirect'));
        setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 1500);
        return;
      }
      toast.error(response.message || t('auth.resetPassword.failed'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('auth.resetPassword.error'));
    },
  });
};
