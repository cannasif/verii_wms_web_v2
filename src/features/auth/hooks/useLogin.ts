import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '@/stores/auth-store';
import { getUserFromToken } from '@/utils/jwt';
import type { LoginRequest, Branch } from '../types/auth';

export const useLogin = (branches?: Branch[]) => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (data: LoginRequest) => {
      const selectedBranch = branches?.find((branch) => branch.id === data.branchId);
      const branchCode = selectedBranch?.code?.trim();
      if (!branchCode) {
        throw new Error('Seçilen şubenin kodu geçersiz.');
      }
      return authApi.login(data, branchCode);
    },
    onSuccess: (response, variables) => {
      if (response.success && response.data) {
        const user = getUserFromToken(response.data.accessToken);
        if (user) {
          const selectedBranch = branches?.find((b) => b.id === variables.branchId) || null;
          setAuth(user, response.data.accessToken, selectedBranch);
          navigate('/');
        }
      }
    },
  });
};
