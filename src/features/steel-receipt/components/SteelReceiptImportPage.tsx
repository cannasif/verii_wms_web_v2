import {useEffect,useState,type ChangeEvent} from 'react';
import type {WorkSheet} from 'xlsx';
import {Download,Loader2,Upload} from 'lucide-react';
import {toast} from 'sonner';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {AppDropdown} from '@/components/shared/AppDropdown';
import {AppDateInput} from '@/components/shared/AppInput';
import {useAuthStore} from '@/stores/auth-store';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import {vehicleCheckInApi} from '@/features/vehicle-check-in/api/vehicle-check-in.api';
import {localizeEnumValue} from '@/lib/enum-localization';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelImportLine,SteelImportPreview,SteelImportRequest} from '../types/steel-receipt.types';
import {SteelProcessHeader} from './SteelProcessHeader';
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
    return {'Sipariş No':'SIP-001','Sipariş Kalem No':String(index+1),'Stok Kodu':`01/${stock}`,'Yapılandırma Kodu':'','Seri No (Levha No)':`LVH-${n}`,'Seri-2 (Poz No)':`POZ-${n}`,'Miktar(Kg)':'1.234,50','Birim':'KG','Kombine Size':'1200x2400x8','Material Quality':'S235','Heat Number':`HEAT-${n}`,'Certificate Number':`CERT-${n}`};
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'SAC Mal Kabul');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Kural','Açıklama'],['Seri','Her levha için tedarikçi seri zorunludur.'],['Miktar','1.234,50 ve 1234.50 biçimleri desteklenir.'],['Stok','Stok kodu ERP mirror kaydıyla eşleşmelidir.']]),'Kılavuz');
  XLSX.writeFile(wb,'SAC_Mal_Kabul_Sablonu.xlsx');
};
export function SteelReceiptImportPage(){
  const branch=useAuthStore(s=>s.branch?.code??'0');const [vehicle,setVehicle]=useState<string|null>(null);const [customer,setCustomer]=useState<string|null>(null);const [warehouse,setWarehouse]=useState<string|null>(null);
  const [location,setLocation]=useState<string|null>(null);const [series,setSeries]=useState<Array<{id:number;code:string;name:string;previewDocumentNumber:string;isDefault:boolean}>>([]);
  const [seriesId,setSeriesId]=useState<string|null>(null);const [reference,setReference]=useState('');const [exportRef,setExportRef]=useState('');
  const [waybill,setWaybill]=useState('');const [waybillDate,setWaybillDate]=useState(new Date().toLocaleDateString('en-CA'));const [plannedArrival,setPlannedArrival]=useState('');
  const [fileName,setFileName]=useState('');const [lines,setLines]=useState<SteelImportLine[]>([]);
  const [preview,setPreview]=useState<SteelImportPreview|null>(null);const [busy,setBusy]=useState(false);const warehouseId=Number(split(warehouse)[0]||0);
  useEffect(()=>{setLocation(null);setSeries([]);setSeriesId(null);if(!warehouseId)return;void goodsReceiptV2Api.series(warehouseId).then(x=>{setSeries(x);setSeriesId(String((x.find(y=>y.isDefault)??x[0])?.id??''))})},[warehouseId]);
  const onFile=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setFileName(file.name);setPreview(null);
    const XLSX=await import('xlsx');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const offset=headerRow(ws,XLSX);const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:'',range:offset});
    const mapped=rows.map((r,i)=>({rowNumber:i+offset+2,netsisOrderNo:find(r,['NetsisOrderNo','Sipariş No','SiparisNo']),netsisOrderLineNo:find(r,['NetsisOrderLineNo','Sipariş Kalem No','SiparisKalemNo']),
      stockCode:find(r,['StockCode','Stok Kodu','StokKodu']),yapCode:find(r,['ConfigurationCode','Yapılandırma Kodu','YapCode','Yap Kodu','YapKodu'])||undefined,supplierSerialNo:find(r,['SerialNo','Seri No','Seri No (Levha No)']),
      secondarySerialNo:find(r,['SerialNo2','Seri-2','Seri-2 (Poz No)'])||undefined,expectedQuantity:number(find(r,['ExpectedQuantity','Miktar','Miktar(Kg)','Miktar Kg'])),unitCode:find(r,['Unit','Birim'])||'KG',
      combinedSize:find(r,['CombinedSize','Kombine Size','Ölçü','Olcu'])||undefined,materialGrade:find(r,['MaterialQuality','Material Quality','Malzeme Kalitesi'])||undefined,
      heatNumber:find(r,['HeatNumber','Heat Number','Döküm No','DokumNo'])||undefined,certificateNumber:find(r,['CertificateNumber','Certificate Number','Sertifika No'])||undefined}));
    setLines(mapped);if(!reference)setReference(file.name.replace(/\.[^.]+$/,''));toast.success(`${mapped.length} satır okundu.`)};
  const request=():SteelImportRequest=>({branchCode:branch,importReferenceNo:reference.trim(),sourceFileName:fileName,exportReferenceNo:exportRef.trim()||undefined,
    vehicleCheckInId:vehicle?Number(vehicle):undefined,
    supplierId:Number(split(customer)[0]),targetWarehouseId:warehouseId,receivingLocationId:Number(location),documentSeriesId:Number(seriesId),
    waybillNo:waybill.trim()||undefined,waybillDate:waybillDate||undefined,plannedArrivalAtUtc:plannedArrival?new Date(plannedArrival).toISOString():undefined,lines});
  const run=async(commit=false)=>{if(!customer||!warehouseId||!location||!seriesId||!reference.trim()||!lines.length){toast.error('Tedarikçi, depo, kabul rafı, belge serisi, referans ve Excel zorunludur.');return}
    setBusy(true);try{if(commit){await steelReceiptApi.commit(request());toast.success('SAC beklenti planı kaydedildi.');setLines([]);setPreview(null);setFileName('')}
      else{setPreview(await steelReceiptApi.preview(request()));toast.success('Önizleme hazır.')}}catch(e){toast.error(e instanceof Error?e.message:'İşlem başarısız.')}finally{setBusy(false)}};
  return <section className="space-y-5"><SteelProcessHeader currentStep="plan" title="Beklenen Levha Aktarımı" description="Excel’i önce önizleyin; hatasız satırlar DCode korunarak idempotent biçimde kaydedilir." notice="Araç giriş kaydı zorunlu değildir; saha kabulü kapıdan başladıysa planı araç kaydıyla eşleştirmek uçtan uca izlenebilirlik sağlar."/>
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Araç Giriş Kaydı"><PagedAppDropdown queryKey={['steel-vehicle-check-ins',branch]} searchFields={['plateNo','driverFirstName','driverLastName']} fetchPage={r=>vehicleCheckInApi.paged({pageNumber:r.pageNumber,pageSize:r.pageSize,search:r.search??null,searchFields:r.searchFields,sortBy:'checkedInAtUtc',sortDirection:'desc',filterLogic:'and',filters:[{column:'branchCode',operator:'equals',value:branch}]})} toOption={x=>({value:String(x.id),label:`${x.plateNo} · ${x.driverFirstName??''} ${x.driverLastName??''}`.trim(),description:`${x.businessDate} · ${localizeEnumValue(x.status)}`})} value={vehicle} onValueChange={setVehicle} searchable placeholder="Kapı girişindeki aracı seçin (opsiyonel)"/></Field>
      <Field label="Tedarikçi"><PagedAppDropdown queryKey={['steel-customers',branch]} fetchPage={r=>goodsReceiptV2Api.customers(r,branch)} toOption={x=>({value:`${x.id}|${x.customerCode}`,label:`${x.customerCode} · ${x.customerName}`})} value={customer} onValueChange={setCustomer} searchable minSearchLength={2}/></Field>
      <Field label="Hedef Depo"><PagedAppDropdown queryKey={['steel-warehouses',branch]} fetchPage={r=>goodsReceiptV2Api.warehouses(r,branch)} toOption={x=>({value:`${x.id}|${x.warehouseCode}`,label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouse} onValueChange={setWarehouse} searchable/></Field>
      <Field label="Kabul / Staging Rafı"><PagedAppDropdown queryKey={['steel-locations',warehouseId]} fetchPage={r=>goodsReceiptV2Api.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} enabled={warehouseId>0} dependencies={[warehouseId]} value={location} onValueChange={setLocation} searchable/></Field>
      <Field label="Belge Serisi"><AppDropdown value={seriesId} onValueChange={setSeriesId} options={series.map(x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.previewDocumentNumber}))}/></Field>
      <Field label="Aktarım Referansı"><input className="input" value={reference} onChange={e=>setReference(e.target.value)} maxLength={100}/></Field>
      <Field label="İhracat Referansı"><input className="input" value={exportRef} onChange={e=>setExportRef(e.target.value)} maxLength={100}/></Field>
      <Field label="İrsaliye No"><input className="input" value={waybill} onChange={e=>setWaybill(e.target.value)} maxLength={50}/></Field>
      <Field label="İrsaliye Tarihi"><input className="input" type="date" value={waybillDate} onChange={e=>{setWaybillDate(e.target.value);setPreview(null)}}/></Field>
      <Field label="Planlanan Varış"><AppDateInput type="datetime-local" value={plannedArrival} onChange={e=>{setPlannedArrival(e.target.value);setPreview(null)}}/></Field>
      <Field label="Excel Dosyası"><label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/50 bg-cyan-500/5 text-sm font-bold text-cyan-500"><Upload className="size-4"/>{fileName||'Dosya seç'}<input type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>void onFile(e)}/></label></Field>
    </div><div className="mt-5 flex flex-wrap justify-between gap-3"><button onClick={downloadTemplate} className="rounded-xl border px-5 py-2.5 font-bold"><Download className="mr-2 inline size-4"/>Örnek Şablon</button><div className="flex gap-3"><button onClick={()=>void run(false)} disabled={busy} className="rounded-xl border px-5 py-2.5 font-bold">{busy?<Loader2 className="size-4 animate-spin"/>:'Önizle'}</button><button onClick={()=>void run(true)} disabled={busy||!preview||preview.errorRows>0} className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white disabled:opacity-40">Aktarımı Kaydet</button></div></div></div>
    {preview&&<div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><div className="mb-4 flex flex-wrap gap-2">{[['Toplam',preview.totalRows],['Yeni',preview.newRows],['Mevcut',preview.existingRows],['Hatalı',preview.errorRows]].map(([k,v])=><span key={String(k)} className="rounded-full border px-3 py-1 text-xs font-bold">{k}: {v}</span>)}</div><div className="max-h-[28rem] overflow-auto rounded-xl border"><table className="w-full min-w-[800px] text-sm"><thead><tr><th>Satır</th><th>Stok</th><th>Seri</th><th>İşlem</th><th>DCode</th><th>Hatalar</th></tr></thead><tbody>{preview.lines.map(r=><tr key={r.rowNumber} className="border-t"><td>{r.rowNumber}</td><td>{r.stockCode||'-'}</td><td>{r.supplierSerialNo}</td><td>{r.action}</td><td>{r.existingDCode||'-'}</td><td className="text-red-500">{r.errors.join(', ')||'-'}</td></tr>)}</tbody></table></div></div>}</section>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
