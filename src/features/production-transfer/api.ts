import { api } from '@/lib/axios';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>) => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export interface ProductionTransferPolicy {
  id: number;
  branchCode: string;
  rowVersion: string;
  requireProductionOrderReference: boolean;
  allowManualTransfer: boolean;
  allowAutomaticGeneration: boolean;
  checkMaterialAvailability: boolean;
  blockOnShortage: boolean;
  requireTaskAssignment: boolean;
  requireSourceProductionLocation: boolean;
  requireTargetProductionLocation: boolean;
  allowPartialSupply: boolean;
  allowOverIssue: boolean;
  overIssueTolerancePercent: number;
  requireApproval: boolean;
}

export const productionTransferApi = {
  policy: async (branchCode: string): Promise<ProductionTransferPolicy> =>
    unwrap(await api.get<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', { params: { branchCode } })),
  updatePolicy: async (payload: ProductionTransferPolicy): Promise<ProductionTransferPolicy> =>
    unwrap(await api.put<Envelope<ProductionTransferPolicy>>('/api/production-transfers/policy', payload)),
};
