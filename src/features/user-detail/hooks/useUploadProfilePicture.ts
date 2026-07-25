import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userDetailApi } from '../api/user-detail-api';
import { USER_DETAIL_QUERY_KEYS } from '../utils/query-keys';
import type { ApiResponse } from '@/types/api';

export const useUploadProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File): Promise<ApiResponse<string>> => {
      return userDetailApi.uploadProfilePicture(file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DETAIL_QUERY_KEYS.CURRENT] });
    },
  });
};
