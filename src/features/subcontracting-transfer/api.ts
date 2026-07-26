import { api } from '@/lib/axios';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(result: Envelope<T>) => {
  if (!result.success) throw new Error(result.message || 'İşlem başarısız.');
  return result.data;
};

export interface SubcontractingTransferPolicy {
  id: number;
  branchCode: string;
  rowVersion: string;
  requireSupplier: boolean;
  requireSubcontractOrderForReceipt: boolean;
  requireIssueBeforeReceipt: boolean;
  allowOrderlessIssue: boolean;
  allowOrderlessReceipt: boolean;
  allowSupplierToSupplier: boolean;
  allowPartialIssue: boolean;
  allowPartialReceipt: boolean;
  requireQualityOnReceipt: boolean;
  requireTaskAssignment: boolean;
  requireApproval: boolean;
  allowOverReceipt: boolean;
  overReceiptTolerancePercent: number;
  defaultLeadTimeDays: number;
}

export const subcontractingTransferApi = {
  policy: async (branchCode: string): Promise<SubcontractingTransferPolicy> =>
    unwrap(await api.get<Envelope<SubcontractingTransferPolicy>>('/api/subcontracting-transfers/policy', { params: { branchCode } })),
  updatePolicy: async (payload: SubcontractingTransferPolicy): Promise<SubcontractingTransferPolicy> =>
    unwrap(await api.put<Envelope<SubcontractingTransferPolicy>>('/api/subcontracting-transfers/policy', payload)),
};
