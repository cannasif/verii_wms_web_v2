export type BarcodeLabelType = 'Product' | 'SerialLot' | 'Location' | 'Logistics' | 'Sscc';
export type BarcodeElementType = 'text' | 'barcode' | 'qrcode' | 'datamatrix' | 'rectangle' | 'line';
export type BarcodeSymbology = 'code128' | 'gs1-128' | 'qrcode' | 'datamatrix';

export interface BarcodeTemplateRow { id:number; branchCode:string; templateCode:string; displayName:string; labelType:BarcodeLabelType; widthMm:number; heightMm:number; dpi:number; engineType:string; isActive:boolean; draftVersionId:number|null; publishedVersionId:number|null; createdBy?:number|null; createdDate?:string|null; updatedBy?:number|null; updatedDate?:string|null }
export interface BarcodeTemplatePayload { branchCode:string; templateCode:string; displayName:string; labelType:BarcodeLabelType; widthMm:number; heightMm:number; dpi:number; isActive:boolean }
export interface BarcodeTemplateVersion { id:number; barcodeTemplateId:number; versionNo:number; isPublished:boolean; publishedAt:string|null; notes:string|null; templateJson:string; createdDate:string|null; createdBy:number|null }
export interface BarcodeSchemaField { key:string; label:string; sampleValue:string; group:string; targetType:string }
export interface LabelElement { id:string; type:BarcodeElementType; xMm:number; yMm:number; widthMm:number; heightMm:number; text?:string; value?:string; binding?:string; symbology?:BarcodeSymbology; fontSize?:number; strokeWidth?:number }
export interface LabelDocument { version:1; canvas:{widthMm:number;heightMm:number;dpi:number;background:string}; elements:LabelElement[]; sampleData:Record<string,string> }

export const sampleDocument = (widthMm=100, heightMm=70, dpi=203):LabelDocument => ({ version:1, canvas:{widthMm,heightMm,dpi,background:'#ffffff'}, sampleData:{stockCode:'STK-0001',stockName:'Örnek Ürün',barcode:'8691234567890',generatedBarcode:'WMS/STK-0001/SN-2026-000001/00000001',serialNo:'SN-2026-000001',lotNo:'LOT-260722',warehouseName:'Merkez Depo',locationCode:'A-01-02',quantity:'12,50',unitCode:'ADET'}, elements:[
  {id:'title',type:'text',xMm:5,yMm:4,widthMm:90,heightMm:8,text:'V3RII WMS',fontSize:18},
  {id:'name',type:'text',xMm:5,yMm:14,widthMm:90,heightMm:7,binding:'stockName',fontSize:14},
  {id:'barcode',type:'barcode',xMm:5,yMm:24,widthMm:90,heightMm:24,binding:'generatedBarcode',symbology:'code128'},
  {id:'stock',type:'text',xMm:5,yMm:51,widthMm:45,heightMm:6,binding:'stockCode',fontSize:11},
  {id:'location',type:'text',xMm:52,yMm:51,widthMm:43,heightMm:6,binding:'locationCode',fontSize:11},
  {id:'serial',type:'text',xMm:5,yMm:59,widthMm:90,heightMm:6,binding:'serialNo',fontSize:10},
]});
