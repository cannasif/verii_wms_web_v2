import { api } from '@/lib/axios';
import type {
  CreateGeneratorProjectRequest, GeneratorBootstrapResult, GeneratorDefinitions, GeneratorOverview,
  GeneratorOperationAction, GeneratorPlanApplyResult, GeneratorPlanPreview, GeneratorPlanRevision, GeneratorProjectDetail,
  GeneratorPolicy, GeneratorProjectPage, GeneratorProjectRequest, GeneratorProjectRow, GeneratorRule, GeneratorScheduleRow,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>): T => { if (!result.success) throw new Error(result.message || 'İşlem başarısız.'); return result.data; };

export const generatorProductionApi = {
  overview: async (): Promise<GeneratorOverview> => unwrap(await api.get<Envelope<GeneratorOverview>>('/api/generator-production/overview')),
  projects: async (request: GeneratorProjectRequest): Promise<GeneratorProjectPage> => unwrap(await api.post<Envelope<GeneratorProjectPage>>('/api/generator-production/projects/paged', request)),
  project: async (id: number): Promise<GeneratorProjectDetail> => unwrap(await api.get<Envelope<GeneratorProjectDetail>>(`/api/generator-production/projects/${id}`)),
  projectOperations: async (id: number): Promise<GeneratorScheduleRow[]> => unwrap(await api.get<Envelope<GeneratorScheduleRow[]>>(`/api/generator-production/projects/${id}/operations`)),
  createProject: async (payload: CreateGeneratorProjectRequest): Promise<GeneratorProjectRow> => unwrap(await api.post<Envelope<GeneratorProjectRow>>('/api/generator-production/projects', payload)),
  deleteProject: async (id: number): Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/generator-production/projects/${id}/delete`)),
  definitions: async (): Promise<GeneratorDefinitions> => unwrap(await api.get<Envelope<GeneratorDefinitions>>('/api/generator-production/definitions')),
  policy: async (): Promise<GeneratorPolicy> => unwrap(await api.get<Envelope<GeneratorPolicy>>('/api/generator-production/definitions/policy')),
  updatePolicy: async (payload: GeneratorPolicy): Promise<GeneratorPolicy> =>
    unwrap(await api.put<Envelope<GeneratorPolicy>>('/api/generator-production/definitions/policy', payload, { useNativeHttpMethod: true })),
  updateRule: async (rule: GeneratorRule): Promise<GeneratorRule> =>
    unwrap(await api.put<Envelope<GeneratorRule>>(`/api/generator-production/definitions/rules/${rule.id}`, {
      name: rule.name, description: rule.description, severity: rule.severity, isEnabled: rule.isEnabled,
      parametersJson: rule.parametersJson || null, rowVersion: rule.rowVersion,
    }, { useNativeHttpMethod: true })),
  bootstrap: async (): Promise<GeneratorBootstrapResult> => unwrap(await api.post<Envelope<GeneratorBootstrapResult>>('/api/generator-production/definitions/bootstrap')),
  preview: async (projectIds: number[], earliestStartAtUtc?: string): Promise<GeneratorPlanPreview> => unwrap(await api.post<Envelope<GeneratorPlanPreview>>('/api/generator-production/planning/preview', { projectIds, earliestStartAtUtc: earliestStartAtUtc || null })),
  apply: async (projectIds: number[], reason: string, earliestStartAtUtc?: string): Promise<GeneratorPlanApplyResult> => unwrap(await api.post<Envelope<GeneratorPlanApplyResult>>('/api/generator-production/planning/apply', { projectIds, reason, earliestStartAtUtc: earliestStartAtUtc || null })),
  revisions: async (projectId?: number, take = 100): Promise<GeneratorPlanRevision[]> => unwrap(await api.get<Envelope<GeneratorPlanRevision[]>>('/api/generator-production/planning/revisions', { params: { projectId, take } })),
  schedule: async (fromUtc: string, toUtc: string): Promise<GeneratorScheduleRow[]> => unwrap(await api.get<Envelope<GeneratorScheduleRow[]>>('/api/generator-production/schedule', { params: { fromUtc, toUtc } })),
  transitionOperation: async (operationId: number, action: GeneratorOperationAction, rowVersion: string, reason?: string, quantities?: { goodQuantity: number; defectQuantity: number; scrapQuantity: number }): Promise<GeneratorScheduleRow> =>
    unwrap(await api.post<Envelope<GeneratorScheduleRow>>(`/api/generator-production/operations/${operationId}/transition`, {
      action, rowVersion, reason: reason?.trim() || null, goodQuantity: quantities?.goodQuantity ?? 0,
      defectQuantity: quantities?.defectQuantity ?? 0, scrapQuantity: quantities?.scrapQuantity ?? 0,
    })),
};
