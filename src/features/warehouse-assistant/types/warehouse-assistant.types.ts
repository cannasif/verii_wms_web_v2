export type WarehouseAssistantIntent =
  | 'help'
  | 'myActivities'
  | 'userActivities'
  | 'serialBalance'
  | 'serialReceiptHistory'
  | 'stockLocationBalance'
  | 'barcodeLookup'
  | 'stockMovementHistory'
  | 'assignedTasks'
  | 'goodsReceiptAnalysis'
  | 'parameterHelp'
  | 'steelVehicleAnalysis'
  | 'warehouseTransferAnalysis'
  | 'shiftBrief'
  | 'operationalExceptions'
  | 'traceability'
  | 'processBlockers'
  | 'composite'
  | 'warehouseOverview'
  | 'locationInventory'
  | 'inventoryInsights'
  | 'inventoryCountAnalysis'
  | 'generatorProductionAnalysis'
  | 'navigationHelp'
  | 'unknown';

export interface WarehouseAssistantParameterHint {
  module: string;
  field: string;
  value?: string | null;
}

export interface WarehouseAssistantCapabilities {
  canQueryAllUsers: boolean;
  canQuerySerialBalances: boolean;
  canQuerySerialReceiptHistory: boolean;
  canQueryBarcode: boolean;
  canQueryStockMovements: boolean;
  canQueryAssignedTasks: boolean;
  scopeLabel: string;
  exampleQuestions: string[];
  canQueryGoodsReceiptAnalysis?: boolean;
  canExplainParameters?: boolean;
  canQuerySteelVehicleAnalysis?: boolean;
  canQueryTransferAnalysis?: boolean;
  canQueryShiftBrief?: boolean;
  canQueryOperationalExceptions?: boolean;
  canQueryTraceability?: boolean;
  canQueryProcessBlockers?: boolean;
  assistantVersion?: string;
  routingMode?: string;
  semanticRoutingAvailable?: boolean;
  semanticModel?: string | null;
  canRunCompoundQueries?: boolean;
  canQueryWarehouseOverview?: boolean;
  canQueryLocationInventory?: boolean;
  canQueryInventoryInsights?: boolean;
  canQueryInventoryCounts?: boolean;
  canQueryGeneratorProduction?: boolean;
  canUseNavigationHelp?: boolean;
}
export interface WarehouseAssistantConversationRow {
  id: number;
  title: string;
  lastMessageAtUtc: string;
  isArchived: boolean;
}

export interface WarehouseAssistantMessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  intent?: string | null;
  scope?: string | null;
  createdDate?: string | null;
  result?: WarehouseAssistantChatResponse | null;
}

export interface WarehouseAssistantActivityRow {
  id: number;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  result: string;
  userId?: number | null;
  userDisplayName: string;
  occurredAtUtc: string;
}

export interface WarehouseAssistantSerialBalanceRow {
  id: number;
  serialNo: string;
  stockId: number;
  stockCode: string;
  stockName: string;
  warehouseCode: number;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  lotNo?: string | null;
  unitCode: string;
  stockStatus: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastTransactionAtUtc: string;
}

export interface WarehouseAssistantSerialReceiptRow {
  movementEntryId: number;
  serialNo: string;
  stockCode: string;
  stockName: string;
  goodsReceiptNo: string;
  goodsReceiptId: number;
  warehouseCode: number;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  quantity: number;
  unitCode: string;
  receivedAtUtc: string;
  receivedByUserId?: number | null;
  receivedByDisplayName: string;
}

