import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ChevronRight,Eye,Loader2} from 'lucide-react';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {requiredActionColumn,systemColumns} from '@/components/shared/GridSystemColumns';
import {OpsDialogBody,OpsDialogContent,OpsDialogHeader} from '@/components/shared/OpsDialogShell';
import {OpsStatusBadge,inferOpsStatusTone,type OpsStatusTone} from '@/components/shared/OpsStatusBadge';
import {Dialog,DialogTitle} from '@/components/ui/dialog';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {cn} from '@/lib/utils';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelLineRow,SteelPlanRow} from '../types/steel-receipt.types';

const G='dataGrid.sacReceiptPlans';
const PENDING_VEHICLE_KEY='__pending__';

function inferPlanDetailArrivalTone(status:string):OpsStatusTone{
  switch(status){
    case'Arrived':return'done';
    case'Missing':return'danger';
    case'Expected':
    default:return'pending';
  }
}

function inferPlanDetailInspectionTone(status:string):OpsStatusTone{
  switch(status){
    case'Approved':return'done';
    case'PartiallyApproved':return'pending';
    case'Rejected':return'danger';
    case'Inspected':return'quality';
    case'Pending':
    default:return'pending';
  }
}

function normalizePlate(plate?:string|null){
  return (plate??'').trim().toLocaleUpperCase('tr-TR');
}

function groupLinesByVehicle(rows:SteelLineRow[]){
  const groups=new Map<string,SteelLineRow[]>();
  for(const row of rows){
    const key=normalizePlate(row.vehiclePlateNo)||PENDING_VEHICLE_KEY;
    const bucket=groups.get(key);
    if(bucket)bucket.push(row);
    else groups.set(key,[row]);
  }
  const vehiclePlates=[...groups.keys()].filter(key=>key!==PENDING_VEHICLE_KEY);
  const shouldSplit=vehiclePlates.length>1||(vehiclePlates.length===1&&groups.has(PENDING_VEHICLE_KEY));
  if(!shouldSplit)return [{key:vehiclePlates[0]??PENDING_VEHICLE_KEY,rows}];
  return [...groups.entries()]
    .sort(([left],[right])=>{
      if(left===PENDING_VEHICLE_KEY)return 1;
      if(right===PENDING_VEHICLE_KEY)return -1;
      return left.localeCompare(right,'tr-TR');
    })
    .map(([key,groupRows])=>({key,rows:groupRows}));
}

function renderVehicleDriver(row:SteelPlanRow,t:(key:string,options?:{defaultValue?:string})=>string){
  const hasVehicle=Boolean(row.vehiclePlateNo||row.vehicleCheckInId);
  return <>
    {row.vehiclePlateNo?<strong>{row.vehiclePlateNo}</strong>:<span>-</span>}
    <small className="block text-slate-500">
      {row.driverName||(hasVehicle?t(`${G}.driverNotProvided`,{defaultValue:'Şoför bilgisi girilmedi'}):t(`${G}.vehicleNotLinked`))}
    </small>
  </>;
}

