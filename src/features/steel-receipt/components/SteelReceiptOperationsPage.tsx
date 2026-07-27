import {useCallback,useEffect,useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {ArrowRight,Boxes,ChevronLeft,ChevronRight,Layers3,Search,UserRoundCog,X} from 'lucide-react';
import {toast} from 'sonner';
import {AdvancedDataGrid,type GridColumn} from '@/components/shared/AdvancedDataGrid';
import {AppDropdown} from '@/components/shared/AppDropdown';
import {requiredActionColumn} from '@/components/shared/GridSystemColumns';
import {PagedAppDropdown} from '@/components/shared/PagedAppDropdown';
import {goodsReceiptV2Api} from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type {ActiveUserOption} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {localizeEnumValue} from '@/lib/enum-localization';
import {formatProjectNumber} from '@/lib/project-format';
import {steelReceiptApi} from '../api/steel-receipt.api';
import type {SteelLineRow} from '../types/steel-receipt.types';
import {SteelProcessHeader} from './SteelProcessHeader';

const O='steelGoodReceiptAcceptance.operations';
const pageSize=20;
const request=(page:number,search:string)=>({pageNumber:page,pageSize,search:search||null,filterLogic:'and' as const,filters:[],sortBy:'id',sortDirection:'desc' as const});
const userLabel=(user:ActiveUserOption):string=>`${user.firstName} ${user.lastName}`.trim()||user.username;
const userOption=(user:ActiveUserOption)=>({value:encodeURIComponent(JSON.stringify(user)),label:userLabel(user),description:`${user.username} · ${user.email}`});
const decodeUser=(value:string):ActiveUserOption=>JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

export function SteelReceiptOperationsPage({initialTab='receipt'}:{initialTab?:'receipt'|'placement'}){
  const {t}=useTranslation('common');
  const [tab,setTab]=useState<'receipt'|'placement'>(initialTab);
  useEffect(()=>setTab(initialTab),[initialTab]);
  return <div className="space-y-5" data-no-auto-localize="true">
    <SteelProcessHeader currentStep={tab} title={t(tab==='receipt'?`${O}.receiptTitle`:`${O}.placementTitle`)} description={t(tab==='receipt'?`${O}.receiptDescription`:`${O}.placementDescription`)}/>
    <nav className="inline-flex rounded-xl border p-1"><Tab active={tab==='receipt'} onClick={()=>setTab('receipt')} icon={<Boxes className="size-4"/>}>{t(`${O}.receiptTab`)}</Tab><Tab active={tab==='placement'} onClick={()=>setTab('placement')} icon={<Layers3 className="size-4"/>}>{t(`${O}.placementTab`)}</Tab></nav>
    {tab==='receipt'?<ReceiptPanel/>:<PlacementPanel/>}
  </div>;
}

function ReceiptPanel(){
  const {t,i18n}=useTranslation('common');
  const R=`${O}.receipt`;
  const gridLanguage=i18n.resolvedLanguage??i18n.language;
  const cache=useQueryClient();
  const [selected,setSelected]=useState<Record<number,SteelLineRow>>({});
  const [note,setNote]=useState('');
  const [priority,setPriority]=useState('3');
  const [assignees,setAssignees]=useState<ActiveUserOption[]>([]);
  const [assignAll,setAssignAll]=useState(false);
  const [busy,setBusy]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);
  const selectedRows=Object.values(selected);const selectedPlan=selectedRows[0]?.planId;
  const total=selectedRows.reduce((sum,row)=>sum+row.approvedQuantity,0);
  const toggle=useCallback((row:SteelLineRow)=>setSelected(current=>{
    if(current[row.id]){const next={...current};delete next[row.id];return next}
    const currentPlan=Object.values(current)[0]?.planId;
    if(Object.keys(current).length&&currentPlan!==row.planId){toast.error(t(`${R}.samePlanOnly`));return current}
    return {...current,[row.id]:row};
  }),[t,R]);
  const columns=useMemo<GridColumn<SteelLineRow>[]>(()=>[
    {key:'actions',label:t(`${R}.select`),...requiredActionColumn,render:r=><input type="checkbox" checked={!!selected[r.id]} onChange={()=>toggle(r)} className="size-4 accent-cyan-500" aria-label={t(`${R}.select`)}/>},
    {key:'dCode',label:t(`${R}.dCodeSerial`),searchable:true,defaultSearch:true,render:r=><><strong className="font-mono text-cyan-500">{r.dCode}</strong><small className="block text-slate-500">{r.supplierSerialNo}</small></>},
    {key:'stockCode',label:t(`${R}.stock`),searchable:true,render:r=><><strong>{r.stockCode}</strong><small className="block text-slate-500">{r.stockName||'-'}</small></>},
    {key:'importReferenceNo',label:t(`${R}.plan`),searchable:true,render:r=><>{r.importReferenceNo}<small className="block text-slate-500">{r.netsisOrderNo||t(`${R}.noOrder`)}</small></>},
    {key:'inspectionStatus',label:t(`${R}.quality`),render:r=>localizeEnumValue(r.inspectionStatus)},
    {key:'approvedQuantity',label:t(`${R}.approvedQty`),render:r=><span className="font-bold">{formatProjectNumber(r.approvedQuantity)} {r.unitCode}</span>},
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gridLanguage forces column label refresh
  ],[t,gridLanguage,selected,toggle,R]);
  const convert=async()=>{
    if(!selectedRows.length||!selectedPlan)return;
    if(!assignAll&&!assignees.length){toast.error(t(`${R}.assigneeRequired`));return}
    setBusy(true);
    try{
      const result=await steelReceiptApi.convert(selectedPlan,selectedRows.map(x=>x.id),{description:note,priority:Number(priority),assignedUserIds:assignees.map(x=>x.id),assignToAllActiveUsers:assignAll});
      toast.success(t(`${R}.convertSuccess`,{documentNo:result.documentNo,count:result.convertedLineCount}));
      setSelected({});setNote('');setAssignees([]);setAssignAll(false);setRefreshKey(key=>key+1);
      await cache.invalidateQueries({queryKey:['advanced-grid','steel-receipt-candidates']})
    }catch(e){toast.error(e instanceof Error?e.message:t(`${R}.convertFailed`))}finally{setBusy(false)}
  };
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.7fr)]">
    <div className="min-w-0"><AdvancedDataGrid pageKey="steel-receipt-candidates" title={t(`${R}.candidatesTitle`)} description={t(`${R}.candidatesText`)} columns={columns} fetchPage={steelReceiptApi.receiptCandidatesPaged} refreshKey={refreshKey}/></div>
    <aside className="h-fit space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 xl:mt-10"><SectionHead title={t(`${R}.summaryTitle`)} text={t(`${R}.summaryText`)}/>
      <Metric label={t(`${R}.selectedSheets`)} value={String(selectedRows.length)}/><Metric label={t(`${R}.totalApprovedQty`)} value={formatProjectNumber(total)}/><Metric label={t(`${R}.sacPlan`)} value={selectedRows[0]?.importReferenceNo||'-'}/>
      <Field label={t(`${R}.priority`)}><AppDropdown value={priority} onValueChange={setPriority} options={[{value:'1',label:t(`${R}.priorityLow`)},{value:'3',label:t(`${R}.priorityNormal`)},{value:'5',label:t(`${R}.priorityHigh`)},{value:'9',label:t(`${R}.priorityUrgent`)}]}/></Field>
      <section className="rounded-xl border p-3">
        <div className="mb-3 flex items-start gap-2"><UserRoundCog className="mt-0.5 size-5 text-cyan-500"/><div><strong className="text-sm">{t(`${R}.assigneesTitle`)} <span className="text-red-500">*</span></strong><p className="text-xs text-slate-500">{t(`${R}.assigneesHint`)}</p></div></div>
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><input type="checkbox" checked={assignAll} onChange={e=>setAssignAll(e.target.checked)} className="mt-1 size-4 accent-cyan-500"/><span><strong className="block text-sm">{t(`${R}.assignAllLabel`)}</strong><small className="text-slate-500">{t(`${R}.assignAllHint`)}</small></span></label>
        {!assignAll&&<PagedAppDropdown queryKey={['steel-receipt-active-users']} fetchPage={goodsReceiptV2Api.activeUsersPaged} toOption={user=>({...userOption(user),disabled:assignees.some(selectedUser=>selectedUser.id===user.id)})} value={null} onValueChange={value=>{const user=decodeUser(value);setAssignees(current=>current.some(x=>x.id===user.id)?current:[...current,user])}} placeholder={t(`${R}.addUserPlaceholder`)} searchable minSearchLength={2}/>}
        <div className="mt-3 flex flex-wrap gap-2">{!assignAll&&assignees.map(user=><span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs"><span><strong>{userLabel(user)}</strong><small className="ml-1 text-slate-500">({user.username})</small></span><button type="button" onClick={()=>setAssignees(current=>current.filter(x=>x.id!==user.id))} className="rounded-full p-0.5 text-slate-500 hover:bg-red-500/15 hover:text-red-500" aria-label={t(`${R}.removeAssigneeAria`,{name:userLabel(user)})}><X className="size-3.5"/></button></span>)}{assignAll?<span className="text-xs font-bold text-cyan-500">{t(`${R}.allUsersWillBeAssigned`)}</span>:!assignees.length&&<span className="text-xs text-amber-500">{t(`${R}.noUsersAssigned`)}</span>}</div>
      </section>
      <Field label={t(`${R}.orderNote`)}><textarea className="input min-h-24" value={note} onChange={e=>setNote(e.target.value)} placeholder={t(`${R}.orderNotePlaceholder`)}/></Field>
      <button disabled={busy||!selectedRows.length||(!assignAll&&!assignees.length)} onClick={()=>void convert()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><ArrowRight className="mr-2 inline size-4"/>{t(`${R}.createOrderButton`)}</button>
    </aside>
  </div>;
}

function PlacementPanel(){
  const {t}=useTranslation('common');
  const P=`${O}.placement`;
  const cache=useQueryClient();const [page,setPage]=useState(1);const [input,setInput]=useState('');const [search,setSearch]=useState('');const [selected,setSelected]=useState<SteelLineRow|null>(null);
  const [location,setLocation]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['steel-placement-candidates',page,search],queryFn:()=>steelReceiptApi.placementCandidatesPaged(request(page,search))});
  const occupancy=useQuery({queryKey:['steel-occupancy',location],queryFn:()=>steelReceiptApi.occupancy(Number(location)),enabled:!!location});
  const nextStack=useMemo(()=>{const items=occupancy.data??[];return Math.max(items.length,...items.map(x=>x.stackOrderNo??0))+1},[occupancy.data]);
  const choose=(row:SteelLineRow)=>{setSelected(row);setLocation(null)};
  const place=async()=>{if(!selected||!location){toast.error(t(`${P}.sheetAndShelfRequired`));return}setBusy(true);try{const result=await steelReceiptApi.place(selected.id,{locationId:Number(location),rowVersion:selected.rowVersion});toast.success(t(`${P}.placeSuccess`,{dCode:selected.dCode,order:result.stackOrderNo}));setSelected(null);setLocation(null);await cache.invalidateQueries({queryKey:['steel-placement-candidates']});await cache.invalidateQueries({queryKey:['steel-occupancy']})}catch(e){toast.error(e instanceof Error?e.message:t(`${P}.placeFailed`))}finally{setBusy(false)}};
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"><SectionHead title={t(`${P}.pendingTitle`)} text={t(`${P}.pendingText`)}/><SearchBar value={input} setValue={setInput} run={()=>{setSearch(input.trim());setPage(1)}}/><div className="space-y-2 p-4">{(query.data?.items??[]).map(row=><button key={row.id} onClick={()=>choose(row)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===row.id?'border-cyan-500 bg-cyan-500/10':''}`}><strong className="font-mono text-cyan-500">{row.dCode}</strong><span className="ml-2">{row.stockCode}</span><small className="block text-slate-500">{row.supplierSerialNo} · {formatProjectNumber(row.approvedQuantity)} {row.unitCode}</small></button>)}</div>{!query.isLoading&&!query.data?.items.length&&<Empty text={t(`${P}.empty`)}/>}<Pager page={page} totalPages={query.data?.totalPages??1} setPage={setPage}/></section>
    <section className="space-y-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><SectionHead title={t(`${P}.occupancyTitle`)} text={selected?`${selected.dCode} · ${selected.stockCode}`:t(`${P}.occupancyTextSelect`)}/>
      {selected&&<><Field label={t(`${P}.targetShelf`)}><PagedAppDropdown queryKey={['steel-putaway',selected.targetWarehouseId]} fetchPage={r=>goodsReceiptV2Api.locations(r,selected.targetWarehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`,description:x.locationType})} value={location} onValueChange={setLocation} searchable/></Field>
      {location&&<><div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-5">
          <div className="flex items-center justify-between"><div><span className="text-xs font-bold uppercase tracking-widest text-cyan-500">{t(`${P}.autoPlacement`)}</span><h3 className="mt-1 text-xl font-black">{t(`${P}.stackOnTop`)}</h3></div><Layers3 className="size-10 text-cyan-500"/></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><Metric label={t(`${P}.sheetsOnShelf`)} value={String(occupancy.data?.length??0)}/><Metric label={t(`${P}.newStackOrder`)} value={String(nextStack)}/></div>
          <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">{t(`${P}.stackOrderNote`)}</p>
        </section>
        <SteelStackVisual items={occupancy.data??[]} pendingCode={selected.dCode} nextStack={nextStack}/>
      </div>
      <div><strong className="text-sm">{t(`${P}.stackOrderList`,{count:occupancy.data?.length??0})}</strong><div className="mt-2 grid gap-2 md:grid-cols-2">{[...(occupancy.data??[])].sort((a,b)=>(b.stackOrderNo??0)-(a.stackOrderNo??0)).map(item=><div key={item.placementId} className="rounded-xl border p-3 text-xs"><strong>{t(`${P}.stackItem`,{order:item.stackOrderNo,dCode:item.dCode})}</strong><span className="block text-slate-500">{item.stockCode} · {item.supplierSerialNo}</span></div>)}</div>{!occupancy.isLoading&&!occupancy.data?.length&&<p className="mt-2 text-xs text-slate-500">{t(`${P}.emptyShelf`)}</p>}</div>
      <button disabled={busy||occupancy.isLoading} onClick={()=>void place()} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-40"><Layers3 className="mr-2 inline size-4"/>{t(`${P}.placeButton`,{order:nextStack})}</button></>}</>}</section></div>;
}

function SteelStackVisual({items,pendingCode,nextStack}:{items:Array<{placementId:number;dCode:string;stackOrderNo?:number}>;pendingCode:string;nextStack:number}){
  const {t}=useTranslation('common');
  const P=`${O}.placement`;
  const visible=[...items].sort((a,b)=>(a.stackOrderNo??0)-(b.stackOrderNo??0)).slice(-6);
  return <section className="relative min-h-72 overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-white [perspective:900px]">
    <div className="absolute inset-x-8 bottom-5 h-10 rounded-[50%] bg-cyan-400/10 blur-xl"/>
    <div className="relative flex h-52 flex-col-reverse items-center justify-start gap-1 [transform-style:preserve-3d]">{visible.map((item,index)=><div key={item.placementId} className="h-7 w-[78%] rounded border border-slate-400/40 bg-gradient-to-r from-slate-700 via-slate-300 to-slate-700 px-3 py-1 text-[10px] font-bold text-slate-950 shadow-xl" style={{transform:`translateZ(${index*5}px) translateX(${index%2?3:-3}px)`}}>{item.stackOrderNo}. {item.dCode}</div>)}<div className="h-8 w-[82%] animate-pulse rounded border-2 border-cyan-300 bg-gradient-to-r from-cyan-700 via-cyan-200 to-cyan-700 px-3 py-1 text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.35)]">{nextStack}. {pendingCode} · {t(`${P}.newBadge`)}</div></div>
    <div className="mx-auto h-4 w-[92%] rounded bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800 shadow-2xl"/><p className="mt-3 text-center text-xs text-slate-400">{t(`${P}.stackPreviewHint`)}</p>
  </section>;
}

function Tab({active,onClick,icon,children}:{active:boolean;onClick:()=>void;icon:React.ReactNode;children:React.ReactNode}){return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${active?'bg-cyan-600 text-white':''}`}>{icon}{children}</button>}
function SectionHead({title,text}:{title:string;text:string}){return <div className="p-4"><h2 className="text-lg font-black">{title}</h2><p className="text-xs text-slate-500">{text}</p></div>}
function SearchBar({value,setValue,run}:{value:string;setValue:(v:string)=>void;run:()=>void}){
  const {t}=useTranslation('common');
  return <div className="flex gap-2 px-4 pb-4"><input className="input" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run()}} placeholder={t(`${O}.searchPlaceholder`)}/><button onClick={run} className="rounded-xl border px-4"><Search className="size-4"/></button></div>;
}
function Pager({page,totalPages,setPage}:{page:number;totalPages:number;setPage:(v:number)=>void}){
  const {t}=useTranslation('common');
  return <div className="flex items-center justify-between border-t p-3 text-xs"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4"/></button><span>{t(`${O}.pageLabel`,{page,totalPages:Math.max(1,totalPages)})}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4"/></button></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5 text-sm"><span className="font-bold">{label}</span>{children}</label>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border p-3"><small className="text-slate-500">{label}</small><strong className="block text-lg">{value}</strong></div>}
function Empty({text}:{text:string}){return <div className="p-8 text-center text-sm text-slate-500">{text}</div>}
