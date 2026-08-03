import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, CheckCircle2, ClipboardCheck, Grid3X3, Settings2, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/ui-store';
import { kkdApi, type KkdEntitlementResult } from './kkd-api';

const field = 'min-h-11 rounded-xl border border-[var(--wms-app-border)] bg-transparent px-3 text-sm outline-none focus:border-cyan-500';
const panel = 'rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm';

function Page({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const setPageTitle = useUIStore((x) => x.setPageTitle);
  useEffect(() => { setPageTitle(title); return () => setPageTitle(null); }, [setPageTitle, title]);
  return <section className="mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-6">
    <header><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-500">KKD / Kişisel Koruyucu Donanım</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></header>
    {children}
  </section>;
}

export function KkdOverviewPage() {
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const distributions = useQuery({ queryKey: ['kkd', 'distributions'], queryFn: kkdApi.distributions });
  const metrics = [
    ['Personel', employees.data?.length ?? 0, Users], ['Departman', departments.data?.length ?? 0, Boxes],
    ['Hak matrisi', matrices.data?.length ?? 0, Grid3X3], ['Dağıtım', distributions.data?.length ?? 0, ClipboardCheck],
  ] as const;
  return <Page title="KKD Süreç Merkezi" description="Organizasyon, hak matrisi, teslim ve Netsis ambar çıkışını tek izlenebilir akışta yönetin.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <div className={panel} key={label}><Icon className="size-5 text-cyan-500"/><p className="mt-5 text-3xl font-black">{value}</p><p className="text-sm text-slate-500">{label}</p></div>)}</div>
    <div className="grid gap-4 md:grid-cols-3">
      <Action href="/warehouse/kkd/definitions" title="Tanımlar ve hak matrisi" text="Departman, rol, personel ve tüm yaşam döngüsü kuralları." />
      <Action href="/warehouse/kkd/entitlement" title="Hak sorgulama" text="Stok özel/grup kuralı, dönem, sıklık ve ek hak sonucunu görün." />
      <Action href="/warehouse/kkd/distributions/new" title="Dağıtım ve ambar çıkış" text="Açık Netsis siparişinden teslim ve fiziksel ambar çıkışı başlatın." />
      <Action href="/warehouse/kkd/policy" title="KKD süreç politikası" text="Sipariş zorunluluğu, hak üstü teslim ve operasyon güvenlik kuralları." />
    </div>
  </Page>;
}

export function KkdPolicyPage() {
  const query=useQuery({queryKey:['kkd','policy'],queryFn:kkdApi.policy});
  const [form,setForm]=useState({requireOpenOrder:true,allowOpenOrderExcess:true,allowMultipleOrdersPerDistribution:true,requireEmployeeUserLink:false,allowFutureDatedDistribution:false});
  useEffect(()=>{if(query.data)setForm({requireOpenOrder:query.data.requireOpenOrder,allowOpenOrderExcess:query.data.allowOpenOrderExcess,allowMultipleOrdersPerDistribution:query.data.allowMultipleOrdersPerDistribution,requireEmployeeUserLink:query.data.requireEmployeeUserLink,allowFutureDatedDistribution:query.data.allowFutureDatedDistribution});},[query.data]);
  const mutation=useMutation({mutationFn:()=>kkdApi.savePolicy(form),onSuccess:value=>{setForm({requireOpenOrder:value.requireOpenOrder,allowOpenOrderExcess:value.allowOpenOrderExcess,allowMultipleOrdersPerDistribution:value.allowMultipleOrdersPerDistribution,requireEmployeeUserLink:value.requireEmployeeUserLink,allowFutureDatedDistribution:value.allowFutureDatedDistribution});toast.success('KKD süreç politikası kaydedildi.');},onError:e=>toast.error(message(e))});
  const toggle=(key:keyof typeof form)=><input type="checkbox" checked={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.checked}))}/>;
  return <Page title="KKD Süreç Politikası" description="Şube bazında dağıtım ön koşullarını yönetin; değişiklikler yeni dağıtımlarda servis katmanında zorunlu uygulanır.">
    <div className={`${panel} space-y-3`}>
      <PolicyRow icon={<ClipboardCheck className="size-5 text-cyan-500"/>} title="Açık Netsis siparişi zorunlu" text="Açık olduğunda siparişsiz KKD dağıtımı oluşturulamaz." control={toggle('requireOpenOrder')}/>
      <PolicyRow icon={<ShieldCheck className="size-5 text-cyan-500"/>} title="Açık siparişle hak üstü teslime izin ver" text="Kapalı olduğunda yalnızca hesaplanan KKD hakkı kadar teslim yapılabilir." control={toggle('allowOpenOrderExcess')}/>
      <PolicyRow icon={<Boxes className="size-5 text-cyan-500"/>} title="Tek dağıtımda birden fazla sipariş" text="Kapalı olduğunda bütün kalemler aynı Netsis siparişine ait olmalıdır." control={toggle('allowMultipleOrdersPerDistribution')}/>
      <PolicyRow icon={<Users className="size-5 text-cyan-500"/>} title="Personel–WMS kullanıcısı bağlantısı zorunlu" text="Açık olduğunda kullanıcı hesabına bağlanmamış personele teslim yapılamaz." control={toggle('requireEmployeeUserLink')}/>
      <PolicyRow icon={<Settings2 className="size-5 text-cyan-500"/>} title="İleri tarihli dağıtıma izin ver" text="Kapalı olduğunda belge tarihi bugünden ileri seçilemez." control={toggle('allowFutureDatedDistribution')}/>
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"><strong>Kapatılamayan kontroller:</strong> oturum şubesi, personel carisi, canlı sipariş bakiyesi, stok eşleşmesi, seri/lot politikası, kaynak raf ve gerçek ambar çıkışı doğrulamaları her zaman uygulanır.</div>
      <button disabled={mutation.isPending||query.isLoading} onClick={()=>mutation.mutate()} className="min-h-11 rounded-xl bg-cyan-500 px-5 font-black text-slate-950 disabled:opacity-50">{mutation.isPending?'Kaydediliyor…':'Politikayı kaydet'}</button>
    </div>
  </Page>;
}

