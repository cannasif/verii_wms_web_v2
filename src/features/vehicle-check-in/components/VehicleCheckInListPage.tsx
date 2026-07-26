import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {formatProjectDateTime} from '@/lib/project-format';
import {localizeEnumValue} from '@/lib/enum-localization';
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
    {key:'steelSheetCount',label:'Sac Levha Adedi',sortable:true,filterable:true,render:r=>r.steelSheetCount},
    {key:'customerCode',label:'Tedarikçi Kodu',render:r=>r.customerCode||'—'},
    {key:'customerName',label:'Tedarikçi Adı',render:r=>r.customerName||'—'},
    {key:'status',label:'Durum',render:r=>localizeEnumValue(r.status)},
    {key:'imageCount',label:'Görsel',render:r=>r.imageCount},
    {key:'actions',label:'İşlemler',sortable:false,filterable:false,render:r=><button onClick={()=>navigate(`/warehouse/goods-receipts/steel/vehicle-check-in?id=${r.id}`)} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold">Görüntüle / Güncelle</button>},
  ],[navigate]);
  return <AdvancedDataGrid pageKey="steel-vehicle-check-ins" title="SAC Araç Giriş Kayıtları" description="Plaka, şoför, tedarikçi ve araç görsellerini sunucu taraflı sayfalama ile izleyin. Yeni kabulü sağ üstteki aksiyondan başlatın." columns={columns} fetchPage={vehicleCheckInApi.paged} toolbarAction={{label:'Yeni Araç ve SAC Kabulü',run:async()=>navigate('/warehouse/goods-receipts/steel/vehicle-check-in')}}/>;
}
