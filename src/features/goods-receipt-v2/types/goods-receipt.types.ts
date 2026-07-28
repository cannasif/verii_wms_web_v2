import type { EffectiveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';

export interface CustomerOption { id: number; branchCode: string; customerCode: string; customerName: string }
export interface WarehouseOption { id: number; branchCode: string; warehouseCode: number; warehouseName: string }
export interface UserWarehouseAccess { isRestricted: boolean; warehouseIds: number[]; warehouseCodes: number[] }
export interface LocationOption { id: number; warehouseId: number; code: string; name: string; locationType: string }
export interface PutawayLocationSuggestion extends LocationOption {
  zoneCode?: string;
  currentStockQuantity: number;
  currentAvailableQuantity: number;
  totalLocationQuantity: number;
  capacityQuantity?: number;
  remainingCapacity?: number;
  containsStock: boolean;
  isEmpty: boolean;
  score: number;
  reason: string;
}
export interface SeriesOption { id: number; code: string; name: string; previewDocumentNumber: string; isDefault: boolean }
export interface OpenOrderHeader { siparisNo: string; customerCode?: string; customerName?: string; branchCode?: number; targetWarehouseCode?: number; orderDate?: string; projectCode?: string; orderedQuantity?: number; deliveredQuantity?: number; remainingQuantity?: number; plannedQuantity?: number; availableQuantity?: number }
export interface OpenOrderLine { siparisNo: string; orderId: number; stockCode?: string; stockName?: string; unitCode?: string; yapCode?: string; yapDescription?: string; customerCode?: string; branchCode?: number; targetWarehouseCode?: number; orderDate?: string; projectCode?: string; orderedQuantity?: number; deliveredQuantity?: number; remainingQuantity?: number; plannedQuantity?: number; availableQuantity?: number }
export type StockTrackingType = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';
export interface PlannedReceiptTracking { localId: string; quantity: number; lotNo?: string; serialNo?: string; manufacturingDate?: string; expirationDate?: string; description?: string }
export interface SelectedReceiptLine extends OpenOrderLine {
  stockId: number;
  quantity: number;
  targetWarehouseId?: number;
  targetWarehouseValue?: string | null;
  receivingLocationId?: number;
  receivingLocationValue?: string | null;
  receivingLocationCode?: string;
  putawayLocationId?: number;
  putawayLocationCode?: string;
  trackingType: StockTrackingType;
  trackingPolicy: EffectiveStockTrackingPolicy;
  trackings: PlannedReceiptTracking[];
  serialGenerationKey?: string;
  requireQualityControl?: boolean;
}
export interface CreatedGoodsReceiptTaskResult { id: number; taskNo: string; warehouseId: number; lineCount: number; plannedQuantity: number }
export interface CreateGoodsReceiptResult { id: number; documentNo: string; taskId: number; taskNo: string; lineCount: number; reservedQuantity: number; replayed: boolean; tasks: CreatedGoodsReceiptTaskResult[] }
export interface StockOption { id: number; branchCode: string; erpStockCode: string; stockName?: string; unitCode?: string }
export interface YapCodeOption { id: number; branchCode: string; configurationCode: string; description?: string }
export interface ManualReceiptLine { localId: string; stockId: number; stockCode: string; stockName?: string; yapCodeId?: number; yapCode?: string; quantity: number; unitCode: string; targetWarehouseId: number; targetWarehouseCode?: number; receivingLocationId: number; receivingLocationCode?: string; trackingType: StockTrackingType; lotNo?: string; serialNo?: string; manufacturingDate?: string; expirationDate?: string; scannedBarcode?: string; description?: string }
export interface ManualGoodsReceiptResult { id: number; documentNo: string; initiationMode: string; status: string; taskId?: number; taskNo?: string; executionId?: number; stockMovementOperationId?: number; qualityInspectionId?: number; lineCount: number; quantity: number; replayed: boolean; generatedLabelIds?: number[] }
export interface GoodsReceiptGridRow { id: number; branchCode: string; documentNo: string; documentDate: string; receiptType: string; initiationMode: string; processType: string; status: string; approvalStatus: string; qualityStatus: string; putawayStatus: string; erpIntegrationStatus: string; supplierCode?: string; supplierName?: string; targetWarehouseId: number; warehouseCode: number; warehouseName: string; waybillNo?: string; waybillDate?: string; lineCount: number; expectedQuantity: number; receivedQuantity: number; priority: number; plannedArrivalAtUtc?: string; receivedAtUtc?: string; createdBy?: number; createdDate?: string; updatedBy?: number; updatedDate?: string; rowVersion: string }
export interface GoodsReceiptDetailLine { id: number; lineNo: number; stockId: number; stockCode: string; stockName?: string; yapCodeId?: number; yapCode?: string; unitCode: string; expectedQuantity: number; receivedQuantity: number; acceptedQuantity: number; rejectedQuantity: number; quarantineQuantity: number; shortClosedQuantity: number; putawayQuantity: number; status: string; requireQualityControl: boolean; targetWarehouseId: number; defaultReceivingLocationId?: number; defaultPutawayLocationId?: number; routedQuantity: number; routableQuantity: number }
export interface GoodsReceiptPutawayCandidate { lineId: number; lineNo: number; stockId: number; stockCode: string; stockName?: string; yapCodeId?: number; yapCode?: string; unitCode: string; quantity: number; warehouseId: number; sourceLocationId: number; lotNo?: string; serialNo?: string; stockStatus: string; defaultTargetLocationId?: number }
export interface GoodsReceiptDetail { header: GoodsReceiptGridRow; lines: GoodsReceiptDetailLine[]; putawayCandidates: GoodsReceiptPutawayCandidate[]; sourceDocuments: string[]; taskNumbers: string[]; executionCount: number }
export type ErpPostingStatus = 'Pending' | 'Processing' | 'Succeeded' | 'Failed' | 'CommitUncertain';
export interface ErpPostingResult {
  postingRecordId: number;
  sourceType: string;
  sourceEntityId: number;
  sourceDocumentNo: string;
  status: ErpPostingStatus;
  attemptCount: number;
  erpDocumentNo?: string;
  erpWaybillNo?: string;
  erpRecordNo?: string;
  erpReferenceNo?: string;
  errorCode?: string;
  errorMessage?: string;
  completedAtUtc?: string;
}
export interface GoodsReceiptLifecycleResult { id: number; documentNo: string; status: string; approvalStatus: string; qualityStatus: string; putawayStatus: string; stockMovementOperationId?: number; affectedQuantity: number; replayed: boolean; rowVersion: string }
export type GoodsReceiptRouteType = 'WarehouseTransfer' | 'WarehouseOutbound';
export interface GoodsReceiptRoutingResult { routingBatchId: number; routeType: GoodsReceiptRouteType; targetDocumentId: number; targetDocumentNo: string; routedQuantity: number; replayed: boolean }
export interface GoodsReceiptSplitRoutingResult { routes: GoodsReceiptRoutingResult[]; routedQuantity: number }
export interface GoodsReceiptTaskGridRow { id: number; goodsReceiptId: number; branchCode: string; taskNo: string; documentNo: string; taskType: string; status: string; receiptStatus: string; processType: string; labelStrategy: string; priority: number; warehouseId: number; warehouseCode: number; warehouseName: string; supplierCode?: string; supplierName?: string; lineCount: number; plannedQuantity: number; processedQuantity: number; assigneeCount: number; myAssignmentStatus?: string; plannedStartAtUtc?: string; dueAtUtc?: string; startedAtUtc?: string; completedAtUtc?: string; createdBy?: number; createdDate?: string; updatedBy?: number; updatedDate?: string; rowVersion: string }
export interface GoodsReceiptTaskLineTracking { id: number; sequenceNo: number; plannedQuantity: number; lotNo?: string; serialNo?: string; manufacturingDate?: string; expirationDate?: string; targetWarehouseId: number; toLocationId: number; description?: string }
export interface GoodsReceiptTaskLine { id: number; sequenceNo: number; goodsReceiptLineId: number; stockId: number; stockCode: string; stockName?: string; yapCode?: string; plannedQuantity: number; processedQuantity: number; unitCode: string; status: string; targetWarehouseId: number; toLocationId?: number; trackingType: StockTrackingType; trackings: GoodsReceiptTaskLineTracking[] }
export interface GoodsReceiptTaskAssignment { id: number; userId: number; username: string; displayName: string; role: string; status: string; assignedAtUtc: string; acceptedAtUtc?: string; startedAtUtc?: string; completedAtUtc?: string }
export interface GoodsReceiptTaskDetail { task: GoodsReceiptTaskGridRow; lines: GoodsReceiptTaskLine[]; assignments: GoodsReceiptTaskAssignment[] }
export interface ActiveUserOption { id: number; username: string; email: string; firstName: string; lastName: string; isActive: boolean }
export interface GoodsReceiptLabelBatchRow { id:number; goodsReceiptId:number; documentNo:string; taskId?:number; taskNo?:string; batchNo:string; status:string; totalLabelCount:number; printedLabelCount:number; consumedLabelCount:number; voidLabelCount:number; lastPrintedAtUtc?:string; createdBy?:number; createdDate?:string; rowVersion:string }
export interface GoodsReceiptLabelRow { id:number; batchId:number; goodsReceiptId:number; goodsReceiptLineId?:number; taskLineId?:number; stockId?:number; stockCode:string; stockName?:string; yapCode?:string; quantity:number; unitCode:string; lotNo?:string; serialNo?:string; manufacturingDate?:string; expirationDate?:string; barcodeValue:string; status:string; printCount:number; lastPrintedAtUtc?:string; consumedAtUtc?:string; voidReason?:string; rowVersion:string }
export interface GoodsReceiptLabelBatchDetail { batch:GoodsReceiptLabelBatchRow; labels:GoodsReceiptLabelRow[] }
export interface ReceiveGoodsReceiptTaskResult { executionId:number; stockMovementOperationId:number; goodsReceiptId:number; taskId:number; taskLineId:number; processedQuantity:number; remainingQuantity:number; taskStatus:string; lineStatus:string; qualityInspectionId?:number; consumedLabelId?:number; generatedLabelId?:number; replayed:boolean }
