import { api } from '@/lib/axios';
import type { WarehouseBarcodeBalanceCandidate } from '@/features/barcode-resolution/barcode-resolution.api';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import { buildDropdownPagedBody } from '@/lib/dropdown-paging';
import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T,>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'KKD işlemi başarısız.');
  return response.data;
};

export type KkdLookup = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  departmentId?: number;
  departmentName?: string;
};
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
  kkdRequestLineId?: number | null;
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
  kkdRequestId?: number | null;
  lines: Array<{ stockId: number; yapCodeId: null; quantity: number; unitCode: string | null;
    sourceLocationId: number | null; orderNumber: string | null; orderLineId: number | null; requireHandlingUnit: boolean;
    description: string | null; trackings: Array<{ quantity: number; lotNo: string | null;
      serialNo: string | null; handlingUnitNo: string | null; manufacturingDate: null;
      expirationDate: null; sourceLocationId: number | null }> | null; kkdRequestLineId?: number | null }>;
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

/** Not: 'quotapending' backend'deki KkdRequestBoardTab.QuotaPending'e Enum.TryParse(ignoreCase:true) ile eşleşir — tire/boşluk desteklenmiyor. */
export type KkdRequestBoardTab = 'all' | 'pending' | 'preparing' | 'completed' | 'cancelled' | 'mine' | 'quotapending';

export type KkdRequestTabCounts = {
  pending: number; preparing: number; completed: number; cancelled: number; mine: number; quotaPending: number;
};

export type KkdQuotaDecision = 'None' | 'Pending' | 'Approved' | 'Rejected';

export type KkdRequestRow = {
  id: number; requestNo: string; status: string; priority: string; sourceType: string;
  employeeId: number; employeeCode: string; employeeName: string; departmentName: string; roleName: string;
  warehouseId?: number | null; assignedUserId?: number | null; assignedUserName?: string | null;
  externalRequestNo?: string | null;
  totalLineCount: number; unresolvedLineCount: number; requestedQuantity: number;
  allocatedQuantity: number; deliveredQuantity: number; requestedAtUtc: string; neededAtUtc?: string | null;
  linkedDistributionId?: number | null; linkedDistributionStatus?: string | null;
  linkedDistributionFailureReason?: string | null;
  warehouseOutboundId?: number | null; rowVersion: string;
  activeTaskCount: number; unassignedLineCount: number; myActiveTaskId?: number | null;
  activeAssigneeNames: string[];
  /** myActiveTaskId "Bu işi yapıyorum" ile başlatıldı mı — "Toplama yap"/"İşe devam et" ayrımı için. */
  myActiveTaskStarted?: boolean;
  /** myActiveTaskId'nin canlı toplanan (henüz teslim edilmemiş) miktar toplamı. */
  myActiveTaskPreparedQuantity?: number;
  /** myActiveTaskId'nin kota kararı bekleyen (Pending/Rejected) kalem sayısı — toplama bu yüzden başlayamıyor olabilir. */
  myActiveTaskQuotaPendingCount?: number;
  /** myActiveTaskId'nin müdürce onaylanmış (Approved) kota kararı sayısı. */
  myActiveTaskQuotaApprovedCount?: number;
  /** Depo havuzuna bırakılmış (kişiye atanmamış), henüz kimsenin üzerine almadığı aktif bir görev var mı. */
  hasPoolTask: boolean;
  poolTaskId?: number | null;
  createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null;
};

/** Bir görev satırının bir rafa ayrılmış rezervasyon/toplama izi ("Bu işi yapıyorum"/"Rotayı güncelle" ile oluşur). */
export type KkdPreparationTaskLineLocationRow = {
  locationId: number; locationCode: string; locationName: string;
  reservedQuantity: number; pickedQuantity: number; serialNo?: string | null; lotNo?: string | null;
};

export type KkdPreparationTaskLineRow = {
  id: number; requestLineId: number; lineNo: number; groupCode: string; groupName?: string | null;
  stockId?: number | null; stockCode?: string | null; stockName?: string | null; unitCode: string;
  quantity: number; preparedQuantity: number; deliveredQuantity: number; lineStatus: string;
  requestLineRowVersion: string; quotaDecision: KkdQuotaDecision; locations: KkdPreparationTaskLineLocationRow[];
};

export type KkdPreparationTaskRow = {
  id: number; taskNo: string; requestId: number; requestNo: string; status: string;
  /** null ise görev kişiye değil depo havuzuna bırakılmıştır. */
  assignedUserId: number | null; assignedUserName: string | null; warehouseId: number;
  previousTaskId?: number | null; previousTaskNo?: string | null;
  originUserId?: number | null; originUserName?: string | null;
  distributionId?: number | null; warehouseOutboundId?: number | null;
  assignedAtUtc: string; startedAtUtc?: string | null; completedAtUtc?: string | null;
  closureReason?: string | null; rowVersion: string;
  lines: KkdPreparationTaskLineRow[];
};

