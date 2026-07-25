import {ArrowRight,ClipboardList,PackageCheck,PackagePlus,Rows3,Settings2,UserCheck,UsersRound} from 'lucide-react';
import {Link} from 'react-router-dom';

const phases=[
  {number:'01',title:'Kabulü Başlat',description:'Belgenin kaynağına ve operasyon şekline göre doğru başlangıcı seçin.',items:[
    {title:'Siparişten Emir',description:'Netsis satınalma siparişlerini seçin, açık miktarları rezerve edip görev oluşturun.',href:'/warehouse/warehouse-inbounds/new',icon:ClipboardList},
    {title:'Siparişsiz Emir',description:'İrsaliye ve stok satırlarıyla sipariş bağlantısız planlı görev açın.',href:'/warehouse/warehouse-inbounds/orderless',icon:PackagePlus},
    {title:'Doğrudan Mal Kabul',description:'Emirsiz kabulü kalite, karantina ve stok hareketiyle atomik kaydedin.',href:'/warehouse/warehouse-inbounds/direct',icon:PackageCheck},
  ]},
  {number:'02',title:'Emri Yürüt',description:'Sorumluları belirleyin, atanan işleri alın ve fiziksel ilerlemeyi yönetin.',items:[
    {title:'Emir Yönetimi',description:'Açık emirleri bir veya birden çok kullanıcıya atayın ve ilerlemeyi izleyin.',href:'/warehouse/warehouse-inbounds/tasks',icon:UsersRound},
    {title:'Bana Atanan Emirler',description:'Size atanmış emirleri kabul edin, başlatın ve operasyonu tamamlayın.',href:'/warehouse/warehouse-inbounds/assigned',icon:UserCheck},
  ]},
  {number:'03',title:'İzle ve Yönet',description:'Tam izlenebilirlik ve parametrik süreç yönetimi için kayıtları ve kuralları kullanın.',items:[
    {title:'Mal Kabul Kayıtları',description:'Tüm işlem tiplerini ortak sunucu taraflı grid üzerinde izleyin.',href:'/warehouse/warehouse-inbounds/list',icon:Rows3},
    {title:'Süreç Ayarları',description:'Fazla/eksik kabul, kalite bekletme, onay ve ERP aktarım politikalarını yönetin.',href:'/warehouse/warehouse-inbound-settings',icon:Settings2},
  ]},
];

export function WarehouseInboundHubPage(){
  return <section className="space-y-6">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-500">Depo Operasyonları</p><h1 className="mt-1 text-3xl font-black">Mal Kabul Süreç Merkezi</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">Siparişli, siparişsiz ve doğrudan kabulü aynı domain kurallarıyla başlatın; emirden kalite ve stok hareketine kadar izleyin.</p></header>
    {phases.map(phase=><section key={phase.number} className="space-y-3"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 font-black text-cyan-500">{phase.number}</span><div><h2 className="text-lg font-black">{phase.title}</h2><p className="text-sm text-slate-500">{phase.description}</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{phase.items.map(({title,description,href,icon:Icon})=><Link key={href} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 transition hover:-translate-y-0.5 hover:border-cyan-500/50"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"><Icon className="size-5"/></div><ArrowRight className="size-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-500"/></div><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></Link>)}</div></section>)}
  </section>;
}
