import { useQuery } from '@tanstack/react-query';
import { userDetailApi } from '../api/user-detail-api';
import { USER_DETAIL_QUERY_KEYS } from '../utils/query-keys';
import type { UserDetailDto } from '../types/user-detail';

export const useUserDetail = (): ReturnType<typeof useQuery<UserDetailDto | null>> => {
  return useQuery({
    queryKey: [USER_DETAIL_QUERY_KEYS.CURRENT],
    queryFn: async (): Promise<UserDetailDto | null> => {
      try {
        const response = await userDetailApi.getCurrent();
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      } catch (error) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            return null;
          }
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
};
