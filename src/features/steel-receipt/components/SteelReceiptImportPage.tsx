import {useCallback,useEffect,useMemo,useState,type ChangeEvent} from 'react';
import type {WorkSheet} from 'xlsx';
import {Download,Loader2,Upload} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {toast} from 'sonner';
import {AdvancedDataGrid,type GridColumn,type GridFilter,type GridPage,type GridRequest} from '@/components/shared/AdvancedDataGrid';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {AppDateInput} from '@/components/shared/AppInput';
import {OpsDialogBody,OpsDialogContent,OpsDialogHeader} from '@/components/shared/OpsDialogShell';
import {Dialog,DialogTitle} from '@/components/ui/dialog';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {useAuthStore} from '@/stores/auth-store';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {completeGoodsReceiptDocumentNo,isValidGoodsReceiptDocumentNo,normalizeGoodsReceiptDocumentNo} from '@/features/goods-receipt-v2/utils/goods-receipt-document-reference';
import {formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import {fetchCommittedPlanLines} from '../steel-import-result';
import type {SteelImportLine,SteelImportPreview,SteelImportPreviewLine,SteelImportRequest,SteelLineRow} from '../types/steel-receipt.types';
import {OpsStatusBadge,type OpsStatusTone} from '@/components/shared/OpsStatusBadge';
import {SteelProcessHeader} from './SteelProcessHeader';

const I='steelGoodReceiptAcceptance.importTransfer';
const split=(v:string|null)=>v?.split('|')??[];
const normalize=(v:string)=>v.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const text=(v:unknown)=>v==null?'':String(v).trim();
const find=(row:Record<string,unknown>,names:string[])=>{const entries=Object.entries(row);for(const name of names){const hit=entries.find(([key])=>normalize(key)===normalize(name));if(hit)return text(hit[1])}return''};
const number=(v:unknown)=>{const compact=text(v).replace(/\s/g,'');if(!compact)return 0;const comma=compact.includes(','),dot=compact.includes('.');const normalized=comma&&dot?(compact.lastIndexOf(',')>compact.lastIndexOf('.')?compact.replace(/\./g,'').replace(',','.'):compact.replace(/,/g,'')):comma?compact.replace(',','.'):compact;const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:0};
const knownHeaders=new Set(['siparisno','sipariskalemno','stokkodu','yapkodu','serino','serino2','miktar','miktarkg','birim','kombinesize','olcu','materialquality','malzemekalitesi','heatnumber','dokumno','certificatenumber','sertifikano'].map(normalize));
const headerRow=(sheet:WorkSheet,XLSX:typeof import('xlsx'))=>{const rows=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',blankrows:false});let best=0,score=0;rows.slice(0,25).forEach((row,index)=>{const current=row.reduce<number>((sum:number,cell:unknown)=>sum+(knownHeaders.has(normalize(text(cell)))?1:0),0);if(current>score){best=index;score=current}});return score>=2?best:0};
const downloadTemplate=async()=>{
  const XLSX=await import('xlsx');
  const rows=Array.from({length:8},(_,index)=>{
    const n=String(index+1).padStart(3,'0');
    const stock=String(index+2).padStart(3,'0');
    return {
      'Sipariş No':'SIP-001',
      'Sipariş Kalem No':String(index+1),
      'Stok Kodu':`01/${stock}`,
      'Yapılandırma Kodu':'',
      'Seri No (Levha No)':`LVH-${n}`,
      'Seri-2 (Poz No)':`POZ-${n}`,
      'Miktar(Kg)':'1.234,50',
      'Birim':'KG',
      'Kombine Size':'1200x2400x8',
      'Material Quality':'S235',
      'Heat Number':`HEAT-${n}`,
      'Certificate Number':`CERT-${n}`,
      'Export No':'EXP-2026-001',
      'İrsaliye No':'',
      'Not':'',
    };
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'SAC Mal Kabul');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['Alan','Zorunlu','Açıklama'],
    ['Sipariş No','Evet','Netsis / ERP sipariş numarası'],
    ['Sipariş Kalem No','Evet','Sipariş satır numarası'],
    ['Stok Kodu','Evet','ERP mirror stok kodu ile birebir eşleşmeli'],
    ['Yapılandırma Kodu','Hayır','Yap kodu varsa doldurun'],
    ['Seri No (Levha No)','Evet','Her levha için benzersiz tedarikçi seri'],
    ['Seri-2 (Poz No)','Hayır','İkincil / pozisyon seri'],
    ['Miktar(Kg)','Evet','1.234,50 veya 1234.50 biçimleri desteklenir'],
    ['Birim','Evet','Varsayılan KG'],
    ['Kombine Size','Hayır','Ölçü bilgisi (örn. 1200x2400x8)'],
    ['Material Quality','Hayır','Malzeme kalitesi / grade'],
    ['Heat Number','Hayır','Döküm / heat numarası'],
    ['Certificate Number','Hayır','Sertifika numarası'],
    ['Export No','Hayır','Export referansı; ekranda da ayrı alana yazılabilir'],
    ['İrsaliye No','Hayır','Bilgi amaçlı; belge no ekrandan da girilir'],
    ['Not','Hayır','Satır notu'],
    ['—','—','Boş satırlar yok sayılır. İlk satır başlık olmalıdır.'],
    ['—','—','Dosya adı otomatik aktarım referansı önerisi olarak kullanılır.'],
  ]),'Kılavuz');
  XLSX.writeFile(wb,'SAC_Mal_Kabul_Sablonu.xlsx');
};

