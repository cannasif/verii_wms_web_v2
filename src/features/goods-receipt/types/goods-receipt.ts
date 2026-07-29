import { z } from 'zod';
import type { ApiResponse } from '@/types/api';
import type {
  BaseDocumentHeaderDto,
  BaseDocumentLineDto,
  BaseDocumentLineRequest,
  BaseSelectedStockItem,
  BaseWorkflowOrder,
  BaseWorkflowOrderItem,
} from '@/types/document-models';
import type {
  BaseWorkflowImportLineDetail,
  BaseWorkflowRouteDetail,
} from '@/types/detail-models';
import type { TFunction } from 'i18next';
import type { Customer, Project } from '@/features/shared/types/operation-reference.types';

const normalizeDocumentNo = (value: string) => value.trim();

export type { Customer, Product, Project, Warehouse } from '@/features/shared/types/operation-reference.types';

export const createGoodsReceiptFormSchema = (t: TFunction) => z.object({
  receiptDate: z.string().min(1, t('goodsReceipt.validation.receiptDateRequired')),
  documentNo: z.string().min(1, t('goodsReceipt.validation.documentNoRequired')),
  projectCode: z.string().optional(),
  isInvoice: z.boolean(),
  customerId: z.string().min(1, t('goodsReceipt.validation.customerRequired')),
  notes: z.string().optional(),
  customerRefId: z.number().optional(),
  allowLessQuantityBasedOnOrder: z.boolean().optional(),
  allowMoreQuantityBasedOnOrder: z.boolean().optional(),
}).superRefine((data, ctx) => {
  const documentNo = normalizeDocumentNo(data.documentNo);

  if (documentNo.length === 0) {
    return;
  }

  if (!/^[A-Z0-9]{15}$/i.test(documentNo)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['documentNo'],
      message: t('goodsReceipt.validation.documentNoInvoiceLength'),
    });
  }
});

export type GoodsReceiptFormData = z.infer<ReturnType<typeof createGoodsReceiptFormSchema>>;

export type CustomersResponse = ApiResponse<Customer[]>;
export type ProjectsResponse = ApiResponse<Project[]>;
export type OrdersResponse = ApiResponse<Order[]>;
export type OrderItemsResponse = ApiResponse<OrderItem[]>;

export type Order = BaseWorkflowOrder;

export interface OrderItem extends BaseWorkflowOrderItem {
  productCode?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  yapKodId?: number;
  yapKod?: string | null;
  yapAcik?: string | null;
}

export interface SelectedOrderItem extends OrderItem {
  stockId?: number;
  receiptQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  warehouseId?: number;
}

export interface SelectedStockItem extends BaseSelectedStockItem {
  receiptQuantity: number;
  isSelected: boolean;
  serialNo?: string;
  lotNo?: string;
  batchNo?: string;
  configCode?: string;
  warehouseId?: number;
}

export interface GoodsReceiptItem {
  orderItemId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface GrHeader extends Omit<
  BaseDocumentHeaderDto,
  'description1' | 'description2' | 'approvalStatus' | 'approvedByUserId' | 'approvalDate' | 'erpReferenceNumber' | 'erpIntegrationDate' | 'erpIntegrationStatus' | 'erpErrorMessage'
> {
  orderId: string;
  plannedDate: string;
  isPlanned: boolean;
  description1: string | null;
  description2: string | null;
  priorityLevel: number;
  approvalStatus: boolean | null;
  approvedByUserId: number | null;
  approvalDate: string | null;
  erpReferenceNumber: string | null;
  erpIntegrationDate: string | null;
  erpIntegrationStatus: string | null;
  erpErrorMessage: string | null;
  returnCode: boolean;
  ocrSource: boolean;
  description3: string | null;
  description4: string | null;
  description5: string | null;
}

export interface GrLine extends Omit<BaseDocumentLineDto, 'orderId'> {
  orderId: number | null;
  yapKod: string | null;
}

export interface GrImportRoute extends BaseWorkflowRouteDetail {
  importLineId: number;
  lineId: number | null;
  routeCode: string | null;
  id: number;
  createdDate: string;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number | null;
  deletedBy: number | null;
  createdByFullUser: string | null;
  updatedByFullUser: string | null;
  deletedByFullUser: string | null;
}

export interface GrImportLine extends BaseWorkflowImportLineDetail {
  routes: GrImportRoute[];
  lineId: number;
  id: number;
  createdDate: string;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number | null;
  deletedBy: number | null;
  createdByFullUser: string | null;
  updatedByFullUser: string | null;
  deletedByFullUser: string | null;
}

export interface BulkCreateRequest {
  header: {
    branchCode: string;
    documentNo: string;
    documentDate: string;
    projectCode?: string;
    orderId?: string;
    documentType: string;
    yearCode: string;
    description1?: string;
    description2?: string;
    priorityLevel?: number;
    plannedDate: string;
    isPlanned: boolean;
    customerId?: number;
    customerCode: string;
    returnCode: boolean;
    ocrSource: boolean;
    description3?: string;
    description4?: string;
    description5?: string;
    allowLessQuantityBasedOnOrder?: boolean;
    allowMoreQuantityBasedOnOrder?: boolean;
  };
  lines?: Array<BaseDocumentLineRequest>;
  importLines?: Array<{
    lineClientKey: string | null;
    clientKey: string;
    stockId?: number;
    stockCode: string;
    yapKodId?: number;
    yapKod?: string;
  }>;
  serialLines?: Array<{
    lineClientKey?: string | null;
    stockCode?: string;
    yapKod?: string;
    serialNo: string;
    quantity: number;
    sourceWarehouseId?: number;
    targetWarehouseId?: number;
    sourceCellCode?: string;
    targetCellCode?: string;
    serialNo2?: string;
    serialNo3?: string;
    serialNo4?: string;
  }>;
  routes?: Array<{
    lineClientKey?: string | null;
    stockCode?: string;
    yapKod?: string;
    scannedBarcode: string;
    quantity: number;
    description?: string;
    serialNo?: string;
    serialNo2?: string;
    serialNo3?: string;
    serialNo4?: string;
    sourceWarehouse?: number;
    targetWarehouse?: number;
    sourceCellCode?: string;
    targetCellCode?: string;
  }>;
}

export interface GenerateGoodsReceiptOrderRequest {
  header: BulkCreateRequest['header'];
  lines?: Array<BaseDocumentLineRequest>;
  lineSerials?: Array<NonNullable<BulkCreateRequest['serialLines']>[number]>;
  terminalLines?: Array<{ terminalUserId: number }>;
}

export interface ProcessGoodsReceiptRequest {
  header: BulkCreateRequest['header'];
  routes?: Array<{
    stockId?: number;
    stockCode?: string;
    yapKodId?: number;
    yapKod?: string;
    scannedBarcode: string;
    quantity: number;
    serialNo?: string;
    serialNo2?: string;
    serialNo3?: string;
    serialNo4?: string;
    sourceWarehouse?: number;
    targetWarehouse?: number;
    sourceCellCode?: string;
    targetCellCode?: string;
  }>;
}

export type GrHeadersResponse = ApiResponse<GrHeader[]>;

export interface AssignedGrLine {
  id: number;
  createdDate: string;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number | null;
  deletedBy: number | null;
  createdByFullUser: string;
  updatedByFullUser: string | null;
  deletedByFullUser: string | null;
  stockCode: string;
  stockName: string;
  yapKod: string | null;
  yapAcik?: string | null;
  quantity: number;
  unit: string;
  erpOrderNo: string;
  erpOrderId: string;
  description: string;
  headerId: number;
  orderId: number | null;
}

export interface AssignedGrOrderLinesData {
  lines: AssignedGrLine[];
}

export type AssignedGrOrderLinesResponse = ApiResponse<AssignedGrOrderLinesData>;

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
  sourceWarehouseId?: number;
  targetCellCode: string;
  targetWarehouseId?: number;
}

