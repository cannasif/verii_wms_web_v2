import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, PackageCheck, ScanLine, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import type { LocationOption, WarehouseOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { useUIStore } from '@/stores/ui-store';
import { kkdApi, type KkdDistributionCreateResult, type KkdOpenOrderLine } from './kkd-api';

const field = 'min-h-11 rounded-xl border border-[var(--wms-app-border)] bg-transparent px-3 text-sm outline-none focus:border-cyan-500';
const panel = 'rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm';
const today = () => new Date().toLocaleDateString('en-CA');
const lineKey = (line: KkdOpenOrderLine) => `${line.orderNumber}|${line.orderLineId}`;
type LineEdit = { selected:boolean; quantity:number; sourceLocationId?:number; sourceLocationValue?:string|null; lotNo:string; serials:string };

export function KkdDistributionCreatePage() {
  const setPageTitle = useUIStore((x) => x.setPageTitle);
  useEffect(() => { setPageTitle('Yeni KKD Dağıtımı'); return () => setPageTitle(null); }, [setPageTitle]);
  const employees = useQuery({ queryKey:['kkd','employees'], queryFn:kkdApi.employees });
  const series = useQuery({ queryKey:['kkd','distribution-series'], queryFn:kkdApi.distributionSeries });
  const [employeeId,setEmployeeId]=useState('');
  const [employeeQr,setEmployeeQr]=useState('');
  const employeeNumber=Number(employeeId||0);
  const context=useQuery({queryKey:['kkd','distribution-context',employeeNumber],queryFn:()=>kkdApi.distributionContext(employeeNumber),enabled:employeeNumber>0});
  const [orders,setOrders]=useState<string[]>([]);
  const sortedOrders=useMemo(()=>[...orders].sort(),[orders]);
  const orderLines=useQuery({queryKey:['kkd','distribution-lines',employeeNumber,sortedOrders.join('|')],queryFn:()=>kkdApi.distributionOrderLines(employeeNumber,sortedOrders),enabled:employeeNumber>0&&sortedOrders.length>0});
  const [warehouseValue,setWarehouseValue]=useState<string|null>(null);
  const warehouseId=Number(warehouseValue?.split('|')[0]||0);
  const [seriesId,setSeriesId]=useState('');
  const [documentDate,setDocumentDate]=useState(today());
  const [description,setDescription]=useState('');
  const [edits,setEdits]=useState<Record<string,LineEdit>>({});
  const [result,setResult]=useState<KkdDistributionCreateResult>();
  const resolveEmployee=useMutation({
    mutationFn:()=>kkdApi.resolveEmployeeQr(employeeQr.trim()),
    onSuccess:(employee)=>{setEmployeeId(String(employee.id));toast.success(`${employee.employeeCode} · ${employee.fullName} seçildi.`);},
    onError:(error)=>toast.error(error instanceof Error?error.message:'Personel QR kodu çözümlenemedi.'),
  });

  useEffect(()=>{ setOrders([]); setEdits({}); setWarehouseValue(null); setResult(undefined); },[employeeId]);
  useEffect(()=>{ const preferred=series.data?.find(x=>x.isDefault)??series.data?.[0]; if(preferred&&!seriesId)setSeriesId(String(preferred.id)); },[series.data,seriesId]);
  const patch=(line:KkdOpenOrderLine,value:Partial<LineEdit>)=>setEdits(current=>{
    const key=lineKey(line);
    const existing=current[key]??{selected:false,quantity:Math.min(1,line.remainingQuantity),lotNo:'',serials:''};
    return {...current,[key]:{...existing,...value}};
  });
  const selected=(orderLines.data??[]).filter(x=>edits[lineKey(x)]?.selected);

  const create=useMutation({
    mutationFn:async()=>{
      if(!employeeNumber||!warehouseId||!seriesId||selected.length===0)throw new Error('Personel, kaynak depo, belge serisi ve en az bir sipariş kalemi zorunludur.');
      const lines=selected.map(line=>{
        const edit=edits[lineKey(line)];
        if(!line.isMapped||!line.stockId)throw new Error(line.mappingMessage||`${line.stockCode} WMS stoğuyla eşleşmiyor.`);
        if(!edit.sourceLocationId)throw new Error(`${line.stockCode} için kaynak raf seçilmelidir.`);
        if(edit.quantity<=0||edit.quantity>line.remainingQuantity)throw new Error(`${line.stockCode} miktarı 0 ile ${line.remainingQuantity} arasında olmalıdır.`);
        const serials=edit.serials.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
        const trackings=serials.length
          ? serials.map(serialNo=>({quantity:1,lotNo:edit.lotNo.trim()||null,serialNo,handlingUnitNo:null,manufacturingDate:null,expirationDate:null,sourceLocationId:edit.sourceLocationId!}))
          : edit.lotNo.trim() ? [{quantity:edit.quantity,lotNo:edit.lotNo.trim(),serialNo:null,handlingUnitNo:null,manufacturingDate:null,expirationDate:null,sourceLocationId:edit.sourceLocationId}] : null;
        if(serials.length&&serials.length!==edit.quantity)throw new Error(`${line.stockCode} için seri sayısı teslim miktarıyla aynı olmalıdır.`);
        return {stockId:line.stockId,yapCodeId:null,quantity:edit.quantity,unitCode:line.unitCode||null,sourceLocationId:edit.sourceLocationId,orderNumber:line.orderNumber,orderLineId:line.orderLineId,requireHandlingUnit:false,description:null,trackings};
      });
      return kkdApi.createDistribution({idempotencyKey:crypto.randomUUID(),employeeId:employeeNumber,warehouseId,documentSeriesId:Number(seriesId),documentDate,stagingLocationId:null,loadingLocationId:null,description:description.trim()||null,lines});
    },
    onSuccess:(value)=>{setResult(value);toast.success(`${value.documentNo} oluşturuldu; ambar çıkış operasyonuna hazır.`);},
    onError:(error)=>toast.error(error instanceof Error?error.message:'KKD dağıtımı oluşturulamadı.'),
  });

  return <section className="mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-6">
    <header><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-500">KKD / Dağıtım</p><h1 className="mt-2 text-3xl font-black">Yeni KKD Dağıtımı</h1><p className="mt-1 text-sm text-slate-500">Personelin açık Netsis siparişinden hakkını ayırın; fiziksel çıkış tamamlandığında hak tüketimi ve ERP ambar çıkışı otomatik sonuçlansın.</p></header>
    {result&&<div className={`${panel} border-l-4 border-l-emerald-500`}><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-500"/><div><h2 className="font-black">{result.documentNo} hazır</h2><p className="text-sm text-slate-500">{result.totalQuantity} toplam · {result.entitledQuantity} hak · {result.excessQuantity} sipariş fazlası</p></div></div><Link className="mt-4 inline-block font-bold text-cyan-500" to={`/warehouse/warehouse-outbounds/${result.warehouseOutboundId}/operations`}>Ambar çıkış operasyonunu aç →</Link></div>}
    <div className={`${panel} grid gap-4 lg:grid-cols-2`}>
      <form className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();if(employeeQr.trim())resolveEmployee.mutate();}}><label className="grid min-w-0 flex-1 gap-1 text-xs font-bold uppercase">Personel QR kodu<input autoFocus className={field} value={employeeQr} onChange={event=>setEmployeeQr(event.target.value)} placeholder="Kartı okutun veya QR kodunu yazın"/></label><button disabled={!employeeQr.trim()||resolveEmployee.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500 px-4 font-black text-cyan-500 disabled:opacity-50"><ScanLine className="size-4"/>Çözümle</button></form>
      <label className="grid gap-1 text-xs font-bold uppercase">Personel<select className={field} value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Personel seçin</option>{employees.data?.map(x=><option key={x.id} value={x.id}>{x.employeeCode} · {x.fullName}</option>)}</select></label>
      {context.data&&<div className="rounded-xl border border-[var(--wms-app-border)] p-3 lg:col-span-2"><p className="text-xs uppercase text-slate-500">Bağlı Netsis carisi / şube</p><p className="font-black">{context.data.customerCode} · {context.data.customerName}</p><p className="text-xs text-slate-500">Şube {context.data.branchCode}</p></div>}
    </div>
    {context.data&&<div className="rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4 text-sm"><strong className="block text-cyan-600 dark:text-cyan-300">Etkin KKD süreç politikası</strong><span>{context.data.policy.requireOpenOrder?'Açık Netsis siparişi zorunlu.':'Siparişsiz dağıtıma izin veriliyor.'} {context.data.policy.allowMultipleOrdersPerDistribution?'Birden fazla sipariş seçilebilir.':'Dağıtım tek siparişle sınırlandırılmıştır.'} {context.data.policy.allowOpenOrderExcess?'Açık sipariş bakiyesi içinde hak üstü teslim yapılabilir.':'Teslim, hesaplanan KKD hakkını aşamaz.'}</span></div>}
    {context.data&&<div className={panel}><h2 className="font-black">Açık Netsis siparişleri</h2><p className="mb-3 text-sm text-slate-500">Her teslim satırı gerçek sipariş satırına bağlı kalır.</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{context.data.orders.map(order=><label key={order.orderNumber} className="flex items-center gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"><input type="checkbox" checked={orders.includes(order.orderNumber)} onChange={e=>setOrders(current=>e.target.checked?(context.data.policy.allowMultipleOrdersPerDistribution?[...new Set([...current,order.orderNumber])]:[order.orderNumber]):current.filter(x=>x!==order.orderNumber))}/><span><strong>{order.orderNumber}</strong><small className="block text-slate-500">{order.projectCode||'Projesiz'} · Açık {order.remainingQuantity}</small></span></label>)}</div>{context.data.orders.length===0&&<p className="text-sm text-amber-500">{context.data.policy.requireOpenOrder?'Bu personele bağlı cari için açık Netsis siparişi bulunmadığından dağıtım başlatılamaz.':'Bu personele bağlı cari için açık Netsis siparişi bulunamadı.'}</p>}</div>}
    {orderLines.data&&<div className={`${panel} overflow-auto`}><h2 className="mb-3 font-black">Sipariş kalemleri</h2><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Seç','Sipariş / sıra','Stok','Proje','Açık miktar','Eşleme'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{orderLines.data.map(line=><tr key={lineKey(line)} className="border-b border-[var(--wms-app-border)]"><td className="p-3"><input type="checkbox" disabled={!line.isMapped} checked={edits[lineKey(line)]?.selected||false} onChange={e=>patch(line,{selected:e.target.checked})}/></td><td className="p-3 font-bold">{line.orderNumber} / {line.orderLineSequence}</td><td className="p-3">{line.stockCode}<small className="block text-slate-500">{line.stockName}</small></td><td className="p-3">{line.projectCode||'-'}</td><td className="p-3">{line.remainingQuantity} {line.unitCode}</td><td className="p-3">{line.isMapped?<span className="text-emerald-500">WMS ile eşleşti</span>:<span className="inline-flex items-start gap-2 text-rose-500"><ShieldAlert className="mt-0.5 size-4 shrink-0"/>{line.mappingMessage}</span>}</td></tr>)}</tbody></table></div>}
    {selected.length>0&&<div className={panel}><h2 className="font-black">Teslim ve stok çıkış ayrıntıları</h2><div className="mt-4 grid gap-3 lg:grid-cols-3"><PagedAppDropdown<WarehouseOption> queryKey={['kkd-warehouses',context.data?.branchCode]} fetchPage={r=>warehouseOutboundApi.warehouses(r,context.data?.branchCode||'0')} toOption={x=>({value:`${x.id}|${x.warehouseCode}`,label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouseValue} onValueChange={value=>{setWarehouseValue(value);setEdits(current=>Object.fromEntries(Object.entries(current).map(([key,item])=>[key,{...item,sourceLocationId:undefined,sourceLocationValue:null}])));}} placeholder="Kaynak depo seçin" searchable/><label className="grid gap-1 text-xs font-bold uppercase">Ambar çıkış belge serisi<select className={field} value={seriesId} onChange={e=>setSeriesId(e.target.value)}><option value="">Seri seçin</option>{series.data?.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name} {x.isDefault?'(Varsayılan)':''}</option>)}</select></label><label className="grid gap-1 text-xs font-bold uppercase">Belge tarihi<input className={field} type="date" value={documentDate} onChange={e=>setDocumentDate(e.target.value)}/></label></div>
      <div className="mt-5 space-y-3">{selected.map(line=>{const edit=edits[lineKey(line)];return <article key={lineKey(line)} className="rounded-xl border border-[var(--wms-app-border)] p-4"><div className="mb-3"><strong>{line.stockCode} · {line.stockName}</strong><p className="text-xs text-slate-500">{line.orderNumber} / sıra {line.orderLineSequence} · en fazla {line.remainingQuantity}</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-xs font-bold uppercase">Miktar<input className={field} type="number" min="0.000001" max={line.remainingQuantity} step="any" value={edit.quantity} onChange={e=>patch(line,{quantity:Number(e.target.value)})}/></label><PagedAppDropdown<LocationOption> queryKey={['kkd-location',warehouseId,lineKey(line)]} fetchPage={r=>warehouseOutboundApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} enabled={warehouseId>0} dependencies={[warehouseId]} value={edit.sourceLocationValue} onValueChange={value=>patch(line,{sourceLocationValue:value,sourceLocationId:Number(value)})} placeholder="Kaynak raf seçin" searchable/><label className="grid gap-1 text-xs font-bold uppercase">Lot (varsa)<input className={field} value={edit.lotNo} onChange={e=>patch(line,{lotNo:e.target.value})}/></label><label className="grid gap-1 text-xs font-bold uppercase">Seriler (satır/virgül ile)<textarea className={`${field} min-h-20 py-2`} value={edit.serials} onChange={e=>patch(line,{serials:e.target.value})}/></label></div></article>})}</div>
      <label className="mt-4 grid gap-1 text-xs font-bold uppercase">Açıklama<textarea className={`${field} min-h-24 py-2`} value={description} onChange={e=>setDescription(e.target.value)}/></label><button disabled={create.isPending} onClick={()=>create.mutate()} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-500 px-5 font-black text-slate-950 disabled:opacity-50"><PackageCheck className="size-5"/>{create.isPending?'Hazırlanıyor…':'Dağıtımı ve ambar çıkışını hazırla'}</button>
    </div>}
  </section>;
}
