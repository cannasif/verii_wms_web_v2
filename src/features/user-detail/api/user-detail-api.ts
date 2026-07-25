import { api } from '@/lib/axios';
import type {
  UserDetailResponse,
  CreateUserDetailDto,
  CreateUserDetailResponse,
  UpdateUserDetailDto,
  UpdateUserDetailResponse,
} from '../types/user-detail';
import type { ApiResponse } from '@/types/api';

export const userDetailApi = {
  getCurrent: async (): Promise<UserDetailResponse> => {
    return await api.get<UserDetailResponse>('/api/userdetail/current');
  },

  create: async (data: CreateUserDetailDto): Promise<CreateUserDetailResponse> => {
    return await api.post<CreateUserDetailResponse>('/api/userdetail', data);
  },

  updateCurrent: async (data: UpdateUserDetailDto): Promise<UpdateUserDetailResponse> => {
    return await api.put<UpdateUserDetailResponse>('/api/userdetail/current', data);
  },

  uploadProfilePicture: async (file: File): Promise<ApiResponse<string>> => {
    const formData = new FormData();
    formData.append('file', file);

    return await api.post<ApiResponse<string>>(
      '/api/userdetail/upload-profile-picture',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  deleteProfilePicture: async (): Promise<ApiResponse<boolean>> => {
    return await api.delete<ApiResponse<boolean>>('/api/userdetail/delete-profile-picture');
  },
};