export type KkdPreparationResolveScanResult = {
  taskLineId: number;
  requestLineId: number;
  needsGroupResolve: boolean;
  groupCode: string;
  stockId: number;
  stockCode: string;
  stockName: string;
  unitCode: string;
  lotNo?: string | null;
  serialNo?: string | null;
  suggestedLocationId?: number | null;
  requireSerial: boolean;
  requireLot: boolean;
  remainingQuantity: number;
  defaultQuantity: number;
  isSerial: boolean;
  canAutoPick: boolean;
  /** Depo AutoPickWithoutConfirmMaxQuantity — üretim ile aynı. */
  autoPickWithoutConfirmMaxQuantity?: number | null;
  rawBarcode: string;
  source: string;
  /** Birden fazla raf/seri varsa kullanıcının seçebilmesi için tüm adaylar. */
  balanceCandidates: WarehouseBarcodeBalanceCandidate[];
};

export const KKD_PICK_ABOVE_THRESHOLD_CONFIRM_MESSAGE =
  'Bu miktar onay eşiğini aşıyor. Devam etmek için onaylayın.';

export type KkdPreparationScanPickResult = {
  isReplay: boolean;
  taskLineId: number;
  requestLineId: number;
  acceptedQuantity: number;
  linePreparedQuantity: number;
  lineQuantity: number;
  stockId: number;
  stockCode: string;
  stockName: string;
  lotNo?: string | null;
  serialNo?: string | null;
  sourceLocationId?: number | null;
  task: KkdPreparationTaskRow;
};

export type KkdPreparationScanTracking = {
  quantity: number;
  lotNo?: string | null;
  serialNo?: string | null;
  sourceLocationId?: number | null;
};

/** "Son okutmalar" listesindeki bir satır — geri alma (Unpick) hedefi. */
export type KkdPreparationScanRow = {
  id: number; taskLineId: number; stockId: number; stockCode: string; stockName: string;
  quantity: number; unitCode: string; lotNo?: string | null; serialNo?: string | null;
  sourceLocationId?: number | null; scannedAtUtc: string; isReversed: boolean; canUnpick: boolean;
};

export type KkdRequestCancelPrecheck = {
  canCancel: boolean; blockers: string[];
  activeDistributionId?: number | null; activeWarehouseOutboundId?: number | null;
};

export type KkdRequestLine = {
  id: number; lineNo: number; groupCode: string; groupName?: string | null; stockId?: number | null;
  stockCode?: string | null; stockName?: string | null; unitCode: string; requestedQuantity: number;
  allocatedQuantity: number; deliveredQuantity: number; remainingQuantity: number; status: string;
  externalOrderNo?: string | null; externalOrderLineId?: string | null; resolvedByUserId?: number | null;
  resolvedAtUtc?: string | null; resolutionReason?: string | null;
  quotaDecision: KkdQuotaDecision; quotaDecisionByUserId?: number | null; quotaDecisionAtUtc?: string | null;
  rowVersion: string;
  resolutions: Array<{ id: number; previousStockId?: number | null; stockId: number; stockCode: string;
    stockName?: string | null; reason: string; resolvedBy?: number | null; resolvedAtUtc: string }>;
};

export type KkdRequestDetail = {
  id: number; correlationId: string; requestNo: string; status: string; priority: string; sourceType: string;
  employeeId: number; employeeCode: string; employeeName: string; departmentName: string; roleName: string;
  customerId: number; warehouseId?: number | null; assignedUserId?: number | null; externalRequestNo?: string | null;
  requestedAtUtc: string; neededAtUtc?: string | null; startedAtUtc?: string | null; readyAtUtc?: string | null;
  completedAtUtc?: string | null; cancelledAtUtc?: string | null; cancellationReason?: string | null;
  description?: string | null; rowVersion: string; lines: KkdRequestLine[];
};

export type KkdRequestCreatePayload = {
  idempotencyKey: string; employeeId: number; warehouseId: number | null; assignedUserId: number | null;
  sourceType: 'Wms'|'Windbox'|'Netsis'|'Manual'; externalRequestNo: string | null;
  priority: 'Low'|'Normal'|'High'|'Urgent'; neededAtUtc: string | null; description: string | null;
  lines: Array<{ groupCode: string; groupName: string | null; stockId: number | null; quantity: number;
    externalOrderNo: string | null; externalOrderLineId: string | null }>;
};

