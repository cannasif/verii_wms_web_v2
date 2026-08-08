export type WarehouseAssistantIntent =
  | 'help'
  | 'myActivities'
  | 'userActivities'
  | 'serialBalance'
  | 'serialReceiptHistory'
  | 'stockLocationBalance'
  | 'unknown';

export interface WarehouseAssistantCapabilities {
  canQueryAllUsers: boolean;
  canQuerySerialBalances: boolean;
  canQuerySerialReceiptHistory: boolean;
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
  suggestions: string[];
}
