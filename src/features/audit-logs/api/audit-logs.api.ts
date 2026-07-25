import { api } from '@/lib/axios';
import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type { AuditLogDetail, AuditLogRow } from '../types/audit-log.types';
type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(value: Envelope<T>): T => { if (!value.success) throw new Error(value.message || 'İşlem başarısız.'); return value.data; };
export const auditLogsApi = {
  getPaged: async (request: GridRequest) => unwrap(await api.post<Envelope<GridPage<AuditLogRow>>>('/api/audit-logs/paged', request)),
  getById: async (id: number) => unwrap(await api.get<Envelope<AuditLogDetail>>(`/api/audit-logs/${id}`)),
};
