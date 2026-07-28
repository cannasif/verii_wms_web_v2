import {useCallback,useEffect,useMemo,useState,type ChangeEvent,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Link,useSearchParams} from 'react-router-dom';
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
import {steelReceiptApi} from '@/features/steel-receipt/api/steel-receipt.api';
import type {SteelAttachment,SteelLineRow} from '@/features/steel-receipt/types/steel-receipt.types';
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
const norm=(v?:string|null)=>(v??'').trim().toLocaleLowerCase('tr-TR');

export function VehicleCheckInPage({embedded=false,initialId,onCompleted}:{embedded?:boolean;initialId?:number;onCompleted?:()=>void}={}){
  const {t}=useTranslation('common');
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
  const acceptedPlates=completed?.plates??[];
  const acceptedPlateDetails=useQuery({
    queryKey:['steel-vehicle-accepted-plate-details',acceptedPlates],
    enabled:acceptedPlates.length>0,
    queryFn:async()=>{
      const resolveLineByPlate=async(plate:(typeof acceptedPlates)[number]):Promise<SteelLineRow|null>=>{
        try{
          return await steelReceiptApi.line(plate.planLineId);
        }catch{
          try{
            const page=await steelReceiptApi.linesPaged({
              pageNumber:1,
              pageSize:50,
              search:plate.dCode||plate.supplierSerialNo||null,
              filterLogic:'and',
              filters:[],
              sortBy:'lineNo',
              sortDirection:'desc',
            });
            return page.items.find(item=>
              item.planId===plate.planId
              || (item.dCode===plate.dCode && item.supplierSerialNo===plate.supplierSerialNo),
            )??null;
          }catch{
            return null;
          }
        }
      };
      const entries=await Promise.all(
        acceptedPlates.map(async(plate)=>{
          const line=await resolveLineByPlate(plate);
          const lineId=line?.id??plate.planLineId;
          let attachments:SteelAttachment[]=[];
          try{
            attachments=await steelReceiptApi.attachments(lineId);
          }catch{
            attachments=[];
          }
          return [plate.planLineId,{line,attachments}] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number,{line:SteelLineRow|null;attachments:SteelAttachment[]}>;
    },
  });

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

  const candidateRows=useMemo(()=>candidates.data?.items??[],[candidates.data?.items]);
  const hydratedMatch=useMemo(()=>{
    const q=norm(sheetInput);
    if(q.length<2||!candidateRows.length)return null;
    const exact=candidateRows.find(row=>
      norm(row.supplierSerialNo)===q ||
      norm(row.secondarySerialNo)===q ||
      norm(row.dCode)===q
    );
    return exact??(candidateRows.length===1?candidateRows[0]:null);
  },[candidateRows,sheetInput]);

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
    const id=initialId??Number(searchParams.get('id'));
    if(!Number.isFinite(id)||id<=0)return;
    setBusy(true);
    void vehicleCheckInApi.get(id)
      .then(hydrateWithAcceptance)
      .catch(error=>toast.error(error instanceof Error?error.message:t('vehicleCheckIn.toast.fetchRecordFailed',{defaultValue:'Araç kaydı getirilemedi.'})))
      .finally(()=>setBusy(false));
  },[hydrateWithAcceptance,initialId,searchParams,t]);

  useEffect(()=>{
    const q=sheetInput.trim();
    if(q.length<2)return;
    const timer=window.setTimeout(()=>{
      setCandidateSearch(current=>({value:q,run:(current?.run??0)+1}));
    },400);
    return ()=>window.clearTimeout(timer);
  },[sheetInput]);

  const findToday=async()=>{
    if(!form.plateNo.trim()){toast.error(t('vehicleCheckIn.toast.plateRequired',{defaultValue:'Plaka zorunludur.'}));return}
    setBusy(true);
    try{
      const detail=await vehicleCheckInApi.today(branch,form.plateNo);
      if(detail){await hydrateWithAcceptance(detail);toast.success(t('vehicleCheckIn.toast.todayFound',{defaultValue:'Bugünkü araç kaydı getirildi.'}))}
      else{setRecord(null);setCompleted(null);setForm(current=>({...current,id:undefined,rowVersion:undefined}));toast.info(t('vehicleCheckIn.toast.todayNotFound',{defaultValue:'Bugün için kayıt bulunamadı; kabul ile birlikte oluşturulacak.'}))}
    }catch(error){toast.error(error instanceof Error?error.message:t('vehicleCheckIn.toast.searchFailed',{defaultValue:'Araç kaydı aranamadı.'}))}
    finally{setBusy(false)}
  };

  const runSheetSearch=()=>{
    if(!Number.isInteger(form.steelSheetCount)||form.steelSheetCount<1||form.steelSheetCount>50){
      toast.error(t('vehicleCheckIn.toast.sheetCountRange',{defaultValue:'Tek araç kabulünde SAC levha adedi 1-50 arasında olmalıdır.'}));
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
        toast.error(t('vehicleCheckIn.toast.sheetSelectionLimit',{defaultValue:'Araç için {{count}} levha seçebilirsiniz.',count:form.steelSheetCount}));
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
    if(files.length!==(event.target.files?.length??0))toast.error(t('vehicleCheckIn.toast.imageValidation',{defaultValue:'Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.'}));
    event.currentTarget.value='';
  };

  const onPlateFiles=(lineId:number,list:FileList|null)=>{
    const files=Array.from(list??[]).filter(validImage);
    setPlateFiles(current=>({...current,[lineId]:[...(current[lineId]??[]),...files].slice(0,5)}));
    if(files.length!==(list?.length??0))toast.error(t('vehicleCheckIn.toast.imageValidation',{defaultValue:'Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.'}));
  };

  const complete=async()=>{
    if(!form.plateNo.trim()){toast.error(t('vehicleCheckIn.toast.towingPlateRequired',{defaultValue:'Çekici plakası zorunludur.'}));return}
    if(selectedCount!==form.steelSheetCount){toast.error(t('vehicleCheckIn.toast.exactSheetCount',{defaultValue:'Girilen levha adedi {{count}}; tam olarak {{count}} levha seçilmelidir.',count:form.steelSheetCount}));return}
    if(selectedPlates.some(item=>!item.locationId)){toast.error(t('vehicleCheckIn.toast.locationRequired',{defaultValue:'Her levha için kabul konumu seçilmelidir.'}));return}
    const missingPhoto=selectedPlates.find(item=>item.row.attachmentCount+(plateFiles[item.row.id]?.length??0)===0);
    if(missingPhoto){toast.error(t('vehicleCheckIn.toast.sheetImageRequired',{defaultValue:'{{dCode}} için en az bir levha görseli zorunludur.',dCode:missingPhoto.row.dCode}));return}
    if((record?.images.length??0)+vehicleFiles.length===0){toast.error(t('vehicleCheckIn.toast.vehicleImageRequired',{defaultValue:'Araç kabulü için en az bir araç görseli zorunludur.'}));return}

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
      if(!embedded)setSearchParams({id:String(result.vehicle.header.id)},{replace:true});
      setCompleted(result);
      setVehicleFiles([]);
      setPlateFiles({});
      setSelected({});
      setIdempotencyKey(crypto.randomUUID());
      setCandidateSearch(current=>current?{...current,run:current.run+1}:current);
      onCompleted?.();
      toast.success(result.replayed?t('vehicleCheckIn.toast.alreadyCompleted',{defaultValue:'Bu araç ve SAC kabulü daha önce tamamlandı.'}):t('vehicleCheckIn.toast.completed',{defaultValue:'Araç giriş ve SAC kabulü başarıyla tamamlandı.'}));
    }catch(error){toast.error(error instanceof Error?error.message:t('vehicleCheckIn.toast.completeFailed',{defaultValue:'Araç giriş ve SAC kabulü tamamlanamadı.'}))}
    finally{setBusy(false)}
  };

  const entryText=record?formatProjectDateTime(record.header.checkedInAtUtc):t('vehicleCheckIn.entryTimePlaceholder',{defaultValue:'Kabul sırasında UTC olarak oluşturulur.'});

  return <section className="space-y-5">
    {!embedded&&<header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">{t('vehicleCheckIn.pageEyebrow',{defaultValue:'Mal Kabul · SAC İşlemleri · Araç + Saha Kabul'})}</p>
      <h1 className="mt-1 text-2xl font-black">{t('vehicleCheckIn.pageTitle',{defaultValue:'Araç Giriş ve SAC Kabul'})}</h1>
      <p className="max-w-5xl text-sm text-slate-500">{t('vehicleCheckIn.pageDescription',{defaultValue:'Araç bilgisi, saha kabul, seçilen levhalar, görseller ve kabul konumları tek işlemde kaydedilir. Seri yazınca eşleşen levha bilgisi otomatik gelir.'})}</p>
    </header>}

    <Panel title={t('vehicleCheckIn.section.vehicleInfo',{defaultValue:'1 · Araç ve sürücü bilgileri'})} icon={<CarFront className="size-5"/>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label={t('vehicleCheckIn.field.towingPlate',{defaultValue:'Çekici plakası *'})}><div className="flex gap-2"><input className="input uppercase" value={form.plateNo} onChange={event=>patch('plateNo',event.target.value.toUpperCase())} maxLength={25}/><button type="button" onClick={()=>void findToday()} disabled={busy} className="rounded-xl border px-4" title={t('vehicleCheckIn.action.findToday',{defaultValue:'Bugünkü aracı bul'})}><Search className="size-4"/></button></div></Field>
        <Field label={t('vehicleCheckIn.field.trailerPlate',{defaultValue:'Dorse plakası'})}><input className="input uppercase" value={form.trailerPlateNo||''} onChange={event=>patch('trailerPlateNo',event.target.value.toUpperCase())} maxLength={25}/></Field>
        <Field label={t('vehicleCheckIn.field.entryTime',{defaultValue:'Araç giriş zamanı'})}><input className="input" value={entryText} readOnly/></Field>
        <Field label={t('vehicleCheckIn.field.driverFirstName',{defaultValue:'Şoför adı'})}><input className="input" value={form.driverFirstName||''} onChange={event=>patch('driverFirstName',event.target.value)} maxLength={100}/></Field>
        <Field label={t('vehicleCheckIn.field.driverLastName',{defaultValue:'Şoför soyadı'})}><input className="input" value={form.driverLastName||''} onChange={event=>patch('driverLastName',event.target.value)} maxLength={100}/></Field>
        <Field label={t('vehicleCheckIn.field.driverPhone',{defaultValue:'Şoför telefonu'})}><input className="input" value={form.driverPhone||''} onChange={event=>patch('driverPhone',event.target.value)} maxLength={40}/></Field>
        <Field label={t('vehicleCheckIn.field.carrier',{defaultValue:'Nakliyeci / taşıyıcı'})}><input className="input" value={form.carrierName||''} onChange={event=>patch('carrierName',event.target.value)} maxLength={200}/></Field>
        <Field label={t('vehicleCheckIn.field.sheetCount',{defaultValue:'SAC levha adedi *'})}><input className="input" type="number" min="1" max="50" step="1" value={form.steelSheetCount} onChange={event=>patch('steelSheetCount',Number(event.target.value))}/></Field>
        <Field label={t('vehicleCheckIn.field.customer',{defaultValue:'Tedarikçi / cari'})}><PagedAppDropdown queryKey={['vehicle-check-in-customers',branch]} fetchPage={request=>goodsReceiptV2Api.customers(request,branch)} toOption={customerOption} value={customer} onValueChange={value=>{setCustomer(value);const [id]=value?.split('|')??[];patch('customerId',id?Number(id):undefined)}} searchable minSearchLength={2} placeholder={t('vehicleCheckIn.placeholder.selectCustomer',{defaultValue:'Cari seçin'})}/></Field>
        <div className="md:col-span-2 xl:col-span-3"><Field label={t('vehicleCheckIn.field.acceptanceNote',{defaultValue:'Saha / kabul notu'})}><textarea className="input min-h-20" value={form.note||''} onChange={event=>patch('note',event.target.value)} maxLength={1000}/></Field></div>
      </div>
    </Panel>

    <Panel title={t('vehicleCheckIn.section.vehicleImages',{defaultValue:'2 · Araç görselleri'})} icon={<Camera className="size-5"/>}>
      <p className="mb-4 text-sm text-slate-500">{t('vehicleCheckIn.vehicleImagesHelp',{defaultValue:'Plaka, dorse, yük güvenliği ve kapı kabul kanıtlarını seçin. Yeni görseller SAC kabulüyle aynı işlemde yüklenecektir.'})}</p>
      <label className="inline-flex cursor-pointer items-center rounded-xl border border-dashed border-cyan-500/50 px-4 py-3 text-sm font-bold text-cyan-500"><ImagePlus className="mr-2 size-4"/>{t('vehicleCheckIn.action.pickVehicleImage',{defaultValue:'Araç görseli seç'})}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onVehicleFiles}/></label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {record?.images.map(image=><ExistingVehicleImage key={image.id} image={image}/>)}
        {vehicleFiles.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>setVehicleFiles(current=>current.filter((_,i)=>i!==index))}/>)}
      </div>
    </Panel>

    <Panel title={t('vehicleCheckIn.section.findSheet',{defaultValue:'3 · Seri / DCode ile SAC levha bul'})} icon={<PackageSearch className="size-5"/>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Field label={t('vehicleCheckIn.field.serialSearch',{defaultValue:'Seri no yazın — eşleşen levha bilgisi otomatik gelir'})}>
          <input className="input" value={sheetInput} onChange={event=>setSheetInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();runSheetSearch()}}} placeholder={t('vehicleCheckIn.placeholder.serialSearch',{defaultValue:'Seri, DCode, stok, sipariş veya Excel no'})}/>
        </Field>
        <button type="button" onClick={runSheetSearch} disabled={candidates.isFetching} className="self-end rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-50">{candidates.isFetching?<Loader2 className="size-4 animate-spin"/>:<><Search className="mr-2 inline size-4"/>{t('vehicleCheckIn.action.findSheet',{defaultValue:'SAC Bul'})}</>}</button>
      </div>
      {hydratedMatch&&(
        <div className="mt-4 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">{t('vehicleCheckIn.matchedSheet',{defaultValue:'Eşleşen levha'})}</p>
              <strong className="mt-1 block font-mono text-lg text-cyan-700 dark:text-cyan-300">{hydratedMatch.dCode} · {hydratedMatch.supplierSerialNo}</strong>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{hydratedMatch.stockCode} · {hydratedMatch.stockName||'-'} · {formatProjectNumber(hydratedMatch.expectedQuantity)} {hydratedMatch.unitCode}</p>
              <small className="text-slate-500">{hydratedMatch.combinedSize||'-'} · {hydratedMatch.materialGrade||'-'} · Excel {hydratedMatch.importReferenceNo} · {hydratedMatch.warehouseCode} / {hydratedMatch.receivingLocationCode}</small>
            </div>
            <button type="button" onClick={()=>togglePlate(hydratedMatch)} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
              {selected[hydratedMatch.id]?t('vehicleCheckIn.action.removeSelection',{defaultValue:'Seçimden çıkar'}):t('vehicleCheckIn.action.addSelection',{defaultValue:'Seçime ekle'})}
            </button>
          </div>
        </div>
      )}
      {candidateSearch&&<CandidateTable rows={candidateRows} loading={candidates.isFetching} selected={selected} onToggle={togglePlate}/>}
    </Panel>

    {selectedCount>0&&<Panel title={t('vehicleCheckIn.section.selectedSheets',{defaultValue:'4 · Seçilen levhalar ({{selected}}/{{total}})',selected:selectedCount,total:form.steelSheetCount})} icon={<MapPin className="size-5"/>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label={t('vehicleCheckIn.summary.selectedSheets',{defaultValue:'Seçilen levha'})} value={String(selectedCount)}/>
        <Summary label={t('vehicleCheckIn.summary.totalQuantity',{defaultValue:'Toplam kabul miktarı'})} value={formatProjectNumber(totalQuantity)}/>
        <Summary label={t('vehicleCheckIn.summary.missingSelection',{defaultValue:'Eksik seçim'})} value={String(Math.max(0,form.steelSheetCount-selectedCount))}/>
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

    {!!completed?.plates.length&&<Panel title={t('vehicleCheckIn.section.savedAcceptedSheets',{defaultValue:'Kayıtlı kabul levhaları ({{count}})',count:completed.plates.length})} icon={<FileImage className="size-5"/>}>
      <p className="mb-4 text-sm text-slate-500">{t('vehicleCheckIn.savedAcceptedSheetsHelp',{defaultValue:'Bu araç için daha önce kaydedilmiş levha bilgileri ve mevcut levha ekleri aşağıda listelenir.'})}</p>
      <div className="space-y-4">
        {completed.plates.map(plate=>{
          const detail=acceptedPlateDetails.data?.[plate.planLineId];
          const line=detail?.line;
          const attachments=detail?.attachments??[];
          return <article key={plate.planLineId} className="rounded-2xl border bg-[var(--wms-app-surface)] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Summary label={t('vehicleCheckIn.summary.dCodeSerial',{defaultValue:'DCode / Seri'})} value={`${plate.dCode} · ${plate.supplierSerialNo}`}/>
              <Summary label={t('vehicleCheckIn.summary.stock',{defaultValue:'Stok'})} value={line?`${line.stockCode} · ${line.stockName||'-'}`:plate.stockCode}/>
              <Summary label={t('vehicleCheckIn.summary.acceptedQuantity',{defaultValue:'Kabul miktarı'})} value={`${formatProjectNumber(plate.acceptedQuantity)} ${plate.unitCode}`}/>
            </div>
            <div className="mt-4">
              <strong className="text-sm">{t('vehicleCheckIn.attachmentsTitle',{defaultValue:'Levha görselleri / ekleri ({{count}})',count:attachments.length})}</strong>
              {acceptedPlateDetails.isLoading&&!detail?<p className="mt-2 text-xs text-slate-500">{t('vehicleCheckIn.loadingAttachments',{defaultValue:'Ekler yükleniyor...'})}</p>:attachments.length===0?<p className="mt-2 text-xs text-slate-500">{t('vehicleCheckIn.noSavedSheetImage',{defaultValue:'Kayıtlı levha görseli bulunamadı.'})}</p>:<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{attachments.map(attachment=><ExistingSteelAttachmentImage key={attachment.id} attachment={attachment}/>)}</div>}
            </div>
          </article>;
        })}
      </div>
    </Panel>}

    {completed&&<section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
      <h2 className="flex items-center gap-2 font-black text-emerald-600"><CheckCircle2 className="size-5"/>{t('vehicleCheckIn.completedTitle',{defaultValue:'Kabul tamamlandı · #{{id}}',id:completed.acceptanceId})}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('vehicleCheckIn.completedDescription',{defaultValue:'{{plateNo}} plakalı araçla gelen {{count}} levha, araç ve Excel aktarım bilgileriyle ilişkilendirildi.',plateNo:completed.vehicle.header.plateNo,count:completed.plates.length})}</p>
      <p className="mt-2 text-xs text-slate-500">{t('vehicleCheckIn.completedQualityPrefix',{defaultValue:'Kalite/onay kararları için'})} <Link className="font-semibold text-cyan-600 underline" to="/warehouse/goods-receipts/steel/inspection">{t('vehicleCheckIn.completedQualityLink',{defaultValue:'Saha Kalite Onayı'})}</Link> {t('vehicleCheckIn.completedQualitySuffix',{defaultValue:'ekranını kullanın.'})}</p>
    </section>}

    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-[var(--wms-app-panel)] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
      <div><strong>{t('vehicleCheckIn.footerReady',{defaultValue:'{{selected}}/{{total}} levha hazır',selected:selectedCount,total:form.steelSheetCount})}</strong><p className="text-xs text-slate-500">{t('vehicleCheckIn.footerHint',{defaultValue:'Araç + saha kabul + görseller + konum tek transaction.'})}</p></div>
      <button type="button" onClick={()=>void complete()} disabled={busy||selectedCount!==form.steelSheetCount} className="rounded-xl bg-cyan-600 px-6 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?<Loader2 className="mr-2 inline size-4 animate-spin"/>:<CheckCircle2 className="mr-2 inline size-4"/>}{t('vehicleCheckIn.action.complete',{defaultValue:'Araç Giriş ve SAC Kabul'})}</button>
    </div>
  </section>;
}