export interface AddBarcodeResponseData {
  id: number;
  createdDate: string;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  createdBy: number;
  updatedBy: number | null;
  deletedBy: number | null;
  createdByFullUser: string | null;
  updatedByFullUser: string | null;
  deletedByFullUser: string | null;
  stockCode: string;
  yapKod: string | null;
  description1: string | null;
  description2: string | null;
  description: string | null;
  headerId: number;
  lineId: number;
}

export type AddBarcodeResponse = ApiResponse<AddBarcodeResponseData>;

export interface CollectedBarcodeItem {
  importLine: GrImportLine;
  routes: GrImportRoute[];
}

export type CollectedBarcodesResponse = ApiResponse<CollectedBarcodeItem[]>;

export interface GrPreReceiptLabelBatch {
  id: number;
  branchCode: string;
  createdDate: string | null;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  batchNo: string;
  siparisNo: string;
  customerId: number | null;
  customerCodeSnapshot: string | null;
  customerNameSnapshot: string | null;
  grHeaderId: number | null;
  status: string;
  source: string;
  totalLabelCount: number;
  printedLabelCount: number;
  consumedLabelCount: number;
  voidLabelCount: number;
  lastPrintedAt: string | null;
  completedDate: string | null;
  description: string | null;
}

export interface GrPreReceiptLabel {
  id: number;
  branchCode: string;
  createdDate: string | null;
  updatedDate: string | null;
  deletedDate: string | null;
  isDeleted: boolean;
  batchId: number;
  grHeaderId: number | null;
  grLineId: number | null;
  grLineSerialId: number | null;
  consumedGrImportLineId: number | null;
  consumedGrRouteId: number | null;
  siparisNo: string;
  erpOrderNo: string | null;
  erpOrderId: number | null;
  stockId: number | null;
  stockCodeSnapshot: string;
  stockNameSnapshot: string | null;
  yapKodId: number | null;
  yapKodSnapshot: string | null;
  yapAcikSnapshot: string | null;
  expectedQuantity: number;
  labelQuantity: number;
  serialNo: string | null;
  serialNo2: string | null;
  serialNo3: string | null;
  serialNo4: string | null;
  barcodeValue: string;
  status: string;
  printCount: number;
  lastPrintedAt: string | null;
  consumedAt: string | null;
  voidReason: string | null;
  description: string | null;
}

export interface CreateGrPreReceiptLabelBatchRequest {
  siparisNo: string;
  customerId?: number | null;
  customerCodeSnapshot?: string | null;
  customerNameSnapshot?: string | null;
  grHeaderId?: number | null;
  description?: string | null;
  lines: CreateGrPreReceiptLabelLineRequest[];
}

export interface CreateGrPreReceiptLabelLineRequest {
  grLineId?: number | null;
  grLineSerialId?: number | null;
  erpOrderNo?: string | null;
  erpOrderId?: number | null;
  stockId?: number | null;
  stockCode: string;
  stockName?: string | null;
  yapKodId?: number | null;
  yapKod?: string | null;
  yapAcik?: string | null;
  expectedQuantity: number;
  labelQuantity?: number | null;
  labelCount?: number | null;
  serialNo?: string | null;
  serialNo2?: string | null;
  serialNo3?: string | null;
  serialNo4?: string | null;
  description?: string | null;
}

export interface StartGoodsReceiptFromScannedLabelsRequest {
  labelIds?: number[];
  barcodeValues?: string[];
}
