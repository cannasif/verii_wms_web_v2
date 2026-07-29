import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import { api } from '@/lib/axios';
import type { LocationBalanceRow, ProjectionRebuildResult, ReconciliationSummary, SerialBalanceRow, SerialMovementHistoryRow, StockBalanceDrillDown, WarehouseBalanceRow } from '../types/stock-balance.types';

interface Envelope<T>{success:boolean;data:T;message?:string}
export interface OpeningBalanceImportResult { operationId:number;operationCode:string;isReplay:boolean;totalRows:number;totalQuantity:number }
const unwrap=<T>(response:Envelope<T>):T=>{if(!response.success)throw new Error(response.message||'İşlem başarısız.');return response.data;};
export const stockBalancesApi={
  getLocations:async(request:GridRequest):Promise<GridPage<LocationBalanceRow>>=>unwrap(await api.post<Envelope<GridPage<LocationBalanceRow>>>('/api/stock-balances/locations/paged',request)),
  getWarehouses:async(request:GridRequest):Promise<GridPage<WarehouseBalanceRow>>=>unwrap(await api.post<Envelope<GridPage<WarehouseBalanceRow>>>('/api/stock-balances/warehouses/paged',request)),
  getSerials:async(request:GridRequest):Promise<GridPage<SerialBalanceRow>>=>unwrap(await api.post<Envelope<GridPage<SerialBalanceRow>>>('/api/stock-balances/serials/paged',request)),
  getSerialMovements:async(id:number,request:GridRequest):Promise<GridPage<SerialMovementHistoryRow>>=>unwrap(await api.post<Envelope<GridPage<SerialMovementHistoryRow>>>(`/api/stock-balances/serials/${id}/movements/paged`,request)),
  getDrillDown:async(id:number):Promise<StockBalanceDrillDown>=>unwrap(await api.get<Envelope<StockBalanceDrillDown>>(`/api/stock-balances/warehouses/${id}/drill-down`)),
  getReconciliation:async():Promise<ReconciliationSummary>=>unwrap(await api.get<Envelope<ReconciliationSummary>>('/api/stock-balances/reconciliation/summary')),
  rebuild:async():Promise<ProjectionRebuildResult>=>unwrap(await api.post<Envelope<ProjectionRebuildResult>>('/api/stock-balances/rebuild')),
  downloadOpeningTemplate:async(branchCode:string):Promise<Blob>=>await api.get<Blob>(`/api/stock-balances/opening-import/template?branchCode=${encodeURIComponent(branchCode)}`,{responseType:'blob'}),
  importOpeningBalance:async(file:File,branchCode:string,idempotencyKey:string):Promise<OpeningBalanceImportResult>=>{
    const form=new FormData();form.append('file',file);
    return unwrap(await api.post<Envelope<OpeningBalanceImportResult>>(`/api/stock-balances/opening-import?branchCode=${encodeURIComponent(branchCode)}&idempotencyKey=${encodeURIComponent(idempotencyKey)}`,form));
  },
};
