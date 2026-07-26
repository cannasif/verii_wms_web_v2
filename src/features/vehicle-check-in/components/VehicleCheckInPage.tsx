import {useCallback,useEffect,useMemo,useState,type ChangeEvent,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import {
  Camera,
  CarFront,
  CheckCircle2,
  FileImage,
  ImagePlus,
  Loader2,
  MapPin,
  PackageSearch,
  Search,
  X,
} from 'lucide-react';
import {toast} from 'sonner';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {useAuthStore} from '@/stores/auth-store';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import type {
  CompleteSteelVehicleAcceptanceResult,
  SaveVehicleCheckInRequest,
  SteelVehicleAcceptanceCandidate,
  VehicleCheckInDetail,
  VehicleCheckInImage,
} from '../types';

interface SelectedPlate {
  row:SteelVehicleAcceptanceCandidate;
  locationId:number;
  locationValue:string;
  note:string;
}

const empty=(branchCode:string):SaveVehicleCheckInRequest=>({
  branchCode,
  plateNo:'',
  trailerPlateNo:'',
  driverFirstName:'',
  driverLastName:'',
  driverPhone:'',
  carrierName:'',
  steelSheetCount:1,
  note:'',
});
const customerOption=(x:{id:number;customerCode:string;customerName:string})=>({
  value:`${x.id}|${encodeURIComponent(x.customerCode)}|${encodeURIComponent(x.customerName)}`,
  label:`${x.customerCode} · ${x.customerName}`,
});
const imageExtension=/\.(jpe?g|png|webp)$/i;
const isImageFile=(file:File)=>file.type.startsWith('image/')||(!file.type&&imageExtension.test(file.name));
const validImage=(file:File)=>isImageFile(file)&&file.size<=8*1024*1024;

export function VehicleCheckInPage(){
  const [searchParams,setSearchParams]=useSearchParams();
  const branch=useAuthStore(s=>s.branch?.code??'0');
  const [form,setForm]=useState<SaveVehicleCheckInRequest>(()=>empty(branch));
  const [customer,setCustomer]=useState<string|null>(null);
  const [record,setRecord]=useState<VehicleCheckInDetail|null>(null);
  const [vehicleFiles,setVehicleFiles]=useState<File[]>([]);
  const [plateFiles,setPlateFiles]=useState<Record<number,File[]>>({});
  const [selected,setSelected]=useState<Record<number,SelectedPlate>>({});
  const [sheetInput,setSheetInput]=useState('');
  const [candidateSearch,setCandidateSearch]=useState<{value:string;run:number}|null>(null);
  const [busy,setBusy]=useState(false);
  const [idempotencyKey,setIdempotencyKey]=useState(()=>crypto.randomUUID());
  const [completed,setCompleted]=useState<CompleteSteelVehicleAcceptanceResult|null>(null);

  const selectedPlates=useMemo(()=>Object.values(selected),[selected]);
  const selectedCount=selectedPlates.length;
  const totalQuantity=selectedPlates.reduce((sum,item)=>sum+item.row.expectedQuantity,0);

  const candidates=useQuery({
    queryKey:['steel-vehicle-acceptance-candidates',branch,candidateSearch?.value,candidateSearch?.run,form.steelSheetCount],
    enabled:Boolean(candidateSearch),
    queryFn:()=>vehicleCheckInApi.steelCandidates(branch,{
      pageNumber:1,
      pageSize:Math.min(100,Math.max(10,form.steelSheetCount*2)),
      search:candidateSearch?.value||null,
      filterLogic:'and',
      filters:[],
      sortBy:'lineNo',
      sortDirection:'asc',
    }),
  });

  const patch=<K extends keyof SaveVehicleCheckInRequest>(key:K,value:SaveVehicleCheckInRequest[K])=>
    setForm(current=>({...current,[key]:value}));

  const hydrate=useCallback((detail:VehicleCheckInDetail)=>{
    setRecord(detail);
    const header=detail.header;
    setForm({
      id:header.id,
      rowVersion:header.rowVersion,
      branchCode:header.branchCode,
      plateNo:header.plateNo,
      trailerPlateNo:header.trailerPlateNo,
      driverFirstName:header.driverFirstName,
      driverLastName:header.driverLastName,
      driverPhone:header.driverPhone,
      carrierName:header.carrierName,
      steelSheetCount:header.steelSheetCount||1,
      customerId:header.customerId,
      note:header.note,
    });
    setCustomer(header.customerId
      ?`${header.customerId}|${encodeURIComponent(header.customerCode||'')}|${encodeURIComponent(header.customerName||'')}`
      :null);
  },[]);
  const hydrateWithAcceptance=useCallback(async(detail:VehicleCheckInDetail)=>{
    hydrate(detail);
    setCompleted(await vehicleCheckInApi.steelAcceptanceByVehicle(detail.header.id));
  },[hydrate]);

  useEffect(()=>{
    const id=Number(searchParams.get('id'));
    if(!Number.isFinite(id)||id<=0)return;
    setBusy(true);
    void vehicleCheckInApi.get(id)
      .then(hydrateWithAcceptance)
      .catch(error=>toast.error(error instanceof Error?error.message:'Araç kaydı getirilemedi.'))
      .finally(()=>setBusy(false));
  },[hydrateWithAcceptance,searchParams]);

  const findToday=async()=>{
    if(!form.plateNo.trim()){toast.error('Plaka zorunludur.');return}
    setBusy(true);
    try{
      const detail=await vehicleCheckInApi.today(branch,form.plateNo);
      if(detail){await hydrateWithAcceptance(detail);toast.success('Bugünkü araç kaydı getirildi.')}
      else{setRecord(null);setCompleted(null);setForm(current=>({...current,id:undefined,rowVersion:undefined}));toast.info('Bugün için kayıt bulunamadı; kabul ile birlikte oluşturulacak.')}
    }catch(error){toast.error(error instanceof Error?error.message:'Araç kaydı aranamadı.')}
    finally{setBusy(false)}
  };

  const runSheetSearch=()=>{
    if(!Number.isInteger(form.steelSheetCount)||form.steelSheetCount<1||form.steelSheetCount>50){
      toast.error('Tek araç kabulünde SAC levha adedi 1-50 arasında olmalıdır.');
      return;
    }
    setCandidateSearch(current=>({value:sheetInput.trim(),run:(current?.run??0)+1}));
  };

  const togglePlate=(row:SteelVehicleAcceptanceCandidate)=>{
    setSelected(current=>{
      if(current[row.id]){
        const next={...current};
        delete next[row.id];
        return next;
      }
      if(Object.keys(current).length>=form.steelSheetCount){
        toast.error(`Araç için ${form.steelSheetCount} levha seçebilirsiniz.`);
        return current;
      }
      return {
        ...current,
        [row.id]:{
          row,
          locationId:row.receivingLocationId,
          locationValue:String(row.receivingLocationId),
          note:'',
        },
      };
    });
  };

  const updateSelected=(lineId:number,changes:Partial<SelectedPlate>)=>
    setSelected(current=>current[lineId]?{...current,[lineId]:{...current[lineId],...changes}}:current);

  const onVehicleFiles=(event:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files??[]).filter(validImage);
    setVehicleFiles(current=>[...current,...files].slice(0,10));
    if(files.length!==(event.target.files?.length??0))toast.error('Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.');
    event.currentTarget.value='';
  };

  const onPlateFiles=(lineId:number,list:FileList|null)=>{
    const files=Array.from(list??[]).filter(validImage);
    setPlateFiles(current=>({...current,[lineId]:[...(current[lineId]??[]),...files].slice(0,5)}));
    if(files.length!==(list?.length??0))toast.error('Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.');
  };

  const complete=async()=>{
    if(!form.plateNo.trim()){toast.error('Çekici plakası zorunludur.');return}
    if(selectedCount!==form.steelSheetCount){toast.error(`Girilen levha adedi ${form.steelSheetCount}; tam olarak ${form.steelSheetCount} levha seçilmelidir.`);return}
    if(selectedPlates.some(item=>!item.locationId)){toast.error('Her levha için kabul konumu seçilmelidir.');return}
    const missingPhoto=selectedPlates.find(item=>item.row.attachmentCount+(plateFiles[item.row.id]?.length??0)===0);
    if(missingPhoto){toast.error(`${missingPhoto.row.dCode} için en az bir levha görseli zorunludur.`);return}
    if((record?.images.length??0)+vehicleFiles.length===0){toast.error('Araç kabulü için en az bir araç görseli zorunludur.');return}

    setBusy(true);
    try{
      const result=await vehicleCheckInApi.completeSteelAcceptance({
        idempotencyKey,
        vehicle:{...form,branchCode:branch,plateNo:form.plateNo.trim().toUpperCase(),steelSheetCount:selectedCount},
        plates:selectedPlates.map(item=>({
          planLineId:item.row.id,
          receivingLocationId:item.locationId,
          rowVersion:item.row.rowVersion,
          note:item.note||undefined,
        })),
        note:form.note||undefined,
      },vehicleFiles,selectedPlates.flatMap(item=>(plateFiles[item.row.id]??[]).map(file=>({lineId:item.row.id,file}))));
      hydrate(result.vehicle);
      setSearchParams({id:String(result.vehicle.header.id)},{replace:true});
      setCompleted(result);
      setVehicleFiles([]);
      setPlateFiles({});
      setSelected({});
      setIdempotencyKey(crypto.randomUUID());
      setCandidateSearch(current=>current?{...current,run:current.run+1}:current);
      toast.success(result.replayed?'Bu araç ve SAC kabulü daha önce tamamlandı.':'Araç giriş ve SAC kabulü başarıyla tamamlandı.');
    }catch(error){toast.error(error instanceof Error?error.message:'Araç giriş ve SAC kabulü tamamlanamadı.')}
    finally{setBusy(false)}
  };

  const entryText=record?formatProjectDateTime(record.header.checkedInAtUtc):'Kabul sırasında UTC olarak oluşturulur.';

  return <section className="space-y-5">
    <header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">Mal Kabul · SAC İşlemleri · Araç Kabul</p>
      <h1 className="mt-1 text-2xl font-black">Araç Giriş ve SAC Kabul</h1>
      <p className="max-w-5xl text-sm text-slate-500">Araç bilgisi, araç kanıtları, seçilen levhalar, levha görselleri ve kabul konumları tek işlemde kaydedilir. Bir adım başarısız olursa veritabanı işleminin tamamı geri alınır.</p>
    </header>

    <Panel title="1 · Araç ve sürücü bilgileri" icon={<CarFront className="size-5"/>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Çekici plakası *"><div className="flex gap-2"><input className="input uppercase" value={form.plateNo} onChange={event=>patch('plateNo',event.target.value.toUpperCase())} maxLength={25}/><button type="button" onClick={()=>void findToday()} disabled={busy} className="rounded-xl border px-4" title="Bugünkü aracı bul"><Search className="size-4"/></button></div></Field>
        <Field label="Dorse plakası"><input className="input uppercase" value={form.trailerPlateNo||''} onChange={event=>patch('trailerPlateNo',event.target.value.toUpperCase())} maxLength={25}/></Field>
        <Field label="Araç giriş zamanı"><input className="input" value={entryText} readOnly/></Field>
        <Field label="Şoför adı"><input className="input" value={form.driverFirstName||''} onChange={event=>patch('driverFirstName',event.target.value)} maxLength={100}/></Field>
        <Field label="Şoför soyadı"><input className="input" value={form.driverLastName||''} onChange={event=>patch('driverLastName',event.target.value)} maxLength={100}/></Field>
        <Field label="Şoför telefonu"><input className="input" value={form.driverPhone||''} onChange={event=>patch('driverPhone',event.target.value)} maxLength={40}/></Field>
        <Field label="Nakliyeci / taşıyıcı"><input className="input" value={form.carrierName||''} onChange={event=>patch('carrierName',event.target.value)} maxLength={200}/></Field>
        <Field label="SAC levha adedi *"><input className="input" type="number" min="1" max="50" step="1" value={form.steelSheetCount} onChange={event=>patch('steelSheetCount',Number(event.target.value))}/></Field>
        <Field label="Tedarikçi / cari"><PagedAppDropdown queryKey={['vehicle-check-in-customers',branch]} fetchPage={request=>goodsReceiptV2Api.customers(request,branch)} toOption={customerOption} value={customer} onValueChange={value=>{setCustomer(value);const [id]=value?.split('|')??[];patch('customerId',id?Number(id):undefined)}} searchable minSearchLength={2} placeholder="Cari seçin"/></Field>
        <div className="md:col-span-2 xl:col-span-3"><Field label="Saha / kabul notu"><textarea className="input min-h-20" value={form.note||''} onChange={event=>patch('note',event.target.value)} maxLength={1000}/></Field></div>
      </div>
    </Panel>

    <Panel title="2 · Araç görselleri" icon={<Camera className="size-5"/>}>
      <p className="mb-4 text-sm text-slate-500">Plaka, dorse, yük güvenliği ve kapı kabul kanıtlarını seçin. Yeni görseller SAC kabulüyle aynı işlemde yüklenecektir.</p>
      <label className="inline-flex cursor-pointer items-center rounded-xl border border-dashed border-cyan-500/50 px-4 py-3 text-sm font-bold text-cyan-500"><ImagePlus className="mr-2 size-4"/>Araç görseli seç<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onVehicleFiles}/></label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {record?.images.map(image=><ExistingVehicleImage key={image.id} image={image}/>)}
        {vehicleFiles.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>setVehicleFiles(current=>current.filter((_,i)=>i!==index))}/>)}
      </div>
    </Panel>

    <Panel title="3 · Uygun SAC levhalarını bul" icon={<PackageSearch className="size-5"/>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Field label="Seri, DCode, stok, sipariş veya Excel aktarım numarası">
          <input className="input" value={sheetInput} onChange={event=>setSheetInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();runSheetSearch()}}} placeholder="Boş bırakırsanız bekleyen ilk uygun levhalar gelir"/>
        </Field>
        <button type="button" onClick={runSheetSearch} disabled={candidates.isFetching} className="self-end rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-50">{candidates.isFetching?<Loader2 className="size-4 animate-spin"/>:<><Search className="mr-2 inline size-4"/>SAC Bul</>}</button>
      </div>
      {candidateSearch&&<CandidateTable rows={candidates.data?.items??[]} loading={candidates.isFetching} selected={selected} onToggle={togglePlate}/>}
    </Panel>

    {selectedCount>0&&<Panel title={`4 · Seçilen levhalar (${selectedCount}/${form.steelSheetCount})`} icon={<MapPin className="size-5"/>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Seçilen levha" value={String(selectedCount)}/>
        <Summary label="Toplam kabul miktarı" value={formatProjectNumber(totalQuantity)}/>
        <Summary label="Eksik seçim" value={String(Math.max(0,form.steelSheetCount-selectedCount))}/>
      </div>
      <div className="space-y-4">{selectedPlates.map(item=><SelectedPlateCard
        key={item.row.id}
        item={item}
        files={plateFiles[item.row.id]??[]}
        onChange={changes=>updateSelected(item.row.id,changes)}
        onFiles={files=>onPlateFiles(item.row.id,files)}
        onRemoveFile={index=>setPlateFiles(current=>({...current,[item.row.id]:(current[item.row.id]??[]).filter((_,i)=>i!==index)}))}
        onRemove={()=>togglePlate(item.row)}
      />)}</div>
    </Panel>}

    {completed&&<section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
      <h2 className="flex items-center gap-2 font-black text-emerald-600"><CheckCircle2 className="size-5"/>Kabul tamamlandı · #{completed.acceptanceId}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{completed.vehicle.header.plateNo} plakalı araçla gelen {completed.plates.length} levha, araç ve Excel aktarım bilgileriyle ilişkilendirildi.</p>
    </section>}

    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-[var(--wms-app-panel)] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
      <div><strong>{selectedCount}/{form.steelSheetCount} levha hazır</strong><p className="text-xs text-slate-500">Araç + görseller + levha onayı + kabul konumu tek transaction.</p></div>
      <button type="button" onClick={()=>void complete()} disabled={busy||selectedCount!==form.steelSheetCount} className="rounded-xl bg-cyan-600 px-6 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?<Loader2 className="mr-2 inline size-4 animate-spin"/>:<CheckCircle2 className="mr-2 inline size-4"/>}Araç Giriş ve SAC Kabul</button>
    </div>
  </section>;
}

