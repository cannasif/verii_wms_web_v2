import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Eye,Loader2} from 'lucide-react';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {requiredActionColumn,systemColumns} from '@/components/shared/GridSystemColumns';
import {OpsDialogBody,OpsDialogContent,OpsDialogHeader} from '@/components/shared/OpsDialogShell';
import {OpsStatusBadge,inferOpsStatusTone} from '@/components/shared/OpsStatusBadge';
import {Dialog,DialogTitle} from '@/components/ui/dialog';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelLineRow,SteelPlanRow} from '../types/steel-receipt.types';

const G='dataGrid.sacReceiptPlans';

export function SteelReceiptPlansPage(){
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const [plan,setPlan]=useState<SteelPlanRow|null>(null);
  const columns=useMemo<GridColumn<SteelPlanRow>[]>(()=>[
    ...systemColumns<SteelPlanRow>(),
    {key:'importReferenceNo',label:t(`${G}.importReferenceNo`),render:r=><span className="font-mono font-bold text-cyan-500">{r.importReferenceNo}</span>},
    {key:'vehiclePlateNo',label:t(`${G}.vehicleDriver`),render:r=><>{r.vehiclePlateNo?<strong>{r.vehiclePlateNo}</strong>:<span>-</span>}<small className="block text-slate-500">{r.driverName||t(`${G}.vehicleNotLinked`)}</small></>},
    {key:'supplierCode',label:t(`${G}.supplierCode`),render:r=>r.supplierCode},
    {key:'supplierName',label:t(`${G}.supplierName`),render:r=>r.supplierName},
    {key:'warehouseCode',label:t(`${G}.warehouseCode`),render:r=>r.warehouseCode},
    {key:'warehouseName',label:t(`${G}.warehouseName`),render:r=>r.warehouseName},
    {key:'status',label:t(`${G}.status`),render:r=><OpsStatusBadge tone={inferOpsStatusTone(r.status)}>{localizeEnumValue(r.status)}</OpsStatusBadge>},
    {key:'totalLineCount',label:t(`${G}.totalLineCount`),render:r=>r.totalLineCount},
    {key:'totalExpectedQuantity',label:t(`${G}.totalExpectedQuantity`),render:r=>formatProjectNumber(r.totalExpectedQuantity)},
    {key:'importedAtUtc',label:t(`${G}.importedAtUtc`),render:r=>formatProjectDateTime(r.importedAtUtc)},
    {key:'actions',label:t(`${G}.actions`),...requiredActionColumn,render:r=><button type="button" onClick={()=>setPlan(r)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-bold text-cyan-500"><Eye className="size-3.5"/>{t(`${G}.viewDetails`)}</button>},
  // i18n language changes invalidate `t`; keep columns in sync with resolved UI language.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gridLanguage forces column label refresh
  ],[t,gridLanguage]);
  return <div data-no-auto-localize="true">
    <AdvancedDataGrid pageKey="steel-receipt-plans" title={t(`${G}.title`)} description={t(`${G}.description`)} columns={columns} fetchPage={steelReceiptApi.plansPaged} onRowDoubleClick={setPlan}/>
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
          :<div className="overflow-auto rounded-xl border"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b bg-[var(--wms-app-panel-muted)] text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="p-3">{t(`${G}.lineNo`)}</th>
            <th className="p-3">{t(`${G}.dCode`)}</th>
            <th className="p-3">{t(`${G}.supplierSerialNo`)}</th>
            <th className="p-3">{t(`${G}.secondarySerialNo`)}</th>
            <th className="p-3">{t(`${G}.stockCode`)}</th>
            <th className="p-3">{t(`${G}.netsisOrderNo`)}</th>
            <th className="p-3">{t(`${G}.expectedQuantity`)}</th>
            <th className="p-3">{t(`${G}.combinedSize`)}</th>
            <th className="p-3">{t(`${G}.materialGrade`)}</th>
            <th className="p-3">{t(`${G}.heatNumber`)}</th>
            <th className="p-3">{t(`${G}.certificateNumber`)}</th>
            <th className="p-3">{t(`${G}.arrivalStatus`)}</th>
            <th className="p-3">{t(`${G}.inspectionStatus`)}</th>
          </tr></thead><tbody>{rows.map((row:SteelLineRow)=><tr key={row.id} className="border-b last:border-0">
            <td className="p-3">{row.lineNo}</td>
            <td className="p-3 font-mono font-bold text-cyan-500">{row.dCode}</td>
            <td className="p-3">{row.supplierSerialNo}</td>
            <td className="p-3">{row.secondarySerialNo||'-'}</td>
            <td className="p-3"><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName||'-'}</small></td>
            <td className="p-3">{row.netsisOrderNo||'-'}</td>
            <td className="p-3 font-bold">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
            <td className="p-3">{row.combinedSize||'-'}</td>
            <td className="p-3">{row.materialGrade||'-'}</td>
            <td className="p-3">{row.heatNumber||'-'}</td>
            <td className="p-3">{row.certificateNumber||'-'}</td>
            <td className="p-3">{localizeEnumValue(row.arrivalStatus)}</td>
            <td className="p-3">{localizeEnumValue(row.inspectionStatus)}</td>
          </tr>)}</tbody></table></div>}
      </OpsDialogBody>
    </OpsDialogContent>
  </Dialog>;
}
