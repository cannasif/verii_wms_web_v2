export interface BaseDocumentHeaderRequest {
  branchCode: string;
  projectCode: string;
  orderId: string;
  documentType: string;
  yearCode: string;
  description1: string;
  description2: string;
  priorityLevel: number;
  plannedDate: string;
  isPlanned: boolean;
  isCompleted: boolean;
  completedDate: string;
  documentNo: string;
  documentDate: string;
  customerId?: number;
  customerCode: string;
  customerName: string;
  sourceWarehouseId?: number;
  sourceWarehouse: string;
  targetWarehouseId?: number;
  targetWarehouse: string;
  priority: string;
  documentSeriesDefinitionId?: number;
  requiresEDispatch?: boolean;
  allowLessQuantityBasedOnOrder?: boolean;
  allowMoreQuantityBasedOnOrder?: boolean;
}

export interface BaseDocumentLineRequest {
  clientKey: string;
  clientGuid?: string;
  stockId?: number;
  stockCode: string;
  yapKodId?: number;
  orderId?: number;
  quantity: number;
  siparisMiktar?: number;
  unit?: string;
  erpOrderNo?: string;
  erpOrderId?: string;
  erpLineReference?: string;
  description?: string;
}

export interface BaseDocumentLineSerialRequest {
  quantity: number;
  serialNo: string;
  serialNo2: string;
  serialNo3: string;
  serialNo4: string;
  sourceWarehouseId?: number;
  targetWarehouseId?: number;
  sourceCellCode: string;
  targetCellCode: string;
  lineClientKey: string;
  lineGroupGuid: string;
}

export interface BaseDocumentHeaderDto {
  id: number;
  branchCode: string;
  projectCode: string;
  documentNo: string;
  documentDate: string;
  plannedDate?: string | null;
  documentType: string;
  customerId?: number | null;
  customerCode: string;
  customerName: string;
  sourceWarehouseId?: number | null;
  sourceWarehouse: string;
  targetWarehouseId?: number | null;
  targetWarehouse: string;
  priority: string;
  yearCode: string;
  description1: string;
  description2: string;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
  isDeleted: boolean;
  deletedBy: string;
  deletedDate: string;
  completionDate: string;
  isCompleted: boolean;
  isPendingApproval: boolean;
  approvalStatus: boolean;
  approvedByUserId: number;
  approvalDate: string;
  isERPIntegrated: boolean;
  erpReferenceNumber: string;
  erpIntegrationDate: string;
  erpIntegrationStatus: string;
  erpErrorMessage: string;
  createdByFullUser: string;
  updatedByFullUser: string;
  deletedByFullUser: string;
  allowLessQuantityBasedOnOrder?: boolean | null;
  allowMoreQuantityBasedOnOrder?: boolean | null;
}

export interface BaseDocumentLineDto {
  id: number;
  createdDate: string;
  updatedDate: string;
  deletedDate: string;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number;
  deletedBy: number;
  createdByFullUser: string;
  updatedByFullUser: string;
  deletedByFullUser: string;
  stockCode: string;
  quantity: number;
  siparisMiktar?: number | null;
  unit: string;
  erpOrderNo: string;
  erpOrderId: string;
  description: string;
  headerId: number;
  orderId: number;
  erpLineReference: string;
}

export interface BaseDocumentLineSerialDto {
  id: number;
  createdDate: string;
  updatedDate: string;
  deletedDate: string;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number;
  deletedBy: number;
  createdByFullUser: string;
  updatedByFullUser: string;
  deletedByFullUser: string;
  quantity: number;
  serialNo: string;
  serialNo2: string;
  serialNo3: string;
  serialNo4: string;
  sourceWarehouseId?: number | null;
  targetWarehouseId?: number | null;
  sourceWarehouseName?: string | null;
  targetWarehouseName?: string | null;
  sourceCellCode: string;
  targetCellCode: string;
  lineId: number;
}

export interface BaseWorkflowOrder {
  mode: string;
  siparisNo: string;
  orderID: number | null;
  customerCode: string;
  customerName: string;
  branchCode: number;
  targetWh: number;
  projectCode: string | null;
  orderDate: string;
  orderedQty: number;
  deliveredQty: number;
  remainingHamax: number;
  plannedQtyAllocated: number;
  remainingForImport: number;
}

export interface BaseWorkflowOrderItem extends BaseWorkflowOrder {
  id?: string;
  orderID: number;
  stockCode: string;
  stockName: string;
  projectCode: string;
}

export interface BaseSelectedStockItem {
  id: string;
  stockId?: number;
  yapKodId?: number;
  stockCode: string;
  stockName: string;
  unit: string;
}