function CandidateTable({rows,loading,selected,onToggle}:{rows:SteelVehicleAcceptanceCandidate[];loading:boolean;selected:Record<number,SelectedPlate>;onToggle:(row:SteelVehicleAcceptanceCandidate)=>void}){
  return <div className="mt-5 overflow-x-auto rounded-xl border">
    <table className="min-w-[1100px] w-full text-left text-sm">
      <thead className="bg-[var(--wms-app-surface)] text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Seç</th><th className="p-3">DCode / Excel</th><th className="p-3">Seri</th><th className="p-3">Stok</th><th className="p-3">Ölçü / kalite</th><th className="p-3">Miktar</th><th className="p-3">Depo / kabul rafı</th><th className="p-3">Kanıt</th></tr></thead>
      <tbody>
        {loading&&<tr><td colSpan={8} className="p-5 text-slate-500">Uygun levhalar aranıyor...</td></tr>}
        {!loading&&rows.length===0&&<tr><td colSpan={8} className="p-5 text-slate-500">Kabul bekleyen uygun SAC levhası bulunamadı.</td></tr>}
        {!loading&&rows.map(row=><tr key={row.id} className={`border-t ${selected[row.id]?'bg-cyan-500/10':''}`}>
          <td className="p-3"><input type="checkbox" checked={Boolean(selected[row.id])} onChange={()=>onToggle(row)} className="size-5 accent-cyan-600"/></td>
          <td className="p-3"><strong className="font-mono text-cyan-600">{row.dCode}</strong><small className="block text-slate-500">{row.importReferenceNo} · {row.sourceFileName}</small></td>
          <td className="p-3"><strong>{row.supplierSerialNo}</strong><small className="block text-slate-500">{row.secondarySerialNo||'-'}</small></td>
          <td className="p-3"><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName||'-'}</small></td>
          <td className="p-3">{row.combinedSize||'-'}<small className="block text-slate-500">{row.materialGrade||'-'} · Heat {row.heatNumber||'-'}</small></td>
          <td className="p-3 font-bold">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
          <td className="p-3">{row.warehouseCode} · {row.warehouseName}<small className="block text-slate-500">{row.receivingLocationCode} · {row.receivingLocationName}</small></td>
          <td className="p-3"><span className="rounded-full border px-2 py-1 text-xs font-bold">{row.attachmentCount} görsel</span></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function SelectedPlateCard({item,files,onChange,onFiles,onRemoveFile,onRemove}:{item:SelectedPlate;files:File[];onChange:(changes:Partial<SelectedPlate>)=>void;onFiles:(files:FileList|null)=>void;onRemoveFile:(index:number)=>void;onRemove:()=>void}){
  const row=item.row;
  return <article className="rounded-2xl border bg-[var(--wms-app-surface)] p-4">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><strong className="font-mono text-cyan-600">{row.dCode} · {row.supplierSerialNo}</strong><p className="text-sm text-slate-500">{row.stockCode} · {row.stockName} · {formatProjectNumber(row.expectedQuantity)} {row.unitCode}</p><small className="text-slate-500">Excel/aktarım: {row.importReferenceNo}</small></div>
      <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/30 p-2 text-red-500" title="Seçimden çıkar"><X className="size-4"/></button>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label="Kabul / staging rafı *"><PagedAppDropdown queryKey={['steel-acceptance-location',row.id,row.targetWarehouseId]} fetchPage={request=>goodsReceiptV2Api.locations(request,row.targetWarehouseId)} toOption={location=>({value:String(location.id),label:`${location.code} · ${location.name}`,description:location.locationType})} selectedOption={{value:String(row.receivingLocationId),label:`${row.receivingLocationCode} · ${row.receivingLocationName}`}} value={item.locationValue} onValueChange={value=>onChange({locationId:Number(value),locationValue:value||''})} searchable/></Field>
      <Field label="Levha kabul notu"><input className="input" value={item.note} onChange={event=>onChange({note:event.target.value})} maxLength={1000}/></Field>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-xl border border-dashed border-cyan-500/50 px-4 py-2.5 text-sm font-bold text-cyan-600"><FileImage className="mr-2 inline size-4"/>Levha görseli ekle<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event=>{onFiles(event.target.files);event.currentTarget.value=''}}/></label>
      <span className="text-xs text-slate-500">Mevcut {row.attachmentCount} · Yeni {files.length} görsel</span>
    </div>
    {files.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{files.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>onRemoveFile(index)}/>)}</div>}
  </article>;
}

function ExistingVehicleImage({image}:{image:VehicleCheckInImage}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void vehicleCheckInApi.download(image.id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>setUrl(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[image.id]);
  return <figure className="overflow-hidden rounded-xl border"><div className="grid h-28 place-items-center bg-slate-950/5">{url?<img src={url} alt={image.fileName} className="h-full w-full object-cover"/>:<Loader2 className="size-4 animate-spin"/>}</div><figcaption className="truncate p-2 text-xs font-bold">{image.fileName}</figcaption></figure>;
}

function PendingImage({file,onRemove}:{file:File;onRemove:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return()=>URL.revokeObjectURL(objectUrl)},[file]);
  return <figure className="overflow-hidden rounded-xl border"><div className="relative h-28 bg-slate-950/5">{url&&<img src={url} alt={file.name} className="h-full w-full object-cover"/>}<button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="size-3"/></button></div><figcaption className="truncate p-2 text-xs font-bold">{file.name}</figcaption></figure>;
}

function Summary({label,value}:{label:string;value:string}){return <div className="rounded-xl border bg-[var(--wms-app-surface)] p-3"><small className="block text-slate-500">{label}</small><strong className="text-lg">{value}</strong></div>}
function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-600">{icon}{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
