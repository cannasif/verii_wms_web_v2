export type WmsDocumentType =
  | 'GoodsReceipt'
  | 'InterWarehouseTransfer'
  | 'Shipment'
  | 'WarehouseReceipt'
  | 'WarehouseIssue'
  | 'ProductionOrder'
  | 'ProductionTransfer'
  | 'SubcontractingIssue'
  | 'SubcontractingReceipt';
export type DocumentYearFormat = 'None' | 'TwoDigit' | 'FourDigit';

export interface DocumentSeriesRow {
  id: number;
  branchCode: string;
  code: string;
  name: string;
  documentType: WmsDocumentType;
  prefix: string;
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
  createdByName?: string | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedByName?: string | null;
  updatedDate?: string | null;
}

export interface DocumentSeriesUpsertPayload {
  branchCode: string;
  code: string;
  name: string;
  documentType: WmsDocumentType;
  prefix: string;
  yearFormat: DocumentYearFormat;
  numberLength: number;
  startNumber: number;
  nextNumber: number;
  incrementBy: number;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
}
