import type { ReactElement, ReactNode } from 'react';
import { ClipboardList, PackageOpen, UserRoundCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OperationSourceMode = 'order' | 'stock';
export type OperationExecutionMode = 'task' | 'direct';

type Props = {
  source: OperationSourceMode;
  execution: OperationExecutionMode;
  onSourceChange: (value: OperationSourceMode) => void;
  onExecutionChange: (value: OperationExecutionMode) => void;
  isAllowed?: (source: OperationSourceMode, execution: OperationExecutionMode) => boolean;
  orderLabel?: string;
  stockLabel?: string;
  taskDescription?: string;
  directDescription?: string;
  accent?: 'cyan' | 'violet';
  children?: ReactNode;
};

export function OperationFlowTabs({
  source,
  execution,
  onSourceChange,
  onExecutionChange,
  isAllowed = () => true,
  orderLabel = 'Siparişe istinaden',
  stockLabel = 'Siparişsiz / serbest stoktan',
  taskDescription = 'Operasyon emri oluşturulur, kullanıcı atanır ve saha ilerlemesi izlenir.',
  directDescription = 'Görev oluşturmadan yetkili kullanıcı tarafından doğrudan işlenir.',
  accent = 'cyan',
  children,
}: Props): ReactElement {
  const tone = accent === 'violet' ? 'violet' : 'cyan';
  const executions: Array<{ value: OperationExecutionMode; title: string; description: string; icon: typeof UserRoundCheck }> = [
    { value: 'task', title: 'Emirli İşlem', description: taskDescription, icon: UserRoundCheck },
    { value: 'direct', title: 'Emirsiz İşlem', description: directDescription, icon: Zap },
  ];
  const sources: Array<{ value: OperationSourceMode; title: string; description: string; icon: typeof ClipboardList }> = [
    { value: 'order', title: orderLabel, description: 'ERP belgesi ve açık miktarlar ile izlenebilir bağlantı kurar.', icon: ClipboardList },
    { value: 'stock', title: stockLabel, description: 'Stok, miktar, depo ve raf bilgileri kullanıcı tarafından belirlenir.', icon: PackageOpen },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm">
      <div className="border-b border-[var(--wms-app-border)] p-4 sm:p-5">
        <p className="text-[0.68rem] font-black uppercase tracking-[.18em] text-slate-500">01 · Yürütme Modeli</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Emir yürütme modeli">
          {executions.map(({ value, title, description, icon: Icon }) => {
            const active = execution === value;
            const hasAnyAllowedSource = isAllowed('order', value) || isAllowed('stock', value);
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!hasAnyAllowedSource}
                onClick={() => onExecutionChange(value)}
                className={cn(
                  'min-h-24 rounded-xl border p-3 text-left transition sm:p-4',
                  active
                    ? tone === 'violet'
                      ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,.12)]'
                      : 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(6,182,212,.12)]'
                    : 'border-[var(--wms-app-border)] hover:border-slate-400/70 hover:bg-black/[.025] dark:hover:bg-white/[.035]',
                  !hasAnyAllowedSource && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-center gap-2 font-black"><Icon className="size-4.5"/>{title}</span>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">{description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-[0.68rem] font-black uppercase tracking-[.18em] text-slate-500">02 · Belge Kaynağı</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Operasyon belge kaynağı">
          {sources.map(({ value, title, description, icon: Icon }) => {
            const active = source === value;
            const allowed = isAllowed(value, execution);
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!allowed}
                onClick={() => onSourceChange(value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition sm:p-4',
                  active
                    ? tone === 'violet'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-cyan-500 bg-cyan-500/10'
                    : 'border-[var(--wms-app-border)] hover:border-slate-400/70',
                  !allowed && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-center gap-2 font-bold"><Icon className="size-4"/>{title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{allowed ? description : 'Bu kombinasyon süreç politikasında kapalı.'}</span>
              </button>
            );
          })}
        </div>
        {children && <div className={cn('mt-4 rounded-xl border p-3 text-xs leading-5', tone === 'violet' ? 'border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-300' : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300')}>{children}</div>}
      </div>
    </section>
  );
}
