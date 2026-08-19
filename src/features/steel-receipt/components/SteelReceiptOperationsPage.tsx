import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRight,CheckCircle2,ExternalLink,FileText,Globe2,Layers3,Loader2,Printer,Search} from 'lucide-react';
import {toast} from 'sonner';
import {AppDateInput} from '@/components/shared/AppInput';
import {AppDropdown} from '@/components/shared/AppDropdown';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {OperationDraftRestoreDialog} from '@/features/operation-drafts/OperationDraftRestoreDialog';
import {useOperationDraft} from '@/features/operation-drafts/useOperationDraft';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {locationsApi} from '@/features/locations/api/locations.api';
import {printReceiptLabels} from '@/features/goods-receipt-v2/utils/goods-receipt-label-output';
import {completeGoodsReceiptDocumentNo,isValidGoodsReceiptDocumentNo,normalizeGoodsReceiptDocumentNo} from '@/features/goods-receipt-v2/utils/goods-receipt-document-reference';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {useAuthStore} from '@/stores/auth-store';
import {StockIdentityCell} from '@/components/shared/StockIdentityCell';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {ConvertResult,SteelLineRow,SteelPendingPlacementSource,SteelPendingReceiptSource,SteelReceiptSource,SteelReceiptTradeType} from '../types/steel-receipt.types';
import {
  fetchPlacementImportSourcesPage,
  filterPlacementLinesBySearch,
  loadPlacementSource,
} from '../utils/steel-receipt-placement';
import {
  hasPendingPlacementLines,
  hasSteelReceiptPlacementDraft,
  isPlacementSourceStillPending,
  restoreSelectedLine,
  type LoadPlacementSourceOptions,
  type SteelReceiptPlacementDraft,
} from '../utils/steel-receipt-placement-draft';
import {
  hasPendingReceiptLines,
  hasSteelReceiptReceiptDraft,
  isReceiptSourceStillPending,
  isSteelReceiptTradeSelectionValid,
  restoreSelectedLines,
  type LoadReceiptSourceOptions,
  type SteelReceiptReceiptDraft,
} from '../utils/steel-receipt-receipt-draft';
import {SteelProcessHeader} from './SteelProcessHeader';

const O='steelGoodReceiptAcceptance.operations';
const today=()=>new Date().toLocaleDateString('en-CA');
export function SteelReceiptOperationsPage({initialTab='receipt'}:{initialTab?:'receipt'|'placement'}){
  const {t}=useTranslation('common');
  const isReceipt=initialTab==='receipt';
  return <div className="space-y-5" data-no-auto-localize="true">
    <SteelProcessHeader currentStep={initialTab} title={t(isReceipt?`${O}.receiptTitle`:`${O}.placementTitle`)} description={t(isReceipt?`${O}.receiptDescription`:`${O}.placementDescription`)}/>
    {isReceipt?<ReceiptPanel/>:<PlacementPanel/>}
  </div>;
}

