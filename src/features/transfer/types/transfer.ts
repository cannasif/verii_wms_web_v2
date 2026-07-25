import { z } from 'zod';
import type { ApiResponse } from '@/types/api';
import type {
  BaseDocumentHeaderDto,
  BaseDocumentHeaderRequest,
  BaseDocumentLineDto,
  BaseDocumentLineRequest,
  BaseDocumentLineSerialRequest,
  BaseDocumentLineSerialDto,
  BaseSelectedStockItem,
  BaseWorkflowOrder,
  BaseWorkflowOrderItem,
} from '@/types/document-models';
import type {
  BaseWorkflowImportLineDetail,
  BaseWorkflowRouteDetail,
} from '@/types/detail-models';
import type { TFunction } from 'i18next';

export const createTransferFormSchema = (
  t: TFunction,
  isFreeTransfer: boolean = false,
  requireDocumentSeries: boolean = true,
) => z.object({
  transferDate: z.string().min(1, t('transfer.validation.transferDateRequired')),
  documentNo: z.string().min(1, t('transfer.validation.documentNoRequired')),
  documentSeriesDefinitionId: requireDocumentSeries
    ? z.number().min(1, t('documentSeries.messages.definitionRequired'))
    : z.number().optional(),
  requiresEDispatch: z.boolean().optional(),
  projectCode: z.string().optional(),
  customerId: isFreeTransfer ? z.string().optional() : z.string().min(1, t('transfer.validation.customerRequired')),
  sourceWarehouse: isFreeTransfer 
    ? z.string().min(1, t('transfer.validation.sourceWarehouseRequired'))
    : z.string().optional(),
  targetWarehouse: z.string().min(1, t('transfer.validation.targetWarehouseRequired')),
  notes: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  customerRefId: z.number().optional(),
  sourceWarehouseId: z.number().optional(),
  targetWarehouseId: z.number().optional(),
  allowLessQuantityBasedOnOrder: z.boolean().optional(),
  allowMoreQuantityBasedOnOrder: z.boolean().optional(),
});

export type TransferFormData = z.infer<ReturnType<typeof createTransferFormSchema>>;

export interface TransferOrder extends BaseWorkflowOrder {
  orderID: number;
}

export interface TransferOrderItem extends BaseWorkflowOrderItem {
  unit?: string;
}

export interface SelectedTransferOrderItem extends TransferOrderItem {
  stockId?: number;
  yapKodId?: number;
  transferQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  serialNo2?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  sourceWarehouse?: number;
  sourceCellCode?: string;
  targetCellCode?: string;
}

export interface SelectedTransferStockItem extends BaseSelectedStockItem {
  yapKodId?: number;
  transferQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  serialNo2?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  sourceWarehouse?: number;
  sourceCellCode?: string;
  targetCellCode?: string;
}

export interface TransferGenerateRequest {
  header: BaseDocumentHeaderRequest & {
    type: number;
  };
  lines: Array<BaseDocumentLineRequest & {
    yapKod: string;
  }>;
  lineSerials: Array<BaseDocumentLineSerialRequest>;
  terminalLines: {
    terminalUserId: number;
  }[];
  userIds?: number[];
}

export interface TransferProcessRequest {
  header: BaseDocumentHeaderRequest & {
    type: number;
  };
  routes: Array<{
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
}

export type TransferOrdersResponse = ApiResponse<TransferOrder[]>;
export type TransferOrderItemsResponse = ApiResponse<TransferOrderItem[]>;

export interface TransferHeader extends BaseDocumentHeaderDto {
  priorityLevel: number;
  type: number;
  businessContext?: string | null;
  businessContextId?: number | null;
  businessContextStep?: string | null;
}

export interface TransferLine extends BaseDocumentLineDto {
  yapKod: string;
}

export type TransferLineSerial = BaseDocumentLineSerialDto;

export type TransferHeadersResponse = ApiResponse<TransferHeader[]>;
export type TransferLinesResponse = ApiResponse<TransferLine[]>;
export type TransferLineSerialsResponse = ApiResponse<TransferLineSerial[]>;

export interface AssignedTransferLine {
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

export interface AssignedTransferLineSerial {
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

export interface AssignedTransferImportLine extends BaseWorkflowImportLineDetail {
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

export interface AssignedTransferRoute extends BaseWorkflowRouteDetail {
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
  packageLineId: number | null;
  packageNo: string | null;
  packageHeaderId: number | null;
}

export interface AssignedTransferOrderLinesData {
  lines: AssignedTransferLine[];
  lineSerials: AssignedTransferLineSerial[];
  importLines: AssignedTransferImportLine[];
  routes: AssignedTransferRoute[];
}

export type AssignedTransferOrderLinesResponse = ApiResponse<AssignedTransferOrderLinesData>;

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
  importLine: AssignedTransferImportLine;
  routes: AssignedTransferRoute[];
}

export type CollectedBarcodesResponse = ApiResponse<CollectedBarcodeItem[]>;

export interface AwaitingApprovalHeader {
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
  yearCode: string;
  branchCode: string;
  projectCode: string;
  orderId: string;
  plannedDate: string;
  isPlanned: boolean;
  documentType: string;
  description1: string;
  description2: string;
  priorityLevel: number;
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
  documentNo: string;
  documentDate: string;
  customerCode: string;
  customerName: string;
  sourceWarehouse: string;
  sourceWarehouseName: string;
  targetWarehouse: string;
  targetWarehouseName: string;
  priority: string;
  type: number;
}
