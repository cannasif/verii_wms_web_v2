import {useEffect,useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowRight,Boxes,ChevronLeft,ChevronRight,Layers3,Search,UserRoundCog,X} from 'lucide-react';
import {toast} from 'sonner';
import {AppDropdown} from '@/components/shared/AppDropdown';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type {ActiveUserOption} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelLineRow} from '../types/steel-receipt.types';
import {SteelProcessHeader} from './SteelProcessHeader';

const pageSize=20;
const request=(page:number,search:string)=>({pageNumber:page,pageSize,search:search||null,filterLogic:'and' as const,filters:[],sortBy:'id',sortDirection:'desc' as const});
const userLabel=(user:ActiveUserOption):string=>`${user.firstName} ${user.lastName}`.trim()||user.username;
const userOption=(user:ActiveUserOption)=>({value:encodeURIComponent(JSON.stringify(user)),label:userLabel(user),description:`${user.username} · ${user.email}`});
const decodeUser=(value:string):ActiveUserOption=>JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

export function SteelReceiptOperationsPage({initialTab='receipt'}:{initialTab?:'receipt'|'placement'}){
  const [tab,setTab]=useState<'receipt'|'placement'>(initialTab);
  useEffect(()=>setTab(initialTab),[initialTab]);
  return <div className="space-y-5">
    <SteelProcessHeader currentStep={tab} title={tab==='receipt'?'SAC Mal Kabul Emri':'SAC Raf Yerleştirme'} description={tab==='receipt'?'Kontrolden geçen levhaları ortak mal kabul emrine dönüştürün ve operasyon kullanıcılarına atayın.':'Fiziksel kabulü tamamlanan levhaları raf doluluğunu görerek stok hareketiyle nihai konuma yerleştirin.'}/>
    <nav className="inline-flex rounded-xl border p-1"><Tab active={tab==='receipt'} onClick={()=>setTab('receipt')} icon={<Boxes className="size-4"/>}>Mal Kabul Emri</Tab><Tab active={tab==='placement'} onClick={()=>setTab('placement')} icon={<Layers3 className="size-4"/>}>Raf Yerleştirme</Tab></nav>
    {tab==='receipt'?<ReceiptPanel/>:<PlacementPanel/>}
  </div>;
}