function PolicyRow({icon,title,text,control}:{icon:ReactNode;title:string;text:string;control:ReactNode}) { return <label className="flex items-center gap-4 rounded-xl border border-[var(--wms-app-border)] p-4"><span>{icon}</span><span className="min-w-0 flex-1"><strong className="block">{title}</strong><small className="text-slate-500">{text}</small></span>{control}</label>; }

function Action({ href, title, text }: { href: string; title: string; text: string }) {
  return <Link className={`${panel} transition hover:-translate-y-0.5 hover:border-cyan-500`} to={href}><h2 className="font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p><span className="mt-5 inline-block text-sm font-bold text-cyan-500">Ekranı aç →</span></Link>;
}

export function KkdDefinitionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'department'|'role'|'employee'|'matrix'>('department');
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const roles = useQuery({ queryKey: ['kkd', 'roles'], queryFn: () => kkdApi.roles() });
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const [form, setForm] = useState<Record<string,string>>({ isActive: 'true', employmentStartDate: new Date().toLocaleDateString('en-CA'), initialQuantity: '1', recurringQuantity: '1', recurringInterval: '1' });
  const change = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: async () => {
      if (tab === 'department') return kkdApi.saveDepartment({ code: form.code, name: form.name, isActive: true });
      if (tab === 'role') return kkdApi.saveRole({ departmentId: n(form.departmentId), code: form.code, name: form.name, isActive: true });
      if (tab === 'employee') return kkdApi.saveEmployee({ customerId:n(form.customerId), userId:n(form.userId)||null, employeeCode:form.code, firstName:form.firstName, lastName:form.lastName, departmentId:n(form.departmentId), roleId:n(form.roleId), qrCode:form.qrCode, employmentStartDate:form.employmentStartDate, isActive:true });
      return kkdApi.saveMatrix({ customerId:n(form.customerId), departmentId:n(form.departmentId), roleId:n(form.roleId), code:form.code, name:form.name, effectiveFrom:form.effectiveFrom||null, effectiveTo:form.effectiveTo||null, isActive:true, description:form.description||null, rules:[{ groupCode:form.groupCode, groupName:form.groupName||null, stockId:n(form.stockId)||null, standardCode:form.standardCode||null, standardName:null, annualIssueCount:n(form.annualIssueCount)||null, annualQuantity:n(form.annualQuantity)||null, maxCarryQuantity:n(form.maxCarryQuantity)||null, allowBulkIssue:form.allowBulkIssue==='true', isMandatory:form.isMandatory==='true', sortOrder:1, isActive:true, description:null, phases:[{phaseType:'Initial',offsetMonths:0,quantity:n(form.initialQuantity),allowBulkIssue:form.allowBulkIssue==='true',frequencyDays:n(form.frequencyDays)||null,quantityPerFrequency:n(form.frequencyQuantity)||null,periodType:null,periodInterval:null,sortOrder:1,isActive:true},{phaseType:'AfterMonths',offsetMonths:n(form.afterMonths)||3,quantity:n(form.afterQuantity)||0,allowBulkIssue:form.allowBulkIssue==='true',frequencyDays:null,quantityPerFrequency:null,periodType:null,periodInterval:null,sortOrder:2,isActive:n(form.afterQuantity)>0},{phaseType:'Recurring',offsetMonths:0,quantity:n(form.recurringQuantity),allowBulkIssue:form.allowBulkIssue==='true',frequencyDays:n(form.frequencyDays)||null,quantityPerFrequency:n(form.frequencyQuantity)||null,periodType:form.periodType||'Year',periodInterval:n(form.recurringInterval)||1,sortOrder:3,isActive:true}] }] });
    },
    onSuccess: async () => { toast.success('KKD tanımı kaydedildi.'); setForm({ isActive:'true', employmentStartDate:new Date().toLocaleDateString('en-CA'), initialQuantity:'1', recurringQuantity:'1', recurringInterval:'1' }); await qc.invalidateQueries({ queryKey:['kkd'] }); },
    onError: (e) => toast.error(message(e)),
  });
  const submit = (e:FormEvent) => { e.preventDefault(); mutation.mutate(); };
  return <Page title="KKD Tanımları" description="V1 kurallarını tek matris motorunda, tarih ve yaşam döngüsü fazlarıyla yönetin.">
    <div className="flex flex-wrap gap-2">{(['department','role','employee','matrix'] as const).map((x)=><button key={x} onClick={()=>setTab(x)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===x?'bg-cyan-500 text-slate-950':'border border-[var(--wms-app-border)]'}`}>{({department:'Departman',role:'Rol',employee:'Personel',matrix:'Hak matrisi'})[x]}</button>)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,.7fr)_1.3fr]">
      <form className={`${panel} grid content-start gap-3`} onSubmit={submit}>
        <h2 className="text-lg font-black">Yeni {tab==='matrix'?'hak matrisi':'tanım'}</h2>
        {(tab==='role'||tab==='employee'||tab==='matrix')&&<Select label="Departman" value={form.departmentId} onChange={(v)=>change('departmentId',v)} options={departments.data}/>} 
        {(tab==='employee'||tab==='matrix')&&<Select label="Rol" value={form.roleId} onChange={(v)=>change('roleId',v)} options={roles.data}/>} 
        <Input label={tab==='employee'?'Personel kodu':'Kod'} value={form.code} onChange={(v)=>change('code',v)} required/>
        {tab!=='employee'&&<Input label="Ad" value={form.name} onChange={(v)=>change('name',v)} required/>}
        {tab==='employee'&&<><Input label="Ad" value={form.firstName} onChange={(v)=>change('firstName',v)} required/><Input label="Soyad" value={form.lastName} onChange={(v)=>change('lastName',v)} required/><Input label="Netsis cari ID" type="number" value={form.customerId} onChange={(v)=>change('customerId',v)} required/><Input label="Kullanıcı ID (opsiyonel)" type="number" value={form.userId} onChange={(v)=>change('userId',v)}/><Input label="QR kodu" value={form.qrCode} onChange={(v)=>change('qrCode',v)} required/><Input label="İşe giriş tarihi" type="date" value={form.employmentStartDate} onChange={(v)=>change('employmentStartDate',v)} required/></>}
        {tab==='matrix'&&<MatrixFields form={form} change={change}/>} 
        <button disabled={mutation.isPending} className="mt-2 min-h-11 rounded-xl bg-cyan-500 px-4 font-black text-slate-950 disabled:opacity-50">{mutation.isPending?'Kaydediliyor…':'Kaydet'}</button>
      </form>
      <div className={`${panel} overflow-auto`}><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]"><th className="p-3">Kod</th><th className="p-3">Ad / kapsam</th><th className="p-3">Durum</th></tr></thead><tbody>{rows(tab,{departments:departments.data,roles:roles.data,employees:employees.data,matrices:matrices.data}).map((r)=><tr key={r.id} className="border-b border-[var(--wms-app-border)]"><td className="p-3 font-bold">{r.code}</td><td className="p-3">{r.name}</td><td className="p-3">{r.active?'Aktif':'Pasif'}</td></tr>)}</tbody></table></div>
    </div>
  </Page>;
}

function MatrixFields({form,change}:{form:Record<string,string>;change:(k:string,v:string)=>void}) { return <>
  <Input label="Netsis cari ID" type="number" value={form.customerId} onChange={(v)=>change('customerId',v)} required/><Input label="Grup kodu" value={form.groupCode} onChange={(v)=>change('groupCode',v)} required/><Input label="Stok ID (boşsa grup kuralı)" type="number" value={form.stockId} onChange={(v)=>change('stockId',v)}/><Input label="Standart kodu" value={form.standardCode} onChange={(v)=>change('standardCode',v)}/>
  <div className="grid grid-cols-2 gap-3"><Input label="İlk teslim miktarı" type="number" value={form.initialQuantity} onChange={(v)=>change('initialQuantity',v)} required/><Input label="Ay sonrası" type="number" value={form.afterMonths} onChange={(v)=>change('afterMonths',v)}/><Input label="Ay sonrası miktar" type="number" value={form.afterQuantity} onChange={(v)=>change('afterQuantity',v)}/><Input label="Periyodik miktar" type="number" value={form.recurringQuantity} onChange={(v)=>change('recurringQuantity',v)} required/><Input label="Dönem aralığı" type="number" value={form.recurringInterval} onChange={(v)=>change('recurringInterval',v)} required/><label className="grid gap-1 text-xs font-bold uppercase">Dönem<select className={field} value={form.periodType||'Year'} onChange={(e)=>change('periodType',e.target.value)}><option value="Day">Gün</option><option value="Month">Ay</option><option value="Year">Yıl</option></select></label><Input label="Sıklık (gün)" type="number" value={form.frequencyDays} onChange={(v)=>change('frequencyDays',v)}/><Input label="Sıklık miktarı" type="number" value={form.frequencyQuantity} onChange={(v)=>change('frequencyQuantity',v)}/><Input label="Yıllık teslim sayısı" type="number" value={form.annualIssueCount} onChange={(v)=>change('annualIssueCount',v)}/><Input label="Yıllık miktar" type="number" value={form.annualQuantity} onChange={(v)=>change('annualQuantity',v)}/><Input label="Devreden üst sınır" type="number" value={form.maxCarryQuantity} onChange={(v)=>change('maxCarryQuantity',v)}/></div>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.allowBulkIssue==='true'} onChange={(e)=>change('allowBulkIssue',String(e.target.checked))}/>Toplu teslim izni</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.isMandatory==='true'} onChange={(e)=>change('isMandatory',String(e.target.checked))}/>Zorunlu KKD</label>
  </>; }

export function KkdEntitlementPage() {
  const employees = useQuery({queryKey:['kkd','employees'],queryFn:kkdApi.employees});
  const [employeeId,setEmployeeId]=useState(''); const [stockId,setStockId]=useState(''); const [quantity,setQuantity]=useState('1'); const [result,setResult]=useState<KkdEntitlementResult>();
  const mutation=useMutation({mutationFn:()=>kkdApi.check({employeeId:n(employeeId),stockId:n(stockId),quantity:n(quantity)}),onSuccess:setResult,onError:(e)=>toast.error(message(e))});
  return <Page title="KKD Hak Sorgulama" description="Stok özel kuralı, grup kuralı, faz, sıklık, yıllık sınır ve ek hak birlikte hesaplanır."><form className={`${panel} grid gap-3 md:grid-cols-4`} onSubmit={(e)=>{e.preventDefault();mutation.mutate()}}><label className="grid gap-1 text-xs font-bold uppercase">Personel<select className={field} value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)} required><option value="">Seçin</option>{employees.data?.map((x)=><option key={x.id} value={x.id}>{x.employeeCode} · {x.fullName}</option>)}</select></label><Input label="Stok ID" type="number" value={stockId} onChange={setStockId} required/><Input label="Miktar" type="number" value={quantity} onChange={setQuantity} required/><button className="self-end min-h-11 rounded-xl bg-cyan-500 font-black text-slate-950">Kontrol et</button></form>{result&&<div className={`${panel} border-l-4 ${result.isAllowed?'border-l-emerald-500':'border-l-rose-500'}`}><div className="flex items-center gap-3">{result.isAllowed?<CheckCircle2 className="text-emerald-500"/>:<ShieldCheck className="text-rose-500"/>}<div><h2 className="font-black">{result.isAllowed?'Teslime uygun':'Teslime uygun değil'}</h2><p className="text-sm text-slate-500">{result.message}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Grup" value={result.groupCode}/><Metric label="Faz" value={result.phaseType||'-'}/><Metric label="Ana hak" value={result.matrixRemainingQuantity}/><Metric label="Ek hak" value={result.overrideRemainingQuantity}/></div></div>}</Page>;
}

export function KkdDistributionsPage() {
  const query=useQuery({queryKey:['kkd','distributions'],queryFn:kkdApi.distributions});
  return <Page title="KKD Dağıtımları" description="Teslim kaydı, hak tüketimi, fiziksel ambar çıkışı ve ERP sonucu aynı belge zincirinde izlenir."><div className={`${panel} overflow-auto`}><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Belge','Personel','Toplam','Hak','Fazla','Durum','Ambar çıkışı'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{query.data?.map(x=><tr className="border-b border-[var(--wms-app-border)]" key={x.id}><td className="p-3 font-bold">{x.documentNo}</td><td className="p-3">{x.employeeCode} · {x.employeeName}</td><td className="p-3">{x.totalQuantity}</td><td className="p-3">{x.entitledQuantity}</td><td className="p-3">{x.excessQuantity}</td><td className="p-3">{x.status}</td><td className="p-3">{x.warehouseOutboundId?<Link className="font-bold text-cyan-500" to={`/warehouse/warehouse-outbounds/${x.warehouseOutboundId}/operations`}>Operasyonu aç</Link>:'-'}</td></tr>)}</tbody></table></div></Page>;
}

export function KkdReportsPage() {
  const [dimension,setDimension]=useState<'Department'|'Role'|'Group'>('Group');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const usage=useQuery({queryKey:['kkd','reports','usage',dimension,from,to],queryFn:()=>kkdApi.usageReport(dimension,from,to)});
  const logs=useQuery({queryKey:['kkd','reports','validation-logs'],queryFn:kkdApi.validationLogs});
  return <Page title="KKD Raporları" description="Teslim edilen, hak içinden karşılanan ve açık siparişle verilen fazla miktarı departman, rol veya KKD grubu bazında izleyin.">
    <div className={`${panel} grid gap-3 md:grid-cols-4`}><label className="grid gap-1 text-xs font-bold uppercase">Kırılım<select className={field} value={dimension} onChange={e=>setDimension(e.target.value as typeof dimension)}><option value="Group">KKD grubu</option><option value="Department">Departman</option><option value="Role">Rol</option></select></label><Input label="Başlangıç" type="date" value={from} onChange={setFrom}/><Input label="Bitiş" type="date" value={to} onChange={setTo}/><button type="button" onClick={()=>{void usage.refetch();void logs.refetch();}} className="self-end min-h-11 rounded-xl border border-cyan-500 px-4 font-black text-cyan-500">Yenile</button></div>
    <div className={`${panel} overflow-auto`}><h2 className="mb-3 font-black">Kullanım özeti</h2><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Kod','Ad','Dağıtım','Personel','Teslim','Hak','Sipariş fazlası'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{usage.data?.map(x=><tr key={x.code} className="border-b border-[var(--wms-app-border)]"><td className="p-3 font-bold">{x.code}</td><td className="p-3">{x.name}</td><td className="p-3">{x.distributionCount}</td><td className="p-3">{x.employeeCount}</td><td className="p-3">{x.deliveredQuantity}</td><td className="p-3">{x.entitledQuantity}</td><td className="p-3">{x.excessQuantity}</td></tr>)}</tbody></table>{usage.data?.length===0&&<p className="py-4 text-sm text-slate-500">Seçilen aralıkta tamamlanmış KKD dağıtımı yok.</p>}</div>
    <div className={`${panel} overflow-auto`}><h2 className="mb-3 font-black">Son doğrulama kayıtları</h2><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Zaman','Neden','Personel','Stok / grup','Miktar','Mesaj'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{logs.data?.map(x=><tr key={x.id} className="border-b border-[var(--wms-app-border)]"><td className="p-3">{x.createdDate?new Date(x.createdDate).toLocaleString('tr-TR'):'-'}</td><td className="p-3 font-bold">{x.reasonCode}</td><td className="p-3">{x.employeeId??'-'}</td><td className="p-3">{x.stockId??'-'} / {x.groupCode||'-'}</td><td className="p-3">{x.attemptedQuantity}</td><td className="p-3">{x.message||'-'}</td></tr>)}</tbody></table></div>
  </Page>;
}

function Input({label,value,onChange,type='text',required=false}:{label:string;value?:string;onChange:(v:string)=>void;type?:string;required?:boolean}) { return <label className="grid gap-1 text-xs font-bold uppercase">{label}<input className={field} type={type} step={type==='number'?'any':undefined} value={value||''} onChange={(e)=>onChange(e.target.value)} required={required}/></label>; }
function Select({label,value,onChange,options}:{label:string;value?:string;onChange:(v:string)=>void;options?:Array<{id:number;code:string;name:string}>}) { return <label className="grid gap-1 text-xs font-bold uppercase">{label}<select className={field} value={value||''} onChange={(e)=>onChange(e.target.value)} required><option value="">Seçin</option>{options?.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>; }
function Metric({label,value}:{label:string;value:string|number}) { return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function n(value?:string){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
function message(error:unknown){return error instanceof Error?error.message:'İşlem başarısız.';}
function rows(tab:string,data:{departments?:Array<{id:number;code:string;name:string;isActive:boolean}>;roles?:Array<{id:number;code:string;name:string;isActive:boolean}>;employees?:Array<{id:number;employeeCode:string;fullName:string;departmentName:string;roleName:string;isActive:boolean}>;matrices?:Array<{id:number;code:string;name:string;ruleCount:number;isActive:boolean}>}) { if(tab==='department')return (data.departments||[]).map(x=>({id:x.id,code:x.code,name:x.name,active:x.isActive})); if(tab==='role')return (data.roles||[]).map(x=>({id:x.id,code:x.code,name:x.name,active:x.isActive})); if(tab==='employee')return (data.employees||[]).map(x=>({id:x.id,code:x.employeeCode,name:`${x.fullName} · ${x.departmentName} / ${x.roleName}`,active:x.isActive})); return (data.matrices||[]).map(x=>({id:x.id,code:x.code,name:`${x.name} · ${x.ruleCount} kural`,active:x.isActive})); }
