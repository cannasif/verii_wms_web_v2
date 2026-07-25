import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userDetailApi } from '../api/user-detail-api';
import { USER_DETAIL_QUERY_KEYS } from '../utils/query-keys';
import type { CreateUserDetailDto, UserDetailDto } from '../types/user-detail';
import { getLocalizedText } from '@/lib/localized-error';

export const useCreateUserDetail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserDetailDto): Promise<UserDetailDto> => {
      const response = await userDetailApi.create(data);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.message || getLocalizedText('common.errors.userDetailCreateFailed'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DETAIL_QUERY_KEYS.CURRENT] });
    },
  });
};
