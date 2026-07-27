import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {formatProjectDateTime} from '@/lib/project-format';
import {localizeEnumValue} from '@/lib/enum-localization';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {VehicleCheckInRow} from '../types';

const G='dataGrid.sacVehicleCheckIns';

export function VehicleCheckInListPage(){
  const navigate=useNavigate();
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
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
    {key:'actions',label:t(`${G}.actions`),sortable:false,filterable:false,render:r=><button onClick={()=>navigate(`/warehouse/goods-receipts/steel/vehicle-check-in?id=${r.id}`)} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold">{t(`${G}.viewUpdate`)}</button>},
  ],[navigate,t,gridLanguage]);
  return <div data-no-auto-localize="true"><AdvancedDataGrid pageKey="steel-vehicle-check-ins" title={t(`${G}.title`)} description={t(`${G}.description`)} columns={columns} fetchPage={vehicleCheckInApi.paged} toolbarAction={{label:t(`${G}.toolbarAction`),run:async()=>navigate('/warehouse/goods-receipts/steel/vehicle-check-in')}}/></div>;
}