export function SteelReceiptPlansPage(){
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const [plan,setPlan]=useState<SteelPlanRow|null>(null);
  const columns=useMemo<GridColumn<SteelPlanRow>[]>(()=>[
    ...systemColumns<SteelPlanRow>(),
    {key:'importReferenceNo',label:t(`${G}.importReferenceNo`),render:r=>(
      <button
        type="button"
        onClick={()=>setPlan(r)}
        className="group inline-flex max-w-full items-center gap-1.5 text-left"
        title="Excel / aktarım detayını aç"
      >
        <span className="truncate font-mono font-bold text-cyan-500 group-hover:underline">{r.importReferenceNo}</span>
        <ChevronRight className="size-3.5 shrink-0 text-cyan-500/70 opacity-0 transition group-hover:opacity-100"/>
      </button>
    )},
    {key:'vehiclePlateNo',label:t(`${G}.vehicleDriver`),render:r=>renderVehicleDriver(r,t)},
    {key:'supplierCode',label:t(`${G}.supplierCode`),render:r=>r.supplierCode},
    {key:'supplierName',label:t(`${G}.supplierName`),render:r=>r.supplierName},
    {key:'warehouseCode',label:t(`${G}.warehouseCode`),render:r=>r.warehouseCode},
    {key:'warehouseName',label:t(`${G}.warehouseName`),render:r=>r.warehouseName},
    {key:'status',label:t(`${G}.status`),width:240,render:r=><OpsStatusBadge tone={inferOpsStatusTone(r.status)}>{localizeEnumValue(r.status)}</OpsStatusBadge>},
    {key:'totalLineCount',label:t(`${G}.totalLineCount`),render:r=>r.totalLineCount},
    {key:'totalExpectedQuantity',label:t(`${G}.totalExpectedQuantity`),render:r=>formatProjectNumber(r.totalExpectedQuantity)},
    {key:'importedAtUtc',label:t(`${G}.importedAtUtc`),render:r=>formatProjectDateTime(r.importedAtUtc)},
    {key:'actions',label:t(`${G}.actions`),...requiredActionColumn,render:r=><button type="button" onClick={()=>setPlan(r)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-bold text-cyan-500"><Eye className="size-3.5"/>{t(`${G}.viewDetails`)}</button>},
  // i18n language changes invalidate `t`; keep columns in sync with resolved UI language.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gridLanguage forces column label refresh
  ],[t,gridLanguage]);
  return <div data-no-auto-localize="true">
    <AdvancedDataGrid
      pageKey="steel-receipt-plans"
      title={t(`${G}.title`)}
      description="Excel / aktarım numarası başlık satırıdır; numaraya tıklayınca levha detayları açılır."
      columns={columns}
      fetchPage={steelReceiptApi.plansPaged}
      onRowDoubleClick={setPlan}
    />
    {plan&&<PlanLinesDialog plan={plan} onClose={()=>setPlan(null)}/>}
  </div>;
}

function PlanLinesDialog({plan,onClose}:{plan:SteelPlanRow;onClose:()=>void}){
  const {t}=useTranslation('common');
  const lines=useQuery({
    queryKey:['steel-receipt-plan-lines',plan.id],
    queryFn:()=>steelReceiptApi.linesPaged({
      pageNumber:1,
      pageSize:Math.max(plan.totalLineCount,200),
      search:null,
      filterLogic:'and',
      filters:[{column:'planId',operator:'equals',value:String(plan.id)}],
      sortBy:'lineNo',
      sortDirection:'asc',
    }),
  });
  const rows=lines.data?.items??[];
  const lineNoBase=useMemo(()=>rows.length?Math.min(...rows.map(row=>row.lineNo)):1,[rows]);
  const groupedRows=useMemo(()=>groupLinesByVehicle(rows),[rows]);
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}>
    <OpsDialogContent size="full" portalRoot="body" className="data-no-auto-localize !max-w-[min(96vw,75rem)] max-h-[min(94dvh,1100px)]">
      <OpsDialogHeader>
        <div>
          <DialogTitle className="wms-ops-detail-dialog__title">{t(`${G}.detailTitle`)}</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono font-bold text-cyan-500">{plan.importReferenceNo}</span>
            <span className="mx-2">·</span>
            {plan.sourceFileName||'-'}
            <span className="mx-2">·</span>
            {t(`${G}.detailMeta`,{count:plan.totalLineCount,qty:formatProjectNumber(plan.totalExpectedQuantity)})}
          </p>
        </div>
      </OpsDialogHeader>
      <OpsDialogBody>
        {lines.isLoading?<div className="grid min-h-48 place-items-center text-sm text-slate-500"><Loader2 className="mr-2 size-4 animate-spin"/>{t(`${G}.detailLoading`)}</div>
          :lines.isError?<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{lines.error instanceof Error?lines.error.message:t(`${G}.detailFailed`)}</div>
          :!rows.length?<div className="grid min-h-48 place-items-center text-sm text-slate-500">{t(`${G}.detailEmpty`)}</div>
          :<div className="space-y-6">{groupedRows.map(group=><PlanVehicleLinesSection key={group.key} groupKey={group.key} rows={group.rows} lineNoBase={lineNoBase} showHeading={groupedRows.length>1}/>)}</div>}
      </OpsDialogBody>
    </OpsDialogContent>
  </Dialog>;
}

function PlanVehicleLinesSection({groupKey,rows,lineNoBase,showHeading}:{groupKey:string;rows:SteelLineRow[];lineNoBase:number;showHeading:boolean}){
  const {t}=useTranslation('common');
  const isPending=groupKey===PENDING_VEHICLE_KEY;
  const plateNo=isPending?null:groupKey;
  const driverName=rows.find(row=>row.driverName?.trim())?.driverName?.trim()??'';
  return <section className="space-y-3">
    {showHeading&&<header className={cn(
      'rounded-xl border-2 px-4 py-3',
      isPending
        ?'border-amber-500/55 bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]'
        :'border-cyan-500/55 bg-cyan-500/10 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.12)]',
    )}>
      <strong className={cn(
        'block text-sm',
        isPending?'text-amber-800 dark:text-amber-300':'text-cyan-700 dark:text-cyan-300',
      )}>
        {isPending
          ?t(`${G}.detailPendingVehicle`,{defaultValue:'Henüz araç atanmadı'})
          :t(`${G}.detailVehicleGroup`,{plateNo,count:rows.length,defaultValue:`${plateNo} · ${rows.length} levha`})}
      </strong>
      {isPending
        ?<small className="mt-1 block text-amber-700/80 dark:text-amber-200/70">{t(`${G}.detailPendingVehicleHint`,{defaultValue:'Bu levhalar araç girişi bekliyor.'})}</small>
        :<small className="mt-1 block text-slate-500">
          {driverName||t(`${G}.driverNotProvided`,{defaultValue:'Şoför bilgisi girilmedi'})}
        </small>}
    </header>}
    <div className="overflow-auto rounded-xl border-2 border-slate-300/90 bg-[var(--wms-app-panel)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] dark:border-slate-600/90 dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]"><table className="w-full min-w-[1100px] border-collapse text-sm"><thead><tr className="border-b border-[var(--wms-app-border)] bg-[var(--wms-app-panel-muted)] text-left text-xs uppercase tracking-wide text-slate-500">
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.lineNo`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.dCode`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.supplierSerialNo`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.secondarySerialNo`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.stockCode`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.netsisOrderNo`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.expectedQuantity`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.combinedSize`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.materialGrade`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.heatNumber`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.certificateNumber`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.arrivalStatus`)}</th>
      <th className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{t(`${G}.inspectionStatus`)}</th>
    </tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b border-[var(--wms-app-border)] last:border-b-0">
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.lineNo-lineNoBase+1}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 font-mono font-bold text-cyan-500 last:border-r-0">{row.dCode}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.supplierSerialNo}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.secondarySerialNo||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0"><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName||'-'}</small></td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.netsisOrderNo||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 font-bold last:border-r-0">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.combinedSize||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.materialGrade||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.heatNumber||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">{row.certificateNumber||'-'}</td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">
        <OpsStatusBadge tone={inferPlanDetailArrivalTone(row.arrivalStatus)}>{localizeEnumValue(row.arrivalStatus)}</OpsStatusBadge>
      </td>
      <td className="border-r border-[var(--wms-app-border)] p-3 last:border-r-0">
        <OpsStatusBadge tone={inferPlanDetailInspectionTone(row.inspectionStatus)}>{localizeEnumValue(row.inspectionStatus)}</OpsStatusBadge>
      </td>
    </tr>)}</tbody></table></div>
  </section>;
}
