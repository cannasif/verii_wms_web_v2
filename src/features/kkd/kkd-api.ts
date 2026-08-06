import { api } from '@/lib/axios';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import { buildDropdownPagedBody } from '@/lib/dropdown-paging';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T,>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'KKD işlemi başarısız.');
  return response.data;
};

export type KkdLookup = { id: number; code: string; name: string; isActive: boolean };
export type KkdCustomerLookup = { id: number; code: string; name: string };
export type KkdStockLookup = { id: number; code: string; name: string; unitCode: string; groupCode?: string | null };
export type KkdStockBulkResolve = { requestedCode: string; id?: number | null; code?: string | null; name?: string | null; unitCode?: string | null; groupCode?: string | null; isFound: boolean };
export type KkdStockGroupLookup = { code: string; stockCount: number };
export type KkdEntitlementGroupLookup = { code: string; name: string; ruleCount: number };
export type KkdEmployee = {
  id: number; employeeCode: string; fullName: string; qrCode: string; customerId: number;
  departmentId: number; departmentName: string; roleId: number; roleName: string;
  employmentStartDate: string; isActive: boolean;
};
export type KkdMatrix = {
  id: number; code: string; name: string; customerId: number; departmentId: number;
  roleId: number; effectiveFrom?: string; effectiveTo?: string; isActive: boolean; ruleCount: number;
};
export type KkdMatrixPhase = {
  id: number; phaseType: string; offsetMonths: number; quantity: number; allowBulkIssue: boolean;
  frequencyDays?: number | null; quantityPerFrequency?: number | null; periodType?: string | null;
  periodInterval?: number | null; sortOrder: number; isActive: boolean; description?: string | null;
};
export type KkdMatrixRule = {
  id: number; groupCode: string; groupName?: string | null; stockId?: number | null;
  stockCode?: string | null; stockName?: string | null; standardCode?: string | null; standardName?: string | null;
  annualIssueCount?: number | null; annualQuantity?: number | null; maxCarryQuantity?: number | null;
  allowBulkIssue: boolean; isMandatory: boolean; sortOrder: number; isActive: boolean;
  description?: string | null; phases: KkdMatrixPhase[];
};
export type KkdMatrixDetail = Omit<KkdMatrix, 'ruleCount'> & { description?: string | null; rules: KkdMatrixRule[]; rowVersion: string };
export type KkdMatrixValidation = {
  isValid: boolean; ruleCount: number; phaseCount: number; stockSpecificRuleCount: number; groupRuleCount: number;
  issues: Array<{ rowNumber: number; field: string; code: string; message: string }>;
};
export type KkdDistribution = {
  id: number; documentNo: string; status: string; employeeId: number; employeeCode: string;
  employeeName: string; warehouseId: number; warehouseOutboundId?: number; totalQuantity: number;
  entitledQuantity: number; excessQuantity: number; excessApprovalStatus: string;
  excessApprovalReason?: string; excessApprovedBy?: number; excessApprovedAtUtc?: string;
  createdDate?: string; completedAtUtc?: string;
};
export type KkdDistributionContext = {
  employeeId: number; employeeCode: string; employeeName: string; branchCode: string;
  customerId: number; customerCode: string; customerName: string; policy: KkdPolicy;
  orders: Array<{ orderNumber: string; orderDate?: string; projectCode?: string; remainingQuantity: number }>;
  preferredStocks: Array<{ groupCode: string; stockId: number; stockCode: string; stockName: string }>;
};
export type KkdPolicy = {
  id: number; branchCode: string; enableMaterialRequestOrderFlow: boolean;
  requireOpenOrder: boolean; allowOpenOrderExcess: boolean;
  allowMultipleOrdersPerDistribution: boolean; requireEmployeeUserLink: boolean;
  allowFutureDatedDistribution: boolean; requireManagerApprovalForExcess: boolean;
  updatedBy?: number; updatedDate?: string;
};
export type KkdOpenOrderLine = {
  orderNumber: string; orderLineId: number; orderLineSequence: number; stockId?: number;
  stockCode: string; stockName: string; unitCode?: string; yapCode?: string; projectCode?: string;
  orderDate?: string; deliveryDate?: string; remainingQuantity: number; isMapped: boolean; mappingMessage?: string;
};
export type KkdDistributionCreateResult = {
  id: number; documentNo: string; status: string; warehouseOutboundId: number;
  warehouseOutboundDocumentNo: string; totalQuantity: number; entitledQuantity: number;
  excessQuantity: number; excessApprovalStatus: string; replayed: boolean;
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
  description: string | null; createWarehouseTask?: boolean; assignedUserIds?: number[] | null;
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
export type KkdDistributionDetail = {
  id: number; correlationId: string; documentNo: string; status: string;
  employeeId: number; employeeCode: string; employeeName: string; customerId: number; warehouseId: number;
  warehouseOutboundId?: number | null; excessApprovalStatus: string; excessApprovalReason?: string | null;
  failureReason?: string | null; createdDate?: string | null; completedAtUtc?: string | null;
  lines: Array<{ id: number; lineNo: number; stockId: number; stockCode: string; stockName: string;
    groupCode: string; quantity: number; entitledQuantity: number; excessQuantity: number;
    sourceLocationId: number; lotNo?: string | null; serialNo?: string | null;
    openOrderNo?: string | null; openOrderLineId?: string | null }>;
};
export type KkdRemainingEntitlement = {
  employeeId: number; employeeCode: string; employeeName: string; groupCode: string; groupName: string;
  stockId: number; stockCode: string; stockName: string; phaseType?: string | null;
  matrixRemainingQuantity: number; overrideRemainingQuantity: number; totalRemainingQuantity: number;
  lastUsageAtUtc?: string | null; nextEligibleDate?: string | null; reasonCode: string; message: string;
};
export type KkdOverride = {
  id: number; employeeId: number; employeeCode: string; employeeName: string; ruleId?: number | null;
  groupCode: string; quantity: number; consumedQuantity: number; remainingQuantity: number;
  validFrom: string; validTo?: string | null; reason: string; approvedByUserId: number;
  isActive: boolean; createdDate?: string | null; updatedDate?: string | null; rowVersion: string;
};
export type KkdPaged<T> = {
  items: T[]; totalCount: number; pageNumber: number; pageSize: number; totalPages: number;
  hasPreviousPage: boolean; hasNextPage: boolean;
};

export const kkdApi = {
  policy: async () => unwrap(await api.get<Envelope<KkdPolicy>>('/api/kkd/policy')),
  savePolicy: async (payload: Omit<KkdPolicy, 'id'|'branchCode'|'updatedBy'|'updatedDate'>) =>
    unwrap(await api.put<Envelope<KkdPolicy>>('/api/kkd/policy', payload)),
  departments: async () => unwrap(await api.get<Envelope<KkdLookup[]>>('/api/kkd/departments')),
  roles: async (departmentId?: number) => unwrap(await api.get<Envelope<KkdLookup[]>>('/api/kkd/roles', { params: { departmentId } })),
  customersPaged: async (request: DropdownPageRequest): Promise<DropdownPage<KkdCustomerLookup>> =>
    unwrap(await api.post<Envelope<DropdownPage<KkdCustomerLookup>>>(
      '/api/kkd/lookups/customers/paged',
      buildDropdownPagedBody(request, { sortBy: 'code', searchFields: ['code', 'name'] }),
      { signal: request.signal },
    )),
  stocksPaged: async (request: DropdownPageRequest, groupCode?: string): Promise<DropdownPage<KkdStockLookup>> =>
    unwrap(await api.post<Envelope<DropdownPage<KkdStockLookup>>>(
      '/api/kkd/lookups/stocks/paged',
      buildDropdownPagedBody(request, { sortBy: 'code', searchFields: ['code', 'name'] }),
      { params: { groupCode: groupCode || undefined }, signal: request.signal },
    )),
  resolveStocks: async (codes: string[]) => unwrap(await api.post<Envelope<KkdStockBulkResolve[]>>(
    '/api/kkd/lookups/stocks/resolve', { codes })),
  stockGroupsPaged: async (request: DropdownPageRequest): Promise<DropdownPage<KkdStockGroupLookup>> =>
    unwrap(await api.post<Envelope<DropdownPage<KkdStockGroupLookup>>>(
      '/api/kkd/lookups/stock-groups/paged',
      buildDropdownPagedBody(request, { sortBy: 'code', searchFields: ['code'] }),
      { signal: request.signal },
    )),
  entitlementGroupsPaged: async (request: DropdownPageRequest): Promise<DropdownPage<KkdEntitlementGroupLookup>> =>
    unwrap(await api.post<Envelope<DropdownPage<KkdEntitlementGroupLookup>>>(
      '/api/kkd/lookups/entitlement-groups/paged',
      buildDropdownPagedBody(request, { sortBy: 'code', searchFields: ['code', 'name'] }),
      { signal: request.signal },
    )),
  employees: async () => unwrap(await api.get<Envelope<KkdEmployee[]>>('/api/kkd/employees')),
  resolveEmployeeQr: async (qrCode: string) =>
    unwrap(await api.post<Envelope<KkdEmployee>>('/api/kkd/employees/qr-resolve', { qrCode })),
  matrices: async () => unwrap(await api.get<Envelope<KkdMatrix[]>>('/api/kkd/matrices')),
  matrix: async (id: number) => unwrap(await api.get<Envelope<KkdMatrixDetail>>(`/api/kkd/matrices/${id}`)),
  distributions: async () => unwrap(await api.get<Envelope<KkdDistribution[]>>('/api/kkd/distributions')),
  distributionsPaged: async (request: { pageNumber: number; pageSize: number; search?: string }) =>
    unwrap(await api.post<Envelope<KkdPaged<KkdDistribution>>>('/api/kkd/distributions/paged', {
      ...request,
      sortBy: 'id',
      sortDirection: 'desc',
      searchFields: ['documentNo', 'employeeCode', 'employeeName'],
    })),
  distributionDetail: async (id: number) =>
    unwrap(await api.get<Envelope<KkdDistributionDetail>>(`/api/kkd/distributions/${id}`)),
  distributionContext: async (employeeId: number) =>
    unwrap(await api.get<Envelope<KkdDistributionContext>>(`/api/kkd/distributions/context/${employeeId}`)),
  distributionOrderLines: async (employeeId: number, orderNumbers: string[]) =>
    unwrap(await api.get<Envelope<KkdOpenOrderLine[]>>(`/api/kkd/distributions/context/${employeeId}/lines`, { params: { orderNumbersCsv: orderNumbers.join(',') } })),
  materialRequestConfiguration: async () =>
    unwrap(await api.get<Envelope<{ isEnabled: boolean }>>('/api/kkd/material-requests/configuration')),
  materialRequestContext: async (employeeId: number) =>
    unwrap(await api.get<Envelope<KkdDistributionContext>>(`/api/kkd/material-requests/context/${employeeId}`)),
  materialRequestOrderLines: async (employeeId: number, orderNumbers: string[]) =>
    unwrap(await api.get<Envelope<KkdOpenOrderLine[]>>(`/api/kkd/material-requests/context/${employeeId}/lines`, { params: { orderNumbersCsv: orderNumbers.join(',') } })),
  distributionSeries: async () =>
    unwrap(await api.get<Envelope<Array<{ id:number; code:string; name:string; previewDocumentNumber:string; isDefault:boolean }>>>('/api/document-series/lookup?documentType=WarehouseIssue')),
  createDistribution: async (payload: KkdDistributionCreatePayload) =>
    unwrap(await api.post<Envelope<KkdDistributionCreateResult>>('/api/kkd/distributions', payload)),
  saveDepartment: async (payload: { code: string; name: string; isActive: boolean }) =>
    unwrap(await api.post<Envelope<number>>('/api/kkd/departments', payload)),
  saveRole: async (payload: { departmentId?: number; code: string; name: string; isActive: boolean }) =>
    unwrap(await api.post<Envelope<number>>('/api/kkd/roles', payload)),
  saveEmployee: async (payload: unknown) => unwrap(await api.post<Envelope<number>>('/api/kkd/employees', payload)),
  saveMatrix: async (payload: unknown, id?: number) => unwrap(id
    ? await api.put<Envelope<number>>(`/api/kkd/matrices/${id}`, payload)
    : await api.post<Envelope<number>>('/api/kkd/matrices', payload)),
  validateMatrix: async (payload: unknown, id?: number) => unwrap(await api.post<Envelope<KkdMatrixValidation>>(
    id ? `/api/kkd/matrices/${id}/validate` : '/api/kkd/matrices/validate', payload)),
  check: async (payload: { employeeId: number; stockId: number; quantity: number; atDate?: string }) =>
    unwrap(await api.post<Envelope<KkdEntitlementResult>>('/api/kkd/entitlements/check', payload)),
  remainingEntitlements: async (employeeId: number, atDate?: string) =>
    unwrap(await api.get<Envelope<KkdRemainingEntitlement[]>>(
      `/api/kkd/reports/remaining-entitlements/${employeeId}`,
      { params: { atDate: atDate || undefined } },
    )),
  overridesPaged: async (request: { pageNumber: number; pageSize: number; search?: string }) =>
    unwrap(await api.post<Envelope<KkdPaged<KkdOverride>>>('/api/kkd/overrides/paged', {
      ...request,
      sortBy: 'updatedDate',
      sortDirection: 'desc',
      searchFields: ['employeeCode', 'employeeName', 'groupCode', 'reason'],
    })),
  createOverride: async (payload: unknown) => unwrap(await api.post<Envelope<number>>('/api/kkd/overrides', payload)),
  updateOverride: async (id: number, payload: unknown) =>
    unwrap(await api.put<Envelope<number>>(`/api/kkd/overrides/${id}`, payload)),
  deleteOverride: async (id: number) => unwrap(await api.delete<Envelope<null>>(`/api/kkd/overrides/${id}`)),
  complete: async (id: number) => unwrap(await api.post<Envelope<unknown>>(`/api/kkd/distributions/${id}/complete`, { idempotencyKey: crypto.randomUUID() })),
  decideExcessApproval: async (id: number, approve: boolean, reason: string) =>
    unwrap(await api.post<Envelope<KkdDistribution>>(`/api/kkd/distributions/${id}/excess-approval`, {
      idempotencyKey: crypto.randomUUID(), approve, reason,
    })),
  usageReport: async (dimension: 'Department'|'Role'|'Group', from?: string, to?: string) =>
    unwrap(await api.get<Envelope<KkdUsageSummary[]>>('/api/kkd/reports/usage', { params: { dimension, from: from || undefined, to: to || undefined } })),
  validationLogs: async () =>
    unwrap(await api.get<Envelope<KkdValidationLog[]>>('/api/kkd/reports/validation-logs', { params: { take: 250 } })),
};
