import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { code128, datamatrix, gs1_128, qrcode } from 'bwip-js/browser';
import { Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { LabelDocument, LabelElement } from '../types/barcode-designer.types';

export interface BarcodeCanvasHandle { toDataUrl:(pixelRatio?:number)=>string }
interface Props { document:LabelDocument; selectedId:string|null; onSelect:(id:string|null)=>void; onChange:(element:LabelElement)=>void }
const SCALE=4;

export const BarcodeLabelCanvas=forwardRef<BarcodeCanvasHandle,Props>(function BarcodeLabelCanvas({document,selectedId,onSelect,onChange},ref){
  const [stage,setStage]=useState<Konva.Stage|null>(null);
  useImperativeHandle(ref,()=>({toDataUrl:(pixelRatio=3)=>stage?.toDataURL({pixelRatio})??''}),[stage]);
  return <div className="max-w-full overflow-auto rounded-2xl bg-slate-200/80 p-6 dark:bg-slate-950/60">
    <Stage ref={setStage} width={document.canvas.widthMm*SCALE} height={document.canvas.heightMm*SCALE} onMouseDown={(e)=>{if(e.target===e.target.getStage())onSelect(null)}} className="mx-auto shadow-2xl">
      <Layer><Rect x={0} y={0} width={document.canvas.widthMm*SCALE} height={document.canvas.heightMm*SCALE} fill={document.canvas.background}/>
        {document.elements.map(element=><ElementNode key={element.id} element={element} sample={document.sampleData} selected={selectedId===element.id} onSelect={()=>onSelect(element.id)} onChange={onChange}/>)}</Layer>
    </Stage>
  </div>;
});

function ElementNode({element,sample,selected,onSelect,onChange}:{element:LabelElement;sample:Record<string,string>;selected:boolean;onSelect:()=>void;onChange:(e:LabelElement)=>void}){
  const common={x:element.xMm*SCALE,y:element.yMm*SCALE,width:element.widthMm*SCALE,height:element.heightMm*SCALE,draggable:true,onClick:onSelect,onTap:onSelect,onDragEnd:(event:Konva.KonvaEventObject<DragEvent>)=>onChange({...element,xMm:round(event.target.x()/SCALE),yMm:round(event.target.y()/SCALE)})};
  const value=element.binding ? sample[element.binding]??`{{${element.binding}}}` : element.value??element.text??'';
  if(element.type==='rectangle') return <Rect {...common} fill="transparent" stroke={selected?'#06b6d4':'#111827'} strokeWidth={selected?2:Math.max(1,element.strokeWidth??1)} dash={selected?[5,3]:undefined}/>;
  if(element.type==='line') return <Line points={[element.xMm*SCALE,element.yMm*SCALE,(element.xMm+element.widthMm)*SCALE,(element.yMm+element.heightMm)*SCALE]} stroke={selected?'#06b6d4':'#111827'} strokeWidth={selected?3:Math.max(1,element.strokeWidth??1)} draggable onClick={onSelect} onDragEnd={(event)=>{const dx=event.target.x()/SCALE,dy=event.target.y()/SCALE;event.target.position({x:0,y:0});onChange({...element,xMm:round(element.xMm+dx),yMm:round(element.yMm+dy)})}}/>;
  if(element.type==='barcode'||element.type==='qrcode'||element.type==='datamatrix') return <BarcodeNode {...common} element={element} value={value} selected={selected}/>;
  return <Text {...common} text={value} fill="#111827" fontFamily="Arial" fontSize={element.fontSize??12} verticalAlign="middle" stroke={selected?'#06b6d4':undefined} strokeWidth={selected?.35:0}/>;
}

function BarcodeNode({element,value,selected,...common}:{element:LabelElement;value:string;selected:boolean;[key:string]:unknown}){
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  useEffect(()=>{let active=true;try{const canvas=window.document.createElement('canvas');const sym=element.type==='qrcode'?'qrcode':element.type==='datamatrix'?'datamatrix':element.symbology==='gs1-128'?'gs1-128':'code128';const encoder=sym==='qrcode'?qrcode:sym==='datamatrix'?datamatrix:sym==='gs1-128'?gs1_128:code128;encoder(canvas,{bcid:sym,text:value||' ',scale:3,height:Math.max(8,Math.round(element.heightMm/2)),includetext:element.type==='barcode',textxalign:'center'});const next=new window.Image();next.onload=()=>{if(active)setImage(next)};next.src=canvas.toDataURL('image/png')}catch{setImage(null)}return()=>{active=false}},[element.heightMm,element.symbology,element.type,value]);
  return image?<KonvaImage {...common} image={image} stroke={selected?'#06b6d4':undefined} strokeWidth={selected?2:0}/>:<Rect {...common} fill="#fee2e2" stroke="#ef4444"/>;
}
const round=(value:number)=>Math.max(0,Math.round(value*10)/10);
