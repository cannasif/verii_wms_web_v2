import { api } from '@/lib/axios';
import type { AuthTokenResponse, LoginRequest, LoginResponse, PasswordPolicy, UserDto } from '../types/auth';
import type { ApiResponse, PagedResponse } from '@/types/api';
import type { ApiRequestOptions } from '@/lib/request-utils';
import { buildPagedRequest } from '@/lib/paged';
import { fetchAllPagedData } from '@/lib/fetch-all-paged-data';

export const authApi = {
  getPasswordPolicy: async (): Promise<PasswordPolicy> => {
    const response = await api.get<ApiResponse<PasswordPolicy>>(
      '/api/auth/password-policy',
      { skipAuth: true, skipSessionExpiredOn401: true },
    );
    if (!response.success || !response.data) throw new Error(response.message);
    return response.data;
  },
  login: async (data: LoginRequest, branchCode: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>(
      '/api/auth/login',
      {
        identifier: data.identifier.trim(),
        password: data.password,
        branchCode,
      },
      { skipAuth: true, skipSessionExpiredOn401: true },
    );
    return response;
  },
  register: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/auth/register', {
      identifier: data.identifier.trim(),
      password: data.password,
    });
    return response;
  },
  getActiveUsers: async (options?: ApiRequestOptions): Promise<UserDto[]> => {
    return fetchAllPagedData({
      fetchPage: async (pageNumber, pageSize) => {
        const response = await api.post<ApiResponse<PagedResponse<UserDto>>>(
          '/api/User/paged',
          buildPagedRequest({
            pageNumber,
            pageSize,
            filters: [{ column: 'IsActive', operator: 'Equals', value: 'true' }],
          }),
          options,
        );
        if (!response.success || !response.data) {
          throw new Error(response.message);
        }
        return response.data;
      },
    });
  },
  requestPasswordReset: async (email: string): Promise<ApiResponse<string>> => {
    const response = await api.post<ApiResponse<string>>('/api/auth/forgot-password', {
      email,
    }, { skipAuth: true, skipSessionExpiredOn401: true });
    return response;
  },
  resetPassword: async (data: { token: string; newPassword: string }): Promise<ApiResponse<string>> => {
    const response = await api.post<ApiResponse<string>>('/api/auth/reset-password', {
      token: data.token,
      newPassword: data.newPassword,
    }, { skipAuth: true, skipSessionExpiredOn401: true });
    return response;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<AuthTokenResponse>> => {
    const response = await api.post<ApiResponse<AuthTokenResponse>>('/api/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    return response;
  },
};