export const kkdApi = {
  policy: async () => unwrap(await api.get<Envelope<KkdPolicy>>('/api/kkd/policy')),
  savePolicy: async (payload: Omit<KkdPolicy, 'id'|'branchCode'|'updatedBy'|'updatedDate'>) =>
    unwrap(await api.put<Envelope<KkdPolicy>>('/api/kkd/policy', payload)),
  /** Depo bazlı KKD toplama sanal rafı — canlı toplamada kaynak raftan buraya stok hareketi postalanır. */
  pickingStagingLocation: async (warehouseId: number) =>
    unwrap(await api.get<Envelope<{ warehouseId: number; kkdPickingStagingLocationId: number | null }>>(
      `/api/kkd/warehouses/${warehouseId}/picking-staging-location`,
    )),
  updatePickingStagingLocation: async (warehouseId: number, locationId: number | null) =>
    unwrap(await api.put<Envelope<{ warehouseId: number; kkdPickingStagingLocationId: number | null }>>(
      `/api/kkd/warehouses/${warehouseId}/picking-staging-location`,
      { locationId },
    )),
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
  distributionContext: async (employeeId: number, includeOpenOrders = true) =>
    unwrap(await api.get<Envelope<KkdDistributionContext>>(`/api/kkd/distributions/context/${employeeId}`, {
      params: { includeOpenOrders },
    })),
  distributionOrderLines: async (employeeId: number, orderNumbers: string[]) =>
    unwrap(await api.get<Envelope<KkdOpenOrderLine[]>>(`/api/kkd/distributions/context/${employeeId}/lines`, { params: { orderNumbersCsv: orderNumbers.join(',') } })),
  materialRequestConfiguration: async () =>
    unwrap(await api.get<Envelope<{ isEnabled: boolean }>>('/api/kkd/material-requests/configuration')),
  materialRequestContext: async (employeeId: number) =>
    unwrap(await api.get<Envelope<KkdDistributionContext>>(`/api/kkd/material-requests/context/${employeeId}`)),
  materialRequestOrderLines: async (employeeId: number, orderNumbers: string[]) =>
    unwrap(await api.get<Envelope<KkdOpenOrderLine[]>>(`/api/kkd/material-requests/context/${employeeId}/lines`, { params: { orderNumbersCsv: orderNumbers.join(',') } })),
  requestsPaged: async (request: GridRequest, tab: KkdRequestBoardTab = 'all'): Promise<GridPage<KkdRequestRow>> =>
    unwrap(await api.post<Envelope<GridPage<KkdRequestRow>>>('/api/kkd/requests/paged', {
      ...request,
      sortBy: request.sortBy || 'requestedAtUtc',
      sortDirection: request.sortDirection || 'desc',
    }, { params: { tab } })),
  requestTabCounts: async () =>
    unwrap(await api.get<Envelope<KkdRequestTabCounts>>('/api/kkd/requests/tab-counts')),
  requestDetail: async (id: number) =>
    unwrap(await api.get<Envelope<KkdRequestDetail>>(`/api/kkd/requests/${id}`)),
  createRequest: async (payload: KkdRequestCreatePayload) =>
    unwrap(await api.post<Envelope<KkdRequestDetail>>('/api/kkd/requests', payload)),
  resolveRequestLine: async (requestId: number, lineId: number, payload: { stockId: number; reason: string; expectedRowVersion: string }) =>
    unwrap(await api.post<Envelope<KkdRequestDetail>>(`/api/kkd/requests/${requestId}/lines/${lineId}/resolve`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  /** Kota aşımı kararı — talebe özel (onay bu talep için tek günlük bir ek hak yaratır). */
  decideQuota: async (lineId: number, payload: { approve: boolean; reason: string }) =>
    unwrap(await api.post<Envelope<{ requestLineId: number; quotaDecision: KkdQuotaDecision; quotaOverrideId: number | null }>>(
      `/api/kkd/requests/lines/${lineId}/quota-decision`, { ...payload, idempotencyKey: crypto.randomUUID() },
    )),
  assignRequest: async (id: number, payload: { warehouseId: number | null; assignedUserId: number | null; expectedRowVersion?: string | null }) =>
    unwrap(await api.put<Envelope<KkdRequestDetail>>(`/api/kkd/requests/${id}/assignment`, payload)),
  requestPreparationTasks: async (requestId: number) =>
    unwrap(await api.get<Envelope<KkdPreparationTaskRow[]>>(`/api/kkd/requests/${requestId}/preparation-tasks`)),
  assignPreparationTasks: async (requestId: number, payload: {
    warehouseId: number;
    /** assignedUserId null olan grup depo havuzuna bırakılır (kişiye özel değil). */
    groups: Array<{ assignedUserId: number | null; lineIds: number[] }>;
    expectedRowVersion?: string | null;
  }) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow[]>>(`/api/kkd/requests/${requestId}/preparation-tasks`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  claimRequest: async (requestId: number, payload: { warehouseId: number; expectedRowVersion?: string | null }) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow>>(`/api/kkd/requests/${requestId}/claim`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  /** Depo havuzundaki (sahipsiz) bir görevi aktörün üzerine alması. */
  claimPreparationTask: async (taskId: number, payload: { expectedRowVersion?: string | null }) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow>>(`/api/kkd/preparation-tasks/${taskId}/claim`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  handoffPreparationTask: async (taskId: number, payload: { toUserId: number; reason: string; expectedRowVersion?: string | null }) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow>>(`/api/kkd/preparation-tasks/${taskId}/handoff`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  returnPreparationTask: async (taskId: number, payload: { reason: string; expectedRowVersion?: string | null }) =>
    unwrap(await api.post<Envelope<null>>(`/api/kkd/preparation-tasks/${taskId}/return`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  resolvePreparationScan: async (taskId: number, payload: { barcode: string; expectedTaskLineId?: number | null }) =>
    unwrap(await api.post<Envelope<KkdPreparationResolveScanResult>>(
      `/api/kkd/preparation-tasks/${taskId}/resolve-scan`,
      payload,
    )),
  scanPickPreparationTask: async (taskId: number, payload: {
    barcode: string;
    expectedTaskLineId?: number | null;
    quantity?: number | null;
    sourceLocationId?: number | null;
    expectedRequestLineRowVersion?: string | null;
    confirmAboveThreshold?: boolean;
  }) =>
    unwrap(await api.post<Envelope<KkdPreparationScanPickResult>>(
      `/api/kkd/preparation-tasks/${taskId}/scan-pick`,
      { ...payload, idempotencyKey: crypto.randomUUID() },
    )),
  preparationStagedTrackings: async (taskId: number, requestLineId: number) =>
    unwrap(await api.get<Envelope<KkdPreparationScanTracking[]>>(
      `/api/kkd/preparation-tasks/${taskId}/lines/${requestLineId}/staged-trackings`,
    )),
  /** "Bu işi yapıyorum": havuz görevinde üzerine alır, stoğu bilinen satırlara raf ataması + gerçek rezervasyon yapar. */
  startPreparationTask: async (taskId: number) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow>>(`/api/kkd/preparation-tasks/${taskId}/start`, {
      idempotencyKey: crypto.randomUUID(),
    })),
  routeCandidates: async (taskLineId: number) =>
    unwrap(await api.get<Envelope<{ isSerial: boolean; candidates: Array<{
      locationId: number; locationCode: string; locationName: string; availableQuantity: number;
      serialNo?: string | null; lotNo?: string | null;
    }> }>>(`/api/kkd/preparation-tasks/lines/${taskLineId}/route-candidates`)),
  applyRouteSplit: async (taskLineId: number, payload: {
    selections: Array<{ locationId: number; quantity: number; serialNo?: string | null }>;
    expectedTaskLineRowVersion?: string | null;
  }) =>
    unwrap(await api.post<Envelope<KkdPreparationTaskRow>>(`/api/kkd/preparation-tasks/lines/${taskLineId}/route-split`, {
      ...payload, idempotencyKey: crypto.randomUUID(),
    })),
  /** Son okutmalar listesi — geri alma (Unpick) UI'sı için, en yeni önce. */
  preparationScans: async (taskId: number) =>
    unwrap(await api.get<Envelope<KkdPreparationScanRow[]>>(`/api/kkd/preparation-tasks/${taskId}/scans`)),
  /** Yanlış okutulan bir taramayı geri alır: gerçek stok hareketi ters çevrilir, rezervasyon geri yüklenir. */
  unpickScan: async (taskId: number, scanId: number) =>
    unwrap(await api.post<Envelope<{ scanId: number; taskLineId: number; revertedQuantity: number; task: KkdPreparationTaskRow }>>(
      `/api/kkd/preparation-tasks/${taskId}/scans/${scanId}/unpick`,
      { idempotencyKey: crypto.randomUUID() },
    )),
  requestCancelPrecheck: async (id: number) =>
    unwrap(await api.get<Envelope<KkdRequestCancelPrecheck>>(`/api/kkd/requests/${id}/cancel-precheck`)),
  cancelRequest: async (id: number, reason: string, expectedRowVersion: string) =>
    unwrap(await api.post<Envelope<KkdRequestDetail>>(`/api/kkd/requests/${id}/cancel`, {
      idempotencyKey: crypto.randomUUID(), reason, expectedRowVersion,
    })),
  /** İptal edilmiş bir talebi tekrar beklemeye alır (Hazırlamada'dan gelen görev iadesinden ayrı bir akış). */
  reactivateRequest: async (id: number, expectedRowVersion?: string | null) =>
    unwrap(await api.post<Envelope<KkdRequestDetail>>(`/api/kkd/requests/${id}/reactivate`, {
      idempotencyKey: crypto.randomUUID(), expectedRowVersion,
    })),
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
