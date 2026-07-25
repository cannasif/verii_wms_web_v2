import { z } from 'zod';
import type { ApiResponse } from '@/types/api';
import type {
  BaseWorkflowImportLineDetail,
  BaseWorkflowRouteDetail,
} from '@/types/detail-models';
import type { TFunction } from 'i18next';

export const createShipmentFormSchema = (t: TFunction, requireDocumentSeries: boolean = true) => z.object({
  transferDate: z.string().min(1, t('shipment.validation.transferDateRequired')),
  documentNo: z.string().min(1, t('shipment.validation.documentNoRequired')),
  documentSeriesDefinitionId: requireDocumentSeries
    ? z.number().min(1, t('documentSeries.messages.definitionRequired'))
    : z.number().optional(),
  requiresEDispatch: z.boolean().optional(),
  projectCode: z.string().optional(),
  customerId: z.string().min(1, t('shipment.validation.customerRequired')),
  sourceWarehouse: z.string().min(1, t('shipment.validation.sourceWarehouseRequired')),
  notes: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  customerRefId: z.number().optional(),
  sourceWarehouseId: z.number().optional(),
  allowLessQuantityBasedOnOrder: z.boolean().optional(),
  allowMoreQuantityBasedOnOrder: z.boolean().optional(),
});

export type ShipmentFormData = z.infer<ReturnType<typeof createShipmentFormSchema>>;

