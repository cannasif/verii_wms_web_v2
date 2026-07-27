import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns} from '@/components/shared/GridSystemColumns';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelPlanRow} from '../types/steel-receipt.types';

const G='dataGrid.sacReceiptPlans';

export function SteelReceiptPlansPage(){
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const columns=useMemo<GridColumn<SteelPlanRow>[]>(()=>[
    ...systemColumns<SteelPlanRow>(),
    {key:'importReferenceNo',label:t(`${G}.importReferenceNo`),render:r=><span className="font-mono font-bold text-cyan-500">{r.importReferenceNo}</span>},
    {key:'vehiclePlateNo',label:t(`${G}.vehicleDriver`),render:r=><>{r.vehiclePlateNo?<strong>{r.vehiclePlateNo}</strong>:<span>-</span>}<small className="block text-slate-500">{r.driverName||t(`${G}.vehicleNotLinked`)}</small></>},
    {key:'supplierCode',label:t(`${G}.supplierCode`),render:r=>r.supplierCode},
    {key:'supplierName',label:t(`${G}.supplierName`),render:r=>r.supplierName},
    {key:'warehouseCode',label:t(`${G}.warehouseCode`),render:r=>r.warehouseCode},
    {key:'warehouseName',label:t(`${G}.warehouseName`),render:r=>r.warehouseName},
    {key:'status',label:t(`${G}.status`),render:r=><Status value={r.status}/>},
    {key:'totalLineCount',label:t(`${G}.totalLineCount`),render:r=>r.totalLineCount},
    {key:'totalExpectedQuantity',label:t(`${G}.totalExpectedQuantity`),render:r=>formatProjectNumber(r.totalExpectedQuantity)},
    {key:'importedAtUtc',label:t(`${G}.importedAtUtc`),render:r=>formatProjectDateTime(r.importedAtUtc)},
  ],[t,gridLanguage]);
  return <div data-no-auto-localize="true"><AdvancedDataGrid pageKey="steel-receipt-plans" title={t(`${G}.title`)} description={t(`${G}.description`)} columns={columns} fetchPage={steelReceiptApi.plansPaged}/></div>;
}

function Status({value}:{value:string}){return <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-500">{localizeEnumValue(value)}</span>}
