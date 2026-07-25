import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'İşlem başarısız.');
  return response.data;
};

export interface RecurringJobRow { id: string; jobName?: string; method?: string; cron?: string; queue?: string; nextExecution?: string; lastExecution?: string; lastJobId?: string; error?: string }
export interface HangfireExecutionRow { id: number; jobKey: string; hangfireJobId?: string; triggerSource: string; status: string; startedAt: string; completedAt?: string; durationMs?: number; sourceCount?: number; insertedCount?: number; updatedCount?: number; deactivatedCount?: number; resultSummary?: string; errorType?: string; errorMessage?: string; stackTrace?: string; createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }

export const hangfireApi = {
  hangfireStats: async () => api.get<Record<string, number>>('/api/hangfire/stats'),
  recurring: async (): Promise<RecurringJobRow[]> => {
    const response = await api.get<{ items: RecurringJobRow[] }>('/api/hangfire/recurring-jobs');
    return response.items || [];
  },
  trigger: async (id: string) => unwrap(await api.post<Envelope<unknown>>(`/api/hangfire/recurring-jobs/${encodeURIComponent(id)}/trigger`)),
  hangfireExecutions: async (request: GridRequest) => unwrap(await api.post<Envelope<GridPage<HangfireExecutionRow>>>('/api/hangfire/executions/paged', request)),
};