function CandidateTable({rows,loading,selected,onToggle}:{rows:SteelVehicleAcceptanceCandidate[];loading:boolean;selected:Record<number,SelectedPlate>;onToggle:(row:SteelVehicleAcceptanceCandidate)=>void}){
  const {t}=useTranslation('common');
  return <div className="mt-5 overflow-x-auto rounded-xl border">
    <table className="min-w-[1100px] w-full text-left text-sm">
      <thead className="bg-[var(--wms-app-surface)] text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">{t('vehicleCheckIn.table.select',{defaultValue:'Seç'})}</th><th className="p-3">{t('vehicleCheckIn.table.dCodeExcel',{defaultValue:'DCode / Excel'})}</th><th className="p-3">{t('vehicleCheckIn.table.serial',{defaultValue:'Seri'})}</th><th className="p-3">{t('vehicleCheckIn.table.stock',{defaultValue:'Stok'})}</th><th className="p-3">{t('vehicleCheckIn.table.sizeQuality',{defaultValue:'Ölçü / kalite'})}</th><th className="p-3">{t('vehicleCheckIn.table.quantity',{defaultValue:'Miktar'})}</th><th className="p-3">{t('vehicleCheckIn.table.warehouseRack',{defaultValue:'Depo / kabul rafı'})}</th><th className="p-3">{t('vehicleCheckIn.table.evidence',{defaultValue:'Kanıt'})}</th></tr></thead>
      <tbody>
        {loading&&<tr><td colSpan={8} className="p-5 text-slate-500">{t('vehicleCheckIn.table.loading',{defaultValue:'Uygun levhalar aranıyor...'})}</td></tr>}
        {!loading&&rows.length===0&&<tr><td colSpan={8} className="p-5 text-slate-500">{t('vehicleCheckIn.table.empty',{defaultValue:'Kabul bekleyen uygun SAC levhası bulunamadı.'})}</td></tr>}
        {!loading&&rows.map(row=><tr key={row.id} className={`border-t ${selected[row.id]?'bg-cyan-500/10':''}`}>
          <td className="p-3"><input type="checkbox" checked={Boolean(selected[row.id])} onChange={()=>onToggle(row)} className="size-5 accent-cyan-600"/></td>
          <td className="p-3"><strong className="font-mono text-cyan-600">{row.dCode}</strong><small className="block text-slate-500">{row.importReferenceNo} · {row.sourceFileName}</small></td>
          <td className="p-3"><strong>{row.supplierSerialNo}</strong><small className="block text-slate-500">{row.secondarySerialNo||'-'}</small></td>
          <td className="p-3"><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName||'-'}</small></td>
          <td className="p-3">{row.combinedSize||'-'}<small className="block text-slate-500">{row.materialGrade||'-'} · {t('vehicleCheckIn.table.heat',{defaultValue:'Heat'})} {row.heatNumber||'-'}</small></td>
          <td className="p-3 font-bold">{formatProjectNumber(row.expectedQuantity)} {row.unitCode}</td>
          <td className="p-3">{row.warehouseCode} · {row.warehouseName}<small className="block text-slate-500">{row.receivingLocationCode} · {row.receivingLocationName}</small></td>
          <td className="p-3"><span className="rounded-full border px-2 py-1 text-xs font-bold">{t('vehicleCheckIn.table.imageCount',{defaultValue:'{{count}} görsel',count:row.attachmentCount})}</span></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function SelectedPlateCard({item,files,onChange,onFiles,onRemoveFile,onRemove}:{item:SelectedPlate;files:File[];onChange:(changes:Partial<SelectedPlate>)=>void;onFiles:(files:FileList|null)=>void;onRemoveFile:(index:number)=>void;onRemove:()=>void}){
  const {t}=useTranslation('common');
  const row=item.row;
  return <article className="rounded-2xl border bg-[var(--wms-app-surface)] p-4">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><strong className="font-mono text-cyan-600">{row.dCode} · {row.supplierSerialNo}</strong><p className="text-sm text-slate-500">{row.stockCode} · {row.stockName} · {formatProjectNumber(row.expectedQuantity)} {row.unitCode}</p><small className="text-slate-500">{t('vehicleCheckIn.excelImportLabel',{defaultValue:'Excel/aktarım'})}: {row.importReferenceNo}</small></div>
      <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/30 p-2 text-red-500" title={t('vehicleCheckIn.action.removeSelection',{defaultValue:'Seçimden çıkar'})}><X className="size-4"/></button>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label={t('vehicleCheckIn.field.acceptanceRack',{defaultValue:'Kabul / staging rafı *'})}><PagedAppDropdown queryKey={['steel-acceptance-location',row.id,row.targetWarehouseId]} fetchPage={request=>goodsReceiptV2Api.locations(request,row.targetWarehouseId)} toOption={location=>({value:String(location.id),label:`${location.code} · ${location.name}`,description:location.locationType})} selectedOption={{value:String(row.receivingLocationId),label:`${row.receivingLocationCode} · ${row.receivingLocationName}`}} value={item.locationValue} onValueChange={value=>onChange({locationId:Number(value),locationValue:value||''})} searchable/></Field>
      <Field label={t('vehicleCheckIn.field.sheetNote',{defaultValue:'Levha kabul notu'})}><input className="input" value={item.note} onChange={event=>onChange({note:event.target.value})} maxLength={1000}/></Field>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-xl border border-dashed border-cyan-500/50 px-4 py-2.5 text-sm font-bold text-cyan-600"><FileImage className="mr-2 inline size-4"/>{t('vehicleCheckIn.action.addSheetImage',{defaultValue:'Levha görseli ekle'})}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event=>{onFiles(event.target.files);event.currentTarget.value=''}}/></label>
      <span className="text-xs text-slate-500">{t('vehicleCheckIn.sheetImageInfo',{defaultValue:'Mevcut {{current}} · Yeni {{next}} görsel',current:row.attachmentCount,next:files.length})}</span>
    </div>
    {files.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{files.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>onRemoveFile(index)}/>)}</div>}
  </article>;
}

