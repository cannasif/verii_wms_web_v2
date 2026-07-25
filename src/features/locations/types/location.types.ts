export interface LocationRow {
  id: number;
  branchCode: string;
  warehouseId: number;
  warehouseCode: number;
  warehouseName: string;
  parentLocationId?: number | null;
  parentCode?: string | null;
  code: string;
  name: string;
  locationType: string;
  barcodeEntryMode: string;
  barcode?: string | null;
  zoneCode?: string | null;
  aisleNo?: number | null;
  rackNo?: number | null;
  levelNo?: number | null;
  binNo?: number | null;
  capacityQuantity?: number | null;
  capacityWeight?: number | null;
  capacityVolume?: number | null;
  capacityUnit?: string | null;
  allowMixedStock: boolean;
  allowMixedLot: boolean;
  allowMixedStatus: boolean;
  allowCycleCount: boolean;
  isPickable: boolean;
  isPutaway: boolean;
  isQuarantine: boolean;
  isActive: boolean;
  description?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  updatedBy?: number | null;
  updatedDate?: string | null;
}

export interface LocationLookupRow {
  id: number;
  warehouseId: number;
  parentLocationId?: number | null;
  code: string;
  name: string;
  locationType: string;
  barcode?: string | null;
}

export interface WarehouseOption {
  id: number;
  branchCode: string;
  warehouseCode: number;
  warehouseName: string;
}

export interface LocationUpsertPayload {
  warehouseId: number;
  parentLocationId: number | null;
  code: string;
  name: string;
  locationType: string;
  barcodeEntryMode: string;
  barcode: string | null;
  zoneCode: string | null;
  aisleNo: number | null;
  rackNo: number | null;
  levelNo: number | null;
  binNo: number | null;
  capacityQuantity: number | null;
  capacityWeight: number | null;
  capacityVolume: number | null;
  capacityUnit: string | null;
  allowMixedStock: boolean;
  allowMixedLot: boolean;
  allowMixedStatus: boolean;
  allowCycleCount: boolean;
  isPickable: boolean;
  isPutaway: boolean;
  isQuarantine: boolean;
  isActive: boolean;
  description: string | null;
}