type SteelImportPreviewGridRow={
  id:number;lineNo:number;netsisOrderNo?:string;netsisOrderLineNo?:string;stockCode?:string;yapCode?:string;
  supplierSerialNo:string;secondarySerialNo?:string;expectedQuantity:number;unitCode:string;combinedSize?:string;
  materialGrade?:string;heatNumber?:string;certificateNumber?:string;action:string;existingDCode?:string;errors:string[];
};
const gridText=(value:unknown)=>value==null?'':Array.isArray(value)?value.join(', '):String(value);
const gridDash=(value:string|number|undefined|null)=>value==null||value===''?'-':value;
const matchesGridSearch=(row:Record<string,unknown>,search:string,keys:string[])=>{
  const term=search.trim().toLocaleLowerCase('tr-TR');
  if(!term)return true;
  return keys.some(key=>gridText(row[key]).toLocaleLowerCase('tr-TR').includes(term));
};
const compareGridValues=(a:unknown,b:unknown)=>{
  if(a==null&&b==null)return 0;
  if(a==null)return 1;
  if(b==null)return-1;
  if(typeof a==='number'&&typeof b==='number')return a-b;
  return gridText(a).localeCompare(gridText(b),'tr',{numeric:true});
};
const matchesGridFilter=(row:Record<string,unknown>,filter:GridFilter)=>{
  const raw=gridText(row[filter.column]).toLocaleLowerCase('tr-TR');
  const value=filter.value.trim().toLocaleLowerCase('tr-TR');
  switch(filter.operator){
    case'contains':return raw.includes(value);
    case'notContains':return!raw.includes(value);
    case'equals':return raw===value;
    case'notEquals':return raw!==value;
    case'startsWith':return raw.startsWith(value);
    case'endsWith':return raw.endsWith(value);
    case'isNull':return!raw;
    case'isNotNull':return Boolean(raw);
    case'gt':case'gte':case'lt':case'lte':{
      const num=Number(raw),cmp=Number(value);
      if(!Number.isFinite(num)||!Number.isFinite(cmp))return false;
      if(filter.operator==='gt')return num>cmp;
      if(filter.operator==='gte')return num>=cmp;
      if(filter.operator==='lt')return num<cmp;
      return num<=cmp;
    }
    default:return true;
  }
};
const filterLocalGrid=<T extends {id:number}>(items:T[],request:GridRequest,searchableKeys:string[]):GridPage<T>=>{
  let rows=[...items];
  const search=request.search?.trim();
  if(search){
    const keys=request.searchFields?.length?request.searchFields:searchableKeys;
    rows=rows.filter(row=>matchesGridSearch(row as Record<string,unknown>,search,keys));
  }
  if(request.filters.length){
    rows=rows.filter(row=>request.filterLogic==='or'
      ?request.filters.some(filter=>matchesGridFilter(row as Record<string,unknown>,filter))
      :request.filters.every(filter=>matchesGridFilter(row as Record<string,unknown>,filter)));
  }
  if(request.sortBy){
    const dir=request.sortDirection==='desc'?-1:1;
    rows.sort((a,b)=>compareGridValues((a as Record<string,unknown>)[request.sortBy!],(b as Record<string,unknown>)[request.sortBy!])*dir);
  }
  const totalCount=rows.length;
  return {items:rows,pageNumber:1,pageSize:Math.max(totalCount,1),totalCount,totalPages:1,hasPreviousPage:false,hasNextPage:false};
};
type SteelImportCommitResult={
  importReferenceNo:string;
  sourceFileName:string;
  waybillNo?:string;
  planId:number;
  lines:SteelLineRow[];
};
const toPreviewGridRow=({row,source,lineNo}:{row:SteelImportPreviewLine;source?:SteelImportLine;lineNo:number}):SteelImportPreviewGridRow=>({
  id:row.rowNumber,lineNo,netsisOrderNo:source?.netsisOrderNo,netsisOrderLineNo:source?.netsisOrderLineNo,
  stockCode:row.stockCode??source?.stockCode,yapCode:source?.yapCode,supplierSerialNo:row.supplierSerialNo??source?.supplierSerialNo??'',
  secondarySerialNo:source?.secondarySerialNo,expectedQuantity:source?.expectedQuantity??0,unitCode:source?.unitCode??'KG',
  combinedSize:source?.combinedSize,materialGrade:source?.materialGrade,heatNumber:source?.heatNumber,certificateNumber:source?.certificateNumber,
  action:row.action,existingDCode:row.existingDCode,errors:row.errors,
});
const localizePreviewAction=(action:string,t:(key:string)=>string)=>action==='New'?t(`${I}.previewNew`):action==='Existing'?t(`${I}.previewExisting`):action;

