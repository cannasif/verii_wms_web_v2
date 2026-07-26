import { useCallback,useMemo,useState,type ReactElement } from 'react';
import { ArrowRightLeft,Ban,CheckCircle2,Eye,FileText,Loader2,PackageCheck,Printer,Search,Warehouse,X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid,type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn,systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog,DialogContent,DialogTitle } from '@/components/ui/dialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDate,formatProjectDateTime,formatProjectNumber } from '@/lib/project-format';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import { goodsReceiptEnumLabel } from '../localization/enum-labels';
import type { GoodsReceiptDetail,GoodsReceiptGridRow,GoodsReceiptLifecycleResult,GoodsReceiptSplitRoutingResult } from '../types/goods-receipt.types';
import { previewReceiptLabelsPdf,printableLabels,printReceiptLabels } from '../utils/goods-receipt-label-output';
import { GoodsReceiptLifecycleDialog,type GoodsReceiptLifecycleAction } from './GoodsReceiptLifecycleDialog';
import { GoodsReceiptRoutingDialog } from './GoodsReceiptRoutingDialog';

type OutputMode='print'|'pdf';
export function GoodsReceiptListPage():ReactElement{
  const {t,moduleReady}=useModuleTranslation('goods-receipt-v2');
  const[detail,setDetail]=useState<GoodsReceiptDetail|null>(null);
  const[loadingId,setLoadingId]=useState<number|null>(null);
  const[outputBusy,setOutputBusy]=useState('');
  const[gridVersion,setGridVersion]=useState(0);
  const openDetail=useCallback(async(id:number)=>{setLoadingId(id);try{setDetail(await goodsReceiptV2Api.detail(id))}catch(error){toast.error(message(error,t('list.detailLoadError')))}finally{setLoadingId(null)}},[t]);
  const output=useCallback(async(receiptId:number,lineId:number|undefined,mode:OutputMode,title:string)=>{
    const key=`${receiptId}:${lineId??'all'}:${mode}`;setOutputBusy(key);
    try{
      const labels=printableLabels(await goodsReceiptV2Api.receiptLabels(receiptId,lineId));
      if(!labels.length)throw new Error(lineId?t('list.noLineLabels'):t('list.noReceiptLabels'));
      if(mode==='pdf'){await previewReceiptLabelsPdf(labels,`${title}.pdf`);toast.success(t('list.pdfReady',{count:labels.length}));return}
      printReceiptLabels(labels,title);
      await goodsReceiptV2Api.markLabelsPrinted(labels.map(x=>x.id));
      toast.success(t('list.sentToPrinter',{count:labels.length}));
    }catch(error){toast.error(message(error,t('list.outputError')))}finally{setOutputBusy('')}
  },[t]);
  const columns=useMemo<GridColumn<GoodsReceiptGridRow>[]>(()=>{
    void moduleReady;
    return [
    ...systemColumns<GoodsReceiptGridRow>(),
    {key:'documentNo',label:t('list.documentNo'),sortable:true,filterable:true,render:r=><span className="font-mono font-semibold">{r.documentNo}</span>},
    {key:'documentDate',label:t('list.documentDate'),sortable:true,filterable:true,render:r=>formatProjectDate(r.documentDate)},
    {key:'supplierCode',label:'Tedarikçi Kodu',sortable:true,filterable:true,render:r=>r.supplierCode||'—'},
    {key:'supplierName',label:'Tedarikçi Adı',sortable:true,filterable:true,render:r=>r.supplierName||'—'},
    {key:'warehouseCode',label:'Depo Kodu',sortable:true,filterable:true,render:r=>r.warehouseCode},
    {key:'warehouseName',label:'Depo Adı',sortable:true,filterable:true,render:r=>r.warehouseName},
    {key:'processType',label:t('list.processType'),sortable:true,filterable:true,render:r=>goodsReceiptEnumLabel(t,'processType',r.processType)},
    {key:'status',label:t('list.status'),sortable:true,filterable:true,render:r=>goodsReceiptEnumLabel(t,'operationStatus',r.status)},
    {key:'qualityStatus',label:t('list.quality'),sortable:true,filterable:true,render:r=>goodsReceiptEnumLabel(t,'qualityStatus',r.qualityStatus)},
    {key:'waybillNo',label:t('list.waybill'),sortable:true,filterable:true,render:r=>r.waybillNo||'—'},
    {key:'lineCount',label:t('list.line'),sortable:true,filterable:true,render:r=>r.lineCount},
    {key:'expectedQuantity',label:t('list.expected'),sortable:true,filterable:true,render:r=>formatProjectNumber(r.expectedQuantity)},
    {key:'receivedQuantity',label:t('list.received'),sortable:true,filterable:true,render:r=>formatProjectNumber(r.receivedQuantity)},
    {key:'actions',label:t('list.actions'),...requiredActionColumn,render:r=><div className="flex items-center gap-1">
      <ActionButton title={t('list.showDetail')} busy={loadingId===r.id} onClick={()=>void openDetail(r.id)} icon={<Eye className="size-4"/>}/>
      <ActionButton title={t('list.printAllLabels')} busy={outputBusy===`${r.id}:all:print`} onClick={()=>void output(r.id,undefined,'print',r.documentNo)} icon={<Printer className="size-4"/>}/>
      <ActionButton title={t('list.showAllLabelsPdf')} busy={outputBusy===`${r.id}:all:pdf`} onClick={()=>void output(r.id,undefined,'pdf',r.documentNo)} icon={<FileText className="size-4"/>}/>
    </div>},
    ];
  },[loadingId,moduleReady,openDetail,output,outputBusy,t]);
  const lifecycleCompleted=useCallback(async(result:GoodsReceiptLifecycleResult|null)=>{
    toast.success(result?.replayed?t('list.replayed'):t('list.operationCompleted'));
    const id=result?.id??detail?.header.id;
    if(id)setDetail(await goodsReceiptV2Api.detail(id));
    setGridVersion((value)=>value+1);
  },[detail?.header.id,t]);
  const routingCompleted=useCallback(async()=>{
    if (!detail?.header.id) return;
    setDetail(await goodsReceiptV2Api.detail(detail.header.id));
    setGridVersion((value)=>value+1);
  },[detail?.header.id]);
  return <><AdvancedDataGrid<GoodsReceiptGridRow> key={gridVersion} pageKey="goods-receipts" title={t('list.title')} description={t('list.description')} columns={columns} fetchPage={goodsReceiptV2Api.paged}/>{detail&&<DetailModal detail={detail} close={()=>setDetail(null)} output={output} busyKey={outputBusy} onLifecycleCompleted={lifecycleCompleted} onRoutingCompleted={routingCompleted}/>}</>;
}

