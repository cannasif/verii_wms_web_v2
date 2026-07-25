import {ArrowRight,CarFront,ClipboardCheck,FileSpreadsheet,Layers3,Rows3,Truck} from 'lucide-react';
import {Link} from 'react-router-dom';

const phases=[
  {number:'01',title:'Kapı ve Beklenti',description:'Araç, şoför, tedarikçi ve beklenen levha verisini operasyondan önce doğrulayın.',items:[
    {title:'Araç Giriş İşlemi',text:'Çekici/dorse, şoför, nakliyeci ve saha görsellerini kaydedin.',href:'/warehouse/goods-receipts/steel/vehicle-check-in',icon:CarFront},
    {title:'Araç Giriş Kayıtları',text:'Kapı kayıtlarını sunucu taraflı listede izleyin ve güncelleyin.',href:'/warehouse/goods-receipts/steel/vehicle-check-ins',icon:Truck},
    {title:'Beklenti Aktarımı',text:'Excel’i önizleyin, doğrulayın ve DCode ile idempotent kaydedin.',href:'/warehouse/goods-receipts/steel/import',icon:FileSpreadsheet},
    {title:'SAC Planları',text:'Aktarım partilerini ve süreç durumlarını izleyin.',href:'/warehouse/goods-receipts/steel/plans',icon:Rows3},
  ]},
  {number:'02',title:'Kontrol ve Karar',description:'Her levhanın fiziksel varışını, miktarını ve kalite kararını kanıtlarıyla kaydedin.',items:[
    {title:'Varış ve Kalite Kontrolü',text:'Geldi/eksik, kabul, kısmi kabul ve ret kararlarını yönetin.',href:'/warehouse/goods-receipts/steel/inspection',icon:ClipboardCheck},
  ]},
  {number:'03',title:'Kabul ve Yerleştirme',description:'Onaylı levhaları emre dönüştürün; fiziksel kabul sonrası stok hareketiyle rafa alın.',items:[
    {title:'Mal Kabul Emri',text:'Onaylı levhaları ortak emre aktarın ve sorumlulara atayın.',href:'/warehouse/goods-receipts/steel/receipt',icon:Layers3},
    {title:'Saha / Raf Yerleştirme',text:'Raf doluluğunu görerek nihai konumu ve istif sırasını kaydedin.',href:'/warehouse/goods-receipts/steel/placement',icon:Layers3},
  ]},
];

export function SteelReceiptHubPage(){
  return <section className="space-y-6">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-500">Mal Kabul · SAC İşlemleri</p>
      <h1 className="mt-1 text-3xl font-black">SAC Mal Kabul Süreç Merkezi</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">Kapı girişinden kalite kararına, ortak mal kabul emrinden nihai raf yerleşimine kadar her levhayı DCode üzerinden izleyin.</p>
    </header>
    {phases.map(phase=><section key={phase.number} className="space-y-3">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/15 font-black text-cyan-500">{phase.number}</span><div><h2 className="text-lg font-black">{phase.title}</h2><p className="text-sm text-slate-500">{phase.description}</p></div></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{phase.items.map(({title,text,href,icon:Icon})=><Link key={href} to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-500/50"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"><Icon className="size-5"/></span><ArrowRight className="size-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-500"/></div><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></Link>)}</div>
    </section>)}
  </section>;
}