function ReceiptPanel(){
  const cache=useQueryClient();const [page,setPage]=useState(1);const [input,setInput]=useState('');const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<Record<number,SteelLineRow>>({});const [note,setNote]=useState('');const [priority,setPriority]=useState('3');const [assignees,setAssignees]=useState<ActiveUserOption[]>([]);const [assignAll,setAssignAll]=useState(false);const [busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['steel-receipt-candidates',page,search],queryFn:()=>steelReceiptApi.receiptCandidatesPaged(request(page,search))});
  const rows=query.data?.items??[];const selectedRows=Object.values(selected);const selectedPlan=selectedRows[0]?.planId;
  const total=selectedRows.reduce((sum,row)=>sum+row.approvedQuantity,0);
  const toggle=(row:SteelLineRow)=>setSelected(current=>{
    if(current[row.id]){const next={...current};delete next[row.id];return next}
    if(Object.keys(current).length&&selectedPlan!==row.planId){toast.error('Tek mal kabul emrinde yalnızca aynı SAC planının levhaları seçilebilir.');return current}
    return {...current,[row.id]:row};
  });
  const convert=async()=>{
    if(!selectedRows.length||!selectedPlan)return;
    if(!assignAll&&!assignees.length){toast.error('Mal kabul emri için kullanıcı seçin veya tüm aktif kullanıcılara atayın.');return}
    setBusy(true);
    try{
      const result=await steelReceiptApi.convert(selectedPlan,selectedRows.map(x=>x.id),{description:note,priority:Number(priority),assignedUserIds:assignees.map(x=>x.id),assignToAllActiveUsers:assignAll});
      toast.success(`${result.documentNo} · ${result.convertedLineCount} levha mal kabul emrine aktarıldı.`);
      setSelected({});setNote('');setAssignees([]);setAssignAll(false);
      await cache.invalidateQueries({queryKey:['steel-receipt-candidates']})
    }catch(e){toast.error(e instanceof Error?e.message:'Mal kabul emri oluşturulamadı.')}finally{setBusy(false)}
  };
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.7fr)]">
    <section className="overflow-hidden rounded-2xl border bg-[var(--wms-app-surface)]"><SectionHead title="Onaylı Levha Adayları" text="Kalite kararı tamamlanmış, henüz ortak mal kabule aktarılmamış levhalar."/>
      <SearchBar value={input} setValue={setInput} run={()=>{setSearch(input.trim());setPage(1)}}/>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-y text-left text-xs uppercase text-slate-500"><th className="p-3">Seç</th><th>DCode / Seri</th><th>Stok</th><th>Plan</th><th>Kalite</th><th className="text-right">Onaylı Miktar</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b last:border-0"><td className="p-3"><input type="checkbox" checked={!!selected[row.id]} onChange={()=>toggle(row)} className="size-4 accent-cyan-500"/></td><td><strong className="font-mono text-cyan-500">{row.dCode}</strong><small className="block">{row.supplierSerialNo}</small></td><td><strong>{row.stockCode}</strong><small className="block text-slate-500">{row.stockName}</small></td><td>{row.importReferenceNo}<small className="block">{row.netsisOrderNo||'Siparişsiz'}</small></td><td>{row.inspectionStatus}</td><td className="text-right font-bold">{formatProjectNumber(row.approvedQuantity)} {row.unitCode}</td></tr>)}</tbody></table></div>
      {!query.isLoading&&!rows.length&&<Empty text="Aktarıma hazır SAC levhası bulunmuyor."/>}<Pager page={page} totalPages={query.data?.totalPages??1} setPage={setPage}/>
    </section>
    <aside className="h-fit space-y-4 rounded-2xl border bg-[var(--wms-app-surface)] p-5"><SectionHead title="Emir Özeti" text="Seçim aynı SAC planı içerisinde toplu oluşturulur."/>
      <Metric label="Seçilen levha" value={String(selectedRows.length)}/><Metric label="Toplam onaylı miktar" value={formatProjectNumber(total)}/><Metric label="SAC planı" value={selectedRows[0]?.importReferenceNo||'-'}/>
      <Field label="Öncelik"><AppDropdown value={priority} onValueChange={setPriority} options={[{value:'1',label:'Düşük'},{value:'3',label:'Normal'},{value:'5',label:'Yüksek'},{value:'9',label:'Acil'}]}/></Field>
      <section className="rounded-xl border p-3">
        <div className="mb-3 flex items-start gap-2"><UserRoundCog className="mt-0.5 size-5 text-cyan-500"/><div><strong className="text-sm">Emir sorumluları <span className="text-red-500">*</span></strong><p className="text-xs text-slate-500">Emir, seçilen kullanıcıların “Bana Atanan Emirler” kuyruğuna düşer.</p></div></div>
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><input type="checkbox" checked={assignAll} onChange={e=>setAssignAll(e.target.checked)} className="mt-1 size-4 accent-cyan-500"/><span><strong className="block text-sm">Tüm aktif WMS kullanıcılarına otomatik ata</strong><small className="text-slate-500">SAC saha operasyonunda vardiya kullanıcısı önceden bilinmiyorsa emir herkesin “Bana Atanan Emirler” kuyruğunda görünür.</small></span></label>
        {!assignAll&&<PagedAppDropdown queryKey={['steel-receipt-active-users']} fetchPage={goodsReceiptV2Api.activeUsersPaged} toOption={user=>({...userOption(user),disabled:assignees.some(selectedUser=>selectedUser.id===user.id)})} value={null} onValueChange={value=>{const user=decodeUser(value);setAssignees(current=>current.some(x=>x.id===user.id)?current:[...current,user])}} placeholder="Operasyon kullanıcısı ekle" searchable minSearchLength={2}/>}
        <div className="mt-3 flex flex-wrap gap-2">{!assignAll&&assignees.map(user=><span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs"><span><strong>{userLabel(user)}</strong><small className="ml-1 text-slate-500">({user.username})</small></span><button type="button" onClick={()=>setAssignees(current=>current.filter(x=>x.id!==user.id))} className="rounded-full p-0.5 text-slate-500 hover:bg-red-500/15 hover:text-red-500" aria-label={`${userLabel(user)} atamasını kaldır`}><X className="size-3.5"/></button></span>)}{assignAll?<span className="text-xs font-bold text-cyan-500">Tüm aktif kullanıcılar atanacak.</span>:!assignees.length&&<span className="text-xs text-amber-500">Henüz kullanıcı atanmadı.</span>}</div>
      </section>
      <Field label="Emir notu"><textarea className="input min-h-24" value={note} onChange={e=>setNote(e.target.value)} placeholder="Operasyon ekibine açıklama..."/></Field>
      <button disabled={busy||!selectedRows.length||(!assignAll&&!assignees.length)} onClick={()=>void convert()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><ArrowRight className="mr-2 inline size-4"/>Mal Kabul Emri Oluştur</button>
    </aside>
  </div>;
}

function PlacementPanel(){
  const cache=useQueryClient();const [page,setPage]=useState(1);const [input,setInput]=useState('');const [search,setSearch]=useState('');const [selected,setSelected]=useState<SteelLineRow|null>(null);
  const [location,setLocation]=useState<string|null>(null);const [type,setType]=useState<'SideBySide'|'Stacked'>('SideBySide');const [rowNo,setRowNo]=useState('1');const [position,setPosition]=useState('1');const [stack,setStack]=useState('');const [busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['steel-placement-candidates',page,search],queryFn:()=>steelReceiptApi.placementCandidatesPaged(request(page,search))});
  const occupancy=useQuery({queryKey:['steel-occupancy',location],queryFn:()=>steelReceiptApi.occupancy(Number(location)),enabled:!!location});
  const suggestions=useMemo(()=>{const items=occupancy.data??[];const maxPosition=Math.max(0,...items.map(x=>x.positionNo));const same=items.filter(x=>x.rowNo===Number(rowNo)&&x.positionNo===Number(position));return{nextPosition:maxPosition+1,nextStack:Math.max(0,...same.map(x=>x.stackOrderNo??0))+1}},[occupancy.data,rowNo,position]);
  const choose=(row:SteelLineRow)=>{setSelected(row);setLocation(null);setRowNo('1');setPosition('1');setStack('')};
  const place=async()=>{if(!selected||!location){toast.error('Levha ve hedef raf seçilmelidir.');return}setBusy(true);try{await steelReceiptApi.place(selected.id,{locationId:Number(location),placementType:type,rowNo:Number(rowNo),positionNo:Number(position),stackOrderNo:type==='Stacked'?Number(stack):undefined,rowVersion:selected.rowVersion});toast.success(`${selected.dCode} nihai rafa yerleştirildi.`);setSelected(null);setLocation(null);await cache.invalidateQueries({queryKey:['steel-placement-candidates']});await cache.invalidateQueries({queryKey:['steel-occupancy']})}catch(e){toast.error(e instanceof Error?e.message:'Yerleştirme tamamlanamadı.')}finally{setBusy(false)}};
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-2xl border bg-[var(--wms-app-surface)]"><SectionHead title="Yerleştirme Bekleyen Levhalar" text="Fiziksel kabulü tamamlanmış ve stok durumu kullanılabilir levhalar."/><SearchBar value={input} setValue={setInput} run={()=>{setSearch(input.trim());setPage(1)}}/><div className="space-y-2 p-4">{(query.data?.items??[]).map(row=><button key={row.id} onClick={()=>choose(row)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===row.id?'border-cyan-500 bg-cyan-500/10':''}`}><strong className="font-mono text-cyan-500">{row.dCode}</strong><span className="ml-2">{row.stockCode}</span><small className="block text-slate-500">{row.supplierSerialNo} · {formatProjectNumber(row.approvedQuantity)} {row.unitCode}</small></button>)}</div>{!query.isLoading&&!query.data?.items.length&&<Empty text="Yerleştirme bekleyen levha bulunmuyor."/>}<Pager page={page} totalPages={query.data?.totalPages??1} setPage={setPage}/></section>
    <section className="space-y-4 rounded-2xl border bg-[var(--wms-app-surface)] p-5"><SectionHead title="Raf Doluluğu ve Yerleşim" text={selected?`${selected.dCode} · ${selected.stockCode}`:'Devam etmek için soldan levha seçin.'}/>
      {selected&&<><Field label="Hedef raf"><PagedAppDropdown queryKey={['steel-putaway',selected.targetWarehouseId]} fetchPage={r=>goodsReceiptV2Api.locations(r,selected.targetWarehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} value={location} onValueChange={setLocation} searchable/></Field>
      {location&&<><div className="grid gap-3 sm:grid-cols-3"><Field label="Yerleşim tipi"><AppDropdown value={type} onValueChange={v=>setType(v as 'SideBySide'|'Stacked')} options={[{value:'SideBySide',label:'Yan yana'},{value:'Stacked',label:'Üst üste'}]}/></Field><Field label="Sıra"><input className="input" type="number" min="1" value={rowNo} onChange={e=>setRowNo(e.target.value)}/></Field><Field label="Pozisyon"><input className="input" type="number" min="1" value={position} onChange={e=>setPosition(e.target.value)}/></Field>{type==='Stacked'&&<Field label="İstif sırası"><input className="input" type="number" min="1" value={stack} onChange={e=>setStack(e.target.value)}/></Field>}</div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>{setPosition(String(suggestions.nextPosition));setType('SideBySide');setStack('')}} className="rounded-lg border px-3 py-2 text-xs font-bold">Sıradaki boş pozisyon: {suggestions.nextPosition}</button><button onClick={()=>{setType('Stacked');setStack(String(suggestions.nextStack))}} className="rounded-lg border px-3 py-2 text-xs font-bold">Üstüne koy: istif {suggestions.nextStack}</button></div>
      <div><strong className="text-sm">Seçili raftaki yerleşimler ({occupancy.data?.length??0})</strong><div className="mt-2 grid gap-2 md:grid-cols-2">{(occupancy.data??[]).map(item=><div key={item.placementId} className="rounded-xl border p-3 text-xs"><strong>{item.dCode} · {item.stockCode}</strong><span className="block text-slate-500">Sıra {item.rowNo} / Pozisyon {item.positionNo}{item.stackOrderNo?` / İstif ${item.stackOrderNo}`:''}</span></div>)}</div>{!occupancy.isLoading&&!occupancy.data?.length&&<p className="mt-2 text-xs text-slate-500">Bu rafta kayıtlı SAC yerleşimi yok.</p>}</div>
      <button disabled={busy||!rowNo||!position||(type==='Stacked'&&!stack)} onClick={()=>void place()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><Layers3 className="mr-2 inline size-4"/>Stok Hareketiyle Yerleştir</button></>}</>}</section></div>;
}

function Tab({active,onClick,icon,children}:{active:boolean;onClick:()=>void;icon:React.ReactNode;children:React.ReactNode}){return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${active?'bg-cyan-600 text-white':''}`}>{icon}{children}</button>}
function SectionHead({title,text}:{title:string;text:string}){return <div className="p-4"><h2 className="text-lg font-black">{title}</h2><p className="text-xs text-slate-500">{text}</p></div>}
function SearchBar({value,setValue,run}:{value:string;setValue:(v:string)=>void;run:()=>void}){return <div className="flex gap-2 px-4 pb-4"><input className="input" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run()}} placeholder="DCode, seri, stok, sipariş veya plan ara..."/><button onClick={run} className="rounded-xl border px-4"><Search className="size-4"/></button></div>}
function Pager({page,totalPages,setPage}:{page:number;totalPages:number;setPage:(v:number)=>void}){return <div className="flex items-center justify-between border-t p-3 text-xs"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4"/></button><span>Sayfa {page} / {Math.max(1,totalPages)}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4"/></button></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border p-3"><small className="text-slate-500">{label}</small><strong className="block text-lg">{value}</strong></div>}
function Empty({text}:{text:string}){return <div className="p-8 text-center text-sm text-slate-500">{text}</div>}