export interface ShipmentOrder {
  mode: string;
  siparisNo: string;
  orderID: number;
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

export interface ShipmentOrderItem {
  id?: string;
  mode: string;
  siparisNo: string;
  orderID: number;
  stockCode: string;
  stockName: string;
  yapKod?: string;
  yapAcik?: string;
  customerCode: string;
  customerName: string;
  branchCode: number;
  targetWh: number;
  projectCode: string;
  orderDate: string;
  orderedQty: number;
  deliveredQty: number;
  remainingHamax: number;
  plannedQtyAllocated: number;
  remainingForImport: number;
}

export interface SelectedShipmentOrderItem extends ShipmentOrderItem {
  stockId?: number;
  yapKodId?: number;
  transferQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  serialNo2?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  sourceCellCode?: string;
  targetCellCode?: string;
}

export interface SelectedShipmentStockItem {
  id: string;
  stockId?: number;
  yapKodId?: number;
  stockCode: string;
  stockName: string;
  unit: string;
  transferQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  serialNo2?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  sourceCellCode?: string;
  targetCellCode?: string;
}

export interface ShipmentGenerateRequest {
  header: {
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
    customerCode: string;
    customerName: string;
    sourceWarehouse: string;
    targetWarehouse: string;
    priority: string;
    documentSeriesDefinitionId?: number;
    requiresEDispatch?: boolean;
    type: number;
    allowLessQuantityBasedOnOrder?: boolean;
    allowMoreQuantityBasedOnOrder?: boolean;
  };
  lines: {
    clientKey: string;
    clientGuid: string;
    stockCode: string;
    stockName?: string;
    yapKod: string;
    yapAcik?: string;
    orderId: number;
    quantity: number;
    unit: string;
    erpOrderNo: string;
    erpOrderId: string;
    erpLineReference: string;
    description: string;
  }[];
  lineSerials: {
    quantity: number;
    serialNo: string;
    serialNo2: string;
    serialNo3: string;
    serialNo4: string;
    sourceCellCode: string;
    targetCellCode: string;
    lineClientKey: string;
    lineGroupGuid: string;
  }[];
  terminalLines: {
    terminalUserId: number;
  }[];
  userIds?: number[];
}

export interface ShipmentProcessRequest {
  header: ShipmentGenerateRequest['header'];
  importLines: Array<{
    clientKey: string;
    stockId?: number;
    stockCode: string;
    yapKodId?: number;
    yapKod?: string;
  }>;
  routes: Array<{
    importLineClientKey: string;
    stockId?: number;
    stockCode: string;
    yapKodId?: number;
    yapKod?: string;
    quantity: number;
    serialNo?: string;
    serialNo2?: string;
    serialNo3?: string;
    serialNo4?: string;
    scannedBarcode?: string;
    sourceWarehouse?: number;
    targetWarehouse?: number;
    sourceCellCode?: string;
    targetCellCode?: string;
  }>;
  terminalLines: Array<{
    terminalUserId: number;
  }>;
}

export interface ShipmentHeader {
  id: number;
  branchCode: string;
  projectCode: string;
  documentNo: string;
  documentDate: string;
  documentType: string;
  customerCode: string;
  customerId?: number | null;
  customerName: string;
  sourceWarehouse: string;
  sourceWarehouseId?: number | null;
  targetWarehouse: string;
  targetWarehouseId?: number | null;
  priority: string;
  yearCode: string;
  description1: string;
  description2: string;
  priorityLevel: number;
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

export interface ShipmentLine {
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
  stockCode?: string;
  stockName?: string;
  yapKod?: string;
  yapAcik?: string;
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

export interface ShipmentLineSerial {
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

export type ShipmentOrdersResponse = ApiResponse<ShipmentOrder[]>;
export type ShipmentOrderItemsResponse = ApiResponse<ShipmentOrderItem[]>;
export type ShipmentHeadersResponse = ApiResponse<ShipmentHeader[]>;
export type ShipmentLinesResponse = ApiResponse<ShipmentLine[]>;
export type ShipmentLineSerialsResponse = ApiResponse<ShipmentLineSerial[]>;

export interface AssignedShipmentLine {
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
  stockCode?: string;
  stockName?: string;
  yapKod?: string;
  yapAcik?: string;
  quantity: number;
  unit: string;
  erpOrderNo: string;
  erpOrderId: string;
  description: string;
  headerId: number;
  orderId: number;
  erpLineReference: string;
}

export interface AssignedShipmentLineSerial {
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
  sourceCellCode: string;
  targetCellCode: string;
  lineId: number;
}

export interface AssignedShipmentImportLine extends BaseWorkflowImportLineDetail {
  yapAcik: string;
  lineId: number;
  routeId: number;
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
}

export interface AssignedShipmentRoute extends BaseWorkflowRouteDetail {
  importLineId: number;
  yapKod: string;
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
}

export interface AssignedShipmentOrderLinesData {
  lines: AssignedShipmentLine[];
  lineSerials: AssignedShipmentLineSerial[];
  importLines: AssignedShipmentImportLine[];
  routes: AssignedShipmentRoute[];
}

export type AssignedShipmentOrderLinesResponse = ApiResponse<AssignedShipmentOrderLinesData>;

export interface StokBarcodeDto {
  barkod: string;
  stokKodu: string;
  stokAdi: string;
  depoKodu: string | null;
  depoAdi: string | null;
  rafKodu: string | null;
  yapilandir: string;
  olcuBr: number;
  olcuAdi: string;
  yapKod: string | null;
  yapAcik: string | null;
  cevrim: number;
  seriBarkodMu: boolean;
  sktVarmi: string | null;
  isemriNo: string | null;
}

export type StokBarcodeResponse = ApiResponse<StokBarcodeDto[]>;

export interface AddBarcodeRequest {
  headerId: number;
  barcode: string;
  stockCode?: string;
  stockName?: string;
  yapKod?: string;
  yapAcik?: string;
  quantity: number;
  serialNo: string;
  serialNo2: string;
  serialNo3: string;
  serialNo4: string;
  sourceCellCode: string;
  targetCellCode: string;
}

export interface AddBarcodeResponseData {
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
  stockCode?: string;
  stockName?: string;
  yapKod?: string;
  yapAcik?: string;
  description1: string;
  description2: string;
  description: string;
  headerId: number;
  lineId: number;
  routeId: number;
}

export type AddBarcodeResponse = ApiResponse<AddBarcodeResponseData>;

export interface CollectedBarcodeItem {
  importLine: AssignedShipmentImportLine;
  routes: AssignedShipmentRoute[];
}

export type CollectedBarcodesResponse = ApiResponse<CollectedBarcodeItem[]>;
