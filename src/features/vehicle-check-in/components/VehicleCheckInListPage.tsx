import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {formatProjectDateTime} from '@/lib/project-format';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {VehicleCheckInRow} from '../types';
export function VehicleCheckInListPage(){
  const navigate=useNavigate();const columns=useMemo<GridColumn<VehicleCheckInRow>[]>(()=>[
    ...systemColumns<VehicleCheckInRow>(),
    {key:'plateNo',label:'Çekici Plakası',render:r=><span className="font-mono font-bold text-cyan-500">{r.plateNo}</span>},
    {key:'trailerPlateNo',label:'Dorse Plakası',render:r=>r.trailerPlateNo||'—'},
    {key:'checkedInAtUtc',label:'Giriş Zamanı',render:r=>formatProjectDateTime(r.checkedInAtUtc)},
    {key:'driverFirstName',label:'Şoför',render:r=>`${r.driverFirstName||''} ${r.driverLastName||''}`.trim()||'—'},
    {key:'driverPhone',label:'Telefon',render:r=>r.driverPhone||'—'},
    {key:'customerCode',label:'Tedarikçi',render:r=><><strong>{r.customerCode||'—'}</strong><small className="block text-slate-500">{r.customerName}</small></>},
    {key:'status',label:'Durum',render:r=>r.status},
    {key:'imageCount',label:'Görsel',render:r=>r.imageCount},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,render:r=><button onClick={()=>navigate(`/warehouse/goods-receipts/steel/vehicle-check-in?id=${r.id}`)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Görüntüle / Güncelle</button>},
  ],[navigate]);
  return <AdvancedDataGrid pageKey="steel-vehicle-check-ins" title="SAC Araç Giriş Kayıtları" description="Plaka, şoför, tedarikçi ve araç görsellerini sunucu taraflı sayfalama ile izleyin." columns={columns} fetchPage={vehicleCheckInApi.paged}/>;
}
