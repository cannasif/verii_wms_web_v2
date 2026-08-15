import { api } from '@/lib/axios';
import type { ApiRequestOptions } from '@/lib/request-utils';
import type { ApiResponse } from '@/types/api';
import type { DashboardQuickSearchResult, DashboardSummary } from '../types/dashboard.types';

export const dashboardApi = {
  async getSummary(options?: ApiRequestOptions): Promise<DashboardSummary> {
    const response = await api.get<ApiResponse<DashboardSummary>>('/api/dashboard/summary', options);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Dashboard özeti yüklenemedi.');
    }

    return response.data;
  },

  async quickSearch(
    query: string,
    options?: ApiRequestOptions & { scopes?: string },
  ): Promise<DashboardQuickSearchResult> {
    const { scopes, ...request } = options ?? {};
    const response = await api.get<ApiResponse<DashboardQuickSearchResult>>('/api/dashboard/quick-search', {
      ...request,
      params: { q: query, ...(scopes ? { scopes } : {}) },
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Arama sonuçları yüklenemedi.');
    }

    return {
      items: Array.isArray(response.data.items) ? response.data.items : [],
    };
  },
};
