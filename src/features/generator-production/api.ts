import { api } from '@/lib/axios';
import type {
  CreateGeneratorProjectRequest, GeneratorBootstrapResult, GeneratorDefinitions, GeneratorOverview,
  GeneratorOperationAction, GeneratorOperationMaterial, GeneratorPlanApplyResult, GeneratorPlanPreview, GeneratorPlanRevision, GeneratorPlanningAssistant, GeneratorProduct, GeneratorProjectDetail,
  GeneratorPolicy, GeneratorProjectPage, GeneratorProjectRequest, GeneratorProjectRow, GeneratorQualityGateStatus, GeneratorRule, GeneratorScheduleRow,
  GeneratorStationCapability, GeneratorStockOption, SaveGeneratorOperationMaterialRequest, SaveGeneratorProductRequest, SaveGeneratorStationCapabilityRequest,
  UpdateGeneratorOperationScheduleRequest, UpdateGeneratorProjectRequest,
} from './types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>): T => { if (!result.success) throw new Error(result.message || 'İşlem başarısız.'); return result.data; };

export const generatorProductionApi = {
  overview: async (): Promise<GeneratorOverview> => unwrap(await api.get<Envelope<GeneratorOverview>>('/api/generator-production/overview')),
  projects: async (request: GeneratorProjectRequest): Promise<GeneratorProjectPage> => unwrap(await api.post<Envelope<GeneratorProjectPage>>('/api/generator-production/projects/paged', request)),
  project: async (id: number): Promise<GeneratorProjectDetail> => unwrap(await api.get<Envelope<GeneratorProjectDetail>>(`/api/generator-production/projects/${id}`)),
  projectOperations: async (id: number): Promise<GeneratorScheduleRow[]> => unwrap(await api.get<Envelope<GeneratorScheduleRow[]>>(`/api/generator-production/projects/${id}/operations`)),
  createProject: async (payload: CreateGeneratorProjectRequest): Promise<GeneratorProjectRow> => unwrap(await api.post<Envelope<GeneratorProjectRow>>('/api/generator-production/projects', payload)),
  updateProject: async (id: number, payload: UpdateGeneratorProjectRequest): Promise<GeneratorProjectDetail> =>
    unwrap(await api.put<Envelope<GeneratorProjectDetail>>(`/api/generator-production/projects/${id}`, payload, { useNativeHttpMethod: true })),
  releaseProject: async (id: number, reason: string, rowVersion: string): Promise<GeneratorProjectDetail> =>
    unwrap(await api.post<Envelope<GeneratorProjectDetail>>(`/api/generator-production/projects/${id}/release`, { reason, rowVersion })),
  deleteProject: async (id: number): Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/generator-production/projects/${id}/delete`)),
  definitions: async (): Promise<GeneratorDefinitions> => unwrap(await api.get<Envelope<GeneratorDefinitions>>('/api/generator-production/definitions')),
  stocks: async (search = ''): Promise<GeneratorStockOption[]> => (unwrap(await api.post<Envelope<{ items: GeneratorStockOption[] }>>('/api/erp-mirror/stocks/paged', { pageNumber: 1, pageSize: 200, search, sortBy: 'erpStockCode', sortDirection: 'asc', filterLogic: 'and', filters: [] }))).items,
  policy: async (): Promise<GeneratorPolicy> => unwrap(await api.get<Envelope<GeneratorPolicy>>('/api/generator-production/definitions/policy')),
  updatePolicy: async (payload: GeneratorPolicy): Promise<GeneratorPolicy> =>
    unwrap(await api.put<Envelope<GeneratorPolicy>>('/api/generator-production/definitions/policy', payload, { useNativeHttpMethod: true })),
  updateRule: async (rule: GeneratorRule): Promise<GeneratorRule> =>
    unwrap(await api.put<Envelope<GeneratorRule>>(`/api/generator-production/definitions/rules/${rule.id}`, {
      name: rule.name, description: rule.description, severity: rule.severity, isEnabled: rule.isEnabled,
      parametersJson: rule.parametersJson || null, rowVersion: rule.rowVersion,
    }, { useNativeHttpMethod: true })),
  saveProduct: async (payload: SaveGeneratorProductRequest & { id?: number }): Promise<GeneratorProduct> => {
    const { id, ...body } = payload;
    return unwrap(id
      ? await api.put<Envelope<GeneratorProduct>>(`/api/generator-production/definitions/products/${id}`, body, { useNativeHttpMethod: true })
      : await api.post<Envelope<GeneratorProduct>>('/api/generator-production/definitions/products', body));
  },
  deleteProduct: async (id: number): Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/generator-production/definitions/products/${id}/delete`)),
  saveStationCapability: async (payload: SaveGeneratorStationCapabilityRequest & { id?: number }): Promise<GeneratorStationCapability> => {
    const { id, ...body } = payload;
    return unwrap(id
      ? await api.put<Envelope<GeneratorStationCapability>>(`/api/generator-production/definitions/station-capabilities/${id}`, body, { useNativeHttpMethod: true })
      : await api.post<Envelope<GeneratorStationCapability>>('/api/generator-production/definitions/station-capabilities', body));
  },
  deleteStationCapability: async (id: number): Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/generator-production/definitions/station-capabilities/${id}/delete`)),
  saveMaterial: async (payload: SaveGeneratorOperationMaterialRequest & { id?: number }): Promise<GeneratorOperationMaterial> => {
    const { id, ...body } = payload;
    return unwrap(id
      ? await api.put<Envelope<GeneratorOperationMaterial>>(`/api/generator-production/definitions/materials/${id}`, body, { useNativeHttpMethod: true })
      : await api.post<Envelope<GeneratorOperationMaterial>>('/api/generator-production/definitions/materials', body));
  },
  deleteMaterial: async (id: number): Promise<boolean> => unwrap(await api.post<Envelope<boolean>>(`/api/generator-production/definitions/materials/${id}/delete`)),
  bootstrap: async (): Promise<GeneratorBootstrapResult> => unwrap(await api.post<Envelope<GeneratorBootstrapResult>>('/api/generator-production/definitions/bootstrap')),
  preview: async (projectIds: number[], earliestStartAtUtc?: string): Promise<GeneratorPlanPreview> => unwrap(await api.post<Envelope<GeneratorPlanPreview>>('/api/generator-production/planning/preview', { projectIds, earliestStartAtUtc: earliestStartAtUtc || null })),
  apply: async (projectIds: number[], reason: string, earliestStartAtUtc?: string): Promise<GeneratorPlanApplyResult> => unwrap(await api.post<Envelope<GeneratorPlanApplyResult>>('/api/generator-production/planning/apply', { projectIds, reason, earliestStartAtUtc: earliestStartAtUtc || null })),
  assistant: async (): Promise<GeneratorPlanningAssistant> => unwrap(await api.get<Envelope<GeneratorPlanningAssistant>>('/api/generator-production/planning/assistant')),
  revisions: async (projectId?: number, take = 100): Promise<GeneratorPlanRevision[]> => unwrap(await api.get<Envelope<GeneratorPlanRevision[]>>('/api/generator-production/planning/revisions', { params: { projectId, take } })),
  schedule: async (fromUtc: string, toUtc: string): Promise<GeneratorScheduleRow[]> => unwrap(await api.get<Envelope<GeneratorScheduleRow[]>>('/api/generator-production/schedule', { params: { fromUtc, toUtc } })),
  transitionOperation: async (operationId: number, action: GeneratorOperationAction, rowVersion: string, reason?: string, quantities?: { goodQuantity: number; defectQuantity: number; scrapQuantity: number }): Promise<GeneratorScheduleRow> =>
    unwrap(await api.post<Envelope<GeneratorScheduleRow>>(`/api/generator-production/operations/${operationId}/transition`, {
      action, rowVersion, reason: reason?.trim() || null, goodQuantity: quantities?.goodQuantity ?? 0,
      defectQuantity: quantities?.defectQuantity ?? 0, scrapQuantity: quantities?.scrapQuantity ?? 0,
    })),
  decideOperationQuality: async (operationId: number, status: Exclude<GeneratorQualityGateStatus, 'Pending'>, reason: string, rowVersion: string): Promise<GeneratorScheduleRow> =>
    unwrap(await api.post<Envelope<GeneratorScheduleRow>>(`/api/generator-production/operations/${operationId}/quality-decision`, { status, reason, rowVersion })),
  updateOperationSchedule: async (operationId: number, payload: UpdateGeneratorOperationScheduleRequest): Promise<GeneratorScheduleRow> =>
    unwrap(await api.put<Envelope<GeneratorScheduleRow>>(`/api/generator-production/operations/${operationId}/schedule`, payload, { useNativeHttpMethod: true })),
};
