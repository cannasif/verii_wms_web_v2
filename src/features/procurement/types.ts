export type ProcurementDocumentType = "request" | "rfq" | "quote" | "order";
export interface ProcurementSummary {
  draftRequests: number;
  pendingRequests: number;
  openRfqs: number;
  submittedQuotes: number;
  pendingOrders: number;
  approvedOpenOrders: number;
}
export interface ProcurementGridRow {
  id: number;
  documentType: ProcurementDocumentType;
  documentNo: string;
  documentDate: string;
  status: string;
  subject: string;
  counterparty?: string;
  lineCount: number;
  totalAmount: number;
  currencyCode: string;
  dueDate?: string;
  createdDate?: string;
  createdBy?: number | null;
  createdByName?: string | null;
  updatedDate?: string | null;
  updatedBy?: number | null;
  updatedByName?: string | null;
  requestId?: number | null;
  requestNo?: string | null;
  rfqId?: number | null;
  rfqNo?: string | null;
  quoteId?: number | null;
  quoteNo?: string | null;
}
export type ProcurementAttachmentOwnerType =
  | "request"
  | "request-line"
  | "quote"
  | "quote-line";

export interface ProcurementAttachment {
  id: number;
  ownerType: ProcurementAttachmentOwnerType | string;
  ownerId: number;
  fileName: string;
  contentType: string;
  url: string;
  fileSize: number;
  caption?: string | null;
  createdDate?: string | null;
}

export interface ProcurementLineDetail {
  id: number;
  lineNo: number;
  stockId?: number;
  stockCode?: string;
  stockName: string;
  unitCode: string;
  quantity: number;
  secondaryQuantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  requiredDate?: string;
  projectCode?: string;
  openQuantity: number;
  sourceRequestLineId?: number | null;
  attachments?: ProcurementAttachment[];
  /** Talep kalemi durumu (Draft / PendingApproval / Approved …). Diğer belgelerde yok. */
  status?: string | null;
}
export interface ProcurementHistoryRow {
  fromStatus: string;
  toStatus: string;
  actorUserId: number;
  actorUserName?: string | null;
  note?: string;
  changedAtUtc: string;
}
export interface ProcurementSupplierParticipant {
  supplierId?: number | null;
  supplierCode: string;
  supplierName: string;
  invitationStatus?: string;
  recipientEmail?: string;
  invitationExpiresAtUtc?: string;
}
export interface ProcurementDocumentDetail {
  id: number;
  documentType: ProcurementDocumentType;
  documentNo: string;
  documentDate: string;
  status: string;
  subject: string;
  description?: string;
  counterpartyCode?: string;
  counterpartyName?: string;
  currencyCode: string;
  exchangeRate: number;
  dueDate?: string;
  lines: ProcurementLineDetail[];
  history: ProcurementHistoryRow[];
  suppliers?: ProcurementSupplierParticipant[];
  requestId?: number | null;
  requestNo?: string | null;
  rfqId?: number | null;
  rfqNo?: string | null;
  quoteId?: number | null;
  quoteNo?: string | null;
  createdBy?: number | null;
  createdByName?: string | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedByName?: string | null;
  updatedDate?: string | null;
  attachments?: ProcurementAttachment[];
}
export interface ProcurementRequestLineInput {
  stockId?: number;
  stockCode?: string;
  stockName: string;
  unitCode: string;
  quantity: number;
  requiredDate?: string;
  projectCode?: string;
  description?: string;
}
export interface SupplierQuoteLineInput {
  rfqLineId: number;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  deliveryDate?: string;
}
export interface RfqRequestLineInput {
  requestLineId: number;
  quantity: number;
}
export interface QuoteOrderLineInput {
  quoteLineId: number;
  quantity: number;
}
export interface ProcurementPolicy {
  id: number;
  branchCode: string;
  allowMultipleRfqsPerRequest: boolean;
  allowPartialRfqLines: boolean;
  allowMultipleQuotesPerSupplier: boolean;
  allowMultipleOrdersPerQuote: boolean;
  allowPartialOrderLines: boolean;
  allowSplitAwardsAcrossSuppliers: boolean;
  supplierQuoteChannelMode:
    "InternalOnly" | "PortalOptional" | "PortalRequired";
  invitationValidityDays: number;
  allowSupplierDraftSave: boolean;
  allowSupplierQuantityChange: boolean;
  allowSupplierRevisions: boolean;
  maximumSupplierRevisionCount: number;
  requireSupplierDeliveryDate: boolean;
  allowZeroUnitPrice: boolean;
  updatedBy?: number;
  updatedDate?: string;
}
export interface SupplierPortalLine {
  rfqLineId: number;
  lineNo: number;
  stockCode?: string;
  stockName: string;
  unitCode: string;
  requestedQuantity: number;
  requiredDate?: string;
  quotedQuantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  deliveryDate?: string;
}
export interface SupplierPortalQuote {
  rfqNo: string;
  subject: string;
  buyerMessage?: string;
  supplierCode: string;
  supplierName: string;
  status: string;
  responseDueDate: string;
  expiresAtUtc: string;
  quoteNo?: string;
  quoteDate?: string;
  validUntil?: string;
  currencyCode: string;
  exchangeRate: number;
  note?: string;
  revisionNo: number;
  allowDraftSave: boolean;
  allowQuantityChange: boolean;
  requireDeliveryDate: boolean;
  allowZeroUnitPrice: boolean;
  lines: SupplierPortalLine[];
}
