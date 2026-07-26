import {useEffect,useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardCheck,ExternalLink,FileImage,Trash2,Upload} from 'lucide-react';
import {toast} from 'sonner';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {systemColumns,requiredActionColumn} from '@/components/shared/GridSystemColumns';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelAttachment,SteelLineRow} from '../types/steel-receipt.types';
import {SteelProcessHeader} from './SteelProcessHeader';
export function SteelReceiptInspectionPage(){
  const cache=useQueryClient();const [row,setRow]=useState<SteelLineRow|null>(null);const [batchInput,setBatchInput]=useState('');const [batchSearch,setBatchSearch]=useState('');
  const batches=useQuery({queryKey:['steel-inspection-batch-search',batchSearch],enabled:batchSearch.length>=2,
    queryFn:()=>steelReceiptApi.linesPaged({pageNumber:1,pageSize:50,search:batchSearch,filterLogic:'and',filters:[],sortBy:'lineNo',sortDirection:'asc'})});
  const columns=useMemo<GridColumn<SteelLineRow>[]>(()=>[...systemColumns<SteelLineRow>(),
    {key:'dCode',label:'DCode',render:r=><span className="font-mono font-bold text-cyan-500">{r.dCode}</span>},
    {key:'supplierSerialNo',label:'Tedarikçi Seri',render:r=><><strong>{r.supplierSerialNo}</strong><small className="block text-slate-500">{r.secondarySerialNo||'-'}</small></>},
    {key:'stockCode',label:'Stok',render:r=><><strong>{r.stockCode}</strong><small className="block text-slate-500">{r.stockName}</small></>},
    {key:'combinedSize',label:'Ölçü / Kalite',render:r=><>{r.combinedSize||'-'}<small className="block text-slate-500">{r.materialGrade||'-'} · Heat {r.heatNumber||'-'}</small></>},
    {key:'expectedQuantity',label:'Beklenen',render:r=>`${formatProjectNumber(r.expectedQuantity)} ${r.unitCode}`},
    {key:'arrivalStatus',label:'Varış',render:r=><Badge value={r.arrivalStatus}/>},
    {key:'inspectionStatus',label:'Kontrol',render:r=><Badge value={r.inspectionStatus}/>},
    {key:'actions',label:'İşlemler',...requiredActionColumn,render:r=><button type="button" disabled={r.conversionStatus==='Created'} onClick={()=>setRow(r)} className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-bold text-cyan-500 disabled:opacity-30"><ClipboardCheck className="mr-1 inline size-3.5"/>Kontrol</button>},
  ],[]);
  const done=async()=>{await cache.invalidateQueries({queryKey:['advanced-grid','steel-receipt-inspection']});setRow(null)};
  return <><SteelProcessHeader currentStep="inspection" title="SAC Kabul ve Kalite Kontrolü" description="İthalat referansı, DCode, tedarikçi seri, stok veya Netsis sipariş numarasıyla partiyi bulun; ardından seri bazında izlenebilir karar verin." notice="Kalite kararı verilmeden levha ortak mal kabul emrine dönüştürülemez. Ret miktarı varsa gerekçe ve mümkünse fotoğraf/sertifika kanıtı ekleyin."/><section className="my-5 rounded-2xl border bg-[var(--wms-app-surface)] p-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">1 · Parti veya Levhayı Bul</p><div className="mt-4 flex gap-2"><input className="input" value={batchInput} onChange={e=>setBatchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')setBatchSearch(batchInput.trim())}} placeholder="Parti / seri / stok / sipariş ara..."/><button onClick={()=>setBatchSearch(batchInput.trim())} className="rounded-xl bg-cyan-600 px-5 font-bold text-white">Ara</button></div>
    {batchSearch.length>=2&&<div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(batches.data?.items??[]).map(item=><button key={item.id} onClick={()=>setRow(item)} className="rounded-xl border p-3 text-left hover:border-cyan-500"><strong className="font-mono text-cyan-500">{item.dCode}</strong><span className="ml-2 text-sm">{item.stockCode}</span><small className="block text-slate-500">{item.importReferenceNo} · {item.supplierSerialNo} · {item.inspectionStatus}</small></button>)}{!batches.isLoading&&!batches.data?.items.length&&<p className="text-sm text-slate-500">Eşleşen SAC levhası bulunamadı.</p>}</div>}</section>
    <AdvancedDataGrid pageKey="steel-receipt-inspection" title="2 · Seri Bazında Kontrol Listesi" description="Geldi, gelmedi, incelendi, kabul, kısmi kabul ve ret kararlarını; fotoğraf ve sertifika kanıtlarıyla yönetin." columns={columns} fetchPage={steelReceiptApi.linesPaged}/>{row&&<InspectionDialog row={row} close={()=>setRow(null)} done={()=>void done()}/>}</>;
}
export function InspectionDialog({row,close,done}:{row:SteelLineRow;close:()=>void;done:()=>void}){
  const [arrived,setArrived]=useState(row.arrivalStatus!=='Missing');const [arrivedQty,setArrivedQty]=useState(String(row.arrivedQuantity||row.expectedQuantity));
  const [approved,setApproved]=useState(String(row.approvedQuantity||row.expectedQuantity));const [rejected,setRejected]=useState(String(row.rejectedQuantity));
  const [reason,setReason]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);
  const [attachments,setAttachments]=useState<SteelAttachment[]>([]);const [attachmentBusy,setAttachmentBusy]=useState(false);
  const arrivedValue=Number(arrivedQty);const approvedValue=Number(approved);const rejectedValue=Number(rejected);
  const validationError=!arrived?null:
    ![arrivedValue,approvedValue,rejectedValue].every(Number.isFinite)?'Miktar alanları geçerli bir sayı olmalıdır.':
    [arrivedValue,approvedValue,rejectedValue].some(value=>value<0)?'Miktarlar negatif olamaz.':
    arrivedValue<=0?'Gelen miktar sıfırdan büyük olmalıdır.':
    arrivedValue>row.expectedQuantity?'Gelen miktar beklenen miktarı aşamaz.':
    approvedValue+rejectedValue>arrivedValue?'Kabul ve ret toplamı gelen miktarı aşamaz.':
    rejectedValue>0&&!reason.trim()?'Ret miktarı için ret nedeni zorunludur.':null;
  const unclassified=arrived&&Number.isFinite(arrivedValue-approvedValue-rejectedValue)?arrivedValue-approvedValue-rejectedValue:0;
  useEffect(()=>{void steelReceiptApi.attachments(row.id).then(setAttachments).catch(e=>toast.error(e instanceof Error?e.message:'Kontrol ekleri alınamadı.'))},[row.id]);
  const upload=async(file?:File)=>{if(!file)return;setAttachmentBusy(true);try{const added=await steelReceiptApi.uploadAttachment(row.id,file);setAttachments(v=>[added,...v]);toast.success('Kontrol kanıtı yüklendi.')}catch(e){toast.error(e instanceof Error?e.message:'Dosya yüklenemedi.')}finally{setAttachmentBusy(false)}};
  const openAttachment=async(item:SteelAttachment)=>{try{const blob=await steelReceiptApi.downloadAttachment(item.id);const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');window.setTimeout(()=>URL.revokeObjectURL(url),60_000)}catch(e){toast.error(e instanceof Error?e.message:'Dosya açılamadı.')}};
  const remove=async(item:SteelAttachment)=>{if(!window.confirm(`${item.fileName} silinsin mi?`))return;setAttachmentBusy(true);try{await steelReceiptApi.removeAttachment(item.id);setAttachments(v=>v.filter(x=>x.id!==item.id));toast.success('Kontrol kanıtı silindi.')}catch(e){toast.error(e instanceof Error?e.message:'Dosya silinemedi.')}finally{setAttachmentBusy(false)}};
  const save=async()=>{if(validationError){toast.error(validationError);return}setBusy(true);try{await steelReceiptApi.inspect(row.id,{isArrived:arrived,arrivedQuantity:arrived?arrivedValue:0,
    approvedQuantity:arrived?approvedValue:0,rejectedQuantity:arrived?rejectedValue:0,rejectReason:reason.trim()||undefined,note:note.trim()||undefined,rowVersion:row.rowVersion});
    toast.success('Kontrol kararı kaydedildi.');done()}catch(e){toast.error(e instanceof Error?e.message:'Kontrol kaydedilemedi.')}finally{setBusy(false)}};
  return <Dialog open onOpenChange={v=>{if(!v)close()}}><DialogContent className="!max-w-2xl"><DialogTitle>{row.dCode} · {row.supplierSerialNo}</DialogTitle>
    <div className="grid gap-4 sm:grid-cols-2"><Card label="Stok" value={`${row.stockCode} · ${row.stockName||''}`}/><Card label="Beklenen" value={`${row.expectedQuantity} ${row.unitCode}`}/></div>
    <label className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={arrived} onChange={e=>setArrived(e.target.checked)} className="size-4 accent-cyan-500"/><strong>Levha fiziksel olarak geldi</strong></label>
    {arrived&&<div className="grid gap-4 sm:grid-cols-3"><Field label="Gelen"><input className="input" type="number" step=".000001" value={arrivedQty} onChange={e=>setArrivedQty(e.target.value)}/></Field><Field label="Kabul"><input className="input" type="number" step=".000001" value={approved} onChange={e=>setApproved(e.target.value)}/></Field><Field label="Ret"><input className="input" type="number" step=".000001" value={rejected} onChange={e=>setRejected(e.target.value)}/></Field></div>}
    {arrived&&<div className={`rounded-xl border px-3 py-2 text-xs ${validationError?'border-red-500/30 bg-red-500/5 text-red-400':unclassified>0?'border-amber-500/30 bg-amber-500/5 text-amber-400':'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'}`}>{validationError??(unclassified>0?`${unclassified} ${row.unitCode} henüz kabul veya ret olarak sınıflandırılmadı.`:'Gelen miktarın tamamı sınıflandırıldı.')}</div>}
    {arrived&&Number(rejected)>0&&<Field label="Ret nedeni"><input className="input" value={reason} onChange={e=>setReason(e.target.value)}/></Field>}
    <Field label="Kontrol notu"><textarea className="input min-h-24" value={note} onChange={e=>setNote(e.target.value)}/></Field>
    <section className="space-y-3 rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><div><strong className="block">Fotoğraf / Sertifika Kanıtları</strong><small className="text-slate-500">JPG, PNG, WEBP veya PDF · en fazla 10 MB</small></div><label className="cursor-pointer rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-500"><Upload className="mr-1 inline size-3.5"/>Yükle<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={attachmentBusy} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value=''}}/></label></div>
      {attachments.length===0?<p className="text-xs text-slate-500">Henüz kontrol kanıtı eklenmedi.</p>:<div className="grid gap-2 sm:grid-cols-2">{attachments.map(item=><div key={item.id} className="flex items-center gap-2 rounded-lg border p-2"><FileImage className="size-4 shrink-0 text-cyan-500"/><span className="min-w-0 flex-1 truncate text-xs" title={item.fileName}>{item.fileName}</span><button onClick={()=>void openAttachment(item)} className="rounded p-1" title="Görüntüle"><ExternalLink className="size-4"/></button><button disabled={attachmentBusy} onClick={()=>void remove(item)} className="rounded p-1 text-red-500" title="Sil"><Trash2 className="size-4"/></button></div>)}</div>}
    </section>
    <div className="flex justify-end gap-3"><button onClick={close} className="rounded-xl border px-4 py-2">Vazgeç</button><button disabled={busy||!!validationError} onClick={()=>void save()} className="rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Kararı Kaydet</button></div>
  </DialogContent></Dialog>}
function Badge({value}:{value:string}){return <span className="rounded-full border px-2.5 py-1 text-xs font-bold">{value}</span>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
function Card({label,value}:{label:string;value:string}){return <div className="rounded-xl border p-3"><small className="text-slate-500">{label}</small><strong className="block">{value}</strong></div>}
