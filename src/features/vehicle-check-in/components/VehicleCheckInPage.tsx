import {useEffect,useMemo,useState,type ChangeEvent,type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Camera,CarFront,ImagePlus,Loader2,Search,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {useAuthStore} from '@/stores/auth-store';
import {formatProjectDateTime} from '@/lib/project-format';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {SaveVehicleCheckInRequest,VehicleCheckInDetail} from '../types';

const empty=(branchCode:string):SaveVehicleCheckInRequest=>({branchCode,plateNo:'',trailerPlateNo:'',driverFirstName:'',driverLastName:'',driverPhone:'',carrierName:'',note:''});
const customerOption=(x:{id:number;customerCode:string;customerName:string})=>({value:`${x.id}|${encodeURIComponent(x.customerCode)}|${encodeURIComponent(x.customerName)}`,label:`${x.customerCode} · ${x.customerName}`});

export function VehicleCheckInPage(){
  const [searchParams,setSearchParams]=useSearchParams();
  const branch=useAuthStore(s=>s.branch?.code??'0');const [form,setForm]=useState<SaveVehicleCheckInRequest>(()=>empty(branch));
  const [customer,setCustomer]=useState<string|null>(null);const [record,setRecord]=useState<VehicleCheckInDetail|null>(null);
  const [files,setFiles]=useState<File[]>([]);const [busy,setBusy]=useState(false);
  const entryText=useMemo(()=>record?formatProjectDateTime(record.header.checkedInAtUtc):'Kayıt sırasında UTC olarak oluşturulur.',[record]);
  const patch=<K extends keyof SaveVehicleCheckInRequest>(key:K,value:SaveVehicleCheckInRequest[K])=>setForm(v=>({...v,[key]:value}));
  const hydrate=(detail:VehicleCheckInDetail)=>{setRecord(detail);const h=detail.header;setForm({id:h.id,rowVersion:h.rowVersion,branchCode:h.branchCode,plateNo:h.plateNo,trailerPlateNo:h.trailerPlateNo,driverFirstName:h.driverFirstName,driverLastName:h.driverLastName,driverPhone:h.driverPhone,carrierName:h.carrierName,customerId:h.customerId,note:h.note});setCustomer(h.customerId?`${h.customerId}|${encodeURIComponent(h.customerCode||'')}|${encodeURIComponent(h.customerName||'')}`:null)};
  useEffect(()=>{const id=Number(searchParams.get('id'));if(!Number.isFinite(id)||id<=0)return;setBusy(true);void vehicleCheckInApi.get(id).then(hydrate).catch(e=>toast.error(e instanceof Error?e.message:'Araç kaydı getirilemedi.')).finally(()=>setBusy(false))},[searchParams]);
  const findToday=async()=>{if(!form.plateNo.trim()){toast.error('Plaka zorunludur.');return}setBusy(true);try{const detail=await vehicleCheckInApi.today(branch,form.plateNo);if(detail){hydrate(detail);toast.success('Bugünkü araç kaydı getirildi.')}else{setRecord(null);toast.info('Bugün için kayıt bulunamadı; yeni kayıt oluşturabilirsiniz.')}}catch(e){toast.error(e instanceof Error?e.message:'Araç kaydı aranamadı.')}finally{setBusy(false)}};
  const save=async()=>{if(!form.plateNo.trim()){toast.error('Plaka zorunludur.');return}setBusy(true);try{const detail=await vehicleCheckInApi.save({...form,branchCode:branch,plateNo:form.plateNo.trim().toUpperCase()});hydrate(detail);setSearchParams({id:String(detail.header.id)},{replace:true});toast.success('Araç giriş kaydı kaydedildi.')}catch(e){toast.error(e instanceof Error?e.message:'Araç kaydı oluşturulamadı.')}finally{setBusy(false)}};
  const upload=async()=>{if(!record||!files.length){toast.error('Önce araç kaydını oluşturup görsel seçin.');return}setBusy(true);try{await vehicleCheckInApi.upload(record.header.id,files);hydrate(await vehicleCheckInApi.get(record.header.id));setFiles([]);toast.success('Araç görselleri yüklendi.')}catch(e){toast.error(e instanceof Error?e.message:'Görseller yüklenemedi.')}finally{setBusy(false)}};
  const open=async(id:number)=>{try{const blob=await vehicleCheckInApi.download(id);const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');window.setTimeout(()=>URL.revokeObjectURL(url),60_000)}catch(e){toast.error(e instanceof Error?e.message:'Görsel açılamadı.')}};
  const remove=async(id:number)=>{if(!record||!window.confirm('Araç görseli silinsin mi?'))return;setBusy(true);try{await vehicleCheckInApi.removeImage(id);hydrate(await vehicleCheckInApi.get(record.header.id));toast.success('Görsel silindi.')}catch(e){toast.error(e instanceof Error?e.message:'Görsel silinemedi.')}finally{setBusy(false)}};
  const selectCustomer=(value:string|null)=>{setCustomer(value);const [id]=value?.split('|')??[];patch('customerId',id?Number(id):undefined)};
  const onFiles=(e:ChangeEvent<HTMLInputElement>)=>setFiles(Array.from(e.target.files??[]).filter(x=>x.type.startsWith('image/')).slice(0,10));
  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">Mal Kabul · SAC İşlemleri · 1. Adım</p><h1 className="mt-1 text-2xl font-black">SAC Araç Giriş İşlemi</h1><p className="text-sm text-slate-500">V1 operasyon kuralı korunur: aynı şube, aynı iş günü ve aynı plaka tekrar girilirse yeni kayıt açılmaz; mevcut kayıt güncellenir.</p></header>
    <Panel title="Araç ve Sürücü Bilgileri" icon={<CarFront/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Çekici Plakası *"><div className="flex gap-2"><input className="input uppercase" value={form.plateNo} onChange={e=>patch('plateNo',e.target.value.toUpperCase())} onBlur={()=>void findToday()} maxLength={25} placeholder="34 ABC 123"/><button type="button" onClick={()=>void findToday()} disabled={busy} className="rounded-xl border px-4"><Search className="size-4"/></button></div></Field>
      <Field label="Dorse Plakası"><input className="input uppercase" value={form.trailerPlateNo||''} onChange={e=>patch('trailerPlateNo',e.target.value.toUpperCase())} maxLength={25}/></Field>
      <Field label="Araç Giriş Zamanı"><input className="input" value={entryText} readOnly/></Field>
      <Field label="Şoför Adı"><input className="input" value={form.driverFirstName||''} onChange={e=>patch('driverFirstName',e.target.value)} maxLength={100}/></Field>
      <Field label="Şoför Soyadı"><input className="input" value={form.driverLastName||''} onChange={e=>patch('driverLastName',e.target.value)} maxLength={100}/></Field>
      <Field label="Şoför Telefonu"><input className="input" value={form.driverPhone||''} onChange={e=>patch('driverPhone',e.target.value)} maxLength={40}/></Field>
      <Field label="Nakliyeci / Taşıyıcı"><input className="input" value={form.carrierName||''} onChange={e=>patch('carrierName',e.target.value)} maxLength={200}/></Field>
      <Field label="Tedarikçi / Cari"><PagedAppDropdown queryKey={['vehicle-check-in-customers',branch]} fetchPage={r=>goodsReceiptV2Api.customers(r,branch)} toOption={customerOption} value={customer} onValueChange={selectCustomer} searchable minSearchLength={2} placeholder="Cari seçin"/></Field>
      <Field label="Saha Notu"><textarea className="input min-h-20" value={form.note||''} onChange={e=>patch('note',e.target.value)} maxLength={1000}/></Field>
    </div><div className="mt-5 flex justify-end"><button onClick={()=>void save()} disabled={busy} className="rounded-xl bg-cyan-600 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?<Loader2 className="size-4 animate-spin"/>:<><CarFront className="mr-2 inline size-4"/>Araç Girişini Kaydet</>}</button></div></Panel>
    <Panel title="Araç Görselleri" icon={<Camera/>}><p className="mb-4 text-sm text-slate-500">Kapı, plaka, dorse ve yük güvenliği görsellerini kayıtla ilişkilendirin. Dosyalar dışarıdan doğrudan erişilemeyen güvenli alanda tutulur.</p>
      <div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-xl border border-dashed border-cyan-500/50 px-4 py-3 text-sm font-bold text-cyan-500"><ImagePlus className="mr-2 inline size-4"/>{files.length?`${files.length} görsel seçildi`:'Görsel seç'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles}/></label><button disabled={busy||!record||!files.length} onClick={()=>void upload()} className="rounded-xl border px-4 py-3 font-bold disabled:opacity-40">Görselleri Yükle</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{record?.images.map(image=><div key={image.id} className="rounded-xl border p-3"><button className="block w-full truncate text-left text-sm font-bold text-cyan-500" onClick={()=>void open(image.id)}>{image.fileName}</button><small className="text-slate-500">{Math.ceil(image.fileSize/1024)} KB</small><button onClick={()=>void remove(image.id)} className="mt-2 flex items-center gap-1 text-xs text-red-500"><Trash2 className="size-3"/>Sil</button></div>)}</div>
    </Panel>
  </section>;
}
function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-500">{icon}{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
