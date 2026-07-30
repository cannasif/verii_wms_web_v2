export interface SupplierStockMappingRow {
  id: number;
  branchCode: string;
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  supplierStockCode: string;
  supplierStockName?: string | null;
  supplierUnitCode?: string | null;
  stockId: number;
  systemStockCode: string;
  systemStockName: string;
  systemUnitCode: string;
  conversionFactor: number;
  isActive: boolean;
  notes?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
  rowVersion: string;
}

export interface SaveSupplierStockMappingInput {
  branchCode: string;
  supplierId: number;
  supplierStockCode: string;
  supplierStockName?: string | null;
  supplierUnitCode?: string | null;
  stockId: number;
  conversionFactor: number;
  isActive: boolean;
  notes?: string | null;
  rowVersion?: string | null;
}
