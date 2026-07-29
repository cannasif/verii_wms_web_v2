import {useEffect,useMemo,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ArrowRight,Boxes,CheckCircle2,ChevronLeft,ChevronRight,FileText,Layers3,Loader2,Printer,Search} from 'lucide-react';
import {toast} from 'sonner';
import {AppDateInput} from '@/components/shared/AppInput';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {printReceiptLabels} from '@/features/goods-receipt-v2/utils/goods-receipt-label-output';
import {isValidGoodsReceiptDocumentNo,normalizeGoodsReceiptDocumentNo} from '@/features/goods-receipt-v2/utils/goods-receipt-document-reference';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectNumber} from '@/lib/project-format';
import {useAuthStore} from '@/stores/auth-store';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {ConvertResult,SteelLineRow,SteelPendingReceiptSource,SteelReceiptSource} from '../types/steel-receipt.types';
import {SteelProcessHeader} from './SteelProcessHeader';

const O='steelGoodReceiptAcceptance.operations';
const pageSize=20;
const request=(page:number,search:string)=>({pageNumber:page,pageSize,search:search||null,filterLogic:'and' as const,filters:[],sortBy:'id',sortDirection:'desc' as const});
const today=()=>new Date().toLocaleDateString('en-CA');
export function SteelReceiptOperationsPage({initialTab='receipt'}:{initialTab?:'receipt'|'placement'}){
  const {t}=useTranslation('common');
  const [tab,setTab]=useState<'receipt'|'placement'>(initialTab);
  useEffect(()=>setTab(initialTab),[initialTab]);
  return <div className="space-y-5" data-no-auto-localize="true">
    <SteelProcessHeader currentStep={tab} title={t(tab==='receipt'?`${O}.receiptTitle`:`${O}.placementTitle`)} description={t(tab==='receipt'?`${O}.receiptDescription`:`${O}.placementDescription`)}/>
    <nav className="inline-flex rounded-xl border p-1"><Tab active={tab==='receipt'} onClick={()=>setTab('receipt')} icon={<Boxes className="size-4"/>}>{t(`${O}.receiptTab`)}</Tab><Tab active={tab==='placement'} onClick={()=>setTab('placement')} icon={<Layers3 className="size-4"/>}>{t(`${O}.placementTab`)}</Tab></nav>
    {tab==='receipt'?<ReceiptPanel/>:<PlacementPanel/>}
  </div>;
}

