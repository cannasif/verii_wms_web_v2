import {Check,ChevronRight,Info} from 'lucide-react';
import {Link} from 'react-router-dom';

export type InboundProcessStep={
  key:string;
  label:string;
  description:string;
  href:string;
};

type Props={
  eyebrow:string;
  title:string;
  description:string;
  steps:InboundProcessStep[];
  currentStep:string;
  completedSteps?:string[];
  notice?:string;
};

export function InboundProcessHeader({eyebrow,title,description,steps,currentStep,completedSteps=[],notice}:Props){
  const currentIndex=Math.max(0,steps.findIndex(step=>step.key===currentStep));
  const completedStepKeys=new Set(completedSteps);
  return <header className="overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm">
    <div className="border-b border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 px-4 py-5 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-500">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
    <nav aria-label="Süreç adımları" className="overflow-x-auto px-3 py-3 sm:px-5">
      <ol className="flex min-w-max items-stretch gap-2">
        {steps.map((step,index)=>{
          const active=index===currentIndex;
          const completed=completedStepKeys.has(step.key);
          return <li key={step.key} className="flex items-center">
            <Link to={step.href} aria-current={active?'step':undefined} className={`group flex min-w-44 items-center gap-3 rounded-xl border px-3 py-2.5 transition ${active?'border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(6,182,212,.12)]':completed?'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60':'border-transparent hover:border-[var(--wms-app-border)] hover:bg-white/5'}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${active?'bg-cyan-500 text-slate-950':completed?'bg-emerald-500/15 text-emerald-500':'bg-slate-500/10 text-slate-500'}`}>{completed?<Check className="size-4"/>:index+1}</span>
              <span><strong className="block text-sm">{step.label}</strong><small className="block max-w-36 truncate text-[11px] text-slate-500">{step.description}</small></span>
            </Link>
            {index<steps.length-1&&<ChevronRight className="mx-1 size-4 shrink-0 text-slate-600"/>}
          </li>;
        })}
      </ol>
    </nav>
    {notice&&<div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs leading-5 text-amber-200 sm:mx-5"><Info className="mt-0.5 size-4 shrink-0 text-amber-500"/><span>{notice}</span></div>}
  </header>;
}
