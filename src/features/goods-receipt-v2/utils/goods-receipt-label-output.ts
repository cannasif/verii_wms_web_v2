import { code128 } from 'bwip-js/browser';
import type { GoodsReceiptLabelRow } from '../types/goods-receipt.types';

const WIDTH_MM=100,HEIGHT_MM=70,SCALE=10;

export function printableLabels(labels:GoodsReceiptLabelRow[]):GoodsReceiptLabelRow[]{
  return labels.filter(x=>!['Void','Consumed'].includes(x.status));
}

export function printReceiptLabels(labels:GoodsReceiptLabelRow[],title:string):void{
  const rows=printableLabels(labels); if(!rows.length)throw new Error('Yazdırılabilir etiket bulunamadı.');
  const win=window.open('','_blank','noopener,noreferrer'); if(!win)throw new Error('Yazdırma penceresine tarayıcı izin vermedi.');
  const images=rows.map(x=>`<img src="${labelImage(x)}" alt="${escapeHtml(x.stockCode)}"/>`).join('');
  win.document.write(`<html><head><title>${escapeHtml(title)}</title><style>@page{size:${WIDTH_MM}mm ${HEIGHT_MM}mm;margin:0}*{box-sizing:border-box}html,body{margin:0}img{display:block;width:${WIDTH_MM}mm;height:${HEIGHT_MM}mm;page-break-after:always}</style></head><body>${images}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  win.document.close();
}

export async function previewReceiptLabelsPdf(labels:GoodsReceiptLabelRow[],fileName:string):Promise<void>{
  const rows=printableLabels(labels); if(!rows.length)throw new Error('PDF oluşturulabilecek etiket bulunamadı.');
  const win=window.open('','_blank','noopener,noreferrer'); if(!win)throw new Error('PDF önizleme penceresine tarayıcı izin vermedi.');
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:[WIDTH_MM,HEIGHT_MM]});
  rows.forEach((row,index)=>{if(index)pdf.addPage([WIDTH_MM,HEIGHT_MM],'landscape');pdf.addImage(labelImage(row),'PNG',0,0,WIDTH_MM,HEIGHT_MM)});
  const url=URL.createObjectURL(pdf.output('blob')); win.location.replace(url);
  window.setTimeout(()=>URL.revokeObjectURL(url),300_000);
  win.document.title=fileName;
}

function labelImage(label:GoodsReceiptLabelRow):string{
  const canvas=document.createElement('canvas');canvas.width=WIDTH_MM*SCALE;canvas.height=HEIGHT_MM*SCALE;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Etiket çizim alanı oluşturulamadı.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
  ctx.fillStyle='#111';ctx.font='700 32px Arial';ctx.fillText(`${label.stockCode} · ${label.stockName??''}`.slice(0,52),42,62);
  ctx.font='24px Arial';ctx.fillText(`YAP: ${label.yapCode||'—'}`,42,112);ctx.fillText(`Miktar: ${label.quantity} ${label.unitCode}`,560,112);
  ctx.fillText(`Lot: ${label.lotNo||'—'}`,42,158);ctx.fillText(`Seri: ${label.serialNo||'—'}`,500,158);
  const barcode=document.createElement('canvas');code128(barcode,{bcid:'code128',text:label.barcodeValue,scale:3,height:18,includetext:false});
  ctx.drawImage(barcode,42,190,916,330);ctx.font='20px monospace';ctx.textAlign='center';ctx.fillText(label.barcodeValue.slice(0,90),500,570);
  ctx.font='18px Arial';ctx.textAlign='left';ctx.fillText(`Etiket #${label.id}`,42,630);
  return canvas.toDataURL('image/png');
}
function escapeHtml(value:string):string{return value.replace(/[&<>'"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[x]!))}
