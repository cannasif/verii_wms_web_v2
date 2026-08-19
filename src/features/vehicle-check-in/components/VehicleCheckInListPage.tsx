import {useCallback,useMemo,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {AlertTriangle,SquarePen} from 'lucide-react';
import {AdvancedDataGrid,type GridColumn,type GridRequest} from '@/components/shared/AdvancedDataGrid';
import {requiredActionColumn,systemColumns} from '@/components/shared/GridSystemColumns';
import {ResponsiveDialog} from '@/components/shared/ResponsiveDialog';
import {formatProjectDateTime} from '@/lib/project-format';
import {localizeEnumValue} from '@/lib/enum-localization';
import {cn} from '@/lib/utils';
import {SteelProcessHeader} from '@/features/steel-receipt/components/SteelProcessHeader';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {VehicleCheckInRow} from '../types';
import {VehicleCheckInPage} from './VehicleCheckInPage';
import {VehicleCheckInStatusTabs} from './VehicleCheckInStatusTabs';
import {
  buildVehicleCheckInStatusFilters,
  VEHICLE_CHECK_IN_STATUS_TAB_ALL,
  type VehicleCheckInStatusTab,
} from '../utils/vehicle-check-in-list-filters';

const G='dataGrid.sacVehicleCheckIns';

const STATUS_BADGE_CLASS: Record<string, string> = {
  ContainsUnknownPlates: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  CheckedIn: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  LinkedToReceipt: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Cancelled: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

function vehicleCheckInStatusLabel(status: string, t: TFunction): string {
  const key = `vehicleCheckIn.status.${status}`;
  const label = t(key);
  return !label || label === key ? localizeEnumValue(status) : label;
}

function VehicleCheckInStatusBadge({status, t}: {status: string; t: TFunction}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
      STATUS_BADGE_CLASS[status] ?? 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    )}>
      {status === 'ContainsUnknownPlates' ? <AlertTriangle className="size-3.5"/> : null}
      {vehicleCheckInStatusLabel(status, t)}
    </span>
  );
}

export function VehicleCheckInListPage(){
  const {t}=useTranslation('common');
  const [dialogId,setDialogId]=useState<number|null|undefined>(undefined);
  const [refreshKey,setRefreshKey]=useState(0);
  const [statusTab,setStatusTab]=useState<VehicleCheckInStatusTab>(VEHICLE_CHECK_IN_STATUS_TAB_ALL);
  const statusFilters=useMemo(()=>buildVehicleCheckInStatusFilters(statusTab),[statusTab]);
  const fetchPage=useCallback(async(request:GridRequest)=>
    vehicleCheckInApi.paged({
      ...request,
      filterLogic: 'and',
      filters: [...statusFilters,...request.filters],
    }),[statusFilters]);
  const columns=useMemo<GridColumn<VehicleCheckInRow>[]>(()=>[
    ...systemColumns<VehicleCheckInRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    {key:'plateNo',label:t(`${G}.plateNo`),render:r=><span className="font-mono font-bold text-cyan-500">{r.plateNo}</span>},
    {key:'trailerPlateNo',label:t(`${G}.trailerPlateNo`),render:r=>r.trailerPlateNo||'—'},
    {key:'checkedInAtUtc',label:t(`${G}.checkedInAtUtc`),render:r=>formatProjectDateTime(r.checkedInAtUtc)},
    {key:'driverFirstName',label:t(`${G}.driver`),render:r=>`${r.driverFirstName||''} ${r.driverLastName||''}`.trim()||'—'},
    {key:'driverPhone',label:t(`${G}.driverPhone`),render:r=>r.driverPhone||'—'},
    {key:'steelSheetCount',label:t(`${G}.steelSheetCount`),sortable:true,filterable:true,render:r=>r.steelSheetCount},
    {key:'customerCode',label:t(`${G}.customerCode`),render:r=>r.customerCode||'—'},
    {key:'customerName',label:t(`${G}.customerName`),render:r=>r.customerName||'—'},
    {key:'status',label:t(`${G}.status`),width:220,contextValue:r=>vehicleCheckInStatusLabel(r.status,t),render:r=>(
      <div className="flex justify-center">
        <VehicleCheckInStatusBadge status={r.status} t={t}/>
      </div>
    )},
    {key:'imageCount',label:t(`${G}.imageCount`),render:r=>r.imageCount},
    {key:'actions',label:t(`${G}.actions`),width:72,...requiredActionColumn,render:r=><button type="button" onClick={()=>setDialogId(r.id)} title={t(`${G}.viewUpdate`)} aria-label={t(`${G}.viewUpdate`)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-cyan-500/30 p-2 text-cyan-500 transition hover:bg-cyan-500/10"><SquarePen className="size-4"/></button>},
  ],[t]);
  const close=()=>{setDialogId(undefined);setRefreshKey(value=>value+1)};
  return <section className="space-y-5" data-no-auto-localize="true">
    <SteelProcessHeader
      currentStep="gate"
      title={t('vehicleCheckIn.pageTitle',{defaultValue:'Araç Giriş ve SAC Kabul'})}
      description={t(`${G}.description`)}
    />
    <AdvancedDataGrid
      pageKey="steel-vehicle-check-ins"
      eyebrow=""
      title={t(`${G}.title`)}
      description={t(`${G}.description`)}
      columns={columns}
      fetchPage={fetchPage}
      refreshKey={`${refreshKey}:${statusTab}`}
      toolbarAfterRefreshExtra={<VehicleCheckInStatusTabs value={statusTab} onChange={setStatusTab}/>}
      toolbarAction={{label:t(`${G}.toolbarAction`),run:async()=>setDialogId(null)}}
    />
    {dialogId!==undefined&&<ResponsiveDialog onClose={close} framed={false} title={dialogId?'Araç Giriş / Saha Kabul Detayı':'Yeni Araç Girişi / Saha Kabul'} description="Araç ve levha kabulünü tek işlemde tamamlayın." className="!max-w-[min(96vw,92rem)] max-h-[95dvh]">
      <VehicleCheckInPage embedded initialId={dialogId??undefined} onCompleted={()=>setRefreshKey(value=>value+1)}/>
    </ResponsiveDialog>}
  </section>;
}
