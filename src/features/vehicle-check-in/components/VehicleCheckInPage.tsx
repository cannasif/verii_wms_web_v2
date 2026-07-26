import {useEffect,useMemo,useState,type ChangeEvent,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import {AlertTriangle,Camera,CarFront,ImagePlus,Loader2,Search,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {steelReceiptApi} from '@/features/steel-receipt/api/steel-receipt.api';
import type {SteelLineRow} from '@/features/steel-receipt/types/steel-receipt.types';
import {useAuthStore} from '@/stores/auth-store';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {SaveVehicleCheckInRequest,VehicleCheckInDetail,VehicleCheckInImage} from '../types';

const empty=(branchCode:string):SaveVehicleCheckInRequest=>({branchCode,plateNo:'',trailerPlateNo:'',driverFirstName:'',driverLastName:'',driverPhone:'',carrierName:'',steelSheetCount:1,note:''});
const customerOption=(x:{id:number;customerCode:string;customerName:string})=>({value:`${x.id}|${encodeURIComponent(x.customerCode)}|${encodeURIComponent(x.customerName)}`,label:`${x.customerCode} · ${x.customerName}`});
const imageExtension=/\.(jpe?g|png|webp)$/i;
const isImageFile=(file:File)=>file.type.startsWith('image/')||(!file.type&&imageExtension.test(file.name));
const guessImageType=(name:string)=>name.toLowerCase().endsWith('.png')?'image/png':name.toLowerCase().endsWith('.webp')?'image/webp':'image/jpeg';
const sanitizeFilePart=(value:string)=>value.trim().replace(/[<>:"/\\|?*\s]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'NA';
const buildSheetImageName=(row:SteelLineRow,index:number,originalName:string)=>{
  const match=originalName.match(imageExtension);
  const ext=match?match[0].toLowerCase():'.jpg';
  const base=[row.dCode,row.supplierSerialNo,row.stockCode].map(sanitizeFilePart).join('_');
  return index===0?`${base}${ext}`:`${base}_${index+1}${ext}`;
};

export function VehicleCheckInPage(){
  const [searchParams,setSearchParams]=useSearchParams();
  const branch=useAuthStore(s=>s.branch?.code??'0');const [form,setForm]=useState<SaveVehicleCheckInRequest>(()=>empty(branch));
  const [customer,setCustomer]=useState<string|null>(null);const [record,setRecord]=useState<VehicleCheckInDetail|null>(null);
  const [files,setFiles]=useState<File[]>([]);const [busy,setBusy]=useState(false);
  const [saveWarningOpen,setSaveWarningOpen]=useState(false);
  const [photoGateWarningOpen,setPhotoGateWarningOpen]=useState(false);
  const [sheetInput,setSheetInput]=useState('');const [sheetSearch,setSheetSearch]=useState('');
  const [photoGate,setPhotoGate]=useState<{search:string;satisfied:boolean}|null>(null);
  const pendingPreviews=useMemo(()=>files.map(file=>({file,url:URL.createObjectURL(file)})),[files]);
  useEffect(()=>()=>{pendingPreviews.forEach(item=>URL.revokeObjectURL(item.url))},[pendingPreviews]);
  const sheetLines=useQuery({queryKey:['vehicle-check-in-sheet-search',sheetSearch],enabled:sheetSearch.length>=2,
    queryFn:()=>steelReceiptApi.linesPaged({pageNumber:1,pageSize:50,search:sheetSearch,filterLogic:'and',filters:[],sortBy:'lineNo',sortDirection:'asc'})});
  useEffect(()=>{
    if(sheetSearch.length<2||sheetLines.isLoading)return;
    const hasResults=(sheetLines.data?.items?.length??0)>0;
    if(!hasResults){
      setPhotoGate(current=>current?.search===sheetSearch?null:current);
      return;
    }
    setPhotoGate(current=>current?.search===sheetSearch?current:{search:sheetSearch,satisfied:false});
  },[sheetSearch,sheetLines.isLoading,sheetLines.data?.items]);
  const entryText=useMemo(()=>record?formatProjectDateTime(record.header.checkedInAtUtc):'Kayıt sırasında UTC olarak oluşturulur.',[record]);
  const patch=<K extends keyof SaveVehicleCheckInRequest>(key:K,value:SaveVehicleCheckInRequest[K])=>setForm(v=>({...v,[key]:value}));
  const hydrate=(detail:VehicleCheckInDetail)=>{setRecord(detail);const h=detail.header;setForm({id:h.id,rowVersion:h.rowVersion,branchCode:h.branchCode,plateNo:h.plateNo,trailerPlateNo:h.trailerPlateNo,driverFirstName:h.driverFirstName,driverLastName:h.driverLastName,driverPhone:h.driverPhone,carrierName:h.carrierName,steelSheetCount:h.steelSheetCount||1,customerId:h.customerId,note:h.note});setCustomer(h.customerId?`${h.customerId}|${encodeURIComponent(h.customerCode||'')}|${encodeURIComponent(h.customerName||'')}`:null)};
  useEffect(()=>{const id=Number(searchParams.get('id'));if(!Number.isFinite(id)||id<=0)return;setBusy(true);void vehicleCheckInApi.get(id).then(hydrate).catch(e=>toast.error(e instanceof Error?e.message:'Araç kaydı getirilemedi.')).finally(()=>setBusy(false))},[searchParams]);
  const findToday=async()=>{if(!form.plateNo.trim()){toast.error('Plaka zorunludur.');return}setBusy(true);try{const detail=await vehicleCheckInApi.today(branch,form.plateNo);if(detail){hydrate(detail);toast.success('Bugünkü araç kaydı getirildi.')}else{setRecord(null);toast.info('Bugün için kayıt bulunamadı; yeni kayıt oluşturabilirsiniz.')}}catch(e){toast.error(e instanceof Error?e.message:'Araç kaydı aranamadı.')}finally{setBusy(false)}};
  const performSave=async()=>{setSaveWarningOpen(false);setBusy(true);try{const detail=await vehicleCheckInApi.save({...form,branchCode:branch,plateNo:form.plateNo.trim().toUpperCase()});hydrate(detail);setSearchParams({id:String(detail.header.id)},{replace:true});toast.success('Araç giriş kaydı kaydedildi.')}catch(e){toast.error(e instanceof Error?e.message:'Araç kaydı oluşturulamadı.')}finally{setBusy(false)}};
  const openPhotoGateWarning=()=>{
    window.setTimeout(()=>setPhotoGateWarningOpen(true),0);
  };
  const requestSave=()=>{
    if(!form.plateNo.trim()){toast.error('Plaka zorunludur.');return}
    if(!Number.isInteger(form.steelSheetCount)||form.steelSheetCount<=0){toast.error('Sac levha adedi pozitif tam sayı olmalıdır.');return}
    if(photoGate&&!photoGate.satisfied){openPhotoGateWarning();return}
    if(files.length>0){setSaveWarningOpen(true);return}
    void performSave();
  };
  const upload=async()=>{if(!record||!files.length){toast.error('Önce araç kaydını oluşturup görsel seçin.');return}setBusy(true);try{await vehicleCheckInApi.upload(record.header.id,files);hydrate(await vehicleCheckInApi.get(record.header.id));setFiles([]);toast.success('Araç görselleri yüklendi.')}catch(e){toast.error(e instanceof Error?e.message:'Görseller yüklenemedi.')}finally{setBusy(false)}};
  const open=async(id:number)=>{try{const blob=await vehicleCheckInApi.download(id);const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');window.setTimeout(()=>URL.revokeObjectURL(url),60_000)}catch(e){toast.error(e instanceof Error?e.message:'Görsel açılamadı.')}};
  const remove=async(id:number)=>{if(!record||!window.confirm('Araç görseli silinsin mi?'))return;setBusy(true);try{await vehicleCheckInApi.removeImage(id);hydrate(await vehicleCheckInApi.get(record.header.id));toast.success('Görsel silindi.')}catch(e){toast.error(e instanceof Error?e.message:'Görsel silinemedi.')}finally{setBusy(false)}};
  const selectCustomer=(value:string|null)=>{setCustomer(value);const [id]=value?.split('|')??[];patch('customerId',id?Number(id):undefined)};
  const onFiles=(e:ChangeEvent<HTMLInputElement>)=>{setFiles(Array.from(e.target.files??[]).filter(isImageFile).slice(0,10));e.currentTarget.value=''};
  const removePendingFile=(file:File)=>setFiles(current=>current.filter(item=>item!==file));
  const addSheetPhotos=(row:SteelLineRow,list:FileList|null)=>{
    if(!list?.length)return;
    const images=Array.from(list).filter(isImageFile);
    if(!images.length){toast.error('Geçerli görsel seçilmedi.');return}
    setFiles(current=>{
      const available=Math.max(0,10-current.length);
      if(available===0){toast.error('Bir işlemde en fazla 10 görsel eklenebilir.');return current}
      const base=[row.dCode,row.supplierSerialNo,row.stockCode].map(sanitizeFilePart).join('_');
      const existingCount=current.filter(file=>file.name===`${base}.jpg`||file.name===`${base}.jpeg`||file.name===`${base}.png`||file.name===`${base}.webp`||file.name.startsWith(`${base}_`)).length;
      const accepted=images.slice(0,available).map((file,index)=>new File([file],buildSheetImageName(row,existingCount+index,file.name),{type:file.type||guessImageType(file.name),lastModified:file.lastModified}));
      if(accepted.length<images.length)toast.info('Bir işlemde en fazla 10 görsel eklenebilir; fazla dosyalar alınmadı.');
      toast.success(`${accepted.length} görsel araç görsellerine eklendi.`);
      return [...current,...accepted];
    });
    setPhotoGate(current=>current?{...current,satisfied:true}:current);
  };
  const runSheetSearch=()=>{
    const next=sheetInput.trim();
    if(next.length<2){toast.error('Arama için en az 2 karakter girin.');return}
    if(photoGate&&!photoGate.satisfied&&next!==photoGate.search){
      openPhotoGateWarning();
      return;
    }
    setSheetSearch(next);
  };
  const forceSheetSearch=()=>{
    const next=sheetInput.trim();
    if(next.length<2){toast.error('Arama için en az 2 karakter girin.');return}
    setPhotoGateWarningOpen(false);
    setPhotoGate(null);
    setSheetSearch(next);
  };
  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">Mal Kabul · SAC İşlemleri · 1. Adım</p><h1 className="mt-1 text-2xl font-black">SAC Araç Giriş İşlemi</h1><p className="text-sm text-slate-500">V1 operasyon kuralı korunur: aynı şube, aynı iş günü ve aynı plaka tekrar girilirse yeni kayıt açılmaz; mevcut kayıt güncellenir.</p></header>
    <Panel title="Araç ve Sürücü Bilgileri" icon={<CarFront/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Çekici Plakası *"><div className="flex gap-2"><input className="input uppercase" value={form.plateNo} onChange={e=>patch('plateNo',e.target.value.toUpperCase())} onBlur={()=>void findToday()} maxLength={25}/><button type="button" onClick={()=>void findToday()} disabled={busy} className="rounded-xl border px-4"><Search className="size-4"/></button></div></Field>
      <Field label="Dorse Plakası"><input className="input uppercase" value={form.trailerPlateNo||''} onChange={e=>patch('trailerPlateNo',e.target.value.toUpperCase())} maxLength={25}/></Field>
      <Field label="Araç Giriş Zamanı"><input className="input" value={entryText} readOnly/></Field>
      <Field label="Şoför Adı"><input className="input" value={form.driverFirstName||''} onChange={e=>patch('driverFirstName',e.target.value)} maxLength={100}/></Field>
      <Field label="Şoför Soyadı"><input className="input" value={form.driverLastName||''} onChange={e=>patch('driverLastName',e.target.value)} maxLength={100}/></Field>
      <Field label="Şoför Telefonu"><input className="input" value={form.driverPhone||''} onChange={e=>patch('driverPhone',e.target.value)} maxLength={40}/></Field>
      <Field label="Nakliyeci / Taşıyıcı"><input className="input" value={form.carrierName||''} onChange={e=>patch('carrierName',e.target.value)} maxLength={200}/></Field>
      <Field label="Sac Levha Adedi *"><input className="input" type="number" min="1" max="100000" step="1" value={form.steelSheetCount} onChange={e=>patch('steelSheetCount',Number(e.target.value))}/></Field>
      <Field label="Tedarikçi / Cari"><PagedAppDropdown queryKey={['vehicle-check-in-customers',branch]} fetchPage={r=>goodsReceiptV2Api.customers(r,branch)} toOption={customerOption} value={customer} onValueChange={selectCustomer} searchable minSearchLength={2} placeholder="Cari seçin"/></Field>
      <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
        <Field label="Saha Notu"><textarea className="input min-h-20" value={form.note||''} onChange={e=>patch('note',e.target.value)} maxLength={1000}/></Field>
        <Field label="Seri No (Levha No) Bul">
          <div className="flex gap-2">
            <input
              className="input"
              value={sheetInput}
              onChange={e=>setSheetInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key!=='Enter')return;
                e.preventDefault();
                e.stopPropagation();
                runSheetSearch();
              }}
            />
            <button type="button" onClick={runSheetSearch} className="rounded-xl bg-cyan-600 px-5 font-bold text-white">Ara</button>
          </div>
        </Field>
      </div>
    </div>
    {sheetSearch.length>=2&&<SheetResultTable lines={sheetLines.data?.items??[]} loading={sheetLines.isLoading} onAddPhotos={addSheetPhotos}/>}
    <div className="mt-5 flex justify-end"><button onClick={requestSave} disabled={busy} className="rounded-xl bg-cyan-600 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:<><CarFront className="mr-2 inline size-4"/>Araç Girişini Kaydet</>}</button></div></Panel>
    <Panel title="Araç Görselleri" icon={<Camera/>}><p className="mb-4 text-sm text-slate-500">Kapı, plaka, dorse ve yük güvenliği görsellerini kayıtla ilişkilendirin. Dosyalar dışarıdan doğrudan erişilemeyen güvenli alanda tutulur.</p>
      <div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-xl border border-dashed border-cyan-500/50 px-4 py-3 text-sm font-bold text-cyan-500"><ImagePlus className="mr-2 inline size-4"/>{files.length?`${files.length} görsel seçildi`:'Görsel seç'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles}/></label><button disabled={busy||!record||!files.length} onClick={()=>void upload()} className="rounded-xl border px-4 py-3 font-bold disabled:opacity-40">Görselleri Yükle</button></div>
      {pendingPreviews.length>0&&<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{pendingPreviews.map(item=><figure key={item.url} className="overflow-hidden rounded-2xl border bg-[var(--wms-app-surface)]"><img src={item.url} alt={item.file.name} className="h-56 w-full object-cover"/><figcaption className="space-y-2 p-3"><strong className="block truncate text-sm">{item.file.name}</strong><small className="block text-slate-500">Yüklenmeyi bekliyor · {Math.ceil(item.file.size/1024)} KB</small><button type="button" onClick={()=>removePendingFile(item.file)} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-bold text-red-500"><Trash2 className="size-4"/>Seçimden Kaldır</button></figcaption></figure>)}</div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{record?.images.map(image=><VehicleImageCard key={image.id} image={image} onOpen={()=>void open(image.id)} onRemove={()=>void remove(image.id)}/>)}</div>
    </Panel>
    <Dialog open={photoGateWarningOpen} onOpenChange={setPhotoGateWarningOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><AlertTriangle className="size-6 text-amber-500"/>Fotoğraf zorunlu</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            <strong className="font-black text-foreground">“{photoGate?.search}”</strong> için henüz fotoğraf eklenmedi. Başka bir seri aramak veya kaydı tamamlamak için önce bu seriye ait satırdan fotoğraf ekleyin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          <button type="button" onClick={forceSheetSearch} className="rounded-xl border px-5 py-3 text-base font-bold">Yine de Ara</button>
          <button type="button" onClick={()=>setPhotoGateWarningOpen(false)} className="rounded-xl bg-cyan-600 px-5 py-3 text-base font-bold text-white">Tamam</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={saveWarningOpen} onOpenChange={setSaveWarningOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><AlertTriangle className="size-6 text-amber-500"/>Yüklenmemiş görseller var</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {files.length} görsel henüz sunucuya yüklenmedi. Araç girişini şimdi kaydederseniz görseller bekleyen listede kalır; ardından <strong className="font-black text-foreground">“Görselleri Yükle”</strong> butonuyla yüklemeniz gerekir.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={()=>setSaveWarningOpen(false)} className="rounded-xl border px-5 py-3 text-base font-bold">Geri Dön</button>
          <button type="button" onClick={()=>void performSave()} className="rounded-xl bg-cyan-600 px-5 py-3 text-base font-bold text-white">Yine de Kaydet</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
function VehicleImageCard({image,onOpen,onRemove}:{image:VehicleCheckInImage;onOpen:()=>void;onRemove:()=>void}){
  const [src,setSrc]=useState<string|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;let objectUrl:string|null=null;
    setFailed(false);setSrc(null);
    void vehicleCheckInApi.download(image.id).then(blob=>{
      if(!active)return;
      objectUrl=URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(()=>{if(active)setFailed(true)});
    return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[image.id]);
  return <figure className="overflow-hidden rounded-2xl border bg-[var(--wms-app-surface)]">
    <button type="button" onClick={onOpen} className="relative block h-56 w-full bg-slate-950/5" title="Büyüt">
      {src?<img src={src} alt={image.fileName} className="h-full w-full object-cover"/>:
        <span className="grid h-full place-items-center text-sm text-slate-500">{failed?'Önizleme alınamadı':<Loader2 className="size-5 animate-spin"/>}</span>}
    </button>
    <figcaption className="space-y-2 p-3">
      <button type="button" className="block w-full truncate text-left text-sm font-bold text-cyan-500" onClick={onOpen}>{image.fileName}</button>
      <small className="block text-slate-500">{Math.ceil(image.fileSize/1024)} KB</small>
      <button type="button" onClick={onRemove} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-bold text-red-500"><Trash2 className="size-4"/>Sil</button>
    </figcaption>
  </figure>;
}
function SheetResultTable({lines,loading,onAddPhotos}:{lines:SteelLineRow[];loading:boolean;onAddPhotos:(row:SteelLineRow,files:FileList|null)=>void}){
  const actor=(value?:number|null)=>value?`Kullanıcı #${value}`:'Sistem';
  const date=(value?:string|null)=>value?formatProjectDateTime(value):'-';
  return <div className="mt-5 overflow-x-auto rounded-xl border">
    <div className="border-b px-4 py-3"><strong className="text-sm">Seri Bazında Kontrol Listesi</strong><p className="text-xs text-slate-500">Aranan levha/parti satırları saha kabul kontrolündeki kolon yapısıyla listelenir.</p></div>
    <table className="min-w-full text-left text-sm">
      <thead className="bg-[var(--wms-app-surface)] text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-3 py-2">Kayıt ID</th>
          <th className="px-3 py-2">Kayıt Eden</th>
          <th className="px-3 py-2">Kayıt Zamanı</th>
          <th className="px-3 py-2">DCode</th>
          <th className="px-3 py-2">Tedarikçi Seri</th>
          <th className="px-3 py-2">Stok</th>
          <th className="px-3 py-2">Ölçü / Kalite</th>
          <th className="px-3 py-2">Beklenen</th>
          <th className="px-3 py-2">Varış</th>
          <th className="px-3 py-2">Kontrol</th>
          <th className="px-3 py-2">İşlemler</th>
        </tr>
      </thead>
      <tbody>
        {loading&&<tr><td colSpan={11} className="px-3 py-4 text-slate-500">Aranıyor...</td></tr>}
        {!loading&&lines.length===0&&<tr><td colSpan={11} className="px-3 py-4 text-slate-500">Eşleşen SAC levhası bulunamadı.</td></tr>}
        {!loading&&lines.map(r=><tr key={r.id} className="border-t">
          <td className="px-3 py-2 font-mono text-xs font-semibold">#{r.id}</td>
          <td className="px-3 py-2">{actor(r.createdBy)}</td>
          <td className="px-3 py-2">{date(r.createdDate)}</td>
          <td className="px-3 py-2 font-mono font-bold text-cyan-500">{r.dCode}</td>
          <td className="px-3 py-2"><strong>{r.supplierSerialNo}</strong><small className="block text-slate-500">{r.secondarySerialNo||'-'}</small></td>
          <td className="px-3 py-2"><strong>{r.stockCode}</strong><small className="block text-slate-500">{r.stockName}</small></td>
          <td className="px-3 py-2">{r.combinedSize||'-'}<small className="block text-slate-500">{r.materialGrade||'-'} · Heat {r.heatNumber||'-'}</small></td>
          <td className="px-3 py-2">{formatProjectNumber(r.expectedQuantity)} {r.unitCode}</td>
          <td className="px-3 py-2"><Badge value={r.arrivalStatus}/></td>
          <td className="px-3 py-2"><Badge value={r.inspectionStatus}/></td>
          <td className="px-3 py-2">
            <label className="cursor-pointer rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-bold text-cyan-500"><Camera className="mr-1 inline size-3.5"/>Fotoğraf Ekle<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={e=>{onAddPhotos(r,e.target.files);e.currentTarget.value=''}}/></label>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
function Badge({value}:{value:string}){return <span className="rounded-full border px-2.5 py-1 text-xs font-bold">{value}</span>}
function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-500">{icon}{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
