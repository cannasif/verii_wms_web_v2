import { api } from '@/lib/axios';
import type { ApiRequestOptions } from '@/lib/request-utils';
import type { ApiResponse } from '@/types/api';
import type { DashboardSummary } from '../types/dashboard.types';

export const dashboardApi = {
  async getSummary(options?: ApiRequestOptions): Promise<DashboardSummary> {
    const response = await api.get<ApiResponse<DashboardSummary>>('/api/dashboard/summary', options);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Dashboard özeti yüklenemedi.');
    }

    return response.data;
  },
};