function ImportStatBadge({label,value,tone}:{label:string;value:number;tone:OpsStatusTone}){
  return <OpsStatusBadge tone={tone} className="!px-3 !py-1.5 !text-[11px] !normal-case !tracking-wide">
    {label}: <span className="font-black tabular-nums">{value}</span>
  </OpsStatusBadge>;
}

export function SteelReceiptImportPage(){
  const {t}=useTranslation('common');
  const branch=useAuthStore(s=>s.branch?.code??'0');const [customer,setCustomer]=useState<string|null>(null);const [warehouse,setWarehouse]=useState<string|null>(null);
  const [seriesId,setSeriesId]=useState<string|null>(null);const [reference,setReference]=useState('');const [exportRef,setExportRef]=useState('');
  const [waybill,setWaybill]=useState('');const [isElectronic,setIsElectronic]=useState(true);const [waybillDate,setWaybillDate]=useState(new Date().toLocaleDateString('en-CA'));const [plannedArrival,setPlannedArrival]=useState('');
  const [fileName,setFileName]=useState('');const [lines,setLines]=useState<SteelImportLine[]>([]);
  const [preview,setPreview]=useState<SteelImportPreview|null>(null);
  const [commitResult,setCommitResult]=useState<SteelImportCommitResult|null>(null);
  const [commitIdempotencyKey,setCommitIdempotencyKey]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);const warehouseId=Number(split(warehouse)[0]||0);
  useEffect(()=>{setSeriesId(null);void goodsReceiptV2Api.series().then(x=>{setSeriesId(String((x.find(y=>y.isDefault)??x[0])?.id??''))})},[branch]);
  const onFile=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setFileName(file.name);setPreview(null);setCommitResult(null);setCommitIdempotencyKey(crypto.randomUUID());
    const XLSX=await import('xlsx');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const offset=headerRow(ws,XLSX);const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:'',range:offset});
    const mapped=rows.map((r,i)=>({rowNumber:i+offset+2,netsisOrderNo:find(r,['NetsisOrderNo','Sipariş No','SiparisNo']),netsisOrderLineNo:find(r,['NetsisOrderLineNo','Sipariş Kalem No','SiparisKalemNo']),
      stockCode:find(r,['StockCode','Stok Kodu','StokKodu']),yapCode:find(r,['ConfigurationCode','Yapılandırma Kodu','YapCode','Yap Kodu','YapKodu'])||undefined,supplierSerialNo:find(r,['SerialNo','Seri No','Seri No (Levha No)']),
      secondarySerialNo:find(r,['SerialNo2','Seri-2','Seri-2 (Poz No)'])||undefined,expectedQuantity:number(find(r,['ExpectedQuantity','Miktar','Miktar(Kg)','Miktar Kg'])),unitCode:find(r,['Unit','Birim'])||'KG',
      combinedSize:find(r,['CombinedSize','Kombine Size','Ölçü','Olcu'])||undefined,materialGrade:find(r,['MaterialQuality','Material Quality','Malzeme Kalitesi'])||undefined,
      heatNumber:find(r,['HeatNumber','Heat Number','Döküm No','DokumNo'])||undefined,certificateNumber:find(r,['CertificateNumber','Certificate Number','Sertifika No'])||undefined}));
    setLines(mapped);
    setReference(file.name.replace(/\.[^.]+$/,''));
    toast.success(t(`${I}.rowsRead`,{count:mapped.length}));
    e.target.value='';
  };
  const buildRequest=(documentSeriesId:number):SteelImportRequest=>({branchCode:branch,importReferenceNo:reference.trim(),sourceFileName:fileName,exportReferenceNo:exportRef.trim()||undefined,
    supplierId:Number(split(customer)[0]),targetWarehouseId:warehouseId,documentSeriesId,
    waybillNo:waybill.trim()||undefined,waybillDate:waybillDate||undefined,plannedArrivalAtUtc:plannedArrival?new Date(plannedArrival).toISOString():undefined,lines});
  const resolveDocumentSeriesId=async():Promise<number>=>{
    const current=Number(seriesId);
    if(Number.isFinite(current)&&current>0)return current;
    const items=await goodsReceiptV2Api.series();
    const picked=items.find(x=>x.isDefault)??items[0];
    if(picked?.id){setSeriesId(String(picked.id));return picked.id}
    return 0;
  };
  const validationMessage=():string|null=>{
    const missing:string[]=[];
    if(!customer)missing.push(t(`${I}.supplier`));
    if(!warehouseId)missing.push(t(`${I}.targetWarehouse`));
    if(!reference.trim())missing.push(t(`${I}.importReference`));
    if(!lines.length)missing.push(t(`${I}.excelFile`));
    if(!isValidGoodsReceiptDocumentNo(waybill))missing.push(isElectronic?t(`${I}.gibWaybillNo`):t(`${I}.waybillNo`,{defaultValue:'İrsaliye numarası'}));
    if(!waybillDate.trim())missing.push(t(`${I}.waybillDate`));
    if(missing.length===0)return null;
    if(missing.length===1)return t(`${I}.validationFieldRequired`,{field:missing[0]});
    return t(`${I}.validationFieldsRequired`,{fields:missing.join(', ')});
  };
  const run=async(commit=false)=>{const validation=validationMessage();if(validation){toast.error(validation);return}
    setBusy(true);try{const documentSeriesId=await resolveDocumentSeriesId();const payload=buildRequest(documentSeriesId);
      if(commit){
        const savedReference=reference.trim();
        const savedFileName=fileName;
        const savedWaybill=waybill.trim()||undefined;
        const lineCount=lines.length;
        const planId=await steelReceiptApi.commit(payload,commitIdempotencyKey);
        toast.success(t(`${I}.saveSuccess`));
        try{
          const savedLines=await fetchCommittedPlanLines(
            planId,lineCount,steelReceiptApi.linesPaged);
          setCommitResult({importReferenceNo:savedReference,sourceFileName:savedFileName,waybillNo:savedWaybill,planId,lines:savedLines});
        }catch{
          setCommitResult(null);
          toast.info(t(`${I}.commitResultLoadFailed`));
        }
        setLines([]);
        setPreview(null);
        setFileName('');
        setCommitIdempotencyKey(crypto.randomUUID());
      }else{
        setCommitResult(null);
        setPreview(await steelReceiptApi.preview(payload));
        toast.success(t(`${I}.previewReady`));
      }
    }catch(e){toast.error(e instanceof Error?e.message:t(`${I}.operationFailed`))}finally{setBusy(false)}};
  return <section className="space-y-5" data-no-auto-localize="true"><SteelProcessHeader currentStep="plan" title={t(`${I}.title`)} description={t(`${I}.description`)} notice={t(`${I}.notice`)}/>
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label={t(`${I}.supplier`)}><PagedAppDropdown queryKey={['steel-customers',branch]} fetchPage={r=>goodsReceiptV2Api.customers(r,branch)} toOption={x=>({value:`${x.id}|${x.customerCode}`,label:`${x.customerCode} · ${x.customerName}`})} value={customer} onValueChange={setCustomer} searchable minSearchLength={2}/></Field>
      <Field label={t(`${I}.targetWarehouse`)}><PagedAppDropdown queryKey={['steel-warehouses',branch]} fetchPage={r=>goodsReceiptV2Api.warehouses(r,branch)} toOption={x=>({value:`${x.id}|${x.warehouseCode}`,label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouse} onValueChange={setWarehouse} searchable/></Field>
      <Field label={t(`${I}.importReference`)}><input className="input" value={reference} onChange={e=>setReference(e.target.value)} maxLength={100}/></Field>
      <Field label={t(`${I}.exportReference`)}><input className="input" value={exportRef} onChange={e=>setExportRef(e.target.value)} maxLength={100}/></Field>
      <Field label={isElectronic?t(`${I}.gibWaybillNo`):t(`${I}.waybillNo`,{defaultValue:'İrsaliye numarası'})}><div className="relative"><input className="input pr-16 font-mono" value={waybill} onChange={e=>{setWaybill(normalizeGoodsReceiptDocumentNo(e.target.value));setPreview(null)}} onBlur={()=>setWaybill(completeGoodsReceiptDocumentNo(waybill))} maxLength={15} placeholder={isElectronic?'GIB2026AB000000':'IRS202600000001'}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{waybill.length}/15</span></div><label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-cyan-500"><input type="checkbox" checked={isElectronic} onChange={e=>{setIsElectronic(e.target.checked);setPreview(null)}} className="size-3.5 accent-cyan-500"/>E-irsaliye / GİB</label></Field>
      <Field label={t(`${I}.waybillDate`)}><AppDateInput value={waybillDate} onChange={e=>{setWaybillDate(e.target.value);setPreview(null)}}/></Field>
      <Field label={t(`${I}.plannedArrival`)}><AppDateInput type="datetime-local" value={plannedArrival} onChange={e=>{setPlannedArrival(e.target.value);setPreview(null)}}/></Field>
      <Field label={t(`${I}.excelFile`)}><label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/50 bg-cyan-500/5 text-sm font-bold text-cyan-500"><Upload className="size-4"/>{fileName||t(`${I}.selectFile`)}<input type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>void onFile(e)}/></label></Field>
    </div><div className="mt-5 flex flex-wrap justify-between gap-3"><button onClick={downloadTemplate} className="rounded-xl border px-5 py-2.5 font-bold"><Download className="mr-2 inline size-4"/>{t(`${I}.templateBtn`)}</button><div className="flex gap-3"><button onClick={()=>void run(false)} disabled={busy} className="rounded-xl border px-5 py-2.5 font-bold">{busy?<Loader2 className="size-4 animate-spin"/>:t(`${I}.previewBtn`)}</button><button onClick={()=>void run(true)} disabled={busy||!preview||preview.errorRows>0} className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white disabled:opacity-40">{t(`${I}.saveTransferBtn`)}</button></div></div></div>
    {preview&&<SteelImportPreviewGrid preview={preview} lines={lines}/>}
    {commitResult&&<SteelImportCommitResultGrid result={commitResult}/>}
  </section>}
function SteelImportPreviewGrid({preview,lines}:{preview:SteelImportPreview;lines:SteelImportLine[]}){
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const previewStats=useMemo(()=>[
    {key:'total',label:t(`${I}.previewTotal`),value:preview.totalRows,tone:'neutral' as const},
    {key:'new',label:t(`${I}.previewNew`),value:preview.newRows,tone:'active' as const},
    {key:'existing',label:t(`${I}.previewExisting`),value:preview.existingRows,tone:'done' as const},
    {key:'error',label:t(`${I}.previewError`),value:preview.errorRows,tone:'danger' as const},
  ],[preview,t]);
  const rows=useMemo(()=>{
    const sourceByRow=new Map(lines.map(line=>[line.rowNumber,line]));
    return preview.lines.map((row,index)=>toPreviewGridRow({row,source:sourceByRow.get(row.rowNumber),lineNo:index+1}));
  },[lines,preview]);
  const searchableKeys=useMemo(()=>['lineNo','netsisOrderNo','netsisOrderLineNo','stockCode','supplierSerialNo','existingDCode','secondarySerialNo','combinedSize','materialGrade','heatNumber','certificateNumber','action','errors'],[]);
  const columns=useMemo<GridColumn<SteelImportPreviewGridRow>[]>(()=>[
    {key:'lineNo',label:t(`${I}.colRow`),width:88,render:r=>r.lineNo,contextValue:r=>r.lineNo},
    {key:'netsisOrderNo',label:t(`${I}.colOrderNo`),render:r=><span className="font-mono">{gridDash(r.netsisOrderNo)}</span>,contextValue:r=>r.netsisOrderNo},
    {key:'netsisOrderLineNo',label:t(`${I}.colOrderLineNo`),render:r=><span className="font-mono">{gridDash(r.netsisOrderLineNo)}</span>,contextValue:r=>r.netsisOrderLineNo},
    {key:'stockCode',label:t(`${I}.colStock`),render:r=><span className="font-mono font-bold">{gridDash(r.stockCode)}</span>,contextValue:r=>r.stockCode},
    {key:'supplierSerialNo',label:t(`${I}.colSerial`),render:r=><span className="font-mono">{gridDash(r.supplierSerialNo)}</span>,contextValue:r=>r.supplierSerialNo},
    {key:'existingDCode',label:t(`${I}.colDCode`),render:r=><span className="font-mono font-bold text-cyan-500">{gridDash(r.existingDCode)}</span>,contextValue:r=>r.existingDCode},
    {key:'secondarySerialNo',label:t(`${I}.colSerial2`),render:r=><span className="font-mono">{gridDash(r.secondarySerialNo)}</span>,contextValue:r=>r.secondarySerialNo},
    {key:'expectedQuantity',label:t(`${I}.colQuantity`),render:r=><span className="font-mono font-bold">{r.expectedQuantity?formatProjectNumber(r.expectedQuantity):'-'}</span>,contextValue:r=>r.expectedQuantity},
    {key:'unitCode',label:t(`${I}.colUnit`),render:r=>gridDash(r.unitCode),contextValue:r=>r.unitCode},
    {key:'combinedSize',label:t(`${I}.colCombinedSize`),render:r=>gridDash(r.combinedSize),contextValue:r=>r.combinedSize},
    {key:'materialGrade',label:t(`${I}.colMaterialGrade`),render:r=>gridDash(r.materialGrade),contextValue:r=>r.materialGrade},
    {key:'heatNumber',label:t(`${I}.colHeatNumber`),render:r=><span className="font-mono">{gridDash(r.heatNumber)}</span>,contextValue:r=>r.heatNumber},
    {key:'certificateNumber',label:t(`${I}.colCertificateNumber`),render:r=><span className="font-mono">{gridDash(r.certificateNumber)}</span>,contextValue:r=>r.certificateNumber},
    {key:'action',label:t(`${I}.colAction`),filterType:'enum',render:r=>localizePreviewAction(r.action,t),contextValue:r=>localizePreviewAction(r.action,t)},
    {key:'errors',label:t(`${I}.colErrors`),sortable:false,width:220,render:r=><PreviewErrorCell errors={r.errors} lineNo={r.lineNo}/>,contextValue:r=>r.errors.join(', ')},
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gridLanguage forces column label refresh
  ],[t,gridLanguage]);
  const fetchPage=useCallback(async(request:GridRequest)=>filterLocalGrid(rows,request,searchableKeys),[rows,searchableKeys]);
  return <>
    <style>{`
      html .steel-import-preview-grid .wms-ops-data-grid-shell {
        overflow: visible !important;
      }
      html .steel-import-preview-grid .wms-ops-list :is(.wms-ops-data-grid-wrap, .wms-ops-table-wrap, .wms-ops-table-h-scroll) {
        max-height: none !important;
        overflow-y: visible !important;
      }
    `}</style>
    <div className="steel-import-preview-grid space-y-3 [&_.wms-ops-grid-pagination]:hidden">
      <div className="wms-ops-list flex flex-wrap items-center gap-2">
        {previewStats.map(stat=><ImportStatBadge key={stat.key} label={stat.label} value={stat.value} tone={stat.tone}/>)}
      </div>
      <AdvancedDataGrid pageKey="steel-import-preview" persistPreferences={false} eyebrow="" title={t(`${I}.previewTitle`)} description={t(`${I}.previewTableHint`)} columns={columns} fetchPage={fetchPage} refreshKey={rows.length}/>
    </div>
  </>;
}
function SteelImportCommitResultGrid({result}:{result:SteelImportCommitResult}){
  const {t,i18n}=useTranslation('common');
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const rows=useMemo(()=>result.lines.map(line=>({...line,lineNo:line.lineNo})),[result.lines]);
  const searchableKeys=useMemo(()=>['lineNo','netsisOrderNo','stockCode','supplierSerialNo','dCode','secondarySerialNo','combinedSize','materialGrade','heatNumber','certificateNumber'],[]);
  const columns=useMemo<GridColumn<SteelLineRow>[]>(()=>[
    {key:'lineNo',label:t(`${I}.colRow`),width:88,render:r=>r.lineNo,contextValue:r=>r.lineNo},
    {key:'netsisOrderNo',label:t(`${I}.colOrderNo`),render:r=><span className="font-mono">{gridDash(r.netsisOrderNo)}</span>,contextValue:r=>r.netsisOrderNo},
    {key:'stockCode',label:t(`${I}.colStock`),render:r=><span className="font-mono font-bold">{gridDash(r.stockCode)}</span>,contextValue:r=>r.stockCode},
    {key:'supplierSerialNo',label:t(`${I}.colSerial`),render:r=><span className="font-mono">{gridDash(r.supplierSerialNo)}</span>,contextValue:r=>r.supplierSerialNo},
    {key:'dCode',label:t(`${I}.colDCode`),render:r=><span className="font-mono font-bold text-cyan-500">{gridDash(r.dCode)}</span>,contextValue:r=>r.dCode},
    {key:'secondarySerialNo',label:t(`${I}.colSerial2`),render:r=><span className="font-mono">{gridDash(r.secondarySerialNo)}</span>,contextValue:r=>r.secondarySerialNo},
    {key:'expectedQuantity',label:t(`${I}.colQuantity`),render:r=><span className="font-mono font-bold">{r.expectedQuantity?formatProjectNumber(r.expectedQuantity):'-'}</span>,contextValue:r=>r.expectedQuantity},
    {key:'unitCode',label:t(`${I}.colUnit`),render:r=>gridDash(r.unitCode),contextValue:r=>r.unitCode},
    {key:'combinedSize',label:t(`${I}.colCombinedSize`),render:r=>gridDash(r.combinedSize),contextValue:r=>r.combinedSize},
    {key:'materialGrade',label:t(`${I}.colMaterialGrade`),render:r=>gridDash(r.materialGrade),contextValue:r=>r.materialGrade},
    {key:'heatNumber',label:t(`${I}.colHeatNumber`),render:r=><span className="font-mono">{gridDash(r.heatNumber)}</span>,contextValue:r=>r.heatNumber},
    {key:'certificateNumber',label:t(`${I}.colCertificateNumber`),render:r=><span className="font-mono">{gridDash(r.certificateNumber)}</span>,contextValue:r=>r.certificateNumber},
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gridLanguage forces column label refresh
  ],[t,gridLanguage]);
  const fetchPage=useCallback(async(request:GridRequest)=>filterLocalGrid(rows,request,searchableKeys),[rows,searchableKeys]);
  const gridTitle=<span className="inline-flex flex-wrap items-center gap-2.5">
    <span>{result.importReferenceNo}</span>
    {result.waybillNo?(
      <OpsStatusBadge tone="active" className="!px-2.5 !py-1 !text-[11px] !normal-case !tracking-wide" title={t(`${I}.waybillNo`)}>
        <span className="font-semibold">{t(`${I}.waybillNo`)}:</span>{' '}
        <span className="font-mono font-black">{result.waybillNo}</span>
      </OpsStatusBadge>
    ):null}
  </span>;
  return <>
    <style>{`
      html .steel-import-commit-grid .wms-ops-data-grid-shell {
        overflow: visible !important;
      }
      html .steel-import-commit-grid .wms-ops-list :is(.wms-ops-data-grid-wrap, .wms-ops-table-wrap, .wms-ops-table-h-scroll) {
        max-height: none !important;
        overflow-y: visible !important;
      }
    `}</style>
    <div className="steel-import-commit-grid space-y-3 [&_.wms-ops-grid-pagination]:hidden">
      <div className="wms-ops-list flex flex-wrap items-center gap-2">
        <OpsStatusBadge tone="done" className="!px-3 !py-1.5 !text-[11px] !normal-case !tracking-wide">
          {t(`${I}.commitResultSaved`)}
        </OpsStatusBadge>
        <ImportStatBadge label={t(`${I}.previewTotal`)} value={rows.length} tone="neutral"/>
      </div>
      <AdvancedDataGrid
        pageKey="steel-import-commit-result"
        persistPreferences={false}
        eyebrow=""
        title={gridTitle}
        description={t(`${I}.commitResultDescription`,{fileName:result.sourceFileName||'-',count:rows.length})}
        columns={columns}
        fetchPage={fetchPage}
        refreshKey={rows.length}
      />
    </div>
  </>;
}
function PreviewErrorCell({errors,lineNo}:{errors:string[];lineNo:number}){
  const {t}=useTranslation('common');
  const [open,setOpen]=useState(false);
  const text=errors.join(', ');
  if(!errors.length)return <span className="text-slate-500">-</span>;
  return <>
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={()=>setOpen(true)} className="block w-full max-w-full truncate text-left font-medium text-red-500 hover:underline" title={text}>
            {text}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm whitespace-pre-wrap break-words text-left">
          <p>{text}</p>
          <p className="mt-1 text-xs opacity-80">{t(`${I}.errorDetailHint`)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    {open&&<Dialog open onOpenChange={setOpen}>
      <OpsDialogContent size="md" portalRoot="body" className="data-no-auto-localize">
        <OpsDialogHeader>
          <DialogTitle className="wms-ops-detail-dialog__title">{t(`${I}.errorDetailTitle`,{row:lineNo})}</DialogTitle>
        </OpsDialogHeader>
        <OpsDialogBody>
          <ul className="space-y-2 text-sm text-red-600">{errors.map((error,index)=><li key={index} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">{error}</li>)}</ul>
        </OpsDialogBody>
      </OpsDialogContent>
    </Dialog>}
  </>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