export interface WarehouseAssistantStockLocationRow {
  stockId: number;
  stockCode: string;
  stockName: string;
  warehouseCode: number;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  unitCode: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface WarehouseAssistantBarcodeRow {
  barcode: string;
  source: string;
  stockId: number;
  stockCode: string;
  stockName: string;
  yapCodeId?: number | null;
  yapCode?: string | null;
  encodedQuantity?: number | null;
  unitCode: string;
  lotNo?: string | null;
  serialNo?: string | null;
  manufacturingDate?: string | null;
  expirationDate?: string | null;
  requireSerial: boolean;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  missingFields: string[];
}

export interface WarehouseAssistantMovementRow {
  entryId: number;
  operationId: number;
  operationType: string;
  operationStatus: string;
  referenceType?: string | null;
  referenceNo?: string | null;
  referenceId?: number | null;
  stockId: number;
  stockCode: string;
  stockName: string;
  warehouseCode: number;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  quantityDelta: number;
  unitCode: string;
  lotNo?: string | null;
  serialNo?: string | null;
  stockStatus: string;
  occurredAtUtc: string;
  isReversal: boolean;
}

export interface WarehouseAssistantTaskRow {
  module: string;
  taskId: number;
  taskNo: string;
  taskType: string;
  status: string;
  priority: number;
  documentId: number;
  documentNo: string;
  warehouseId: number;
  warehouseCode: number;
  warehouseName: string;
  plannedQuantity: number;
  processedQuantity: number;
  remainingQuantity: number;
  plannedAtUtc?: string | null;
  dueAtUtc?: string | null;
  assigneeUserId?: number | null;
  assigneeDisplayName: string;
}

export interface WarehouseAssistantGoodsReceiptRow {
  goodsReceiptId: number;
  documentNo: string;
  documentDate: string;
  receivedAtUtc?: string | null;
  supplierId?: number | null;
  supplierCode: string;
  supplierName: string;
  warehouseCode: number;
  warehouseName: string;
  stockId: number;
  stockCode: string;
  stockName: string;
  yapCode?: string | null;
  unitCode: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quarantineQuantity: number;
  putawayQuantity: number;
  status: string;
  qualityStatus: string;
  erpIntegrationStatus: string;
  receivedByUserId?: number | null;
  receivedByDisplayName: string;
}

export interface WarehouseAssistantParameterGuideRow {
  module: string;
  field: string;
  value?: string | null;
}

export interface WarehouseAssistantSteelVehicleRow {
  vehicleCheckInId: number;
  plateNo: string;
  trailerPlateNo?: string | null;
  driverName: string;
  carrierName?: string | null;
  declaredSteelSheetCount: number;
  acceptedPlateCount: number;
  unresolvedPlateCount: number;
  status: string;
  checkedInAtUtc: string;
  businessDate: string;
  customerCode?: string | null;
  customerName?: string | null;
}

export interface WarehouseAssistantTransferRow {
  transferId: number;
  documentNo: string;
  documentDate: string;
  businessContext: string;
  sourceWarehouseCode: number;
  sourceWarehouseName: string;
  targetWarehouseCode: number;
  targetWarehouseName: string;
  status: string;
  approvalStatus: string;
  erpIntegrationStatus: string;
  lineCount: number;
  unitCode: string;
  requestedQuantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
  shortClosedQuantity: number;
  externalReferenceNo?: string | null;
  completedAtUtc?: string | null;
}

export interface WarehouseAssistantEntityCandidateRow {
  entityType: 'stock' | 'customer';
  entityId?: number | null;
  code: string;
  name: string;
  matchedBy: 'code' | 'name';
  matchScore: number;
  selectionMessage: string;
}

export interface WarehouseAssistantSummaryMetricRow {
  key: string;
  label: string;
  value: number;
  unit: string;
  severity: 'Info' | 'Medium' | 'High' | 'Critical' | string;
  module: string;
  route?: string | null;
}

export interface WarehouseAssistantExceptionRow {
  code: string;
  severity: 'Info' | 'Medium' | 'High' | 'Critical' | string;
  module: string;
  title: string;
  description: string;
  entityType: string;
  entityId?: number | null;
  documentNo?: string | null;
  status: string;
  detectedAtUtc?: string | null;
  ageHours?: number | null;
  suggestedAction: string;
  route?: string | null;
}

export interface WarehouseAssistantTraceabilityEventRow {
  eventKey: string;
  occurredAtUtc: string;
  stage: string;
  eventType: string;
  documentType: string;
  documentId?: number | null;
  documentNo?: string | null;
  stockId: number;
  stockCode: string;
  stockName: string;
  serialNo?: string | null;
  lotNo?: string | null;
  quantity: number;
  unitCode: string;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  status: string;
  actorDisplayName: string;
  isReversal: boolean;
  route?: string | null;
}

export interface WarehouseAssistantEvidenceRow {
  source: string;
  tool: string;
  recordCount: number;
  generatedAtUtc: string;
  dataAsOfUtc?: string | null;
  scope: string;
  filters: string;
  isTruncated: boolean;
  route?: string | null;
}

export interface WarehouseAssistantInterpretationRow {
  intent: WarehouseAssistantIntent;
  confidence: number;
  usedLocalSemanticModel: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
  serialNo?: string | null;
  barcode?: string | null;
  vehiclePlate?: string | null;
  transferDocumentNo?: string | null;
  documentNo?: string | null;
  transferScope: 'all' | 'interWarehouse' | 'production' | string;
  queryKind?: string;
  warehouseQuery?: string | null;
  locationQuery?: string | null;
  stockGroupQuery?: string | null;
  projectQuery?: string | null;
  statusQuery?: string | null;
  stockMeasure?: string | null;
  sort?: string;
  limit?: number | null;
  excludeZero?: boolean;
  excludeCancelled?: boolean;
  activeOnly?: boolean;
  navigationTopic?: string | null;
  reasonCodes?: string[] | null;
}

export interface WarehouseAssistantAnalysisRow {
  category: string;
  entityType: string;
  entityId?: number | null;
  code: string;
  name: string;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  status?: string | null;
  unitCode?: string | null;
  physicalQuantity?: number | null;
  availableQuantity?: number | null;
  reservedQuantity?: number | null;
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
  varianceQuantity?: number | null;
  capacityQuantity?: number | null;
  capacityUnit?: string | null;
  plannedAtUtc?: string | null;
  actualAtUtc?: string | null;
  detail?: string | null;
  route?: string | null;
}

export interface WarehouseAssistantChatResponse {
  conversationId: number;
  messageId: number;
  answer: string;
  intent: WarehouseAssistantIntent;
  scope: string;
  providerMode: string;
  activities: WarehouseAssistantActivityRow[];
  serialBalances: WarehouseAssistantSerialBalanceRow[];
  serialReceipts: WarehouseAssistantSerialReceiptRow[];
  stockLocations: WarehouseAssistantStockLocationRow[];
  barcode?: WarehouseAssistantBarcodeRow | null;
  movements: WarehouseAssistantMovementRow[];
  tasks: WarehouseAssistantTaskRow[];
  goodsReceipts?: WarehouseAssistantGoodsReceiptRow[];
  parameterGuides?: WarehouseAssistantParameterGuideRow[];
  steelVehicles?: WarehouseAssistantSteelVehicleRow[];
  transfers?: WarehouseAssistantTransferRow[];
  entityCandidates?: WarehouseAssistantEntityCandidateRow[];
  summaryMetrics?: WarehouseAssistantSummaryMetricRow[];
  exceptions?: WarehouseAssistantExceptionRow[];
  traceabilityEvents?: WarehouseAssistantTraceabilityEventRow[];
  evidence?: WarehouseAssistantEvidenceRow[];
  interpretations?: WarehouseAssistantInterpretationRow[];
  analysisRows?: WarehouseAssistantAnalysisRow[];
  suggestions: string[];
}
