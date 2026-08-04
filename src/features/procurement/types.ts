export type ProcurementDocumentType = 'request' | 'rfq' | 'quote' | 'order';
export interface ProcurementSummary { draftRequests:number; pendingRequests:number; openRfqs:number; submittedQuotes:number; pendingOrders:number; approvedOpenOrders:number }
export interface ProcurementGridRow { id:number; documentType:ProcurementDocumentType; documentNo:string; documentDate:string; status:string; subject:string; counterparty?:string; lineCount:number; totalAmount:number; currencyCode:string; dueDate?:string; createdDate?:string }
export interface ProcurementLineDetail { id:number; lineNo:number; stockId?:number; stockCode?:string; stockName:string; unitCode:string; quantity:number; secondaryQuantity:number; unitPrice:number; discountRate:number; vatRate:number; requiredDate?:string; projectCode?:string; openQuantity:number }
export interface ProcurementHistoryRow { fromStatus:string; toStatus:string; actorUserId:number; note?:string; changedAtUtc:string }
export interface ProcurementSupplierParticipant { supplierId:number; supplierCode:string; supplierName:string }
export interface ProcurementDocumentDetail { id:number; documentType:ProcurementDocumentType; documentNo:string; documentDate:string; status:string; subject:string; description?:string; counterpartyCode?:string; counterpartyName?:string; currencyCode:string; exchangeRate:number; dueDate?:string; lines:ProcurementLineDetail[]; history:ProcurementHistoryRow[]; suppliers?:ProcurementSupplierParticipant[] }
export interface ProcurementRequestLineInput { stockId?:number; stockCode?:string; stockName:string; unitCode:string; quantity:number; requiredDate?:string; projectCode?:string; description?:string }
export interface SupplierQuoteLineInput { rfqLineId:number; quantity:number; unitPrice:number; discountRate:number; vatRate:number; deliveryDate?:string }
export interface RfqRequestLineInput { requestLineId:number; quantity:number }
export interface QuoteOrderLineInput { quoteLineId:number; quantity:number }
export interface ProcurementPolicy { id:number;branchCode:string;allowMultipleRfqsPerRequest:boolean;allowPartialRfqLines:boolean;allowMultipleQuotesPerSupplier:boolean;allowMultipleOrdersPerQuote:boolean;allowPartialOrderLines:boolean;allowSplitAwardsAcrossSuppliers:boolean;updatedBy?:number;updatedDate?:string }
