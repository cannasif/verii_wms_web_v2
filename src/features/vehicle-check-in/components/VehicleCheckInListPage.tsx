import {useMemo,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {ResponsiveDialog} from '@/components/shared/ResponsiveDialog';
import {formatProjectDateTime} from '@/lib/project-format';
import {localizeEnumValue} from '@/lib/enum-localization';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {VehicleCheckInRow} from '../types';
import {VehicleCheckInPage} from './VehicleCheckInPage';

const G='dataGrid.sacVehicleCheckIns';

export function VehicleCheckInListPage(){
  const {t}=useTranslation('common');
  const [dialogId,setDialogId]=useState<number|null|undefined>(undefined);
  const [refreshKey,setRefreshKey]=useState(0);
  const columns=useMemo<GridColumn<VehicleCheckInRow>[]>(()=>[
    ...systemColumns<VehicleCheckInRow>(),
    {key:'plateNo',label:t(`${G}.plateNo`),render:r=><span className="font-mono font-bold text-cyan-500">{r.plateNo}</span>},
    {key:'trailerPlateNo',label:t(`${G}.trailerPlateNo`),render:r=>r.trailerPlateNo||'—'},
    {key:'checkedInAtUtc',label:t(`${G}.checkedInAtUtc`),render:r=>formatProjectDateTime(r.checkedInAtUtc)},
    {key:'driverFirstName',label:t(`${G}.driver`),render:r=>`${r.driverFirstName||''} ${r.driverLastName||''}`.trim()||'—'},
    {key:'driverPhone',label:t(`${G}.driverPhone`),render:r=>r.driverPhone||'—'},
    {key:'steelSheetCount',label:t(`${G}.steelSheetCount`),sortable:true,filterable:true,render:r=>r.steelSheetCount},
    {key:'customerCode',label:t(`${G}.customerCode`),render:r=>r.customerCode||'—'},
    {key:'customerName',label:t(`${G}.customerName`),render:r=>r.customerName||'—'},
    {key:'status',label:t(`${G}.status`),render:r=>localizeEnumValue(r.status)},
    {key:'imageCount',label:t(`${G}.imageCount`),render:r=>r.imageCount},
    {key:'actions',label:t(`${G}.actions`),width:180,sortable:false,filterable:false,render:r=><button onClick={()=>setDialogId(r.id)} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold">{t(`${G}.viewUpdate`)}</button>},
  ],[t]);
  const close=()=>{setDialogId(undefined);setRefreshKey(value=>value+1)};
  return <div data-no-auto-localize="true">
    <AdvancedDataGrid pageKey="steel-vehicle-check-ins" title={t(`${G}.title`)} description={t(`${G}.description`)} columns={columns} fetchPage={vehicleCheckInApi.paged} refreshKey={refreshKey} toolbarAction={{label:t(`${G}.toolbarAction`),run:async()=>setDialogId(null)}}/>
    {dialogId!==undefined&&<ResponsiveDialog onClose={close} framed={false} title={dialogId?'Araç Giriş / Saha Kabul Detayı':'Yeni Araç Girişi / Saha Kabul'} description="Araç ve levha kabulünü tek işlemde tamamlayın." className="!max-w-[min(96vw,92rem)] max-h-[95dvh]">
      <VehicleCheckInPage embedded initialId={dialogId??undefined} onCompleted={()=>setRefreshKey(value=>value+1)}/>
    </ResponsiveDialog>}
  </div>;
}
