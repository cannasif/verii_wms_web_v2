import {InboundProcessHeader} from '@/features/inbound-operations/components/InboundProcessHeader';

const steps=[
  {key:'gate',label:'Araç Kayıtları',description:'Liste, yeni kabul ve güncelleme',href:'/warehouse/goods-receipts/steel/vehicle-check-ins'},
  {key:'plan',label:'Beklenti Planı',description:'Excel önizleme ve doğrulama',href:'/warehouse/goods-receipts/steel/import'},
  {key:'inspection',label:'Kalite Kontrol',description:'Levha bazında kabul ve ret',href:'/warehouse/goods-receipts/steel/inspection'},
  {key:'receipt',label:'Mal Kabul Emri',description:'Emre dönüştürme ve atama',href:'/warehouse/goods-receipts/steel/receipt'},
  {key:'placement',label:'Raf Yerleştirme',description:'Stok hareketi ve konum',href:'/warehouse/goods-receipts/steel/placement'},
];

export function SteelProcessHeader({currentStep,title,description,notice}:{currentStep:string;title:string;description:string;notice?:string}){
  return <InboundProcessHeader eyebrow="Mal Kabul · SAC İşlemleri" title={title} description={description} steps={steps} currentStep={currentStep} notice={notice}/>;
}
