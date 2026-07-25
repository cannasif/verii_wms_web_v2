import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authApi } from '../api/auth-api';
import type { ChangePasswordRequest } from '../types/auth';
import { useAuthStore } from '@/stores/auth-store';
import { getUserFromToken } from '@/utils/jwt';

export const useChangePassword = () => {
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: async (data: ChangePasswordRequest): Promise<void> => {
      const response = await authApi.changePassword(data);

      if (!response.success || !response.data) {
        throw new Error(response.message || response.exceptionMessage || t('userDetail.changePasswordError'));
      }

      const newToken = response.data.accessToken;
      const decodedUser = getUserFromToken(newToken);
      const currentState = useAuthStore.getState();

      useAuthStore.setState({
        token: newToken,
        user: decodedUser ?? currentState.user,
      });
    },
    onSuccess: () => {
      toast.success(t('userDetail.passwordChangedSuccessfully'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('userDetail.changePasswordError'));
    },
  });
};