function ReceiptPanel(){
  const {t}=useTranslation('common');
  const R=`${O}.receipt`;
  const branchCode=useAuthStore(state=>state.branch?.code??'0');
  const userId=useAuthStore(state=>state.user?.id);
  const [reference,setReference]=useState('');
  const [selectedSourceReference,setSelectedSourceReference]=useState<string|null>(null);
  const [source,setSource]=useState<SteelReceiptSource|null>(null);
  const [selected,setSelected]=useState<Record<number,SteelLineRow>>({});
  const [note,setNote]=useState('');
  const [isElectronic,setIsElectronic]=useState(true);
  const [receiptNo,setReceiptNo]=useState('');
  const [documentDate,setDocumentDate]=useState(today);
  const [tradeType,setTradeType]=useState<SteelReceiptTradeType>('Domestic');
  const [importFileNumber,setImportFileNumber]=useState('');
  const [lastResult,setLastResult]=useState<ConvertResult|null>(null);
  const [printing,setPrinting]=useState(false);
  const [busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState(false);
  const [restoreDialogOpen,setRestoreDialogOpen]=useState(false);
  const idempotencyKey=useRef(crypto.randomUUID());
  const clearDraftRef=useRef<() => Promise<void>>(async()=>{});
  const loadSourceRef=useRef<(value?:string,options?:LoadReceiptSourceOptions)=>Promise<SteelReceiptSource|null>>(async()=>null);
  const selectedRows=Object.values(selected);
  const total=selectedRows.reduce((sum,row)=>sum+row.approvedQuantity,0);
  const approvedUnit=(()=>{
    const units=[...new Set(selectedRows.map(row=>row.unitCode?.trim()).filter(Boolean))];
    return units.length===1?units[0]:'';
  })();
  const totalApprovedDisplay=approvedUnit?`${formatProjectNumber(total)} ${approvedUnit}`:formatProjectNumber(total);
  const receiptNoValid=isValidGoodsReceiptDocumentNo(receiptNo);
  const openImportFiles=useQuery({
    queryKey:['netsis-import-open-files'],
    queryFn:steelReceiptApi.openImportFiles,
    enabled:tradeType==='Foreign',
    staleTime:30_000,
  });
  const importFileIsOpen=tradeType==='Domestic'||Boolean(openImportFiles.data?.some(
    file=>file.fileNumber.trim().toUpperCase()===importFileNumber.trim().toUpperCase(),
  ));
  const tradeSelectionValid=isSteelReceiptTradeSelectionValid(tradeType,importFileNumber)&&importFileIsOpen;
  const eligible=(row:SteelLineRow)=>(
    (row.inspectionStatus==='Approved'||row.inspectionStatus==='PartiallyApproved')
    &&row.approvedQuantity>0
    &&row.conversionStatus==='NotCreated'
  );
  const eligibilityText=(row:SteelLineRow)=>{
    if(row.conversionStatus!=='NotCreated')
      return row.erpIntegrationStatus
        ?t(`${R}.receiptCreatedErp`,{status:localizeEnumValue(row.erpIntegrationStatus)})
        :t(`${R}.receiptCreated`);
    if(row.inspectionStatus!=='Approved'&&row.inspectionStatus!=='PartiallyApproved')
      return t(`${R}.awaitingApproval`,{status:localizeEnumValue(row.inspectionStatus)});
    if(row.approvedQuantity<=0)return t(`${R}.noApprovedQty`);
    return t(`${R}.readyForDirectReceipt`);
  };
  const eligibilityBadgeClass=(row:SteelLineRow)=>{
    if(eligible(row))return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
    if(row.conversionStatus!=='NotCreated'&&(row.erpIntegrationStatus==='Failed'||row.erpIntegrationStatus==='Cancelled'))
      return 'border-red-500/30 bg-red-500/10 text-red-600';
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
  };
  const pendingDescription=(pending:number,total:number,waybillNo?:string|null)=>
    t(`${R}.pendingOptionDescription`,{
      waybillPrefix:waybillNo?.trim()?t(`${R}.waybillPrefix`,{no:waybillNo.trim()}):'',
      pending,
      total,
    });
  const toggle=(row:SteelLineRow)=>setSelected(current=>{
    if(!eligible(row))return current;
    if(current[row.id]){const next={...current};delete next[row.id];return next}
    return {...current,[row.id]:row};
  });
  const loadSource=async(value=reference,options:LoadReceiptSourceOptions={}):Promise<SteelReceiptSource|null>=>{
    const normalized=value.trim();
    if(!normalized){
      if(!options.silent)toast.error(t(`${R}.referenceRequired`));
      return null;
    }
    setBusy(true);
    if(!options.preserveResult)setLastResult(null);
    try{
      const result=await steelReceiptApi.receiptSource(normalized);
      setSource(result);
      setSelectedSourceReference(result.importReferenceNo);
      setReference(result.importReferenceNo);
      setSelected(options.restoreSelectedIds?.length
        ?restoreSelectedLines(result.lines,options.restoreSelectedIds,eligible)
        :{});
      if(!options.keepWaybillFields){
        const sourceReceipt=(result.waybillNo??'').trim();
        setReceiptNo(completeGoodsReceiptDocumentNo(sourceReceipt));
        setDocumentDate(result.waybillDate?.slice(0,10)||today());
      }
      if(!hasPendingReceiptLines(result))void clearDraftRef.current();
      if(!options.silent)toast.success(t(`${R}.sourceLoaded`,{reference:result.importReferenceNo}));
      return result;
    }catch(error){
      setSource(null);
      setSelectedSourceReference(null);
      setSelected({});
      if(!options.keepWaybillFields)setReceiptNo('');
      if(options.silent)void clearDraftRef.current();
      if(!options.silent)toast.error(error instanceof Error?error.message:t(`${R}.sourceLoadFailed`));
      return null;
    }finally{setBusy(false)}
  };
  loadSourceRef.current=loadSource;
  const restoreDraftPayload=useCallback((draft:SteelReceiptReceiptDraft)=>{
    setRestoring(true);
    setReference(draft.reference);
    setSelectedSourceReference(draft.importReferenceNo);
    setNote(draft.note);
    setIsElectronic(draft.isElectronic);
    setReceiptNo(draft.receiptNo);
    setDocumentDate(draft.documentDate);
    setTradeType(draft.tradeType??'Domestic');
    setImportFileNumber(draft.importFileNumber??'');
    void loadSourceRef.current(draft.importReferenceNo,{
      silent:true,
      preserveResult:true,
      restoreSelectedIds:draft.selectedLineIds,
      keepWaybillFields:true,
    }).finally(()=>setRestoring(false));
  },[]);
  const draftPayload=useMemo<SteelReceiptReceiptDraft>(()=>({
    importReferenceNo:source?.importReferenceNo??selectedSourceReference??'',
    reference,
    selectedLineIds:Object.keys(selected).map(Number),
    note,
    isElectronic,
    receiptNo,
    documentDate,
    tradeType,
    importFileNumber,
  }),[documentDate,importFileNumber,isElectronic,note,receiptNo,reference,selected,selectedSourceReference,source?.importReferenceNo,tradeType]);
  const operationDraft=useOperationDraft({
    operationType:'steel-receipt-direct',
    userId,
    branchCode,
    payload:draftPayload,
    isMeaningful:hasSteelReceiptReceiptDraft,
    onRestore:restoreDraftPayload,
    enabled:!busy&&!lastResult&&!restoring,
  });
  const {pendingDraft,discardDraft,clearDraft,restoreDraft}=operationDraft;
  clearDraftRef.current=clearDraft;
  useEffect(()=>{
    if(!pendingDraft||!operationDraft.restoreDialogOpen){
      setRestoreDialogOpen(false);
      return;
    }
    let active=true;
    void (async()=>{
      const stillPending=await isReceiptSourceStillPending(branchCode,pendingDraft.payload.importReferenceNo);
      if(!active)return;
      if(!stillPending){
        await discardDraft();
        setRestoreDialogOpen(false);
        return;
      }
      setRestoreDialogOpen(true);
    })();
    return ()=>{active=false};
  },[branchCode,discardDraft,operationDraft.restoreDialogOpen,pendingDraft]);
  const convert=async()=>{
    if(!selectedRows.length||!source)return;
    if(!receiptNoValid||!documentDate){toast.error(isElectronic?t(`${R}.waybillValidationElectronic`):t(`${R}.waybillValidationPaper`));return}
    if(!tradeSelectionValid){toast.error(t(`${R}.importFileRequired`));return}
    setBusy(true);
    try{
      const result=await steelReceiptApi.convert(source.planId,selectedRows.map(x=>x.id),{
        idempotencyKey:idempotencyKey.current,mode:'Direct',documentDate,
        waybillNo:isElectronic?undefined:receiptNo,electronicWaybillNo:isElectronic?receiptNo:undefined,
        tradeType,importFileNumber:tradeType==='Foreign'?importFileNumber:undefined,
        description:note,priority:1,assignedUserIds:[],assignToAllActiveUsers:false,
      });
      toast.success(t(`${R}.convertSuccess`,{documentNo:result.documentNo,count:result.convertedLineCount}));
      setLastResult(result);idempotencyKey.current=crypto.randomUUID();
      setSelected({});setNote('');
      const refreshed=await loadSource(source.importReferenceNo,{preserveResult:true,silent:true});
      if(refreshed&&!hasPendingReceiptLines(refreshed))void clearDraft();
    }catch(e){toast.error(e instanceof Error?e.message:t(`${R}.convertFailed`))}finally{setBusy(false)}
  };
  const printLabels=async()=>{
    if(!lastResult?.generatedLabelIds?.length)return;
    setPrinting(true);
    try{
      const wanted=new Set(lastResult.generatedLabelIds??[]);
      const labels=(await goodsReceiptV2Api.receiptLabels(lastResult.goodsReceiptId)).filter(label=>wanted.has(label.id));
      if(!labels.length)throw new Error(t(`${R}.noPrintableLabels`));
      printReceiptLabels(labels,t(`${R}.printTitle`,{documentNo:lastResult.documentNo}));
      const unprinted=labels.filter(label=>label.printCount===0).map(label=>label.id);
      if(unprinted.length)await goodsReceiptV2Api.markLabelsPrinted(unprinted);
    }catch(error){toast.error(error instanceof Error?error.message:t(`${R}.printFailed`))}
    finally{setPrinting(false)}
  };
  const selectable=source?.lines.filter(eligible)??[];
  const allSelectableSelected=selectable.length>0&&selectable.every(row=>selected[row.id]);
  const lastConversionWaybill=useMemo(
    ()=>resolveLastConversionWaybill(source?.lines??[]),
    [source?.lines],
  );
  return <div className="space-y-5">
    <OperationDraftRestoreDialog
      open={restoreDialogOpen&&Boolean(pendingDraft)}
      operationName={t('operationNames.steelReceiptDirect')}
      updatedAt={pendingDraft?.updatedAt}
      onRestore={()=>{
        restoreDraft();
        setRestoreDialogOpen(false);
      }}
      onDiscard={async()=>{
        await discardDraft();
        setRestoreDialogOpen(false);
      }}
    />
    {(busy||restoring)&&!source&&<div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin"/>{t(`${R}.restoringDraft`)}</div>}
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <SectionHead title={t(`${R}.sourceTitle`)} text={t(`${R}.sourceText`)}/>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label={t(`${R}.pendingImportLabel`)}>
          <PagedAppDropdown<SteelPendingReceiptSource>
            queryKey={['steel-pending-receipt-sources',branchCode]}
            fetchPage={request=>steelReceiptApi.pendingReceiptSourcesPaged({
              pageNumber:request.pageNumber,
              pageSize:request.pageSize,
              search:request.search??null,
              searchFields:request.searchFields,
              sortBy:request.sortBy??'importedAtUtc',
              sortDirection:request.sortDirection??'desc',
              filterLogic:'and',
              filters:[{column:'branchCode',operator:'equals',value:branchCode}],
            })}
            toOption={item=>({
              value:item.importReferenceNo,
              label:`${item.importReferenceNo} · ${item.supplierCode}`,
              description:pendingDescription(item.pendingLineCount,item.totalLineCount,item.waybillNo),
            })}
            value={selectedSourceReference}
            onValueChange={value=>{setSelectedSourceReference(value);setReference(value);void loadSource(value)}}
            selectedOption={source?{
              value:source.importReferenceNo,
              label:`${source.importReferenceNo} · ${source.supplierCode}`,
              description:pendingDescription(source.lines.filter(line=>line.conversionStatus==='NotCreated').length,source.totalLineCount,source.waybillNo),
            }:undefined}
            searchFields={['importReferenceNo','waybillNo','supplierCode','supplierName']}
            sortBy="importedAtUtc"
            sortDirection="desc"
            searchable
            minSearchLength={0}
            placeholder={t(`${R}.pendingImportPlaceholder`)}
            emptyText={t(`${R}.pendingImportEmpty`)}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Field label={t(`${R}.referenceLabel`)}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-500"/><input className="input !pl-10 font-mono" value={reference} onChange={event=>setReference(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void loadSource()}}} placeholder={t(`${R}.referencePlaceholder`)}/></div>
        </Field>
        <button type="button" disabled={busy||!reference.trim()} onClick={()=>void loadSource()} className="self-end rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:<><Search className="mr-2 inline size-4"/>{t(`${R}.fetchSheetsButton`)}</>}</button>
      </div>
      {source&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t(`${R}.metricImportRef`)} value={source.importReferenceNo}/><Metric label={t(`${R}.metricSourceFile`)} value={source.sourceFileName}/><Metric label={t(`${R}.metricSupplier`)} value={`${source.supplierCode} · ${source.supplierName}`}/><Metric label={t(`${R}.metricTotalSheets`)} value={String(source.totalLineCount)}/></div>}
    </section>

    {source&&<div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.7fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div><h2 className="font-black">{t(`${R}.linkedSheetsTitle`)}</h2><p className="text-xs text-slate-500">{t(`${R}.linkedSheetsSummary`,{total:source.lines.length,ready:selectable.length})}</p></div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={allSelectableSelected} disabled={!selectable.length} onChange={()=>setSelected(allSelectableSelected?{}:Object.fromEntries(selectable.map(row=>[row.id,row])))} className="size-4 accent-cyan-500"/>{t(`${R}.selectAllEligible`)}</label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-black/[.03] text-xs uppercase text-slate-500 dark:bg-white/[.03]"><tr><th className="p-3">{t(`${R}.select`)}</th><th className="p-3">{t(`${R}.dCodeSerial`)}</th><th className="p-3">{t(`${R}.stock`)}</th><th className="p-3">{t(`${R}.expectedQty`)}</th><th className="p-3">{t(`${R}.approvedQty`)}</th><th className="p-3">{t(`${R}.approvalErpStatus`)}</th><th className="p-3">{t(`${R}.conversionDate`)}</th><th className="p-3">{t(`${R}.waybillNo`)}</th><th className="p-3">{t('actions')}</th></tr></thead>
          <tbody>{source.lines.map(row=>{const canSelect=eligible(row);const hasGoodsReceipt=row.conversionStatus!=='NotCreated'&&!!row.goodsReceiptId;return <tr key={row.id} className={`border-t ${selected[row.id]?'bg-cyan-500/10':!canSelect?'opacity-65':''}`}>
            <td className="p-3"><input type="checkbox" checked={Boolean(selected[row.id])} disabled={!canSelect} onChange={()=>toggle(row)} className="size-4 accent-cyan-500" aria-label={t(`${R}.selectRowAria`,{dCode:row.dCode})}/></td>
            <td className="p-3"><strong className="font-mono text-cyan-500">{row.dCode}</strong><small className="block text-slate-500">{row.supplierSerialNo}</small></td>
            <td className="p-3"><StockIdentityCell stockCode={row.stockCode} stockName={row.stockName} branchCode={branchCode} nameClassName="block text-slate-500" /></td>
            <td className="p-3 font-mono">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
            <td className="p-3 font-mono font-bold">{formatProjectNumber(row.approvedQuantity)} {row.unitCode}</td>
            <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${eligibilityBadgeClass(row)}`}>{eligibilityText(row)}</span></td>
            <td className="p-3 whitespace-nowrap">{row.convertedAtUtc?formatProjectDateTime(row.convertedAtUtc):'—'}</td>
            <td className="p-3 font-mono">{row.conversionWaybillNo||'—'}</td>
            <td className="p-3 whitespace-nowrap">{hasGoodsReceipt
              ?<Link
                to="/warehouse/goods-receipts/list"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 px-2.5 py-1.5 text-xs font-bold text-cyan-600 transition hover:bg-cyan-500/10"
                title={t(`${R}.openGoodsReceiptListAria`,{documentNo:row.goodsReceiptNo??row.goodsReceiptId})}
              >
                <ExternalLink className="size-3.5 shrink-0"/>
                {t(`${R}.openGoodsReceiptList`)}
              </Link>
              :'—'}
            </td>
          </tr>})}</tbody>
        </table></div>
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><SectionHead title={t(`${R}.directReceiptTitle`)} text={t(`${R}.directReceiptText`)}/>
      <Metric label={t(`${R}.selectedSheets`)} value={String(selectedRows.length)}/><Metric label={t(`${R}.totalApprovedQty`)} value={totalApprovedDisplay}/><Metric label={t(`${R}.sacPlan`)} value={source.importReferenceNo}/><Metric label={t(`${R}.lastConversionWaybill`)} value={lastConversionWaybill??'—'} valueClassName="font-mono"/>
      <section className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <div className="flex items-start gap-2"><Globe2 className="mt-0.5 size-5 text-violet-500"/><div><strong className="text-sm">{t(`${R}.tradeTypeLabel`)}</strong><p className="text-xs text-slate-500">{t(`${R}.tradeTypeText`)}</p></div></div>
        <AppDropdown<SteelReceiptTradeType>
          value={tradeType}
          onValueChange={value=>{setTradeType(value);setImportFileNumber('')}}
          options={[
            {value:'Domestic',label:t(`${R}.tradeTypeDomestic`)},
            {value:'Foreign',label:t(`${R}.tradeTypeForeign`)},
          ]}
          ariaLabel={t(`${R}.tradeTypeLabel`)}
          testId="steel-receipt-trade-type"
        />
        {tradeType==='Foreign'&&<Field label={t(`${R}.importFileLabel`)}>
          <AppDropdown
            value={importFileNumber}
            onValueChange={setImportFileNumber}
            options={(openImportFiles.data??[]).map(file=>({
              value:file.fileNumber,
              label:`${file.fileNumber} · ${file.customerName??file.customerCode}`,
              description:file.deliveryCustomerName
                ?`${file.customerCode} → ${file.deliveryCustomerName} (${file.deliveryCustomerCode??'—'})`
                :file.customerCode,
            }))}
            searchable
            isLoading={openImportFiles.isLoading}
            disabled={openImportFiles.isLoading}
            placeholder={t(`${R}.importFilePlaceholder`)}
            emptyText={t(`${R}.importFileEmpty`)}
            searchPlaceholder={t(`${R}.importFileSearchPlaceholder`)}
            errorText={openImportFiles.isError?t(`${R}.importFileLoadFailed`):undefined}
            onRetry={()=>openImportFiles.refetch()}
            ariaLabel={t(`${R}.importFileLabel`)}
            testId="steel-receipt-import-file"
          />
          {importFileNumber&&!importFileIsOpen&&!openImportFiles.isLoading&&!openImportFiles.isError&&<p className="text-xs font-semibold text-red-600">{t(`${R}.importFileClosed`)}</p>}
        </Field>}
      </section>
      <section className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
        <div className="flex items-start gap-2"><FileText className="mt-0.5 size-5 text-cyan-500"/><div><strong className="text-sm">{t(`${R}.waybillInfoTitle`)}</strong><p className="text-xs text-slate-500">{t(`${R}.waybillInfoText`)}</p></div></div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-[var(--wms-app-panel)] p-3"><input type="checkbox" checked={isElectronic} onChange={event=>setIsElectronic(event.target.checked)} className="size-4 accent-cyan-500"/><span className="text-sm font-bold">{t(`${R}.electronicWaybill`)}</span></label>
        <Field label={isElectronic?t(`${R}.gibWaybillNo`):t(`${R}.waybillNo`)}><div className="relative"><input className={`input pr-16 font-mono ${receiptNo&&!receiptNoValid?'!border-red-500':receiptNoValid?'!border-emerald-500':''}`} inputMode="text" maxLength={15} value={receiptNo} onChange={event=>setReceiptNo(normalizeGoodsReceiptDocumentNo(event.target.value))} onBlur={()=>setReceiptNo(completeGoodsReceiptDocumentNo(receiptNo))} placeholder={isElectronic?'GIB2026AB000000':'IRS202600000001'}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{receiptNo.length}/15</span></div></Field>
        <Field label={t(`${R}.waybillDate`)}><AppDateInput value={documentDate} onChange={event=>setDocumentDate(event.target.value)}/></Field>
      </section>
      <Field label={t(`${R}.orderNote`)}><textarea className="input min-h-24" value={note} onChange={e=>setNote(e.target.value)} placeholder={t(`${R}.orderNotePlaceholder`)}/></Field>
      <button disabled={busy||!selectedRows.length||!receiptNoValid||!documentDate||!tradeSelectionValid} onClick={()=>void convert()} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="mr-2 inline size-4 animate-spin"/>:<ArrowRight className="mr-2 inline size-4"/>}{t(`${R}.completeDirectReceipt`)}</button>
      {lastResult&&<section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-5 text-emerald-500"/><div><strong className="block">{lastResult.documentNo}</strong><small className="text-slate-500">{t(`${R}.receiptCompletedNote`)}</small></div></div>{(lastResult.generatedLabelIds?.length??0)>0&&<button type="button" disabled={printing} onClick={()=>void printLabels()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 px-3 py-2 text-sm font-bold text-violet-500 disabled:opacity-40">{printing?<Loader2 className="size-4 animate-spin"/>:<Printer className="size-4"/>}{t(`${R}.printReceiptLabels`)}</button>}</section>}
    </aside>
    </div>}
  </div>;
}

function resolveLastConversionWaybill(lines:SteelLineRow[]):string|null{
  let latest:SteelLineRow|null=null;
  for(const row of lines){
    const waybill=row.conversionWaybillNo?.trim();
    if(!waybill||!row.convertedAtUtc)continue;
    if(!latest||row.convertedAtUtc>latest.convertedAtUtc!)latest=row;
  }
  return latest?.conversionWaybillNo?.trim()??null;
}
function resolveTargetWarehouseId(row:SteelLineRow):number{
  const source=row as SteelLineRow&{TargetWarehouseId?:number;warehouseId?:number;WarehouseId?:number;WarehouseCode?:number;warehouseCode?:number};
  return row.targetWarehouseId||source.TargetWarehouseId||source.warehouseId||source.WarehouseId||0;
}
function resolveWarehouseCode(row:SteelLineRow):number|undefined{
  const source=row as SteelLineRow&{WarehouseCode?:number};
  return row.warehouseCode??source.WarehouseCode;
}
function resolveReceivingLocationId(row:SteelLineRow):number{
  const source=row as SteelLineRow&{ReceivingLocationId?:number};
  return row.receivingLocationId||source.ReceivingLocationId||0;
}
function resolveReceivingLocationLabel(row:SteelLineRow):string|null{
  const source=row as SteelLineRow&{
    receivingLocationCode?:string;receivingLocationName?:string;
    ReceivingLocationCode?:string;ReceivingLocationName?:string;
  };
  const code=source.receivingLocationCode??source.ReceivingLocationCode;
  const name=source.receivingLocationName??source.ReceivingLocationName;
  if(code&&name)return `${code} · ${name}`;
  if(code)return code;
  return null;
}
function PlacementPanel(){
  const {t}=useTranslation('common');
  const P=`${O}.placement`;
  const R=`${O}.receipt`;
  const branchCode=useAuthStore(state=>state.branch?.code??'0');
  const userId=useAuthStore(state=>state.user?.id);
  const cache=useQueryClient();
  const [reference,setReference]=useState('');
  const [selectedSourceReference,setSelectedSourceReference]=useState<string|null>(null);
  const [source,setSource]=useState<SteelReceiptSource|null>(null);
  const [pendingLines,setPendingLines]=useState<SteelLineRow[]>([]);
  const [input,setInput]=useState('');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<SteelLineRow|null>(null);
  const [location,setLocation]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState(false);
  const [restoreDialogOpen,setRestoreDialogOpen]=useState(false);
  const clearDraftRef=useRef<() => Promise<void>>(async()=>{});
  const loadSourceRef=useRef<(value?:string,options?:LoadPlacementSourceOptions)=>Promise<boolean>>(async()=>false);
  const importOptionDescription=(pendingLineCount:number,supplierCode?:string)=>
    t(`${P}.importOptionDescription`,{
      total:pendingLineCount,
      supplier:supplierCode?.trim()||'—',
    });
  const loadSource=async(value=reference,options:LoadPlacementSourceOptions={}):Promise<boolean>=>{
    const normalized=value.trim();
    if(!normalized){
      if(!options.silent)toast.error(t(`${R}.referenceRequired`));
      return false;
    }
    setBusy(true);
    try{
      const result=await loadPlacementSource(normalized);
      setSource(result.source);
      setPendingLines(result.pendingLines);
      setSelectedSourceReference(result.source.importReferenceNo);
      setReference(result.source.importReferenceNo);
      const restoredLine=options.restoreSelectedLineId!=null
        ?restoreSelectedLine(result.pendingLines,options.restoreSelectedLineId)
        :null;
      setSelected(current=>{
        if(options.restoreSelectedLineId!=null)return restoredLine;
        return current&&result.pendingLines.some(line=>line.id===current.id)?current:null;
      });
      if(options.restoreSelectedLineId!=null){
        setLocation(restoredLine&&options.restoreLocationId?options.restoreLocationId:null);
      }
      if(options.restoreSearch!=null){
        setSearch(options.restoreSearch);
        setInput(options.restoreSearch);
      }
      if(!hasPendingPlacementLines(result.pendingLines))void clearDraftRef.current();
      if(!options.silent)toast.success(t(`${R}.sourceLoaded`,{reference:result.source.importReferenceNo}));
      return true;
    }catch(error){
      setSource(null);
      setPendingLines([]);
      setSelectedSourceReference(null);
      setSelected(null);
      setLocation(null);
      if(options.silent)void clearDraftRef.current();
      if(!options.silent)toast.error(error instanceof Error?error.message:t(`${R}.sourceLoadFailed`));
      return false;
    }finally{setBusy(false)}
  };
  loadSourceRef.current=loadSource;
  const restoreDraftPayload=useCallback((draft:SteelReceiptPlacementDraft)=>{
    setRestoring(true);
    setReference(draft.reference);
    setSelectedSourceReference(draft.importReferenceNo);
    setInput(draft.search);
    setSearch(draft.search);
    void loadSourceRef.current(draft.importReferenceNo,{
      silent:true,
      restoreSelectedLineId:draft.selectedLineId,
      restoreLocationId:draft.locationId,
      restoreSearch:draft.search,
    }).finally(()=>setRestoring(false));
  },[]);
  const draftPayload=useMemo<SteelReceiptPlacementDraft>(()=>({
    importReferenceNo:source?.importReferenceNo??selectedSourceReference??'',
    reference,
    selectedLineId:selected?.id??null,
    locationId:location,
    search,
  }),[location,reference,search,selected,selectedSourceReference,source?.importReferenceNo]);
  const operationDraft=useOperationDraft({
    operationType:'steel-receipt-placement',
    userId,
    branchCode,
    payload:draftPayload,
    isMeaningful:hasSteelReceiptPlacementDraft,
    onRestore:restoreDraftPayload,
    enabled:!busy&&!restoring,
  });
  const {pendingDraft,discardDraft,clearDraft,restoreDraft}=operationDraft;
  clearDraftRef.current=clearDraft;
  useEffect(()=>{
    if(!pendingDraft||!operationDraft.restoreDialogOpen){
      setRestoreDialogOpen(false);
      return;
    }
    let active=true;
    void (async()=>{
      const stillPending=await isPlacementSourceStillPending(pendingDraft.payload.importReferenceNo);
      if(!active)return;
      if(!stillPending){
        await discardDraft();
        setRestoreDialogOpen(false);
        return;
      }
      setRestoreDialogOpen(true);
    })();
    return ()=>{active=false};
  },[discardDraft,operationDraft.restoreDialogOpen,pendingDraft]);
  const visibleLines=useMemo(
    ()=>filterPlacementLinesBySearch(pendingLines,search),
    [pendingLines,search],
  );
  const selectedWarehouseId=selected?resolveTargetWarehouseId(selected):0;
  const lineFallback=useQuery({
    queryKey:['steel-placement-line-warehouse',selected?.id],
    queryFn:()=>steelReceiptApi.line(selected!.id),
    enabled:!!selected&&selectedWarehouseId<=0,
  });
  const targetWarehouseId=selected
    ?(selectedWarehouseId>0?selectedWarehouseId:resolveTargetWarehouseId(lineFallback.data??selected))
    :0;
  const warehouseCode=selected?resolveWarehouseCode(lineFallback.data??selected):undefined;
  const activeRow=lineFallback.data??selected;
  const receivingLocationId=activeRow?resolveReceivingLocationId(activeRow):0;
  const receivingLocationLabel=activeRow?resolveReceivingLocationLabel(activeRow):null;
  const sourceLocation=useQuery({
    queryKey:['steel-placement-source-location',receivingLocationId],
    queryFn:()=>locationsApi.getById(receivingLocationId),
    enabled:!!selected&&receivingLocationId>0&&!receivingLocationLabel,
  });
  const sourceShelfText=receivingLocationLabel
    ??(sourceLocation.data?`${sourceLocation.data.code} · ${sourceLocation.data.name}${sourceLocation.data.locationType?` (${sourceLocation.data.locationType})`:''}`:null);
  const occupancy=useQuery({queryKey:['steel-occupancy',location],queryFn:()=>steelReceiptApi.occupancy(Number(location)),enabled:!!location});
  const nextStack=useMemo(()=>{const items=occupancy.data??[];return Math.max(items.length,...items.map(x=>x.stackOrderNo??0))+1},[occupancy.data]);
  const fetchTargetLocations=useCallback(async(request:Parameters<typeof goodsReceiptV2Api.locations>[0])=>{
    const page=await goodsReceiptV2Api.locations(request,targetWarehouseId);
    if(receivingLocationId<=0)return page;
    const items=page.items.filter(item=>item.id!==receivingLocationId);
    return {...page,items};
  },[targetWarehouseId,receivingLocationId]);
  useEffect(()=>{
    if(receivingLocationId>0&&location===String(receivingLocationId))setLocation(null);
  },[receivingLocationId,location]);
  const choose=(row:SteelLineRow)=>{setSelected(row);setLocation(null)};
  const place=async()=>{
    if(!selected||!location||!source){toast.error(t(`${P}.sheetAndShelfRequired`));return}
    setBusy(true);
    try{
      const result=await steelReceiptApi.place(selected.id,{locationId:Number(location),rowVersion:selected.rowVersion});
      toast.success(t(`${P}.placeSuccess`,{dCode:selected.dCode,order:result.stackOrderNo}));
      setSelected(null);
      setLocation(null);
      await loadSource(source.importReferenceNo,{silent:true});
      await cache.invalidateQueries({queryKey:['steel-placement-import-sources']});
      await cache.invalidateQueries({queryKey:['steel-occupancy']});
    }catch(e){toast.error(e instanceof Error?e.message:t(`${P}.placeFailed`))}finally{setBusy(false)}
  };
  return <div className="space-y-5">
    <OperationDraftRestoreDialog
      open={restoreDialogOpen&&Boolean(pendingDraft)}
      operationName={t('operationNames.steelReceiptPlacement')}
      updatedAt={pendingDraft?.updatedAt}
      onRestore={()=>{
        restoreDraft();
        setRestoreDialogOpen(false);
      }}
      onDiscard={async()=>{
        await discardDraft();
        setRestoreDialogOpen(false);
      }}
    />
    {(busy||restoring)&&!source&&<div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin"/>{t(`${R}.restoringDraft`)}</div>}
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <SectionHead title={t(`${P}.sourceTitle`)} text={t(`${P}.sourceText`)}/>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label={t(`${P}.importLabel`)}>
          <PagedAppDropdown<SteelPendingPlacementSource>
            queryKey={['steel-placement-import-sources',branchCode]}
            fetchPage={request=>fetchPlacementImportSourcesPage(branchCode,request)}
            toOption={item=>({
              value:item.importReferenceNo,
              label:item.supplierCode
                ?`${item.importReferenceNo} · ${item.supplierCode}`
                :item.importReferenceNo,
              description:importOptionDescription(item.pendingLineCount,item.supplierCode),
            })}
            value={selectedSourceReference}
            onValueChange={value=>{setSelectedSourceReference(value);setReference(value);void loadSource(value)}}
            selectedOption={source?{
              value:source.importReferenceNo,
              label:`${source.importReferenceNo} · ${source.supplierCode}`,
              description:importOptionDescription(pendingLines.length,source.supplierCode),
            }:undefined}
            searchFields={['importReferenceNo','dCode','stockCode','supplierSerialNo']}
            sortBy="importedAtUtc"
            sortDirection="desc"
            searchable
            minSearchLength={0}
            placeholder={t(`${P}.importPlaceholder`)}
            emptyText={t(`${P}.importEmpty`)}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Field label={t(`${R}.referenceLabel`)}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-500"/><input className="input !pl-10 font-mono" value={reference} onChange={event=>setReference(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void loadSource()}}} placeholder={t(`${R}.referencePlaceholder`)}/></div>
        </Field>
        <button type="button" disabled={busy||!reference.trim()} onClick={()=>void loadSource()} className="self-end rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:<><Search className="mr-2 inline size-4"/>{t(`${R}.fetchSheetsButton`)}</>}</button>
      </div>
      {source&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t(`${R}.metricImportRef`)} value={source.importReferenceNo}/><Metric label={t(`${R}.metricSourceFile`)} value={source.sourceFileName}/><Metric label={t(`${R}.metricSupplier`)} value={`${source.supplierCode} · ${source.supplierName}`}/><Metric label={t(`${P}.metricPendingSheets`)} value={String(pendingLines.length)}/></div>}
    </section>

    {source&&<div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
        <div className="border-b p-4">
          <h2 className="text-lg font-black">{t(`${P}.pendingTitle`)}</h2>
          <p className="text-xs text-slate-500">{t(`${P}.pendingText`)}</p>
          <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <strong className="font-mono text-cyan-600">{source.importReferenceNo}</strong>
            <p className="mt-1 text-xs text-slate-500">{t(`${P}.pendingSheetsSummary`,{count:pendingLines.length,file:source.sourceFileName,supplier:`${source.supplierCode} · ${source.supplierName}`})}</p>
          </div>
        </div>
        <SearchBar value={input} setValue={setInput} run={()=>setSearch(input.trim())}/>
        <div className="space-y-2 p-4">{visibleLines.map(row=><button key={row.id} onClick={()=>choose(row)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===row.id?'border-cyan-500 bg-cyan-500/10':''}`}><strong className="font-mono text-cyan-500">{row.dCode}</strong><span className="ml-2">{row.stockCode}</span><small className="block text-slate-500">{row.supplierSerialNo} · {formatProjectNumber(row.approvedQuantity)} {row.unitCode}</small></button>)}</div>
        {!busy&&!visibleLines.length&&<Empty text={search.trim()?t(`${P}.emptySearch`):t(`${P}.empty`)}/>}
      </section>
      <section className="space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><SectionHead title={t(`${P}.occupancyTitle`)} text={selected?`${selected.dCode} · ${selected.stockCode}${warehouseCode?` · ${t(`${P}.warehouseLabel`,{code:warehouseCode})}`:''}`:t(`${P}.occupancyTextSelect`)}/>
        {selected&&<>{targetWarehouseId<=0&&!lineFallback.isLoading&&<p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">{t(`${P}.warehouseMissing`)}</p>}
        <Field label={t(`${P}.sourceShelf`)}><div className="input flex min-h-11 items-center bg-black/[.03] text-sm text-slate-700 dark:bg-white/[.03] dark:text-slate-200">{sourceLocation.isLoading?t(`${P}.sourceShelfLoading`):sourceShelfText??(receivingLocationId>0?`#${receivingLocationId}`:t(`${P}.sourceShelfMissing`))}</div><p className="text-xs text-slate-500">{t(`${P}.sourceShelfHint`)}</p></Field>
        <Field label={t(`${P}.targetShelf`)}><PagedAppDropdown key={`${selected.id}-${targetWarehouseId}-${receivingLocationId}`} queryKey={['steel-putaway',selected.id,targetWarehouseId,receivingLocationId]} fetchPage={fetchTargetLocations} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} value={location} onValueChange={setLocation} searchable enabled={targetWarehouseId>0} dependencies={[targetWarehouseId,receivingLocationId]} disabled={targetWarehouseId<=0||lineFallback.isLoading} placeholder={lineFallback.isLoading?t(`${P}.warehouseLoading`):t(`${P}.targetShelfPlaceholder`)}/></Field>
        {location&&<><div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-5">
            <div className="flex items-center justify-between"><div><span className="text-xs font-bold uppercase tracking-widest text-cyan-500">{t(`${P}.autoPlacement`)}</span><h3 className="mt-1 text-xl font-black">{t(`${P}.stackOnTop`)}</h3></div><Layers3 className="size-10 text-cyan-500"/></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><Metric label={t(`${P}.sheetsOnShelf`)} value={String(occupancy.data?.length??0)}/><Metric label={t(`${P}.newStackOrder`)} value={String(nextStack)}/></div>
            <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">{t(`${P}.stackOrderNote`)}</p>
          </section>
          <SteelStackVisual items={occupancy.data??[]} pendingCode={selected.dCode} nextStack={nextStack}/>
        </div>
        <div><strong className="text-sm">{t(`${P}.stackOrderList`,{count:occupancy.data?.length??0})}</strong><div className="mt-2 grid gap-2 md:grid-cols-2">{[...(occupancy.data??[])].sort((a,b)=>(b.stackOrderNo??0)-(a.stackOrderNo??0)).map(item=><div key={item.placementId} className="rounded-xl border p-3 text-xs"><strong>{t(`${P}.stackItem`,{order:item.stackOrderNo,dCode:item.dCode})}</strong><span className="block text-slate-500">{item.stockCode} · {item.supplierSerialNo}</span></div>)}</div>{!occupancy.isLoading&&!occupancy.data?.length&&<p className="mt-2 text-xs text-slate-500">{t(`${P}.emptyShelf`)}</p>}</div>
        <button disabled={busy||occupancy.isLoading} onClick={()=>void place()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><Layers3 className="mr-2 inline size-4"/>{t(`${P}.placeButton`,{order:nextStack})}</button></>}</>}</section>
    </div>}
  </div>;
}

function SteelStackVisual({items,pendingCode,nextStack}:{items:Array<{placementId:number;dCode:string;stackOrderNo?:number}>;pendingCode:string;nextStack:number}){
  const {t}=useTranslation('common');
  const P=`${O}.placement`;
  const visible=[...items].sort((a,b)=>(a.stackOrderNo??0)-(b.stackOrderNo??0)).slice(-6);
  return <section className="relative min-h-72 overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-white [perspective:900px]">
    <div className="absolute inset-x-8 bottom-5 h-10 rounded-[50%] bg-cyan-400/10 blur-xl"/>
    <div className="relative flex h-52 flex-col-reverse items-center justify-start gap-1 [transform-style:preserve-3d]">{visible.map((item,index)=><div key={item.placementId} className="h-7 w-[78%] rounded border border-slate-400/40 bg-gradient-to-r from-slate-700 via-slate-300 to-slate-700 px-3 py-1 text-[10px] font-bold text-slate-950 shadow-xl" style={{transform:`translateZ(${index*5}px) translateX(${index%2?3:-3}px)`}}>{item.stackOrderNo}. {item.dCode}</div>)}<div className="h-8 w-[82%] animate-pulse rounded border-2 border-cyan-300 bg-gradient-to-r from-cyan-700 via-cyan-200 to-cyan-700 px-3 py-1 text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.35)]">{nextStack}. {pendingCode} · {t(`${P}.newBadge`)}</div></div>
    <div className="mx-auto h-4 w-[92%] rounded bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800 shadow-2xl"/><p className="mt-3 text-center text-xs text-slate-400">{t(`${P}.stackPreviewHint`)}</p>
  </section>;
}

function SectionHead({title,text}:{title:string;text:string}){return <div className="p-4"><h2 className="text-lg font-black">{title}</h2><p className="text-xs text-slate-500">{text}</p></div>}
function SearchBar({value,setValue,run}:{value:string;setValue:(v:string)=>void;run:()=>void}){
  const {t}=useTranslation('common');
  return <div className="flex gap-2 px-4 pb-4"><input className="input" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run()}} placeholder={t(`${O}.searchPlaceholder`)}/><button onClick={run} className="rounded-xl border px-4"><Search className="size-4"/></button></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
function Metric({label,value,valueClassName}:{label:string;value:string;valueClassName?:string}){return <div className="rounded-xl border p-3"><small className="text-slate-500">{label}</small><strong className={`block text-lg ${valueClassName??''}`}>{value}</strong></div>}
function Empty({text}:{text:string}){return <div className="p-8 text-center text-sm text-slate-500">{text}</div>}
