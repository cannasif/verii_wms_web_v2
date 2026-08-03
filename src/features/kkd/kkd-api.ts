import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T,>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'KKD işlemi başarısız.');
  return response.data;
};

export type KkdLookup = { id: number; code: string; name: string; isActive: boolean };
export type KkdEmployee = {
  id: number; employeeCode: string; fullName: string; qrCode: string; customerId: number;
  departmentId: number; departmentName: string; roleId: number; roleName: string;
  employmentStartDate: string; isActive: boolean;
};
export type KkdMatrix = {
  id: number; code: string; name: string; customerId: number; departmentId: number;
  roleId: number; effectiveFrom?: string; effectiveTo?: string; isActive: boolean; ruleCount: number;
};
export type KkdDistribution = {
  id: number; documentNo: string; status: string; employeeId: number; employeeCode: string;
  employeeName: string; warehouseId: number; warehouseOutboundId?: number; totalQuantity: number;
  entitledQuantity: number; excessQuantity: number; createdDate?: string; completedAtUtc?: string;
};
export type KkdDistributionContext = {
  employeeId: number; employeeCode: string; employeeName: string; branchCode: string;
  customerId: number; customerCode: string; customerName: string; policy: KkdPolicy;
  orders: Array<{ orderNumber: string; orderDate?: string; projectCode?: string; remainingQuantity: number }>;
};
export type KkdPolicy = {
  id: number; branchCode: string; requireOpenOrder: boolean; allowOpenOrderExcess: boolean;
  allowMultipleOrdersPerDistribution: boolean; requireEmployeeUserLink: boolean;
  allowFutureDatedDistribution: boolean; updatedBy?: number; updatedDate?: string;
};
export type KkdOpenOrderLine = {
  orderNumber: string; orderLineId: number; orderLineSequence: number; stockId?: number;
  stockCode: string; stockName: string; unitCode?: string; yapCode?: string; projectCode?: string;
  orderDate?: string; deliveryDate?: string; remainingQuantity: number; isMapped: boolean; mappingMessage?: string;
};
export type KkdDistributionCreateResult = {
  id: number; documentNo: string; status: string; warehouseOutboundId: number;
  warehouseOutboundDocumentNo: string; totalQuantity: number; entitledQuantity: number;
  excessQuantity: number; replayed: boolean;
};
export type KkdUsageSummary = {
  code: string; name: string; distributionCount: number; employeeCount: number;
  deliveredQuantity: number; entitledQuantity: number; excessQuantity: number;
};
export type KkdValidationLog = {
  id: number; correlationId: string; employeeId?: number; stockId?: number; groupCode?: string;
  warehouseId?: number; attemptedQuantity: number; reasonCode: string; message?: string;
  deviceInfo?: string; createdDate?: string;
};
export type KkdDistributionCreatePayload = {
  idempotencyKey: string; employeeId: number; warehouseId: number; documentSeriesId: number;
  documentDate: string; stagingLocationId: number | null; loadingLocationId: number | null;
  description: string | null;
  lines: Array<{ stockId: number; yapCodeId: null; quantity: number; unitCode: string | null;
    sourceLocationId: number; orderNumber: string | null; orderLineId: number | null; requireHandlingUnit: boolean;
    description: string | null; trackings: Array<{ quantity: number; lotNo: string | null;
      serialNo: string | null; handlingUnitNo: string | null; manufacturingDate: null;
      expirationDate: null; sourceLocationId: number }> | null }>;
};
export type KkdEntitlementResult = {
  isAllowed: boolean; reasonCode: string; message: string; employeeId: number; stockId: number;
  groupCode: string; phaseType?: string; requestedQuantity: number; matrixRemainingQuantity: number;
  overrideRemainingQuantity: number; totalRemainingQuantity: number; nextEligibleDate?: string;
  allocations: Array<{ sourceType: string; sourceId: number; quantity: number; periodStart: string; periodEnd?: string }>;
};

export const kkdApi = {
  policy: async () => unwrap(await api.get<Envelope<KkdPolicy>>('/api/kkd/policy')),
  savePolicy: async (payload: Omit<KkdPolicy, 'id'|'branchCode'|'updatedBy'|'updatedDate'>) =>
    unwrap(await api.put<Envelope<KkdPolicy>>('/api/kkd/policy', payload)),
  departments: async () => unwrap(await api.get<Envelope<KkdLookup[]>>('/api/kkd/departments')),
  roles: async (departmentId?: number) => unwrap(await api.get<Envelope<KkdLookup[]>>('/api/kkd/roles', { params: { departmentId } })),
  employees: async () => unwrap(await api.get<Envelope<KkdEmployee[]>>('/api/kkd/employees')),
  resolveEmployeeQr: async (qrCode: string) =>
    unwrap(await api.post<Envelope<KkdEmployee>>('/api/kkd/employees/qr-resolve', { qrCode })),
  matrices: async () => unwrap(await api.get<Envelope<KkdMatrix[]>>('/api/kkd/matrices')),
  distributions: async () => unwrap(await api.get<Envelope<KkdDistribution[]>>('/api/kkd/distributions')),
  distributionContext: async (employeeId: number) =>
    unwrap(await api.get<Envelope<KkdDistributionContext>>(`/api/kkd/distributions/context/${employeeId}`)),
  distributionOrderLines: async (employeeId: number, orderNumbers: string[]) =>
    unwrap(await api.get<Envelope<KkdOpenOrderLine[]>>(`/api/kkd/distributions/context/${employeeId}/lines`, { params: { orderNumbersCsv: orderNumbers.join(',') } })),
  distributionSeries: async () =>
    unwrap(await api.get<Envelope<Array<{ id:number; code:string; name:string; previewDocumentNumber:string; isDefault:boolean }>>>('/api/document-series/lookup?documentType=WarehouseIssue')),
  createDistribution: async (payload: KkdDistributionCreatePayload) =>
    unwrap(await api.post<Envelope<KkdDistributionCreateResult>>('/api/kkd/distributions', payload)),
  saveDepartment: async (payload: { code: string; name: string; isActive: boolean }) =>
    unwrap(await api.post<Envelope<number>>('/api/kkd/departments', payload)),
  saveRole: async (payload: { departmentId?: number; code: string; name: string; isActive: boolean }) =>
    unwrap(await api.post<Envelope<number>>('/api/kkd/roles', payload)),
  saveEmployee: async (payload: unknown) => unwrap(await api.post<Envelope<number>>('/api/kkd/employees', payload)),
  saveMatrix: async (payload: unknown) => unwrap(await api.post<Envelope<number>>('/api/kkd/matrices', payload)),
  check: async (payload: { employeeId: number; stockId: number; quantity: number; atDate?: string }) =>
    unwrap(await api.post<Envelope<KkdEntitlementResult>>('/api/kkd/entitlements/check', payload)),
  complete: async (id: number) => unwrap(await api.post<Envelope<unknown>>(`/api/kkd/distributions/${id}/complete`, { idempotencyKey: crypto.randomUUID() })),
  usageReport: async (dimension: 'Department'|'Role'|'Group', from?: string, to?: string) =>
    unwrap(await api.get<Envelope<KkdUsageSummary[]>>('/api/kkd/reports/usage', { params: { dimension, from: from || undefined, to: to || undefined } })),
  validationLogs: async () =>
    unwrap(await api.get<Envelope<KkdValidationLog[]>>('/api/kkd/reports/validation-logs', { params: { take: 250 } })),
};
