import {useCallback,useEffect,useMemo,useRef,useState,type FocusEvent,type MouseEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Link,useSearchParams} from 'react-router-dom';
import {
  Camera,
  CarFront,
  AlertTriangle,
  CheckCircle2,
  Contact,
  FileImage,
  ImagePlus,
  Loader2,
  MapPin,
  PackageSearch,
  Search,
  Save,
  Plus,
  X,
} from 'lucide-react';
import {toast} from 'sonner';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {OpsActionButton} from '@/components/shared/OpsActionButton';
import {DeleteConfirmDialog} from '@/components/shared/DeleteConfirmDialog';
import {PagedLookupDialog} from '@/components/shared/PagedLookupDialog';
import type {GridPage} from '@/components/shared/AdvancedDataGrid';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type {CustomerOption} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {SteelProcessHeader} from '@/features/steel-receipt/components/SteelProcessHeader';
import {steelReceiptApi} from '@/features/steel-receipt/api/steel-receipt.api';
import type {SteelAttachment} from '@/features/steel-receipt/types/steel-receipt.types';
import {formatProjectDateTime,formatProjectNumber} from '@/lib/project-format';
import {getNextLightboxFocusIndex} from '@/lib/wms-image-lightbox';
import type {PagedResponse} from '@/types/api';
import {useAuthStore} from '@/stores/auth-store';
import {vehicleCheckInApi} from '../api/vehicle-check-in.api';
import {canEnableUnknownPlateResolve} from '../unknown-plate-resolve';
import {
  acceptanceTargetMatches,
  hydrateVehicleCheckInForm,
} from '../vehicle-check-in-form';
import type {
  AcceptedSteelPlate,
  CompleteSteelVehicleAcceptanceResult,
  SaveVehicleCheckInRequest,
  SteelVehicleAcceptanceCandidate,
  VehicleCheckInDetail,
  VehicleCheckInImage,
} from '../types';

interface SelectedPlate {
  row:SteelVehicleAcceptanceCandidate;
  note:string;
}

interface UnknownPlateSlot {id:string}

interface PendingUnknownPlateResolve {
  acceptedPlateId:number;
  rowVersion:string;
  candidate:SteelVehicleAcceptanceCandidate;
  files:File[];
}

interface ImagePreview {
  url:string;
  title:string;
}

type OpenImagePreview=(url:string,title:string)=>void;

interface VehicleFormSnapshot {
  plateNo:string;
  trailerPlateNo:string;
  driverFirstName:string;
  driverLastName:string;
  driverPhone:string;
  carrierName:string;
  steelSheetCount:number;
  customerId:number|null;
  note:string;
}

const toVehicleFormSnapshot=(form:SaveVehicleCheckInRequest):VehicleFormSnapshot=>({
  plateNo:form.plateNo.trim().toUpperCase(),
  trailerPlateNo:(form.trailerPlateNo??'').trim(),
  driverFirstName:(form.driverFirstName??'').trim(),
  driverLastName:(form.driverLastName??'').trim(),
  driverPhone:(form.driverPhone??'').trim(),
  carrierName:(form.carrierName??'').trim(),
  steelSheetCount:form.steelSheetCount,
  customerId:form.customerId??null,
  note:(form.note??'').trim(),
});

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
const imageExtension=/\.(jpe?g|png|webp)$/i;
const allowedImageTypes=new Set(['image/jpeg','image/png','image/webp']);
const isImageFile=(file:File)=>allowedImageTypes.has(file.type.toLowerCase())||(!file.type&&imageExtension.test(file.name));
const validImage=(file:File)=>isImageFile(file)&&file.size<=8*1024*1024;
const imageKey=(file:File)=>`${file.name}:${file.size}:${file.lastModified}:${file.type}`;
const mergeImages=(current:File[],incoming:File[],limit:number)=>{
  const keys=new Set(current.map(imageKey));
  const unique=incoming.filter(file=>{
    const key=imageKey(file);
    if(keys.has(key))return false;
    keys.add(key);
    return true;
  });
  return [...current,...unique].slice(0,limit);
};
const norm=(v?:string|null)=>(v??'').trim().toLocaleLowerCase('tr-TR');
const formatDriverName=(firstName?:string,lastName?:string)=>{
  if(!firstName?.trim()&&!lastName?.trim())return'';
  if(!lastName)return firstName??'';
  if(!firstName?.trim())return lastName;
  return `${firstName} ${lastName}`;
};
const parseDriverName=(value:string)=>{if(!value)return{driverFirstName:'',driverLastName:''};const space=value.indexOf(' ');if(space===-1)return{driverFirstName:value,driverLastName:''};return{driverFirstName:value.slice(0,space),driverLastName:value.slice(space+1)}};
const selectInputContents=(event:FocusEvent<HTMLInputElement>|MouseEvent<HTMLInputElement>)=>event.currentTarget.select();
const toPagedResponse=<T,>(page:GridPage<T>):PagedResponse<T>=>({
  data:page.items,
  pageNumber:page.pageNumber,
  pageSize:page.pageSize,
  totalCount:page.totalCount,
  totalPages:page.totalPages??Math.max(1,Math.ceil(page.totalCount/page.pageSize)||0),
  hasPreviousPage:page.pageNumber>1,
  hasNextPage:page.hasNextPage??page.pageNumber*page.pageSize<page.totalCount,
});

