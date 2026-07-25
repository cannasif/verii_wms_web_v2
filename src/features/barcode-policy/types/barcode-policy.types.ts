export type BarcodePolicyScope='ProductSerial'|'ProductLot'|'Location'|'Logistics'|'Document';
export type BarcodePolicySegmentType='Field'|'Literal'|'Sequence'|'Date';
export type BarcodePolicyField='StockCode'|'SerialNo'|'YapCode'|'LotNo'|'WarehouseCode'|'LocationCode'|'DocumentNo';
export type BarcodeValueTransform='None'|'Upper'|'Lower';
export interface BarcodePolicySegment { id?:number;order:number;segmentType:BarcodePolicySegmentType;sourceField?:BarcodePolicyField|null;literalValue?:string|null;isRequired:boolean;transform:BarcodeValueTransform;sequenceLength:number;dateFormat:string }
export interface BarcodePolicyProfile { id:number;scope:BarcodePolicyScope;displayName:string;prefix?:string|null;separator:string;nextSequence:number;isEnabled:boolean;concurrencyToken:string;segments:BarcodePolicySegment[];updatedBy?:number|null;updatedDate?:string|null }
export interface BarcodePolicy { id:number;policyKey:string;displayName:string;currentVersion:number;isActive:boolean;concurrencyToken:string;profiles:BarcodePolicyProfile[];updatedDate?:string|null;updatedBy?:number|null }
export interface BarcodePolicyProfileUpdate { displayName:string;prefix?:string|null;separator:string;isEnabled:boolean;concurrencyToken:string;segments:BarcodePolicySegment[] }
export interface BarcodeGeneratePayload { idempotencyKey:string;stockCode?:string;serialNo?:string;yapCode?:string;lotNo?:string;warehouseCode?:string;locationCode?:string;documentNo?:string }
export interface BarcodePreview { value:string;sequenceNo:number;reserved:boolean;policyVersion:number;scope:BarcodePolicyScope }
export interface GeneratedBarcodeRow { id:number;scope:BarcodePolicyScope;policyVersion:number;barcodeValue:string;stockCode?:string|null;serialNo?:string|null;yapCode?:string|null;lotNo?:string|null;warehouseCode?:string|null;locationCode?:string|null;documentNo?:string|null;sequenceNo:number;generatedAt:string;createdBy?:number|null }
