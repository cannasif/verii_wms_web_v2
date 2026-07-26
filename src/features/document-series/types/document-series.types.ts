export type WmsDocumentType =
  | 'GoodsReceipt'
  | 'InterWarehouseTransfer'
  | 'Shipment'
  | 'WarehouseReceipt'
  | 'WarehouseIssue'
  | 'ProductionTransfer'
  | 'SubcontractingIssue'
  | 'SubcontractingReceipt';
export type DocumentYearFormat = 'None' | 'TwoDigit' | 'FourDigit';

export interface DocumentSeriesRow {
  id: number;
  branchCode: string;
  warehouseId?: number | null;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  code: string;
  name: string;
  documentType: WmsDocumentType;
  prefix: string;
  separator: string;
  yearFormat: DocumentYearFormat;
  numberLength: number;
  startNumber: number;
  nextNumber: number;
  incrementBy: number;
  previewDocumentNumber: string;
  isDefault: boolean;
  isActive: boolean;
  hasIssuedNumbers: boolean;
  lastIssuedAt?: string | null;
  description?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
}

export interface DocumentSeriesUpsertPayload {
  branchCode: string;
  warehouseId: number | null;
  code: string;
  name: string;
  documentType: WmsDocumentType;
  prefix: string;
  separator: string;
  yearFormat: DocumentYearFormat;
  numberLength: number;
  startNumber: number;
  nextNumber: number;
  incrementBy: number;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
}

export interface WarehouseOption { id: number; branchCode: string; warehouseCode: number; warehouseName: string }