export function VehicleCheckInPage({embedded=false,initialId,onCompleted}:{embedded?:boolean;initialId?:number;onCompleted?:()=>void}={}){
  const {t}=useTranslation('common');
  const [searchParams,setSearchParams]=useSearchParams();
  const branch=useAuthStore(s=>s.branch?.code??'0');
  const [form,setForm]=useState<SaveVehicleCheckInRequest>(()=>empty(branch));
  const [record,setRecord]=useState<VehicleCheckInDetail|null>(null);
  const [vehicleFiles,setVehicleFiles]=useState<File[]>([]);
  const [plateFiles,setPlateFiles]=useState<Record<number,File[]>>({});
  const [selected,setSelected]=useState<Record<number,SelectedPlate>>({});
  const [unknownSlots,setUnknownSlots]=useState<UnknownPlateSlot[]>([]);
  const [removeUnknownId,setRemoveUnknownId]=useState<string|null>(null);
  const [resolvingPlateId,setResolvingPlateId]=useState<number|null>(null);
  const [resolveCandidate,setResolveCandidate]=useState<SteelVehicleAcceptanceCandidate|null>(null);
  const [resolveFiles,setResolveFiles]=useState<File[]>([]);
  const [pendingResolves,setPendingResolves]=useState<PendingUnknownPlateResolve[]>([]);
  const [sheetInput,setSheetInput]=useState('');
  const [candidateSearch,setCandidateSearch]=useState<{value:string;run:number}|null>(null);
  const [busy,setBusy]=useState(false);
  const [idempotencyKey,setIdempotencyKey]=useState(()=>crypto.randomUUID());
  const [completed,setCompleted]=useState<CompleteSteelVehicleAcceptanceResult|null>(null);
  const [carrierLookupOpen,setCarrierLookupOpen]=useState(false);
  const [imagePreview,setImagePreview]=useState<ImagePreview|null>(null);
  const [savedFormBaseline,setSavedFormBaseline]=useState<VehicleFormSnapshot|null>(null);
  const openImagePreview=useCallback((url:string,title:string)=>setImagePreview({url,title}),[]);
  const closeImagePreview=useCallback(()=>setImagePreview(null),[]);

  const savedAcceptedCount=completed?.plates.length??0;
  const knownAcceptedPlates=useMemo(()=>completed?.plates.filter(plate=>plate.identityStatus!=='Unknown')??[],[completed?.plates]);
  const unknownAcceptedPlates=useMemo(()=>completed?.plates.filter(plate=>plate.identityStatus==='Unknown')??[],[completed?.plates]);
  const acceptedPlanLineIds=useMemo(
    ()=>new Set(knownAcceptedPlates.flatMap(plate=>plate.planLineId?[plate.planLineId]:[])),
    [knownAcceptedPlates],
  );
  const pendingResolveByPlateId=useMemo(
    ()=>new Map(pendingResolves.map(item=>[item.acceptedPlateId,item])),
    [pendingResolves],
  );
  const reservedPlanLineIds=useMemo(()=>{
    const ids=new Set(acceptedPlanLineIds);
    pendingResolves.forEach(item=>ids.add(item.candidate.id));
    return ids;
  },[acceptedPlanLineIds,pendingResolves]);
  const selectedPlates=useMemo(()=>Object.values(selected),[selected]);
  const selectedCount=selectedPlates.length+unknownSlots.length;
  const targetCountMatches=acceptanceTargetMatches(
    savedAcceptedCount,selectedCount,form.steelSheetCount);
  const footerReadyCount=savedAcceptedCount+selectedCount;
  const totalQuantity=selectedPlates.reduce((sum,item)=>sum+item.row.expectedQuantity,0);
  const vehicleImageCount=(record?.images.length??0)+vehicleFiles.length;
  const plateHasImages=(row:SteelVehicleAcceptanceCandidate,lineId:number)=>
    row.attachmentCount+(plateFiles[lineId]?.length??0)>0;
  const platesWithoutImages=selectedPlates.filter(item=>!plateHasImages(item.row,item.row.id));
  const hasFormChanges=savedFormBaseline!==null&&JSON.stringify(toVehicleFormSnapshot(form))!==JSON.stringify(savedFormBaseline);
  const hasVehicleFileChanges=vehicleFiles.length>0;
  const hasPendingResolves=pendingResolves.length>0;
  const hasVehicleChanges=hasFormChanges||hasVehicleFileChanges;
  const hasSaveableChanges=hasVehicleChanges||hasPendingResolves;
  const isAcceptanceComplete=savedAcceptedCount>=form.steelSheetCount&&selectedCount===0;
  const readyToComplete=
    form.plateNo.trim().length>0&&
    targetCountMatches&&
    selectedCount>0&&
    vehicleImageCount>0&&
    platesWithoutImages.length===0;
  const readyToSaveVehicle=
    Boolean(form.id)&&
    form.plateNo.trim().length>0&&
    vehicleImageCount>0&&
    hasSaveableChanges;
  const showSaveButton=Boolean(form.id);
  const showCompleteButton=!form.id||selectedCount>0;
  const saveVehicleBlockers=useMemo(()=>{
    const items:string[]=[];
    if(!hasSaveableChanges&&savedFormBaseline){
      items.push(t('vehicleCheckIn.blocker.noChanges',{defaultValue:'Kaydedilecek değişiklik yok.'}));
    }
    if(!form.plateNo.trim())items.push(t('vehicleCheckIn.blocker.towingPlate',{defaultValue:'Çekici plakası girilmeli.'}));
    if(vehicleImageCount===0)items.push(t('vehicleCheckIn.blocker.vehicleImage',{defaultValue:'En az bir araç görseli eklenmeli.'}));
    return items;
  },[form.plateNo,hasSaveableChanges,savedFormBaseline,t,vehicleImageCount]);
  const completeBlockers=useMemo(()=>{
    const items:string[]=[];
    if(!form.plateNo.trim())items.push(t('vehicleCheckIn.blocker.towingPlate',{defaultValue:'Çekici plakası girilmeli.'}));
    if(footerReadyCount<form.steelSheetCount){
      items.push(t('vehicleCheckIn.blocker.missingSheets',{
        missing:form.steelSheetCount-footerReadyCount,
        total:form.steelSheetCount,
        defaultValue:`${form.steelSheetCount-footerReadyCount} levha daha seçilmeli (toplam ${form.steelSheetCount}).`,
      }));
    }
    if(vehicleImageCount===0)items.push(t('vehicleCheckIn.blocker.vehicleImage',{defaultValue:'En az bir araç görseli eklenmeli.'}));
    platesWithoutImages.forEach(item=>{
      items.push(t('vehicleCheckIn.blocker.sheetImage',{
        dCode:item.row.dCode,
        defaultValue:`${item.row.dCode} levhası için görsel eklenmeli.`,
      }));
    });
    return items;
  },[footerReadyCount,form.plateNo,form.steelSheetCount,platesWithoutImages,t,vehicleImageCount]);
  const candidates=useQuery({
    queryKey:['steel-vehicle-acceptance-candidates',branch,candidateSearch?.value,candidateSearch?.run,form.steelSheetCount],
    enabled:Boolean(candidateSearch),
    queryFn:()=>vehicleCheckInApi.steelCandidates(branch,{
      pageNumber:1,
      pageSize:500,
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
  const patchDriverName=(value:string)=>{
    const parsed=parseDriverName(value);
    setForm(current=>({...current,...parsed}));
  };
  const driverFullName=formatDriverName(form.driverFirstName,form.driverLastName);

  const hydrate=useCallback((detail:VehicleCheckInDetail)=>{
    setRecord(detail);
    const header=detail.header;
    const nextForm=hydrateVehicleCheckInForm(header);
    setForm(nextForm);
    setSavedFormBaseline(toVehicleFormSnapshot(nextForm));
  },[]);
  const hydrateWithAcceptance=useCallback(async(detail:VehicleCheckInDetail)=>{
    hydrate(detail);
    setPendingResolves([]);
    setResolvingPlateId(null);
    setResolveCandidate(null);
    setResolveFiles([]);
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
      else{setRecord(null);setCompleted(null);setSavedFormBaseline(null);setForm(current=>({...current,id:undefined,rowVersion:undefined}));toast.info(t('vehicleCheckIn.toast.todayNotFound',{defaultValue:'Bugün için kayıt bulunamadı; kabul ile birlikte oluşturulacak.'}))}
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

  const remainingSelectionSlots=Math.max(0,form.steelSheetCount-savedAcceptedCount);
  const addUnknownPlate=()=>{
    if(selectedCount>=remainingSelectionSlots){
      toast.error(t('vehicleCheckIn.toast.sheetSelectionLimit',{defaultValue:'Araç için {{count}} levha seçebilirsiniz.',count:form.steelSheetCount}));
      return;
    }
    setUnknownSlots(current=>[...current,{id:crypto.randomUUID()}]);
  };
  const stageUnknownPlateResolve=()=>{
    if(!resolvingPlateId||!completed||!resolveCandidate)return;
    const unknown=completed.plates.find(plate=>plate.id===resolvingPlateId&&plate.identityStatus==='Unknown');
    if(!unknown)return;
    if(resolveFiles.length===0){
      toast.error(t('vehicleCheckIn.sheetImageMissing',{defaultValue:'En az bir levha görseli zorunludur.'}));
      return;
    }
    if(reservedPlanLineIds.has(resolveCandidate.id)&&!pendingResolveByPlateId.has(unknown.id)){
      toast.error(t('vehicleCheckIn.toast.sheetAlreadyAccepted',{defaultValue:'Bu levha zaten kabul edilmiş.'}));
      return;
    }
    setPendingResolves(current=>{
      const next=current.filter(item=>item.acceptedPlateId!==unknown.id);
      next.push({
        acceptedPlateId:unknown.id,
        rowVersion:unknown.rowVersion,
        candidate:resolveCandidate,
        files:resolveFiles,
      });
      return next;
    });
    setResolvingPlateId(null);
    setResolveCandidate(null);
    setResolveFiles([]);
    toast.success(t('vehicleCheckIn.toast.unknownPlateResolveStaged',{
      defaultValue:'Eşleştirme hazır. Uygulamak için Kaydet\'e basın.',
    }));
  };
  const removePendingResolve=(acceptedPlateId:number)=>{
    setPendingResolves(current=>current.filter(item=>item.acceptedPlateId!==acceptedPlateId));
  };
  const togglePlate=(row:SteelVehicleAcceptanceCandidate)=>{
    if(resolvingPlateId){
      if(reservedPlanLineIds.has(row.id)){
        toast.error(t('vehicleCheckIn.toast.sheetAlreadyAccepted',{defaultValue:'Bu levha zaten kabul edilmiş.'}));
        return;
      }
      setResolveCandidate(current=>current?.id===row.id?null:row);
      setResolveFiles([]);
      return;
    }
    if(reservedPlanLineIds.has(row.id)){
      toast.error(t('vehicleCheckIn.toast.sheetAlreadyAccepted',{defaultValue:'Bu levha zaten kabul edilmiş.'}));
      return;
    }
    setSelected(current=>{
      if(current[row.id]){
        const next={...current};
        delete next[row.id];
        return next;
      }
      if(Object.keys(current).length+unknownSlots.length>=remainingSelectionSlots){
        toast.error(t('vehicleCheckIn.toast.sheetSelectionLimit',{defaultValue:'Araç için {{count}} levha seçebilirsiniz.',count:form.steelSheetCount}));
        return current;
      }
      return {
        ...current,
        [row.id]:{
          row,
          note:'',
        },
      };
    });
  };
  const toggleAllCandidates=(visibleRows:SteelVehicleAcceptanceCandidate[],select:boolean)=>{
    if(resolvingPlateId){
      if(!select){
        setResolveCandidate(null);
        setResolveFiles([]);
        return;
      }
      const first=visibleRows.find(row=>!reservedPlanLineIds.has(row.id));
      if(first){
        setResolveCandidate(first);
        setResolveFiles([]);
      }
      return;
    }
    if(select){
      setSelected(current=>{
        const next={...current};
        let count=Object.keys(next).length+unknownSlots.length;
        let skipped=0;
        for(const row of visibleRows){
          if(next[row.id]||reservedPlanLineIds.has(row.id))continue;
          if(count>=remainingSelectionSlots){skipped++;continue}
          next[row.id]={row,note:''};
          count++;
        }
        if(skipped>0)toast.error(t('vehicleCheckIn.toast.sheetSelectionLimit',{defaultValue:'Araç için {{count}} levha seçebilirsiniz.',count:form.steelSheetCount}));
        return next;
      });
      return;
    }
    setSelected(current=>{
      const next={...current};
      visibleRows.forEach(row=>{delete next[row.id]});
      return next;
    });
  };

  const updateSelected=(lineId:number,changes:Partial<SelectedPlate>)=>
    setSelected(current=>current[lineId]?{...current,[lineId]:{...current[lineId],...changes}}:current);

  const onVehicleFiles=(list:FileList|null)=>{
    const files=Array.from(list??[]).filter(validImage);
    setVehicleFiles(current=>mergeImages(current,files,10));
    if(files.length!==(list?.length??0))toast.error(t('vehicleCheckIn.toast.imageValidation',{defaultValue:'Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.'}));
  };

  const onPlateFiles=(lineId:number,list:FileList|null)=>{
    const files=Array.from(list??[]).filter(validImage);
    setPlateFiles(current=>({...current,[lineId]:mergeImages(current[lineId]??[],files,5)}));
    if(files.length!==(list?.length??0))toast.error(t('vehicleCheckIn.toast.imageValidation',{defaultValue:'Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.'}));
  };
  const onResolveFiles=(list:FileList|null)=>{
    const files=Array.from(list??[]).filter(validImage);
    setResolveFiles(current=>mergeImages(current,files,5));
    if(files.length!==(list?.length??0))toast.error(t('vehicleCheckIn.toast.imageValidation',{defaultValue:'Yalnız JPG, PNG veya WEBP ve en fazla 8 MB görsel yüklenebilir.'}));
  };

  const saveVehicle=async()=>{
    if(!form.id)return;
    if(!hasSaveableChanges){toast.info(t('vehicleCheckIn.toast.noChangesToSave',{defaultValue:'Kaydedilecek değişiklik yok.'}));return}
    if(!form.plateNo.trim()){toast.error(t('vehicleCheckIn.toast.towingPlateRequired',{defaultValue:'Çekici plakası zorunludur.'}));return}
    if(vehicleImageCount===0){toast.error(t('vehicleCheckIn.toast.vehicleImageRequired',{defaultValue:'Araç kabulü için en az bir araç görseli zorunludur.'}));return}

    setBusy(true);
    const resolvesToSave=[...pendingResolves];
    const savingVehicle=hasVehicleChanges;
    const savingResolves=resolvesToSave.length>0;
    try{
      if(savingVehicle){
        let detail=await vehicleCheckInApi.save({
          ...form,
          branchCode:branch,
          plateNo:form.plateNo.trim().toUpperCase(),
        });
        if(vehicleFiles.length>0){
          const uploaded=await vehicleCheckInApi.upload(detail.header.id,vehicleFiles);
          detail={...detail,images:[...detail.images,...uploaded]};
          setVehicleFiles([]);
        }
        hydrate(detail);
      }
      if(savingResolves){
        for(const pending of resolvesToSave){
          await vehicleCheckInApi.resolveUnknownPlate(pending.acceptedPlateId,{
            planLineId:pending.candidate.id,
            receivingLocationId:pending.candidate.receivingLocationId,
            rowVersion:pending.rowVersion,
            planLineRowVersion:pending.candidate.rowVersion,
          },pending.files);
        }
        const refreshed=await vehicleCheckInApi.steelAcceptanceByVehicle(form.id);
        setCompleted(refreshed);
        if(refreshed)hydrate(refreshed.vehicle);
        setPendingResolves([]);
        setCandidateSearch(current=>current?{...current,run:current.run+1}:current);
      }
      onCompleted?.();
      toast.success(savingResolves&&savingVehicle
        ?t('vehicleCheckIn.toast.vehicleAndResolveSaved',{defaultValue:'Araç bilgileri ve eşleştirmeler kaydedildi.'})
        :savingResolves
          ?t('vehicleCheckIn.toast.unknownPlateResolved',{defaultValue:'Bilinmeyen levha SAC satırıyla eşleştirildi.'})
          :t('vehicleCheckIn.toast.vehicleSaved',{defaultValue:'Araç bilgileri kaydedildi.'}));
    }catch(error){
      toast.error(error instanceof Error?error.message:t('vehicleCheckIn.toast.saveVehicleFailed',{defaultValue:'Kayıt tamamlanamadı.'}));
    }finally{
      setBusy(false);
    }
  };

  const complete=async()=>{
    if(!form.plateNo.trim()){toast.error(t('vehicleCheckIn.toast.towingPlateRequired',{defaultValue:'Çekici plakası zorunludur.'}));return}
    if(selectedCount===0){toast.error(t('vehicleCheckIn.toast.noNewSheetsSelected',{defaultValue:'Kaydetmek için en az bir levha seçilmelidir.'}));return}
    if(!targetCountMatches){toast.error(t('vehicleCheckIn.toast.exactSheetCount',{defaultValue:'Girilen levha adedi {{count}}; tam olarak {{count}} levha seçilmelidir.',count:form.steelSheetCount}));return}
    if(vehicleImageCount===0){toast.error(t('vehicleCheckIn.toast.vehicleImageRequired',{defaultValue:'Araç kabulü için en az bir araç görseli zorunludur.'}));return}
    const missingImages=selectedPlates.find(item=>!plateHasImages(item.row,item.row.id));
    if(missingImages){
      toast.error(t('vehicleCheckIn.toast.sheetImageRequired',{
        dCode:missingImages.row.dCode,
        defaultValue:`${missingImages.row.dCode} levhası için en az bir görsel zorunludur.`,
      }));
      return;
    }

    setBusy(true);
    try{
      const result=await vehicleCheckInApi.completeSteelAcceptance({
        idempotencyKey,
        vehicle:{...form,branchCode:branch,plateNo:form.plateNo.trim().toUpperCase(),steelSheetCount:form.steelSheetCount},
        slots:[
          ...selectedPlates.map(item=>({
          identityStatus:'Known' as const,
          planLineId:item.row.id,
          receivingLocationId:item.row.receivingLocationId,
          rowVersion:item.row.rowVersion,
          note:item.note||undefined,
          })),
          ...unknownSlots.map(()=>({identityStatus:'Unknown' as const})),
        ],
        note:form.note||undefined,
      },vehicleFiles,selectedPlates.flatMap(item=>(plateFiles[item.row.id]??[]).map(file=>({lineId:item.row.id,file}))));
      hydrate(result.vehicle);
      if(!embedded)setSearchParams({id:String(result.vehicle.header.id)},{replace:true});
      setCompleted(result);
      setVehicleFiles([]);
      setPlateFiles({});
      setSelected({});
      setUnknownSlots([]);
      setIdempotencyKey(crypto.randomUUID());
      setCandidateSearch(current=>current?{...current,run:current.run+1}:current);
      onCompleted?.();
      toast.success(result.replayed?t('vehicleCheckIn.toast.alreadyCompleted',{defaultValue:'Bu araç ve SAC kabulü daha önce tamamlandı.'}):t('vehicleCheckIn.toast.completed',{defaultValue:'Araç giriş ve SAC kabulü başarıyla tamamlandı.'}));
    }catch(error){toast.error(error instanceof Error?error.message:t('vehicleCheckIn.toast.completeFailed',{defaultValue:'Araç giriş ve SAC kabulü tamamlanamadı.'}))}
    finally{setBusy(false)}
  };

  const candidateTableSelected=useMemo(()=>{
    if(resolvingPlateId&&resolveCandidate){
      return {[resolveCandidate.id]:{row:resolveCandidate,note:''}};
    }
    return selected;
  },[resolvingPlateId,resolveCandidate,selected]);
  const startUnknownPlateResolve=(plateId:number)=>{
    setResolvingPlateId(plateId);
    setResolveCandidate(null);
    setResolveFiles([]);
  };
  const cancelUnknownPlateResolve=()=>{
    setResolvingPlateId(null);
    setResolveCandidate(null);
    setResolveFiles([]);
  };

  const entryText=record?formatProjectDateTime(record.header.checkedInAtUtc):t('vehicleCheckIn.entryTimePlaceholder',{defaultValue:'Kabul sırasında UTC olarak oluşturulur.'});

  return <section className="space-y-5">
    {!embedded&&<SteelProcessHeader
      currentStep="gate"
      title={t('vehicleCheckIn.pageTitle',{defaultValue:'Araç Giriş ve SAC Kabul'})}
      description={t('vehicleCheckIn.pageDescription',{defaultValue:'Araç bilgisi, saha kabul, seçilen levhalar, görseller ve kabul konumları tek işlemde kaydedilir. Seri yazınca eşleşen levha bilgisi otomatik gelir.'})}
    />}

    <Panel title={t('vehicleCheckIn.section.vehicleInfo',{defaultValue:'1 · Araç ve sürücü bilgileri'})} icon={<CarFront className="size-5"/>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field
          label={t('vehicleCheckIn.field.towingPlate',{defaultValue:'Çekici plakası *'})}
          errorTarget="plateNo"
          errorKeys="plaka|çekici plakası|araç girişinin sac kabul|tamamlanmış|iptal edilmiş|araç giriş kaydı|araç kaydı getirilemedi|araç kaydı aranamadı"
        ><div className="flex gap-2"><input className="input uppercase" value={form.plateNo} onChange={event=>patch('plateNo',event.target.value.toUpperCase())} maxLength={25}/><button type="button" onClick={()=>void findToday()} disabled={busy} className="rounded-xl border px-4" title={t('vehicleCheckIn.action.findToday',{defaultValue:'Bugünkü aracı bul'})}><Search className="size-4"/></button></div></Field>
        <Field label={t('vehicleCheckIn.field.trailerPlate',{defaultValue:'Dorse plakası'})}><input className="input uppercase" value={form.trailerPlateNo||''} onChange={event=>patch('trailerPlateNo',event.target.value.toUpperCase())} maxLength={25}/></Field>
        <Field label={t('vehicleCheckIn.field.entryTime',{defaultValue:'Araç giriş zamanı'})}><input className="input" value={entryText} readOnly/></Field>
        <Field label={t('vehicleCheckIn.field.driverName',{defaultValue:'Şoför adı soyadı'})}><input className="input" value={driverFullName} onChange={event=>patchDriverName(event.target.value)} maxLength={201}/></Field>
        <Field label={t('vehicleCheckIn.field.driverPhone',{defaultValue:'Şoför telefonu'})}><input className="input" value={form.driverPhone||''} onChange={event=>patch('driverPhone',event.target.value)} maxLength={40}/></Field>
        <Field label={t('vehicleCheckIn.field.carrier',{defaultValue:'Nakliyeci / taşıyıcı carisi'})}>
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={form.carrierName||''}
              onChange={event=>patch('carrierName',event.target.value)}
              maxLength={200}
              placeholder={t('vehicleCheckIn.placeholder.carrierAccount',{defaultValue:'Nakliyeci / taşıyıcı carisi girin veya rehberden seçin'})}
            />
            <button
              type="button"
              onClick={()=>setCarrierLookupOpen(true)}
              disabled={busy}
              className="rounded-xl border px-4"
              title={t('vehicleCheckIn.action.openCarrierGuide',{defaultValue:'Tedarikçi rehberi'})}
            >
              <Contact className="size-6"/>
            </button>
          </div>
          <div className="hidden" aria-hidden>
            <PagedLookupDialog<CustomerOption>
              variant="ops"
              triggerMode="button"
              open={carrierLookupOpen}
              onOpenChange={setCarrierLookupOpen}
              title={t('vehicleCheckIn.carrierLookup.title',{defaultValue:'Tedarikçi / cari rehberi'})}
              value={form.carrierName||null}
              placeholder={t('vehicleCheckIn.placeholder.carrierAccount',{defaultValue:'Nakliyeci / taşıyıcı carisi girin veya rehberden seçin'})}
              searchPlaceholder={t('vehicleCheckIn.carrierLookup.searchPlaceholder',{defaultValue:'Cari kodu veya adı ile ara'})}
              emptyText={t('vehicleCheckIn.carrierLookup.empty',{defaultValue:'Tedarikçi kaydı bulunamadı'})}
              queryKey={['vehicle-check-in-carrier-customers',branch]}
              fetchPage={async({pageNumber,pageSize,search,signal})=>toPagedResponse(await goodsReceiptV2Api.customers({
                pageNumber,
                pageSize,
                search,
                sortBy:'customerCode',
                sortDirection:'asc',
                signal:signal??new AbortController().signal,
              },branch))}
              getKey={item=>String(item.id)}
              getLabel={item=>`${item.customerName} (${item.customerCode})`}
              onSelect={item=>patch('carrierName',item.customerName)}
            />
          </div>
        </Field>
        <Field
          label={t('vehicleCheckIn.field.sheetCount',{defaultValue:'SAC levha adedi *'})}
          errorTarget="steelSheetCount"
          errorKeys="levha adedi|sac levha adedi|1-50|levha sayısı|seçilen levha sayısı|levha seçebilirsiniz|levha daha seçilmeli|levha seçilebilir"
        ><input className="input" type="number" min={Math.max(1,savedAcceptedCount)} max="50" step="1" value={form.steelSheetCount} onFocus={selectInputContents} onClick={selectInputContents} onChange={event=>{
          const next=Number(event.target.value);
          if(next<savedAcceptedCount){
            toast.error(t('vehicleCheckIn.toast.sheetCountBelowSaved',{count:savedAcceptedCount,defaultValue:'Kayıtlı {{count}} levha varken hedef adet daha düşük olamaz.'}));
            return;
          }
          patch('steelSheetCount',next);
        }}/></Field>
        <div className="md:col-span-2 xl:col-span-3"><Field label={t('vehicleCheckIn.field.acceptanceNote',{defaultValue:'Saha / kabul notu'})}><textarea className="input min-h-20" value={form.note||''} onChange={event=>patch('note',event.target.value)} maxLength={1000}/></Field></div>
      </div>
    </Panel>

    <Panel
      title={t('vehicleCheckIn.section.vehicleImagesRequired',{defaultValue:'2 · Araç görselleri *'})}
      icon={<Camera className="size-5"/>}
      errorTarget="vehicleImages"
      errorKeys="araç görseli|araç kabulü için en az bir|en fazla 10 araç görseli|120 mb|jpg, png|webp|8 mb görsel"
    >
      <p className="mb-4 text-sm text-slate-500">{t('vehicleCheckIn.vehicleImagesHelp',{defaultValue:'Plaka, dorse, yük güvenliği ve kapı kabul kanıtlarını seçin. Yeni görseller SAC kabulüyle aynı işlemde yüklenecektir.'})}</p>
      {vehicleImageCount===0&&<p className="mb-4 text-sm font-semibold text-amber-600">{t('vehicleCheckIn.vehicleImageMissing',{defaultValue:'En az bir araç görseli zorunludur.'})}</p>}
      <ImageInputActions
        selectLabel={t('vehicleCheckIn.action.pickVehicleImage',{defaultValue:'Araç görseli seç'})}
        captureLabel={t('vehicleCheckIn.action.captureVehicleImage',{defaultValue:'Araç fotoğrafı çek'})}
        onFiles={onVehicleFiles}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {record?.images.map(image=><ExistingVehicleImage key={image.id} image={image} onPreview={openImagePreview}/>)}
        {vehicleFiles.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>setVehicleFiles(current=>current.filter((_,i)=>i!==index))} onPreview={openImagePreview}/>)}
      </div>
    </Panel>

    <Panel title={t('vehicleCheckIn.section.findSheet',{defaultValue:'3 · Seri / DCode ile SAC levha bul'})} icon={<PackageSearch className="size-5"/>}>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {!resolvingPlateId&&<button type="button" onClick={addUnknownPlate} disabled={footerReadyCount>=form.steelSheetCount} className="inline-flex items-center rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-700 disabled:opacity-50 dark:text-amber-300"><Plus className="mr-2 size-4"/>{t('vehicleCheckIn.action.addUnknownPlate',{defaultValue:'Bilinmeyen levha ekle'})}</button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Field
          label={t('vehicleCheckIn.field.serialSearch',{defaultValue:'Seri no yazın — eşleşen levha bilgisi otomatik gelir'})}
          errorTarget="sheetSearch"
          errorKeys="sac levhası|seçilen sac|levha bulunamadı|şubesiyle uyuşmuyor|tedarikçi|aday listesini yenile|başka bir kullanıcı|kabul edilmiş|kontrol edilmiş|mal kabule aktarılmış|idempotency"
        >
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
              {(resolvingPlateId?resolveCandidate?.id===hydratedMatch.id:selected[hydratedMatch.id])?t('vehicleCheckIn.action.removeSelection',{defaultValue:'Seçimden çıkar'}):t('vehicleCheckIn.action.addSelection',{defaultValue:'Seçime ekle'})}
            </button>
          </div>
        </div>
      )}
      {candidateSearch&&<CandidateTable rows={candidateRows} loading={candidates.isFetching} selected={candidateTableSelected} onToggle={togglePlate} onToggleAll={toggleAllCandidates}/>}
    </Panel>

    {selectedCount>0&&<Panel emphasized title={t('vehicleCheckIn.section.selectedSheets',{defaultValue:'4 · Seçilen levhalar ({{selected}}/{{total}})',selected:footerReadyCount,total:form.steelSheetCount})} icon={<MapPin className="size-5"/>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary emphasized label={t('vehicleCheckIn.summary.selectedSheets',{defaultValue:'Seçilen levha'})} value={String(footerReadyCount)}/>
        <Summary emphasized label={t('vehicleCheckIn.summary.totalQuantity',{defaultValue:'Toplam kabul miktarı'})} value={formatProjectNumber(totalQuantity)}/>
        <Summary emphasized label={t('vehicleCheckIn.summary.missingSelection',{defaultValue:'Eksik seçim'})} value={String(Math.max(0,form.steelSheetCount-footerReadyCount))}/>
      </div>
      <div className="space-y-4">{selectedPlates.map(item=><SelectedPlateCard
        key={item.row.id}
        item={item}
        files={plateFiles[item.row.id]??[]}
        missingImages={!plateHasImages(item.row,item.row.id)}
        onChange={changes=>updateSelected(item.row.id,changes)}
        onFiles={files=>onPlateFiles(item.row.id,files)}
        onRemoveFile={index=>setPlateFiles(current=>({...current,[item.row.id]:(current[item.row.id]??[]).filter((_,i)=>i!==index)}))}
        onRemove={()=>togglePlate(item.row)}
        onPreview={openImagePreview}
      />)}
      {unknownSlots.map((slot,index)=><article key={slot.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
        <div><span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">{t('vehicleCheckIn.unknownBadge',{defaultValue:'Bilinmeyen'})}</span><p className="mt-2 text-sm text-slate-500">{t('vehicleCheckIn.unknownSlotDescription',{sequence:selectedPlates.length+index+1,defaultValue:'{{sequence}}. levhanın seri bilgisi daha sonra SAC ile eşleştirilecek.'})}</p></div>
        <button type="button" onClick={()=>setRemoveUnknownId(slot.id)} className="rounded-lg border border-red-500/30 p-2 text-red-500" title={t('vehicleCheckIn.action.removeUnknownPlate',{defaultValue:'Bilinmeyen levhayı kaldır'})}><X className="size-4"/></button>
      </article>)}</div>
    </Panel>}

    {unknownAcceptedPlates.length>0&&<Panel title={t('vehicleCheckIn.section.unknownPlates',{count:unknownAcceptedPlates.length,defaultValue:'Bilinmeyen levhalar ({{count}})'})} icon={<AlertTriangle className="size-5 text-amber-500"/>}>
      <p className="mb-4 text-sm font-semibold text-amber-600">{t('vehicleCheckIn.blocker.unknownPlatesPending',{count:unknownAcceptedPlates.length,defaultValue:'{{count}} levhanın kimliği bilinmiyor; irsaliye için önce eşleştirin.'})}</p>
      {hasPendingResolves&&<p className="mb-4 text-sm font-semibold text-cyan-600">{t('vehicleCheckIn.pendingResolveHint',{count:pendingResolves.length,defaultValue:'{{count}} eşleştirme Kaydet ile uygulanmayı bekliyor.'})}</p>}
      <div className="space-y-3">{unknownAcceptedPlates.map(plate=>{
        const pending=pendingResolveByPlateId.get(plate.id);
        if(pending){
          return <StagedUnknownPlateResolveCard
            key={plate.id}
            plate={plate}
            pending={pending}
            onRemove={()=>removePendingResolve(plate.id)}
            onPreview={openImagePreview}
          />;
        }
        return <UnknownAcceptedPlateCard
          key={plate.id}
          plate={plate}
          busy={busy}
          isResolving={resolvingPlateId===plate.id}
          resolveCandidate={resolvingPlateId===plate.id?resolveCandidate:null}
          resolveFiles={resolvingPlateId===plate.id?resolveFiles:[]}
          onStart={()=>startUnknownPlateResolve(plate.id)}
          onCancel={cancelUnknownPlateResolve}
          onResolveFiles={onResolveFiles}
          onRemoveResolveFile={index=>setResolveFiles(current=>current.filter((_,fileIndex)=>fileIndex!==index))}
          onConfirm={stageUnknownPlateResolve}
          onPreview={openImagePreview}
        />;
      })}</div>
    </Panel>}

    {knownAcceptedPlates.length>0&&<Panel title={t('vehicleCheckIn.section.savedAcceptedSheets',{defaultValue:'Kayıtlı kabul levhaları ({{count}})',count:knownAcceptedPlates.length})} icon={<FileImage className="size-5"/>}>
      <p className="mb-4 text-sm text-slate-500">{t('vehicleCheckIn.savedAcceptedSheetsHelp',{defaultValue:'Bu araç için daha önce kaydedilmiş levha bilgileri ve mevcut levha ekleri aşağıda listelenir.'})}</p>
      <div className="space-y-4">
        {knownAcceptedPlates.map(plate=>{
          const line=plate.planLineSummary;
          const attachments=plate.attachments??[];
          return <article key={plate.id} className="rounded-2xl border bg-[var(--wms-app-surface)] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Summary label={t('vehicleCheckIn.summary.dCodeSerial',{defaultValue:'DCode / Seri'})} value={`${plate.dCode} · ${plate.supplierSerialNo}`}/>
              <Summary label={t('vehicleCheckIn.summary.stock',{defaultValue:'Stok'})} value={line?`${line.stockCode} · ${line.stockName||'-'}`:plate.stockCode??'-'}/>
              <Summary label={t('vehicleCheckIn.summary.acceptedQuantity',{defaultValue:'Kabul miktarı'})} value={`${formatProjectNumber(plate.acceptedQuantity??0)} ${plate.unitCode??''}`}/>
            </div>
            <div className="mt-4">
              <strong className="text-sm">{t('vehicleCheckIn.attachmentsTitle',{defaultValue:'Levha görselleri / ekleri ({{count}})',count:attachments.length})}</strong>
              {attachments.length===0?<p className="mt-2 text-xs text-slate-500">{t('vehicleCheckIn.noSavedSheetImage',{defaultValue:'Kayıtlı levha görseli bulunamadı.'})}</p>:<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{attachments.map(attachment=><ExistingSteelAttachmentImage key={attachment.id} attachment={attachment} onPreview={openImagePreview}/>)}</div>}
            </div>
          </article>;
        })}
      </div>
    </Panel>}

    {completed&&<section className={`rounded-2xl border p-5 ${completed.containsUnknownPlates?'border-amber-500/40 bg-amber-500/10':'border-emerald-500/40 bg-emerald-500/10'}`}>
      <h2 className={`flex items-center gap-2 font-black ${completed.containsUnknownPlates?'text-amber-600':'text-emerald-600'}`}>{completed.containsUnknownPlates?<AlertTriangle className="size-5"/>:<CheckCircle2 className="size-5"/>}{completed.containsUnknownPlates?t('vehicleCheckIn.partiallyIdentifiedTitle',{defaultValue:'Kabul kaydedildi, eşleştirme bekleniyor · #{{id}}',id:completed.acceptanceId}):t('vehicleCheckIn.completedTitle',{defaultValue:'Kabul tamamlandı · #{{id}}',id:completed.acceptanceId})}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('vehicleCheckIn.completedDescription',{defaultValue:'{{plateNo}} plakalı araçla gelen {{count}} levha, araç ve Excel aktarım bilgileriyle ilişkilendirildi.',plateNo:completed.vehicle.header.plateNo,count:completed.plates.length})}</p>
      <p className="mt-2 text-xs text-slate-500">{t('vehicleCheckIn.completedQualityPrefix',{defaultValue:'Kalite/onay kararları için'})} <Link className="font-semibold text-cyan-600 underline" to="/warehouse/goods-receipts/steel/inspection">{t('vehicleCheckIn.completedQualityLink',{defaultValue:'Saha Kalite Onayı'})}</Link> {t('vehicleCheckIn.completedQualitySuffix',{defaultValue:'ekranını kullanın.'})}</p>
    </section>}

    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-[var(--wms-app-panel)] p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
      <div><strong>{isAcceptanceComplete?t('vehicleCheckIn.footerAccepted',{defaultValue:'{{selected}}/{{total}} levha kabul edildi',selected:footerReadyCount,total:form.steelSheetCount}):t('vehicleCheckIn.footerReady',{defaultValue:'{{selected}}/{{total}} levha hazır',selected:footerReadyCount,total:form.steelSheetCount})}</strong><p className="text-xs text-slate-500">{isAcceptanceComplete?t('vehicleCheckIn.footerAcceptedHint',{defaultValue:'Kabul tamamlandı. Araç bilgilerini Kaydet ile güncelleyebilir veya yeni levha ekleyebilirsiniz.'}):readyToComplete?t('vehicleCheckIn.footerHint',{defaultValue:'Araç + saha kabul + görseller tek transaction.'}):t('vehicleCheckIn.footerIncomplete',{defaultValue:'Her levha için görsel, araç için en az bir görsel zorunludur.'})}</p></div>
      <div className="flex flex-wrap gap-3">
        {showSaveButton&&<FooterActionButton
          busy={busy}
          ready={readyToSaveVehicle}
          blockers={saveVehicleBlockers}
          label={t('vehicleCheckIn.action.saveVehicle',{defaultValue:'Kaydet'})}
          savingLabel={t('vehicleCheckIn.blocker.saving',{defaultValue:'Kaydediliyor...'})}
          title={t('vehicleCheckIn.saveVehicleBlockers.title',{defaultValue:'Kaydetmek için eksikler'})}
          icon={<Save className="mr-2 inline size-4" aria-hidden="true"/>}
          appearance="panel"
          onClick={()=>void saveVehicle()}
        />}
        {showCompleteButton&&<FooterActionButton
          busy={busy}
          ready={readyToComplete}
          blockers={completeBlockers}
          label={t('vehicleCheckIn.action.complete',{defaultValue:'Araç Giriş ve SAC Kabul'})}
          savingLabel={t('vehicleCheckIn.blocker.saving',{defaultValue:'Kaydediliyor...'})}
          title={t('vehicleCheckIn.completeBlockers.title',{defaultValue:'Kaydetmek için eksikler'})}
          icon={<CheckCircle2 className="mr-2 inline size-4" aria-hidden="true"/>}
          onClick={()=>void complete()}
        />}
      </div>
    </div>
    <DeleteConfirmDialog
      open={removeUnknownId!==null}
      title={t('vehicleCheckIn.confirm.removeUnknownTitle',{defaultValue:'Bilinmeyen levhayı kaldır'})}
      description={t('vehicleCheckIn.confirm.removeUnknownDescription',{defaultValue:'Bu araç için eklediğiniz bilinmeyen levha kaydını kaldırıyorsunuz. Devam etmek istiyor musunuz?'})}
      confirmLabel={t('vehicleCheckIn.action.removeUnknownPlate',{defaultValue:'Bilinmeyen levhayı kaldır'})}
      onOpenChange={open=>{if(!open)setRemoveUnknownId(null)}}
      onConfirm={()=>{if(removeUnknownId)setUnknownSlots(current=>current.filter(slot=>slot.id!==removeUnknownId));setRemoveUnknownId(null)}}
    />
    {imagePreview&&<ImageLightbox preview={imagePreview} onClose={closeImagePreview} closeLabel={t('vehicleCheckIn.action.closeImagePreview',{defaultValue:'Kapat'})}/>}
  </section>;
}

function FooterActionButton({busy,ready,blockers,label,savingLabel,title,icon,appearance='ops',onClick}:{busy:boolean;ready:boolean;blockers:string[];label:string;savingLabel:string;title:string;icon:ReactNode;appearance?:'ops'|'panel';onClick:()=>void}){
  const button=appearance==='panel'
    ?<button type="button" onClick={onClick} disabled={busy||!ready} className="rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?<Loader2 className="size-4 animate-spin" aria-hidden="true"/>:<>{icon}{label}</>}</button>
    :<OpsActionButton type="button" variant="primary" onClick={onClick} disabled={busy||!ready} className="inline-flex !min-h-[3rem] items-center gap-2 px-6 font-black">{busy?<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true"/>:icon}{label}</OpsActionButton>;
  if(ready&&!busy)return button;
  return <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" sideOffset={8} className="max-w-[22rem] overflow-hidden rounded-xl border border-[var(--wms-app-border)] !bg-[var(--wms-app-panel)] p-0 text-left !text-[var(--wms-app-text)] shadow-xl [&>svg]:!fill-[var(--wms-app-panel)] [&>svg]:!bg-[var(--wms-app-panel)]">
        <div className="border-b border-[var(--wms-app-border)] bg-slate-100 px-3.5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-cyan-600 dark:bg-slate-800">{title}</div>
        <ul className="space-y-1.5 bg-[var(--wms-app-panel)] px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text)]">
          {(busy?[savingLabel]:blockers).map(item=><li key={item} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-cyan-500" aria-hidden/>{item}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>;
}

function StagedUnknownPlateResolveCard({
  plate,
  pending,
  onRemove,
  onPreview,
}:{
  plate:AcceptedSteelPlate;
  pending:PendingUnknownPlateResolve;
  onRemove:()=>void;
  onPreview:OpenImagePreview;
}){
  const {t}=useTranslation('common');
  const candidate=pending.candidate;
  return <article className="rounded-xl border border-cyan-500/45 bg-cyan-500/10 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span className="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">{t('vehicleCheckIn.pendingResolveBadge',{defaultValue:'Kaydedilmeyi bekliyor'})}</span>
        <strong className="mt-2 block">{t('vehicleCheckIn.unknownSequence',{sequence:plate.sequenceNo,defaultValue:'Sıra {{sequence}}'})}</strong>
        <p className="text-xs text-slate-500">{t('vehicleCheckIn.pendingResolveDescription',{defaultValue:'Eşleştirme hazır; uygulamak için alttaki Kaydet\'e basın.'})}</p>
      </div>
      <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/30 p-2 text-red-500" title={t('vehicleCheckIn.action.removePendingResolve',{defaultValue:'Eşleştirmeyi geri al'})}><X className="size-4"/></button>
    </div>
    <div className="mt-3 rounded-xl border bg-[var(--wms-app-surface)] p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">{t('vehicleCheckIn.matchedSheet',{defaultValue:'Eşleşen levha'})}</p>
      <strong className="mt-1 block font-mono text-cyan-700 dark:text-cyan-300">{candidate.dCode} · {candidate.supplierSerialNo}</strong>
      <p className="text-sm text-slate-500">{candidate.stockCode} · {candidate.stockName||'-'} · {formatProjectNumber(candidate.expectedQuantity)} {candidate.unitCode}</p>
    </div>
    {pending.files.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{pending.files.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>{}} onPreview={onPreview}/>)}</div>}
  </article>;
}

function UnknownAcceptedPlateCard({
  plate,
  busy,
  isResolving,
  resolveCandidate,
  resolveFiles,
  onStart,
  onCancel,
  onResolveFiles,
  onRemoveResolveFile,
  onConfirm,
  onPreview,
}:{
  plate:AcceptedSteelPlate;
  busy:boolean;
  isResolving:boolean;
  resolveCandidate:SteelVehicleAcceptanceCandidate|null;
  resolveFiles:File[];
  onStart:()=>void;
  onCancel:()=>void;
  onResolveFiles:(files:FileList|null)=>void;
  onRemoveResolveFile:(index:number)=>void;
  onConfirm:()=>void;
  onPreview:OpenImagePreview;
}){
  const {t}=useTranslation('common');
  const canResolve=canEnableUnknownPlateResolve(plate.canResolve,busy);
  return <article className={`rounded-xl border p-4 ${isResolving?'border-amber-500/50 bg-amber-500/15':'border-amber-500/30 bg-amber-500/10'}`}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        {isResolving
          ?<button type="button" onClick={onCancel} className="rounded-xl border border-amber-500/40 bg-[var(--wms-app-surface)] px-4 py-2 text-sm font-bold text-amber-700 dark:text-amber-300">{t('cancel',{defaultValue:'İptal'})}</button>
          :<button type="button" title={plate.canResolve?t('vehicleCheckIn.action.resolveUnknownPlate'):t('vehicleCheckIn.resolveUnavailable')} disabled={!canResolve} onClick={onStart} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{t('vehicleCheckIn.action.resolveUnknownPlate',{defaultValue:'SAC ile eşleştir'})}</button>}
        <div>
          <strong>{t('vehicleCheckIn.unknownSequence',{sequence:plate.sequenceNo,defaultValue:'Sıra {{sequence}}'})}</strong>
          <p className="text-xs text-slate-500">{isResolving?t('vehicleCheckIn.resolveModeHint',{defaultValue:'Seçili bilinmeyen levhayı eşleştirmek için aşağıdan bir SAC satırı seçin.'}):t('vehicleCheckIn.unknownAwaitingMatch',{defaultValue:'SAC eşleştirmesi bekleniyor.'})}</p>
        </div>
      </div>
      {isResolving&&<>
        {resolveCandidate&&<div className="rounded-xl border bg-[var(--wms-app-surface)] p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">{t('vehicleCheckIn.matchedSheet',{defaultValue:'Eşleşen levha'})}</p>
          <strong className="mt-1 block font-mono text-cyan-700 dark:text-cyan-300">{resolveCandidate.dCode} · {resolveCandidate.supplierSerialNo}</strong>
          <p className="text-sm text-slate-500">{resolveCandidate.stockCode} · {resolveCandidate.stockName||'-'} · {formatProjectNumber(resolveCandidate.expectedQuantity)} {resolveCandidate.unitCode}</p>
        </div>}
        <div className="rounded-xl border bg-[var(--wms-app-surface)] p-3">
          <ImageInputActions
            compact
            selectLabel={t('vehicleCheckIn.action.addSheetImage',{defaultValue:'Levha görseli ekle'})}
            captureLabel={t('vehicleCheckIn.action.captureSheetImage',{defaultValue:'Levha fotoğrafı çek'})}
            onFiles={onResolveFiles}
          />
          {resolveFiles.length===0&&<p className="mt-2 text-xs font-semibold text-amber-600">{t('vehicleCheckIn.sheetImageMissing',{defaultValue:'En az bir levha görseli zorunludur.'})}</p>}
          {resolveFiles.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{resolveFiles.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>onRemoveResolveFile(index)} onPreview={onPreview}/>)}</div>}
        </div>
        <button type="button" disabled={busy||!resolveCandidate||resolveFiles.length===0} onClick={onConfirm} className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy?<Loader2 className="size-4 animate-spin"/>:t('vehicleCheckIn.action.confirmResolveUnknownPlate',{defaultValue:'Eşleştirmeyi tamamla'})}
        </button>
      </>}
    </div>
  </article>;
}

function CandidateTable({rows,loading,selected,onToggle,onToggleAll}:{rows:SteelVehicleAcceptanceCandidate[];loading:boolean;selected:Record<number,SelectedPlate>;onToggle:(row:SteelVehicleAcceptanceCandidate)=>void;onToggleAll:(rows:SteelVehicleAcceptanceCandidate[],select:boolean)=>void}){
  const {t}=useTranslation('common');
  const selectAllRef=useRef<HTMLInputElement>(null);
  const visibleSelectedCount=rows.filter(row=>selected[row.id]).length;
  const allVisibleSelected=rows.length>0&&visibleSelectedCount===rows.length;
  const someVisibleSelected=visibleSelectedCount>0&&!allVisibleSelected;
  useEffect(()=>{if(selectAllRef.current)selectAllRef.current.indeterminate=someVisibleSelected},[someVisibleSelected]);
  return <div className="mt-5 overflow-x-auto rounded-xl border">
    <table className="min-w-[1100px] w-full text-left text-sm">
      <thead className="bg-[var(--wms-app-surface)] text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3"><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} disabled={loading||rows.length===0} onChange={event=>onToggleAll(rows,event.target.checked)} className="size-5 accent-cyan-600" aria-label={t('vehicleCheckIn.table.selectAll',{defaultValue:'Tümünü seç'})} title={t('vehicleCheckIn.table.selectAll',{defaultValue:'Tümünü seç'})}/></th><th className="p-3">{t('vehicleCheckIn.table.dCodeExcel',{defaultValue:'DCode / Excel'})}</th><th className="p-3">{t('vehicleCheckIn.table.serial',{defaultValue:'Seri'})}</th><th className="p-3">{t('vehicleCheckIn.table.stock',{defaultValue:'Stok'})}</th><th className="p-3">{t('vehicleCheckIn.table.sizeQuality',{defaultValue:'Ölçü / kalite'})}</th><th className="p-3">{t('vehicleCheckIn.table.quantity',{defaultValue:'Miktar'})}</th><th className="p-3">{t('vehicleCheckIn.table.warehouseRack',{defaultValue:'Depo / kabul rafı'})}</th><th className="p-3">{t('vehicleCheckIn.table.evidence',{defaultValue:'Kanıt'})}</th></tr></thead>
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

function SelectedPlateCard({item,files,missingImages,onChange,onFiles,onRemoveFile,onRemove,onPreview}:{item:SelectedPlate;files:File[];missingImages:boolean;onChange:(changes:Partial<SelectedPlate>)=>void;onFiles:(files:FileList|null)=>void;onRemoveFile:(index:number)=>void;onRemove:()=>void;onPreview:OpenImagePreview}){
  const {t}=useTranslation('common');
  const row=item.row;
  const sheetImageErrorKeys=`${row.dCode}|levhası için en az bir görsel|en fazla 5 görsel|görseli gönderilen sac levhası`;
  return <article className="rounded-2xl border-2 border-cyan-500/45 bg-[var(--wms-app-surface)] p-4 shadow-sm" data-wms-error-line-ref={row.dCode}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><strong className="font-mono text-cyan-600">{row.dCode} · {row.supplierSerialNo}</strong><p className="text-sm text-slate-500">{row.stockCode} · {row.stockName} · {formatProjectNumber(row.expectedQuantity)} {row.unitCode}</p><small className="text-slate-500">{t('vehicleCheckIn.excelImportLabel',{defaultValue:'Excel/aktarım'})}: {row.importReferenceNo}</small></div>
      <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/30 p-2 text-red-500" title={t('vehicleCheckIn.action.removeSelection',{defaultValue:'Seçimden çıkar'})}><X className="size-4"/></button>
    </div>
    <Field label={t('vehicleCheckIn.field.sheetNote',{defaultValue:'Levha kabul notu'})}><input className="input" value={item.note} onChange={event=>onChange({note:event.target.value})} maxLength={1000}/></Field>
    <div className="mt-4 space-y-2" data-wms-error-target="sheetImages" data-wms-error-keys={sheetImageErrorKeys}>
      <strong className="text-sm">{t('vehicleCheckIn.field.sheetImages',{defaultValue:'Levha görselleri *'})}</strong>
      <div className="flex flex-wrap items-center gap-3">
        <ImageInputActions
          compact
          selectLabel={t('vehicleCheckIn.action.addSheetImage',{defaultValue:'Levha görseli ekle'})}
          captureLabel={t('vehicleCheckIn.action.captureSheetImage',{defaultValue:'Levha fotoğrafı çek'})}
          onFiles={onFiles}
        />
        <span className={`text-xs ${missingImages?'font-semibold text-amber-600':'text-slate-500'}`}>{t('vehicleCheckIn.sheetImageInfo',{defaultValue:'Mevcut {{current}} · Yeni {{next}} görsel',current:row.attachmentCount,next:files.length})}</span>
      </div>
      {missingImages&&<p className="text-xs font-semibold text-amber-600">{t('vehicleCheckIn.sheetImageMissing',{defaultValue:'En az bir levha görseli zorunludur.'})}</p>}
    </div>
    {files.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{files.map((file,index)=><PendingImage key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>onRemoveFile(index)} onPreview={onPreview}/>)}</div>}
  </article>;
}

function ImageLightbox({preview,onClose,closeLabel}:{preview:ImagePreview;onClose:()=>void;closeLabel:string}){
  const dialogRef=useRef<HTMLDivElement|null>(null);
  const closeButtonRef=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow='hidden';

    const blockScroll=(event:WheelEvent)=>{event.preventDefault()};
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if(event.key!=='Tab')return;
      const focusable=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )??[]);
      if(focusable.length===0)return;
      event.preventDefault();
      const currentIndex=focusable.indexOf(document.activeElement as HTMLElement);
      focusable[getNextLightboxFocusIndex(currentIndex,focusable.length,event.shiftKey)]?.focus();
    };

    window.addEventListener('wheel',blockScroll,{passive:false,capture:true});
    window.addEventListener('keydown',onKeyDown,true);
    closeButtonRef.current?.focus();

    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('wheel',blockScroll,true);
      window.removeEventListener('keydown',onKeyDown,true);
      opener?.focus();
    };
  },[onClose]);

  if(typeof document==='undefined')return null;

  return createPortal(
    <div
      data-wms-image-lightbox=""
      ref={dialogRef}
      className="pointer-events-auto fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/90 backdrop-blur-sm"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="pointer-events-none relative z-[1] flex h-full w-full items-center justify-center p-4">
        <div className="pointer-events-auto relative flex max-w-[min(96vw,72rem)] flex-col items-center">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute -right-2 -top-2 z-[2] rounded-full bg-black/75 p-2 text-white shadow-lg transition hover:bg-black/90 sm:right-0 sm:top-0 sm:-translate-y-[calc(100%+0.5rem)]"
            aria-label={closeLabel}
          >
            <X className="size-5"/>
          </button>
          <img
            src={preview.url}
            alt={preview.title}
            className="max-h-[82vh] w-auto max-w-[min(96vw,72rem)] rounded-lg object-contain shadow-2xl"
          />
          <p className="mt-3 max-w-[min(96vw,48rem)] truncate rounded-lg bg-black/70 px-4 py-2 text-sm font-semibold text-white">
            {preview.title}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExistingVehicleImage({image,onPreview}:{image:VehicleCheckInImage;onPreview:OpenImagePreview}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void vehicleCheckInApi.download(image.id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>setUrl(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[image.id]);
  return <figure className="overflow-hidden rounded-xl border"><PreviewImageFrame url={url} title={image.fileName} onPreview={onPreview}/><figcaption className="truncate p-2 text-xs font-bold">{image.fileName}</figcaption></figure>;
}

function ExistingSteelAttachmentImage({attachment,onPreview}:{attachment:SteelAttachment;onPreview:OpenImagePreview}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void steelReceiptApi.downloadAttachment(attachment.id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>setUrl(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[attachment.id]);
  return <figure className="overflow-hidden rounded-xl border"><PreviewImageFrame url={url} title={attachment.fileName} onPreview={onPreview}/><figcaption className="truncate p-2 text-xs font-bold">{attachment.fileName}</figcaption></figure>;
}

function PendingImage({file,onRemove,onPreview}:{file:File;onRemove:()=>void;onPreview:OpenImagePreview}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return()=>URL.revokeObjectURL(objectUrl)},[file]);
  return <figure className="overflow-hidden rounded-xl border"><div className="relative h-28 bg-slate-950/5"><PreviewImageFrame url={url||null} title={file.name} onPreview={onPreview} className="h-full"/><button type="button" onClick={onRemove} className="absolute right-1 top-1 z-[1] rounded-full bg-black/70 p-1 text-white"><X className="size-3"/></button></div><figcaption className="truncate p-2 text-xs font-bold">{file.name}</figcaption></figure>;
}

function PreviewImageFrame({url,title,onPreview,className}:{url:string|null;title:string;onPreview:OpenImagePreview;className?:string}){
  if(!url){
    return <div className={`grid h-28 place-items-center bg-slate-950/5 ${className??''}`}><Loader2 className="size-4 animate-spin"/></div>;
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={()=>onPreview(url,title)}
      className={`block h-28 w-full cursor-zoom-in overflow-hidden bg-slate-950/5 transition hover:opacity-90 ${className??''}`}
    >
      <img src={url} alt={title} className="h-full w-full object-cover"/>
    </button>
  );
}

function ImageInputActions({selectLabel,captureLabel,onFiles,compact=false}:{selectLabel:string;captureLabel:string;onFiles:(files:FileList|null)=>void;compact?:boolean}){
  const inputClass='hidden';
  const buttonClass=compact
    ?'inline-flex cursor-pointer items-center rounded-xl border border-dashed border-cyan-500/50 px-4 py-2.5 text-sm font-bold text-cyan-600'
    :'inline-flex cursor-pointer items-center rounded-xl border border-dashed border-cyan-500/50 px-4 py-3 text-sm font-bold text-cyan-500';
  const handleFiles=(input:HTMLInputElement)=>{
    onFiles(input.files);
    input.value='';
  };
  return <div className="flex flex-wrap items-center gap-3">
    <label className={buttonClass}>
      <ImagePlus className="mr-2 size-4" aria-hidden="true"/>
      {selectLabel}
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className={inputClass} onChange={event=>handleFiles(event.currentTarget)}/>
    </label>
    <label className={`${buttonClass} border-solid bg-cyan-500/10`}>
      <Camera className="mr-2 size-4" aria-hidden="true"/>
      {captureLabel}
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className={inputClass} onChange={event=>handleFiles(event.currentTarget)}/>
    </label>
  </div>;
}

function Summary({label,value,emphasized=false}:{label:string;value:string;emphasized?:boolean}){return <div className={`rounded-xl border bg-[var(--wms-app-surface)] p-3 ${emphasized?'border-2 border-cyan-500/45':''}`}><small className="block text-slate-500">{label}</small><strong className="text-lg">{value}</strong></div>}
function Panel({title,icon,children,errorTarget,errorKeys,emphasized=false}:{title:string;icon:ReactNode;children:ReactNode;errorTarget?:string;errorKeys?:string;emphasized?:boolean}){return <section className={`rounded-2xl border bg-[var(--wms-app-panel)] p-5 ${emphasized?'border-2 border-cyan-500/45 shadow-sm':''}`} data-wms-error-target={errorTarget} data-wms-error-keys={errorKeys}><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-600">{icon}{title}</h2>{children}</section>}
function Field({label,children,errorTarget,errorKeys}:{label:string;children:ReactNode;errorTarget?:string;errorKeys?:string}){return <label className="space-y-1.5 text-sm" data-wms-error-target={errorTarget} data-wms-error-keys={errorKeys}><span className="font-bold">{label}</span>{children}</label>}
