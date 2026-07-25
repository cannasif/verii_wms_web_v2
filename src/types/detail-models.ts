export interface BaseWorkflowHeaderDetail {
  id: number;
  branchCode?: string | null;
  projectCode?: string | null;
  documentNo?: string | null;
  documentDate?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  sourceWarehouse?: string | null;
  targetWarehouse?: string | null;
  description1?: string | null;
  description2?: string | null;
  completionDate?: string | null;
  isCompleted?: boolean;
}

export interface BaseWorkflowLineDetail {
  id: number;
  stockCode: string;
  stockName?: string | null;
  description?: string | null;
  quantity: number;
  siparisMiktar?: number | null;
  unit?: string | null;
  yapKod?: string | null;
  yapAcik?: string | null;
}

export interface BaseWorkflowLineSerialDetail {
  id: number;
  quantity: number;
  serialNo?: string | null;
  serialNo2?: string | null;
  serialNo3?: string | null;
  serialNo4?: string | null;
  sourceWarehouseId?: number | null;
  targetWarehouseId?: number | null;
  sourceWarehouseName?: string | null;
  targetWarehouseName?: string | null;
  sourceCellCode?: string | null;
  targetCellCode?: string | null;
}

export interface BaseWorkflowRouteDetail {
  id: number;
  quantity: number;
  stockCode?: string | null;
  stockName?: string | null;
  serialNo?: string | null;
  serialNo2?: string | null;
  serialNo3?: string | null;
  serialNo4?: string | null;
  sourceWarehouse?: number | null;
  targetWarehouse?: number | null;
  sourceWarehouseName?: string | null;
  targetWarehouseName?: string | null;
  sourceCellCode?: string | null;
  targetCellCode?: string | null;
  scannedBarcode?: string | null;
  description?: string | null;
}

export interface BaseWorkflowImportLineDetail {
  id: number;
  headerId: number;
  lineId?: number | null;
  stockCode: string;
  stockName?: string | null;
  yapKod?: string | null;
  yapAcik?: string | null;
  description1?: string | null;
  description2?: string | null;
  description?: string | null;
}
