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
  | 'unknown';

export interface WarehouseAssistantCapabilities {
  canQueryAllUsers: boolean;
  canQuerySerialBalances: boolean;
  canQuerySerialReceiptHistory: boolean;
  canQueryBarcode: boolean;
  canQueryStockMovements: boolean;
  canQueryAssignedTasks: boolean;
  scopeLabel: string;
  exampleQuestions: string[];
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
  suggestions: string[];
}
