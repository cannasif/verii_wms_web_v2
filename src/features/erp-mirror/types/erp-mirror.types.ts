export interface PagedRequest { pageNumber?: number; page?: number; pageSize: number; search: string | null; sortBy?: string | null; sortDirection?: 'asc'|'desc'; filterLogic?: 'and'|'or'; filters?: Array<{column:string;operator:string;value:string}> }
export interface PagedResponse<T> { items: T[]; pageNumber: number; page?: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean }
export interface ApiEnvelope<T> { success: boolean; data: T; message?: string }
export interface AuditFields { createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }
export interface WarehouseMirror extends AuditFields { id: number; branchCode: string; warehouseCode: number; warehouseName: string; lastSyncDate?: string }
export interface StockMirror extends AuditFields { id: number; branchCode: string; businessUnitCode: number; erpStockCode: string; stockName: string; unitCode: string; manufacturerCode?: string; groupCode?: string; code1?: string; code2?: string; code3?: string; code4?: string; code5?: string; lastSyncDate?: string }
export interface CustomerMirror extends AuditFields { id: number; branchCode: string; businessUnitCode: number; customerCode: string; customerName: string; lastSyncDate?: string }
export interface ConfigurationCodeMirror extends AuditFields { id: number; branchCode: string; configurationCode: string; description: string; configurableStockCode?: string; stockId?: number; lastSyncDate?: string }
