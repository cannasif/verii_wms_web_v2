import type { ApiResponse } from '@/types/api';

export interface BarcodeDefinition {
  id?: number | null;
  moduleKey: string;
  displayName: string;
  definitionType: string;
  segmentPattern: string;
  requiredSegments: string;
  isActive: boolean;
  allowMirrorLookup: boolean;
  hintText: string;
  source: string;
  isEditable: boolean;
  branchCode: string;
}

export interface SaveBarcodeDefinitionRequest {
  moduleKey: string;
  displayName: string;
  definitionType: string;
  segmentPattern: string;
  requiredSegments: string;
  isActive: boolean;
  allowMirrorLookup: boolean;
  hintText: string;
}

export interface BarcodeSegmentValue {
  name: string;
  value: string;
}

export interface BarcodeMatchCandidate {
  stockCode?: string | null;
  stockName?: string | null;
  yapKod?: string | null;
  yapAcik?: string | null;
  serialNumber?: string | null;
}

export interface ResolvedBarcode {
  moduleKey: string;
  barcode: string;
  stockCode?: string | null;
  stockName?: string | null;
  yapKod?: string | null;
  yapAcik?: string | null;
  serialNumber?: string | null;
  originCountryCode?: string | null;
  originCountryName?: string | null;
  lotNo?: string | null;
  batchNo?: string | null;
  packageNo?: string | null;
  unit?: string | null;
  sourceWarehouseCode?: string | null;
  targetWarehouseCode?: string | null;
  sourceCellCode?: string | null;
  targetCellCode?: string | null;
  quantity?: number | null;
  source?: string | null;
  definitionType?: string | null;
  segmentPattern?: string | null;
  reasonCode: number;
  segments: BarcodeSegmentValue[];
  candidates: BarcodeMatchCandidate[];
}

export class BarcodeResolutionError extends Error {
  statusCode?: number;
  reasonCode?: number;
  candidates: BarcodeMatchCandidate[];

  constructor(message: string, options?: { statusCode?: number; reasonCode?: number; candidates?: BarcodeMatchCandidate[] }) {
    super(message);
    this.name = 'BarcodeResolutionError';
    this.statusCode = options?.statusCode;
    this.reasonCode = options?.reasonCode;
    this.candidates = options?.candidates ?? [];
  }
}

export function isBarcodeResolutionError(error: unknown): error is BarcodeResolutionError {
  return error instanceof BarcodeResolutionError;
}

export type BarcodeDefinitionResponse = ApiResponse<BarcodeDefinition>;
export type BarcodeDefinitionsResponse = ApiResponse<BarcodeDefinition[]>;
export type ResolvedBarcodeResponse = ApiResponse<ResolvedBarcode>;