function DetailModal({detail,close,output,busyKey,onLifecycleCompleted,onRoutingCompleted}:{detail:GoodsReceiptDetail;close:()=>void;output:(receiptId:number,lineId:number|undefined,mode:OutputMode,title:string)=>Promise<void>;busyKey:string;onLifecycleCompleted:(result:GoodsReceiptLifecycleResult|null)=>Promise<void>;onRoutingCompleted:(result:GoodsReceiptSplitRoutingResult)=>Promise<void>}):ReactElement{
  const {t}=useModuleTranslation('goods-receipt-v2');
  const[action,setAction]=useState<GoodsReceiptLifecycleAction|null>(null);
  const[routeKind,setRouteKind]=useState<'transfer'|'outbound'|null>(null);
  const[lineSearch,setLineSearch]=useState('');
  const shortCloseAvailable=detail.lines.some(line=>line.expectedQuantity-line.receivedQuantity-line.shortClosedQuantity>0);
  const cancelled=detail.header.status==='Cancelled';
  const routingAvailable=!cancelled&&detail.lines.some(line=>line.routableQuantity>0);
  const normalizedSearch=lineSearch.trim().toLocaleUpperCase('tr-TR');
  const visibleLines=normalizedSearch
    ?detail.lines.filter(line=>[line.stockCode,line.stockName,line.yapCode,line.status,String(line.lineNo)].some(value=>String(value??'').toLocaleUpperCase('tr-TR').includes(normalizedSearch)))
    :detail.lines;
  return <Dialog open onOpenChange={(open)=>{if(!open)close()}}><DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-[calc(100%_-_2rem)] w-full overflow-auto rounded-2xl p-4 sm:max-w-6xl sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><DialogTitle className="text-xl font-bold">{detail.header.documentNo}</DialogTitle><p className="text-sm text-slate-500">{detail.header.supplierCode} · {detail.header.supplierName} · {detail.header.warehouseCode} {detail.header.warehouseName}</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={()=>void output(detail.header.id,undefined,'print',detail.header.documentNo)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 py-2 text-sm font-semibold"><Printer className="size-4"/>{t('list.printLabels')}</button><button onClick={()=>void output(detail.header.id,undefined,'pdf',detail.header.documentNo)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 py-2 text-sm font-semibold"><FileText className="size-4"/>{t('list.showPdf')}</button><button type="button" aria-label={t('list.close')} onClick={close} className="grid size-11 place-items-center rounded-xl hover:bg-[var(--wms-brand-soft)]"><X className="size-5"/></button></div></header>
    <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-[var(--wms-app-border)] p-3">
      {detail.header.approvalStatus==='Pending'&&!cancelled&&<LifecycleButton label={t('list.approve')} icon={<CheckCircle2 className="size-4"/>} onClick={()=>setAction('approve')}/>}
      {shortCloseAvailable&&!cancelled&&<LifecycleButton label={t('list.shortClose')} icon={<PackageCheck className="size-4"/>} onClick={()=>setAction('shortClose')}/>}
      {detail.putawayCandidates.length>0&&!cancelled&&<LifecycleButton label={t('list.putaway',{count:detail.putawayCandidates.length})} icon={<Warehouse className="size-4"/>} onClick={()=>setAction('putaway')}/>}
      {routingAvailable&&<LifecycleButton label={t('list.route')} icon={<ArrowRightLeft className="size-4"/>} onClick={()=>setRouteKind('transfer')}/>}
      {!cancelled&&<LifecycleButton label={t('list.cancel')} danger icon={<Ban className="size-4"/>} onClick={()=>setAction('cancel')}/>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label={t('list.processType')} value={goodsReceiptEnumLabel(t,'processType',detail.header.processType)}/><Info label={t('list.status')} value={goodsReceiptEnumLabel(t,'operationStatus',detail.header.status)}/><Info label={t('list.approval')} value={goodsReceiptEnumLabel(t,'approvalStatus',detail.header.approvalStatus)}/><Info label={t('list.quality')} value={goodsReceiptEnumLabel(t,'qualityStatus',detail.header.qualityStatus)}/><Info label={t('list.putawayStatus')} value={goodsReceiptEnumLabel(t,'putawayStatus',detail.header.putawayStatus)}/><Info label={t('list.erpPosting')} value={goodsReceiptEnumLabel(t,'erpStatus',detail.header.erpIntegrationStatus)}/><Info label={t('list.task')} value={detail.taskNumbers.join(', ')||'—'}/><Info label={t('list.physicalReceipt')} value={String(detail.executionCount)}/><Info label={t('list.waybill')} value={detail.header.waybillNo||'—'}/><Info label={t('list.documentDate')} value={formatProjectDate(detail.header.documentDate)}/><Info label={t('list.receivedAt')} value={detail.header.receivedAtUtc?formatProjectDateTime(detail.header.receivedAtUtc):'—'}/></div>
    <section className="mt-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-bold">{t('list.receiptLines')}</h3><p className="text-xs text-slate-500">{t('list.linesShown',{visible:visibleLines.length,total:detail.lines.length})}</p></div>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
          <input value={lineSearch} onChange={event=>setLineSearch(event.target.value)} className="input min-h-11 !pl-10" placeholder={t('list.lineSearchPlaceholder')} aria-label={t('list.lineSearchAria')}/>
        </label>
      </div>
      {!visibleLines.length&&<div className="rounded-xl border border-dashed border-[var(--wms-app-border)] p-6 text-center text-sm text-slate-500">{t('list.noMatchingLines')}</div>}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--wms-app-border)] md:block"><table className="min-w-[900px] w-full text-sm"><thead className="bg-[var(--wms-app-panel-muted)] text-left"><tr><th className="p-3">#</th><th className="p-3">{t('list.stock')}</th><th className="p-3">{t('list.yap')}</th><th className="p-3 text-right">{t('list.expected')}</th><th className="p-3 text-right">{t('list.accepted')}</th><th className="p-3 text-right">{t('list.routed')}</th><th className="p-3 text-right">{t('list.remaining')}</th><th className="p-3">{t('list.status')}</th><th className="p-3 text-center">{t('list.label')}</th></tr></thead><tbody>{visibleLines.map(line=><tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td className="p-3">{line.lineNo}</td><td className="p-3"><strong>{line.stockCode}</strong><div className="text-xs text-slate-500">{line.stockName}</div></td><td className="p-3">{line.yapCode||'—'}</td><td className="p-3 text-right">{formatProjectNumber(line.expectedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.acceptedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.routedQuantity)}</td><td className="p-3 text-right font-semibold text-cyan-600">{formatProjectNumber(line.routableQuantity)}</td><td className="p-3">{goodsReceiptEnumLabel(t,'lineStatus',line.status)}</td><td className="p-3"><div className="flex justify-center gap-1"><ActionButton title={t('list.printLineLabel')} busy={busyKey===`${detail.header.id}:${line.id}:print`} onClick={()=>void output(detail.header.id,line.id,'print',`${detail.header.documentNo}-${line.lineNo}`)} icon={<Printer className="size-4"/>}/><ActionButton title={t('list.showLineLabelPdf')} busy={busyKey===`${detail.header.id}:${line.id}:pdf`} onClick={()=>void output(detail.header.id,line.id,'pdf',`${detail.header.documentNo}-${line.lineNo}`)} icon={<FileText className="size-4"/>}/></div></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:hidden">{visibleLines.map(line=><article key={line.id} className="rounded-2xl border border-[var(--wms-app-border)] bg-black/[0.015] p-4 dark:bg-white/[0.025]">
        <header className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-cyan-500">{t('list.lineNumber',{number:line.lineNo})}</p><h4 className="break-words font-black">{line.stockCode}</h4><p className="text-xs text-slate-500">{line.stockName||t('list.noStockName')}</p></div><span className="shrink-0 rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-600">{goodsReceiptEnumLabel(t,'lineStatus',line.status)}</span></header>
        <div className="mt-3 grid grid-cols-2 gap-2"><LineMetric label={t('list.yap')} value={line.yapCode||'—'}/><LineMetric label={t('list.expected')} value={formatProjectNumber(line.expectedQuantity)}/><LineMetric label={t('list.accepted')} value={formatProjectNumber(line.acceptedQuantity)}/><LineMetric label={t('list.routed')} value={formatProjectNumber(line.routedQuantity)}/><LineMetric label={t('list.remaining')} value={formatProjectNumber(line.routableQuantity)} accent/></div>
        <footer className="mt-3 flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-3"><ActionButton title={t('list.printLineLabel')} busy={busyKey===`${detail.header.id}:${line.id}:print`} onClick={()=>void output(detail.header.id,line.id,'print',`${detail.header.documentNo}-${line.lineNo}`)} icon={<Printer className="size-4"/>}/><ActionButton title={t('list.showLineLabelPdf')} busy={busyKey===`${detail.header.id}:${line.id}:pdf`} onClick={()=>void output(detail.header.id,line.id,'pdf',`${detail.header.documentNo}-${line.lineNo}`)} icon={<FileText className="size-4"/>}/></footer>
      </article>)}</div>
    </section>
    {action&&<GoodsReceiptLifecycleDialog action={action} detail={detail} onClose={()=>setAction(null)} onCompleted={async(result)=>{setAction(null);await onLifecycleCompleted(result)}}/>}
    {routeKind&&<GoodsReceiptRoutingDialog detail={detail} initialKind={routeKind} onClose={()=>setRouteKind(null)} onCompleted={async(result)=>{setRouteKind(null);await onRoutingCompleted(result)}}/>}
  </DialogContent></Dialog>;
}
function LifecycleButton({label,icon,onClick,danger=false}:{label:string;icon:ReactElement;onClick:()=>void;danger?:boolean}){return <button type="button" onClick={onClick} className={danger?'inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-500/10':'inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-3 py-2 text-sm font-semibold text-cyan-500 hover:bg-cyan-500/10'}>{icon}{label}</button>}
function ActionButton({title,busy,onClick,icon}:{title:string;busy:boolean;onClick:()=>void;icon:ReactElement}){return <button type="button" title={title} aria-label={title} disabled={busy} onClick={onClick} className="grid size-11 place-items-center rounded-lg text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:icon}</button>}
function LineMetric({label,value,accent=false}:{label:string;value:string;accent?:boolean}){return <div className="rounded-xl border border-[var(--wms-app-border)] p-2.5"><span className="block text-[11px] text-slate-500">{label}</span><strong className={accent?'mt-0.5 block text-sm text-cyan-600':'mt-0.5 block text-sm'}>{value}</strong></div>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><div className="text-xs text-slate-500">{label}</div><strong className="mt-1 block text-sm">{value}</strong></div>}
function message(error:unknown,fallback:string){return error instanceof Error?error.message:fallback}
