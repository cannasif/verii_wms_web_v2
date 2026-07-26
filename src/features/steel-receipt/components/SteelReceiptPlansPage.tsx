import {useMemo} from 'react';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelPlanRow} from '../types/steel-receipt.types';

export function SteelReceiptPlansPage(){
  const columns=useMemo<GridColumn<SteelPlanRow>[]>(()=>[
    ...systemColumns<SteelPlanRow>(),
    {key:'importReferenceNo',label:'Aktarım Referansı',render:r=><span className="font-mono font-bold text-cyan-500">{r.importReferenceNo}</span>},
    {key:'vehiclePlateNo',label:'Araç / Şoför',render:r=><>{r.vehiclePlateNo?<strong>{r.vehiclePlateNo}</strong>:<span>-</span>}<small className="block text-slate-500">{r.driverName||'Araç girişi bağlanmadı'}</small></>},
    {key:'supplierCode',label:'Tedarikçi Kodu',render:r=>r.supplierCode},
    {key:'supplierName',label:'Tedarikçi Adı',render:r=>r.supplierName},
    {key:'warehouseCode',label:'Depo Kodu',render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',render:r=>r.warehouseName},
    {key:'status',label:'Durum',render:r=><Status value={r.status}/>},
    {key:'totalLineCount',label:'Levha',render:r=>r.totalLineCount},
    {key:'totalExpectedQuantity',label:'Beklenen',render:r=>formatProjectNumber(r.totalExpectedQuantity)},
    {key:'importedAtUtc',label:'Aktarım Zamanı',render:r=>formatProjectDateTime(r.importedAtUtc)},
  ],[]);
  return <AdvancedDataGrid pageKey="steel-receipt-plans" title="SAC Beklenti Planları" description="Araç girişiyle ilişkilendirilen beklenen levha partileri ve süreç durumları." columns={columns} fetchPage={steelReceiptApi.plansPaged}/>;
}

function Status({value}:{value:string}){return <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-500">{localizeEnumValue(value)}</span>}