function ReceiptPanel(){
  const {t}=useTranslation('common');
  const R=`${O}.receipt`;
  const branchCode=useAuthStore(state=>state.branch?.code??'0');
  const [reference,setReference]=useState('');
  const [selectedSourceReference,setSelectedSourceReference]=useState<string|null>(null);
  const [source,setSource]=useState<SteelReceiptSource|null>(null);
  const [selected,setSelected]=useState<Record<number,SteelLineRow>>({});
  const [note,setNote]=useState('');
  const [isElectronic,setIsElectronic]=useState(true);
  const [receiptNo,setReceiptNo]=useState('');
  const [documentDate,setDocumentDate]=useState(today);
  const [lastResult,setLastResult]=useState<ConvertResult|null>(null);
  const [printing,setPrinting]=useState(false);
  const [busy,setBusy]=useState(false);
  const idempotencyKey=useRef(crypto.randomUUID());
  const selectedRows=Object.values(selected);
  const total=selectedRows.reduce((sum,row)=>sum+row.approvedQuantity,0);
  const receiptNoValid=isValidGoodsReceiptDocumentNo(receiptNo);
  const eligible=(row:SteelLineRow)=>(
    (row.inspectionStatus==='Approved'||row.inspectionStatus==='PartiallyApproved')
    &&row.approvedQuantity>0
    &&row.conversionStatus==='NotCreated'
  );
  const eligibilityText=(row:SteelLineRow)=>{
    if(row.conversionStatus!=='NotCreated')
      return row.erpIntegrationStatus?`Mal kabul oluşturuldu · ERP ${localizeEnumValue(row.erpIntegrationStatus)}`:'Mal kabul oluşturuldu';
    if(row.inspectionStatus!=='Approved'&&row.inspectionStatus!=='PartiallyApproved')
      return `Onay bekliyor · ${localizeEnumValue(row.inspectionStatus)}`;
    if(row.approvedQuantity<=0)return 'Onaylı miktar bulunmuyor';
    return 'Doğrudan mal kabule hazır';
  };
  const toggle=(row:SteelLineRow)=>setSelected(current=>{
    if(!eligible(row))return current;
    if(current[row.id]){const next={...current};delete next[row.id];return next}
    return {...current,[row.id]:row};
  });
  const loadSource=async(value=reference,preserveResult=false)=>{
    const normalized=value.trim();
    if(!normalized){toast.error('Excel aktarım referansı veya irsaliye numarası girin.');return}
    setBusy(true);if(!preserveResult)setLastResult(null);
    try{
      const result=await steelReceiptApi.receiptSource(normalized);
      setSource(result);setSelectedSourceReference(result.importReferenceNo);setSelected({});
      const sourceReceipt=(result.waybillNo??'').trim();
      setReceiptNo(normalizeGoodsReceiptDocumentNo(sourceReceipt));
      setDocumentDate(result.waybillDate?.slice(0,10)||today());
      toast.success(`${result.importReferenceNo} aktarımı getirildi.`);
    }catch(error){
      setSource(null);setSelectedSourceReference(null);setSelected({});setReceiptNo('');
      toast.error(error instanceof Error?error.message:'SAC kaynağı getirilemedi.');
    }finally{setBusy(false)}
  };
  const convert=async()=>{
    if(!selectedRows.length||!source)return;
    if(!receiptNoValid||!documentDate){toast.error(isElectronic?'E-irsaliye / GİB numarası tam 15 alfanümerik karakter olmalı ve irsaliye tarihi girilmelidir.':'İrsaliye numarası tam 15 alfanümerik karakter olmalı ve irsaliye tarihi girilmelidir.');return}
    setBusy(true);
    try{
      const result=await steelReceiptApi.convert(source.planId,selectedRows.map(x=>x.id),{
        idempotencyKey:idempotencyKey.current,mode:'Direct',documentDate,
        waybillNo:isElectronic?undefined:receiptNo,electronicWaybillNo:isElectronic?receiptNo:undefined,
        description:note,priority:1,assignedUserIds:[],assignToAllActiveUsers:false,
      });
      toast.success(t(`${R}.convertSuccess`,{documentNo:result.documentNo,count:result.convertedLineCount}));
      setLastResult(result);idempotencyKey.current=crypto.randomUUID();
      setSelected({});setNote('');
      await loadSource(source.importReferenceNo,true);
    }catch(e){toast.error(e instanceof Error?e.message:t(`${R}.convertFailed`))}finally{setBusy(false)}
  };
  const printLabels=async()=>{
    if(!lastResult?.generatedLabelIds?.length)return;
    setPrinting(true);
    try{
      const wanted=new Set(lastResult.generatedLabelIds??[]);
      const labels=(await goodsReceiptV2Api.receiptLabels(lastResult.goodsReceiptId)).filter(label=>wanted.has(label.id));
      if(!labels.length)throw new Error('Yazdırılabilir kabul etiketi bulunamadı.');
      printReceiptLabels(labels,`${lastResult.documentNo} SAC kabul etiketleri`);
      const unprinted=labels.filter(label=>label.printCount===0).map(label=>label.id);
      if(unprinted.length)await goodsReceiptV2Api.markLabelsPrinted(unprinted);
    }catch(error){toast.error(error instanceof Error?error.message:'Etiketler yazdırılamadı.')}
    finally{setPrinting(false)}
  };
  const selectable=source?.lines.filter(eligible)??[];
  const allSelectableSelected=selectable.length>0&&selectable.every(row=>selected[row.id]);
  return <div className="space-y-5">
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <SectionHead title="Excel aktarımı veya irsaliye ile SAC kaynağı bul" text="Kaynağa bağlı onaylı, onaysız ve daha önce işlenmiş tüm levhalar birlikte gösterilir. Yalnızca onaylı ve henüz mal kabule aktarılmamış satırlar seçilebilir."/>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Tamamlanmamış Excel aktarımı">
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
              description:`${item.waybillNo?`İrsaliye ${item.waybillNo} · `:''}${item.pendingLineCount}/${item.totalLineCount} levha bekliyor`,
            })}
            value={selectedSourceReference}
            onValueChange={value=>{setSelectedSourceReference(value);setReference(value);void loadSource(value)}}
            selectedOption={source?{
              value:source.importReferenceNo,
              label:`${source.importReferenceNo} · ${source.supplierCode}`,
              description:`${source.waybillNo?`İrsaliye ${source.waybillNo} · `:''}${source.lines.filter(line=>line.conversionStatus==='NotCreated').length}/${source.totalLineCount} levha bekliyor`,
            }:undefined}
            searchFields={['importReferenceNo','waybillNo','supplierCode','supplierName']}
            sortBy="importedAtUtc"
            sortDirection="desc"
            searchable
            minSearchLength={0}
            placeholder="Mal kabulü tamamlanmamış aktarımı seçin"
            emptyText="Bekleyen Excel aktarımı bulunmuyor"
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="Excel aktarım referansı / irsaliye no">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-500"/><input className="input !pl-10 font-mono" value={reference} onChange={event=>setReference(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void loadSource()}}} placeholder="Aktarım ref veya alış irsaliye no"/></div>
        </Field>
        <button type="button" disabled={busy||!reference.trim()} onClick={()=>void loadSource()} className="self-end rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:<><Search className="mr-2 inline size-4"/>Levhaları getir</>}</button>
      </div>
      {source&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Excel aktarım ref" value={source.importReferenceNo}/><Metric label="Kaynak dosya" value={source.sourceFileName}/><Metric label="Tedarikçi" value={`${source.supplierCode} · ${source.supplierName}`}/><Metric label="Toplam levha" value={String(source.totalLineCount)}/></div>}
    </section>

    {source&&<div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.7fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div><h2 className="font-black">Aktarıma bağlı levhalar</h2><p className="text-xs text-slate-500">{source.lines.length} satır · {selectable.length} satır doğrudan mal kabule hazır</p></div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={allSelectableSelected} disabled={!selectable.length} onChange={()=>setSelected(allSelectableSelected?{}:Object.fromEntries(selectable.map(row=>[row.id,row])))} className="size-4 accent-cyan-500"/>Uygunların tümünü seç</label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-black/[.03] text-xs uppercase text-slate-500 dark:bg-white/[.03]"><tr><th className="p-3">Seç</th><th className="p-3">DCode / Seri</th><th className="p-3">Stok</th><th className="p-3">Beklenen</th><th className="p-3">Onaylı</th><th className="p-3">Onay / ERP durumu</th></tr></thead>
          <tbody>{source.lines.map(row=>{const canSelect=eligible(row);return <tr key={row.id} className={`border-t ${selected[row.id]?'bg-cyan-500/10':!canSelect?'opacity-65':''}`}>
            <td className="p-3"><input type="checkbox" checked={Boolean(selected[row.id])} disabled={!canSelect} onChange={()=>toggle(row)} className="size-4 accent-cyan-500" aria-label={`${row.dCode} seç`}/></td>
            <td className="p-3"><strong className="font-mono text-cyan-500">{row.dCode}</strong><small className="block text-slate-500">{row.supplierSerialNo}</small></td>
            <td className="p-3"><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName||'—'}</small></td>
            <td className="p-3 font-mono">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
            <td className="p-3 font-mono font-bold">{formatProjectNumber(row.approvedQuantity)} {row.unitCode}</td>
            <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${canSelect?'border-emerald-500/30 bg-emerald-500/10 text-emerald-600':'border-amber-500/30 bg-amber-500/10 text-amber-600'}`}>{eligibilityText(row)}</span></td>
          </tr>})}</tbody>
        </table></div>
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><SectionHead title="Doğrudan SAC mal kabul" text="Bu işlem görev veya kullanıcı ataması oluşturmaz; seçili levhaları doğrudan kabul eder ve süreç politikasına göre ERP gönderimini çalıştırır."/>
      <Metric label={t(`${R}.selectedSheets`)} value={String(selectedRows.length)}/><Metric label={t(`${R}.totalApprovedQty`)} value={formatProjectNumber(total)}/><Metric label={t(`${R}.sacPlan`)} value={source.importReferenceNo}/>
      <section className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
        <div className="flex items-start gap-2"><FileText className="mt-0.5 size-5 text-cyan-500"/><div><strong className="text-sm">İrsaliye bilgisi</strong><p className="text-xs text-slate-500">Excel aktarımında girilmiş irsaliye otomatik gelir; gerekirse bu kabul için değiştirebilirsiniz.</p></div></div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-[var(--wms-app-panel)] p-3"><input type="checkbox" checked={isElectronic} onChange={event=>setIsElectronic(event.target.checked)} className="size-4 accent-cyan-500"/><span className="text-sm font-bold">E-irsaliye / GİB</span></label>
        <Field label={isElectronic?'GİB e-irsaliye no':'İrsaliye numarası'}><div className="relative"><input className={`input pr-16 font-mono ${receiptNo&&!receiptNoValid?'!border-red-500':receiptNoValid?'!border-emerald-500':''}`} inputMode="text" maxLength={15} value={receiptNo} onChange={event=>setReceiptNo(normalizeGoodsReceiptDocumentNo(event.target.value))} placeholder={isElectronic?'GIB2026AB000000':'IRS202600000001'}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{receiptNo.length}/15</span></div></Field>
        <Field label="İrsaliye tarihi"><AppDateInput value={documentDate} onChange={event=>setDocumentDate(event.target.value)}/></Field>
      </section>
      <Field label={t(`${R}.orderNote`)}><textarea className="input min-h-24" value={note} onChange={e=>setNote(e.target.value)} placeholder={t(`${R}.orderNotePlaceholder`)}/></Field>
      <button disabled={busy||!selectedRows.length||!receiptNoValid||!documentDate} onClick={()=>void convert()} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="mr-2 inline size-4 animate-spin"/>:<ArrowRight className="mr-2 inline size-4"/>}Doğrudan mal kabulü tamamla</button>
      {lastResult&&<section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-5 text-emerald-500"/><div><strong className="block">{lastResult.documentNo}</strong><small className="text-slate-500">Mal kabul tamamlandı; ERP politikası çalıştırıldı.</small></div></div>{(lastResult.generatedLabelIds?.length??0)>0&&<button type="button" disabled={printing} onClick={()=>void printLabels()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 px-3 py-2 text-sm font-bold text-violet-500 disabled:opacity-40">{printing?<Loader2 className="size-4 animate-spin"/>:<Printer className="size-4"/>}Kabul etiketlerini yazdır</button>}</section>}
    </aside>
    </div>}
  </div>;
}

function PlacementPanel(){
  const {t}=useTranslation('common');
  const P=`${O}.placement`;
  const cache=useQueryClient();const [page,setPage]=useState(1);const [input,setInput]=useState('');const [search,setSearch]=useState('');const [selected,setSelected]=useState<SteelLineRow|null>(null);
  const [location,setLocation]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['steel-placement-candidates',page,search],queryFn:()=>steelReceiptApi.placementCandidatesPaged(request(page,search))});
  const occupancy=useQuery({queryKey:['steel-occupancy',location],queryFn:()=>steelReceiptApi.occupancy(Number(location)),enabled:!!location});
  const nextStack=useMemo(()=>{const items=occupancy.data??[];return Math.max(items.length,...items.map(x=>x.stackOrderNo??0))+1},[occupancy.data]);
  const choose=(row:SteelLineRow)=>{setSelected(row);setLocation(null)};
  const place=async()=>{if(!selected||!location){toast.error(t(`${P}.sheetAndShelfRequired`));return}setBusy(true);try{const result=await steelReceiptApi.place(selected.id,{locationId:Number(location),rowVersion:selected.rowVersion});toast.success(t(`${P}.placeSuccess`,{dCode:selected.dCode,order:result.stackOrderNo}));setSelected(null);setLocation(null);await cache.invalidateQueries({queryKey:['steel-placement-candidates']});await cache.invalidateQueries({queryKey:['steel-occupancy']})}catch(e){toast.error(e instanceof Error?e.message:t(`${P}.placeFailed`))}finally{setBusy(false)}};
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"><SectionHead title={t(`${P}.pendingTitle`)} text={t(`${P}.pendingText`)}/><SearchBar value={input} setValue={setInput} run={()=>{setSearch(input.trim());setPage(1)}}/><div className="space-y-2 p-4">{(query.data?.items??[]).map(row=><button key={row.id} onClick={()=>choose(row)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===row.id?'border-cyan-500 bg-cyan-500/10':''}`}><strong className="font-mono text-cyan-500">{row.dCode}</strong><span className="ml-2">{row.stockCode}</span><small className="block text-slate-500">{row.supplierSerialNo} · {formatProjectNumber(row.approvedQuantity)} {row.unitCode}</small></button>)}</div>{!query.isLoading&&!query.data?.items.length&&<Empty text={t(`${P}.empty`)}/>}<Pager page={page} totalPages={query.data?.totalPages??1} setPage={setPage}/></section>
    <section className="space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><SectionHead title={t(`${P}.occupancyTitle`)} text={selected?`${selected.dCode} · ${selected.stockCode}`:t(`${P}.occupancyTextSelect`)}/>
      {selected&&<><Field label={t(`${P}.targetShelf`)}><PagedAppDropdown queryKey={['steel-putaway',selected.targetWarehouseId]} fetchPage={r=>goodsReceiptV2Api.locations(r,selected.targetWarehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} value={location} onValueChange={setLocation} searchable/></Field>
      {location&&<><div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-5">
          <div className="flex items-center justify-between"><div><span className="text-xs font-bold uppercase tracking-widest text-cyan-500">{t(`${P}.autoPlacement`)}</span><h3 className="mt-1 text-xl font-black">{t(`${P}.stackOnTop`)}</h3></div><Layers3 className="size-10 text-cyan-500"/></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><Metric label={t(`${P}.sheetsOnShelf`)} value={String(occupancy.data?.length??0)}/><Metric label={t(`${P}.newStackOrder`)} value={String(nextStack)}/></div>
          <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">{t(`${P}.stackOrderNote`)}</p>
        </section>
        <SteelStackVisual items={occupancy.data??[]} pendingCode={selected.dCode} nextStack={nextStack}/>
      </div>
      <div><strong className="text-sm">{t(`${P}.stackOrderList`,{count:occupancy.data?.length??0})}</strong><div className="mt-2 grid gap-2 md:grid-cols-2">{[...(occupancy.data??[])].sort((a,b)=>(b.stackOrderNo??0)-(a.stackOrderNo??0)).map(item=><div key={item.placementId} className="rounded-xl border p-3 text-xs"><strong>{t(`${P}.stackItem`,{order:item.stackOrderNo,dCode:item.dCode})}</strong><span className="block text-slate-500">{item.stockCode} · {item.supplierSerialNo}</span></div>)}</div>{!occupancy.isLoading&&!occupancy.data?.length&&<p className="mt-2 text-xs text-slate-500">{t(`${P}.emptyShelf`)}</p>}</div>
      <button disabled={busy||occupancy.isLoading} onClick={()=>void place()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><Layers3 className="mr-2 inline size-4"/>{t(`${P}.placeButton`,{order:nextStack})}</button></>}</>}</section></div>;
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

function Tab({active,onClick,icon,children}:{active:boolean;onClick:()=>void;icon:React.ReactNode;children:React.ReactNode}){return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${active?'bg-cyan-600 text-white':''}`}>{icon}{children}</button>}
function SectionHead({title,text}:{title:string;text:string}){return <div className="p-4"><h2 className="text-lg font-black">{title}</h2><p className="text-xs text-slate-500">{text}</p></div>}
function SearchBar({value,setValue,run}:{value:string;setValue:(v:string)=>void;run:()=>void}){
  const {t}=useTranslation('common');
  return <div className="flex gap-2 px-4 pb-4"><input className="input" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run()}} placeholder={t(`${O}.searchPlaceholder`)}/><button onClick={run} className="rounded-xl border px-4"><Search className="size-4"/></button></div>;
}
function Pager({page,totalPages,setPage}:{page:number;totalPages:number;setPage:(v:number)=>void}){
  const {t}=useTranslation('common');
  return <div className="flex items-center justify-between border-t p-3 text-xs"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4"/></button><span>{t(`${O}.pageLabel`,{page,totalPages:Math.max(1,totalPages)})}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4"/></button></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border p-3"><small className="text-slate-500">{label}</small><strong className="block text-lg">{value}</strong></div>}
function Empty({text}:{text:string}){return <div className="p-8 text-center text-sm text-slate-500">{text}</div>}
