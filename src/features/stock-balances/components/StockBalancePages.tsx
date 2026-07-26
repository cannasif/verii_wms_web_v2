import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { localizeEnumValue } from '@/lib/enum-localization';
import { stockBalancesApi } from '../api/stock-balances.api';
import type { LocationBalanceRow, ReconciliationSummary, SerialBalanceRow, SerialMovementHistoryRow, StockBalanceDrillDown, WarehouseBalanceRow } from '../types/stock-balance.types';
import { formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';

const quantity=(value:number)=><span className={value<0?'font-bold text-red-600':value>0?'font-bold text-emerald-600':'text-slate-500'}>{formatProjectNumber(value)}</span>;
const date=(value:string)=>formatProjectDateTime(value);

export function LocationBalancesPage(){
  const queryClient=useQueryClient(); const {can,isLoading,isError}=usePermissionAccess(); const allow=isLoading||isError||can('WMS.STOCK_BALANCES.RECONCILE');
  const [summary,setSummary]=useState<ReconciliationSummary|null>(null); const [working,setWorking]=useState(false);
  const reconcile=async()=>{setWorking(true);try{const current=await stockBalancesApi.getReconciliation();setSummary(current);if(current.mismatchCount>0){const result=await stockBalancesApi.rebuild();toast.success(`${result.locationRows} raf ve ${result.warehouseRows} depo bakiyesi yeniden oluşturuldu.`);await queryClient.invalidateQueries({queryKey:['advanced-grid']});setSummary(await stockBalancesApi.getReconciliation());}else toast.success('Hareket defteri ve raf bakiyeleri tamamen uyumlu.');}catch(error){toast.error(error instanceof Error?error.message:'Uzlaştırma başarısız.');}finally{setWorking(false);}};
  const columns=useMemo<GridColumn<LocationBalanceRow>[]>(()=>[
    ...systemColumns<LocationBalanceRow>(),
    {key:'warehouseCode',label:'Depo Kodu',render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',render:r=>r.warehouseName},
    {key:'locationCode',label:'Raf Kodu',render:r=>r.locationCode},
    {key:'locationName',label:'Raf Adı',render:r=>r.locationName},
    {key:'stockCode',label:'Stok Kodu',render:r=>r.stockCode},
    {key:'stockName',label:'Stok Adı',render:r=>r.stockName},
    {key:'yapCode',label:'Yapılandırma Kodu',render:r=>r.yapCode||'-'}, {key:'lotNo',label:'Lot',render:r=>r.lotNo||'-'}, {key:'serialNo',label:'Seri',render:r=>r.serialNo||'-'},
    {key:'stockStatus',label:'Durum',render:r=>r.stockStatus}, {key:'quantity',label:'Fiziksel',render:r=>quantity(r.quantity)},
    {key:'reservedQuantity',label:'Rezerve',render:r=>quantity(r.reservedQuantity)}, {key:'availableQuantity',label:'Kullanılabilir',render:r=>quantity(r.availableQuantity)},
    {key:'unitCode',label:'Birim',render:r=>r.unitCode}, {key:'lastMovementEntryId',label:'Son Hareket ID',render:r=>r.lastMovementEntryId},
    {key:'lastTransactionDate',label:'Son Hareket',render:r=>date(r.lastTransactionDate)},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,hideable:false,render:()=> <span className="text-xs text-slate-500">Salt okunur</span>},
  ],[]);
  return <div className="space-y-4">{summary&&<div className={`rounded-xl border p-4 ${summary.mismatchCount?'border-amber-400 bg-amber-50 text-amber-900':'border-emerald-400 bg-emerald-50 text-emerald-900'}`}><strong>Reconciliation:</strong> {summary.mismatchCount} fark · Defter son ID {summary.ledgerLastEntryId} · Projection son ID {summary.projectionLastEntryId}</div>}<AdvancedDataGrid pageKey="location-stock-balances" title="Raf Bakiyeleri" description="Depo, raf, stok, yapılandırma kodu, lot, seri ve stok durumu seviyesinde güncel fiziksel/rezerve/kullanılabilir miktarlar." columns={columns} fetchPage={stockBalancesApi.getLocations} toolbarAction={allow?{label:working?'Kontrol ediliyor...':'Uzlaştır ve Onar',run:reconcile}:undefined}/></div>;
}

export function WarehouseBalancesPage(){
  const [detail,setDetail]=useState<StockBalanceDrillDown|null>(null); const [loading,setLoading]=useState(false);
  const open=useCallback(async(row:WarehouseBalanceRow)=>{setLoading(true);try{setDetail(await stockBalancesApi.getDrillDown(row.id));}catch(error){toast.error(error instanceof Error?error.message:'Bakiye detayı alınamadı.');}finally{setLoading(false);}},[]);
  const columns=useMemo<GridColumn<WarehouseBalanceRow>[]>(()=>[
    ...systemColumns<WarehouseBalanceRow>(),
    {key:'warehouseCode',label:'Depo Kodu',render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',render:r=>r.warehouseName},
    {key:'stockCode',label:'Stok Kodu',render:r=>r.stockCode},
    {key:'stockName',label:'Stok Adı',render:r=>r.stockName},
    {key:'yapCode',label:'Yapılandırma Kodu',render:r=>r.yapCode||'-'}, {key:'stockStatus',label:'Durum',render:r=>r.stockStatus},
    {key:'quantity',label:'Fiziksel',render:r=>quantity(r.quantity)}, {key:'reservedQuantity',label:'Rezerve',render:r=>quantity(r.reservedQuantity)},
    {key:'availableQuantity',label:'Kullanılabilir',render:r=>quantity(r.availableQuantity)}, {key:'unitCode',label:'Birim',render:r=>r.unitCode},
    {key:'distinctLocationCount',label:'Raf Sayısı',render:r=>r.distinctLocationCount}, {key:'distinctLotCount',label:'Lot Sayısı',render:r=>r.distinctLotCount},
    {key:'distinctSerialCount',label:'Seri Sayısı',render:r=>r.distinctSerialCount}, {key:'lastTransactionDate',label:'Son Hareket',render:r=>date(r.lastTransactionDate)},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,hideable:false,render:r=><button type="button" title="Raf, lot ve seri detayını aç" onClick={()=>void open(r)} className="rounded-lg border p-2 text-cyan-600"><Eye className="size-4"/></button>},
  ],[open]);
  return <><AdvancedDataGrid pageKey="warehouse-stock-balances" title="Depo Stok Bakiyesi" description="Depo ve stok seviyesinde özet bakiye; işlemden raf, lot ve seri kırılımına inebilirsiniz." columns={columns} fetchPage={stockBalancesApi.getWarehouses}/>{(detail||loading)&&<Dialog open onOpenChange={v=>{if(!v)setDetail(null);}}><DialogContent className="max-h-[calc(100%-2rem)] w-full !max-w-6xl overflow-auto rounded-2xl">{!detail?<div className="grid h-48 place-items-center"><Loader2 className="size-7 animate-spin"/></div>:<><DialogTitle>{detail.summary.stockCode} · {detail.summary.warehouseName}</DialogTitle><div className="mt-3 grid gap-3 sm:grid-cols-4"><Card label="Fiziksel" value={detail.summary.quantity}/><Card label="Rezerve" value={detail.summary.reservedQuantity}/><Card label="Kullanılabilir" value={detail.summary.availableQuantity}/><Card label="Raf" value={detail.summary.distinctLocationCount}/></div><div className="mt-5 overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-100 dark:bg-white/5"><th className="p-3 text-left">Raf</th><th className="p-3 text-left">YAP / Lot / Seri</th><th className="p-3 text-left">Durum</th><th className="p-3 text-right">Fiziksel</th><th className="p-3 text-right">Rezerve</th><th className="p-3 text-right">Kullanılabilir</th></tr></thead><tbody>{detail.locations.map(r=><tr key={r.id} className="border-t"><td className="p-3"><strong>{r.locationCode}</strong><small className="block text-slate-500">{r.locationName}</small></td><td className="p-3">{r.yapCode||'-'} / {r.lotNo||'-'} / {r.serialNo||'-'}</td><td className="p-3">{localizeEnumValue(r.stockStatus)}</td><td className="p-3 text-right">{quantity(r.quantity)}</td><td className="p-3 text-right">{quantity(r.reservedQuantity)}</td><td className="p-3 text-right">{quantity(r.availableQuantity)}</td></tr>)}</tbody></table></div></>}</DialogContent></Dialog>}</>;
}

export function SerialBalancesPage(){
  const [selected,setSelected]=useState<SerialBalanceRow|null>(null);
  const fetchHistory=useCallback((request:Parameters<typeof stockBalancesApi.getSerials>[0])=>{
    if(!selected) return Promise.resolve({items:[],totalCount:0,pageNumber:1,page:1,pageSize:request.pageSize,totalPages:0,hasPreviousPage:false,hasNextPage:false});
    return stockBalancesApi.getSerialMovements(selected.id,request);
  },[selected]);
  const columns=useMemo<GridColumn<SerialBalanceRow>[]>(()=>[
    ...systemColumns<SerialBalanceRow>(),
    {key:'serialNo',label:'Seri No',hideable:false,render:r=><span className="font-mono font-bold text-cyan-600">{r.serialNo}</span>},
    {key:'stockCode',label:'Stok Kodu',render:r=>r.stockCode},
    {key:'stockName',label:'Stok Adı',render:r=>r.stockName},
    {key:'warehouseCode',label:'Depo Kodu',render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',render:r=>r.warehouseName},
    {key:'locationCode',label:'Raf Kodu',render:r=>r.locationCode},
    {key:'locationName',label:'Raf Adı',render:r=>r.locationName},
    {key:'yapCode',label:'Yapılandırma Kodu',render:r=>r.yapCode||'-'}, {key:'lotNo',label:'Lot',render:r=>r.lotNo||'-'},
    {key:'stockStatus',label:'Durum',render:r=>r.stockStatus}, {key:'quantity',label:'Fiziksel',render:r=>quantity(r.quantity)},
    {key:'reservedQuantity',label:'Rezerve',render:r=>quantity(r.reservedQuantity)}, {key:'availableQuantity',label:'Kullanılabilir',render:r=>quantity(r.availableQuantity)},
    {key:'unitCode',label:'Birim',render:r=>r.unitCode}, {key:'lastMovementEntryId',label:'Son Hareket ID',render:r=>r.lastMovementEntryId},
    {key:'lastTransactionDate',label:'Son Hareket',render:r=>date(r.lastTransactionDate)},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,hideable:false,render:r=><button type="button" title="Seri hareket geçmişini aç" onClick={()=>setSelected(r)} className="rounded-lg border p-2 text-cyan-600"><Eye className="size-4"/></button>},
  ],[]);
  const historyColumns=useMemo<GridColumn<SerialMovementHistoryRow>[]>(()=>[
    ...systemColumns<SerialMovementHistoryRow>(),
    {key:'occurredAt',label:'Hareket Zamanı',hideable:false,render:r=>date(r.occurredAt)},
    {key:'operationType',label:'Hareket Tipi',render:r=>movementType(r.operationType)},
    {key:'operationStatus',label:'Operasyon Durumu',render:r=>r.operationStatus},
    {key:'operationCode',label:'Operasyon Kodu',render:r=><span className="font-mono text-xs">{r.operationCode}</span>},
    {key:'referenceNo',label:'Referans',render:r=>[r.referenceType,r.referenceNo].filter(Boolean).join(' / ')||'-'},
    {key:'warehouseCode',label:'Depo Kodu',render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',render:r=>r.warehouseName},
    {key:'locationCode',label:'Raf Kodu',render:r=>r.locationCode},
    {key:'locationName',label:'Raf Adı',render:r=>r.locationName},
    {key:'quantityDelta',label:'Miktar Değişimi',render:r=><span className={r.quantityDelta>0?'font-bold text-emerald-600':'font-bold text-red-600'}>{r.quantityDelta>0?'+':''}{formatProjectNumber(r.quantityDelta)} {r.unitCode}</span>},
    {key:'stockStatus',label:'Stok Durumu',render:r=>r.stockStatus},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,hideable:false,render:()=> <span className="text-xs text-slate-500">Değiştirilemez defter kaydı</span>},
  ],[]);
  return <><AdvancedDataGrid pageKey="serial-stock-balances" title="Stok Seri Bakiyesi" description="Seri takipli stokların depo, raf, YAP ve lot kırılımındaki güncel bakiyesi; işlemden serinin uçtan uca hareket geçmişine ulaşabilirsiniz." columns={columns} fetchPage={stockBalancesApi.getSerials}/>{selected&&<Dialog open onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="max-h-[calc(100%-2rem)] w-full !max-w-7xl overflow-auto rounded-2xl"><DialogTitle>{selected.stockCode} · {selected.serialNo} Seri Hareket Geçmişi</DialogTitle><p className="text-sm text-slate-500">Kabulden transfer ve sevke kadar bu seriyle aynı stok/YAP/lot kimliğine ait tüm depo ve raf olayları.</p><div className="mt-4"><AdvancedDataGrid pageKey={`serial-movement-history-${selected.id}`} title="Seri İzlenebilirlik Defteri" description={`${selected.warehouseName} / ${selected.locationCode} üzerindeki güncel bakiye: ${formatProjectNumber(selected.quantity)} ${selected.unitCode}`} columns={historyColumns} fetchPage={fetchHistory}/></div></DialogContent></Dialog>}</>;
}

function movementType(value:string){return ({Receipt:'Mal Kabul',Shipment:'Sevk',Transfer:'Transfer',AdjustmentIncrease:'Sayım Artışı',AdjustmentDecrease:'Sayım Azalışı',CustomerReturn:'Müşteri İadesi',SupplierReturn:'Tedarikçi İadesi',Reversal:'Ters Kayıt'} as Record<string,string>)[value]??value;}
function Card({label,value}:{label:string;value:number}){return <div className="rounded-xl border p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{formatProjectNumber(value)}</p></div>}
