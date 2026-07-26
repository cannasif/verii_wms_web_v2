export type IncomingInvoiceKind = 'EInvoice' | 'EArchive';
export type IncomingInvoiceLookupKind = 'Automatic' | 'EInvoice' | 'EArchive';
export type IncomingInvoiceArchiveStatus =
  | 'Imported' | 'NeedsReview' | 'ReadyForReceipt' | 'PartiallyLinked' | 'Linked' | 'Rejected';
export type IncomingInvoiceValidationStatus = 'Parsed' | 'Warning' | 'Invalid';
export type IncomingInvoiceLineMatchStatus = 'Unmatched' | 'StockMatched' | 'Ready' | 'Ignored';
export type IncomingInvoiceDocumentFormat = 'UblXml' | 'Pdf';

export interface ELogoConnectionRow {
  id: number;
  branchCode: string;
  key: string;
  displayName: string;
  vkn: string;
  username: string;
  source: string;
  endpointUrl?: string | null;
  applicationName?: string | null;
  version?: string | null;
  timeoutSeconds?: number | null;
  isActive: boolean;
  isDefault: boolean;
  isConfigured: boolean;
  description?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
  rowVersion: string;
}

export interface SaveELogoConnectionInput {
  branchCode: string;
  key: string;
  displayName: string;
  vkn: string;
  username: string;
  password?: string | null;
  source: string;
  endpointUrl?: string | null;
  applicationName?: string | null;
  version?: string | null;
  timeoutSeconds?: number | null;
  isActive: boolean;
  isDefault: boolean;
  description?: string | null;
  rowVersion?: string | null;
}

export interface IncomingInvoiceGridRow {
  id: number;
  branchCode: string;
  uuid: string;
  documentKind: IncomingInvoiceKind;
  invoiceNo: string;
  issueDate: string;
  supplierVknOrTckn: string;
  supplierName: string;
  currencyCode: string;
  payableAmount: number;
  lineCount: number;
  matchedLineCount: number;
  archiveStatus: IncomingInvoiceArchiveStatus;
  validationStatus: IncomingInvoiceValidationStatus;
  hasUbl: boolean;
  hasPdf: boolean;
  goodsReceiptCount: number;
  importedAtUtc: string;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
  rowVersion: string;
}

export interface IncomingInvoiceLineRow {
  id: number;
  lineNo: number;
  externalLineId: string;
  stockCode: string;
  buyerStockCode?: string | null;
  stockName: string;
  description?: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineExtensionAmount: number;
  taxRate: number;
  taxAmount: number;
  stockId?: number | null;
  matchStatus: IncomingInvoiceLineMatchStatus;
  matchMessage?: string | null;
  linkedQuantity: number;
  remainingQuantity: number;
}

export interface IncomingInvoiceDocumentRow {
  id: number;
  format: IncomingInvoiceDocumentFormat;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  storedAtUtc: string;
}

export interface IncomingInvoiceGoodsReceiptLinkRow {
  id: number;
  goodsReceiptId: number;
  documentNo: string;
  linkedQuantity: number;
  linkedAtUtc: string;
  linkedBy: number;
}

export interface IncomingInvoiceDetail {
  header: IncomingInvoiceGridRow;
  profileId?: string | null;
  invoiceTypeCode: string;
  issueTime?: string | null;
  orderReferenceNo?: string | null;
  despatchReferenceNo?: string | null;
  customerVknOrTckn: string;
  customerName: string;
  supplierTaxOffice?: string | null;
  supplierCustomerId?: number | null;
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  allowanceTotalAmount: number;
  validationMessage?: string | null;
  sourceHash: string;
  lastSynchronizedAtUtc: string;
  lines: IncomingInvoiceLineRow[];
  documents: IncomingInvoiceDocumentRow[];
  goodsReceipts: IncomingInvoiceGoodsReceiptLinkRow[];
}

export interface IncomingInvoiceImportResult {
  id: number;
  uuid: string;
  invoiceNo: string;
  documentKind: IncomingInvoiceKind;
  archiveStatus: IncomingInvoiceArchiveStatus;
  lineCount: number;
  matchedLineCount: number;
  hasPdf: boolean;
  replayed: boolean;
}

export interface IncomingInvoiceGoodsReceiptResult {
  incomingInvoiceId: number;
  goodsReceiptId: number;
  documentNo: string;
  taskId: number;
  taskNo: string;
  lineCount: number;
  linkedQuantity: number;
  archiveStatus: IncomingInvoiceArchiveStatus;
  replayed: boolean;
}
