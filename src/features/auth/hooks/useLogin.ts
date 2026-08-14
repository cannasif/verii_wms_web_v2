import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '@/stores/auth-store';
import { getUserFromToken } from '@/utils/jwt';
import type { LoginRequest, Branch } from '../types/auth';
import { requireSuccessfulLogin } from '../utils/login-flow';

export const useLogin = (branches?: Branch[]) => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const selectedBranch = branches?.find((branch) => branch.id === data.branchId);
      const branchCode = selectedBranch?.code?.trim();
      if (!branchCode) {
        throw new Error();
      }
      const response = await authApi.login(data, branchCode);
      const session = requireSuccessfulLogin(response);
      const user = getUserFromToken(session.accessToken);
      if (!user) {
        throw new Error(response.message?.trim() ?? '');
      }

      return { session, user, selectedBranch: selectedBranch ?? null };
    },
    onSuccess: ({ session, user, selectedBranch }) => {
      setAuth(user, session.accessToken, selectedBranch);
      navigate('/');
    },
  });
};