function ExistingVehicleImage({image}:{image:VehicleCheckInImage}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void vehicleCheckInApi.download(image.id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>setUrl(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[image.id]);
  return <figure className="overflow-hidden rounded-xl border"><div className="grid h-28 place-items-center bg-slate-950/5">{url?<img src={url} alt={image.fileName} className="h-full w-full object-cover"/>:<Loader2 className="size-4 animate-spin"/>}</div><figcaption className="truncate p-2 text-xs font-bold">{image.fileName}</figcaption></figure>;
}

function ExistingSteelAttachmentImage({attachment}:{attachment:SteelAttachment}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void steelReceiptApi.downloadAttachment(attachment.id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>setUrl(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[attachment.id]);
  return <figure className="overflow-hidden rounded-xl border"><div className="grid h-28 place-items-center bg-slate-950/5">{url?<img src={url} alt={attachment.fileName} className="h-full w-full object-cover"/>:<Loader2 className="size-4 animate-spin"/>}</div><figcaption className="truncate p-2 text-xs font-bold">{attachment.fileName}</figcaption></figure>;
}

function PendingImage({file,onRemove}:{file:File;onRemove:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return()=>URL.revokeObjectURL(objectUrl)},[file]);
  return <figure className="overflow-hidden rounded-xl border"><div className="relative h-28 bg-slate-950/5">{url&&<img src={url} alt={file.name} className="h-full w-full object-cover"/>}<button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="size-3"/></button></div><figcaption className="truncate p-2 text-xs font-bold">{file.name}</figcaption></figure>;
}

function Summary({label,value}:{label:string;value:string}){return <div className="rounded-xl border bg-[var(--wms-app-surface)] p-3"><small className="block text-slate-500">{label}</small><strong className="text-lg">{value}</strong></div>}
function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-600">{icon}{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
