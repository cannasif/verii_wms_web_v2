import { useCallback, useId, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { ClipboardList, Info, Lock, PackageOpen, UserRoundCheck, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type OperationSourceMode = 'order' | 'stock';
export type OperationExecutionMode = 'task' | 'direct';

const OF = 'transferDraft.operationFlow';

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
  hiddenExecutions?: OperationExecutionMode[];
  hideExecutionSection?: boolean;
  hideSourceSection?: boolean;
  accent?: 'cyan' | 'violet';
  children?: ReactNode;
};

type FlowTab<TValue extends string> = {
  value: TValue;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  allowed: boolean;
};

export function OperationFlowTabs({
  source,
  execution,
  onSourceChange,
  onExecutionChange,
  isAllowed = () => true,
  orderLabel,
  stockLabel,
  taskDescription,
  directDescription,
  hiddenExecutions = [],
  hideExecutionSection = false,
  hideSourceSection = false,
  children,
}: Props): ReactElement {
  const { t } = useTranslation('common');
  const showExecutionSection = !hideExecutionSection;
  const showSourceSection = !hideSourceSection;
  const allExecutionTabs: Array<FlowTab<OperationExecutionMode>> = [
    {
      value: 'task',
      title: t(`${OF}.taskBased`),
      description: taskDescription ?? t(`${OF}.taskDescription`),
      icon: UserRoundCheck,
      allowed: isAllowed('order', 'task') || isAllowed('stock', 'task'),
    },
    {
      value: 'direct',
      title: t(`${OF}.direct`),
      description: directDescription ?? t(`${OF}.directDescription`),
      icon: Zap,
      allowed: isAllowed('order', 'direct') || isAllowed('stock', 'direct'),
    },
  ];
  const executionTabs = allExecutionTabs.filter((tab) => !hiddenExecutions.includes(tab.value));
  const sourceTabs: Array<FlowTab<OperationSourceMode>> = [
    {
      value: 'order',
      title: orderLabel ?? t('transferDraft.sourceLabels.warehouseOrder'),
      description: t(`${OF}.orderSourceDescription`),
      icon: ClipboardList,
      allowed: isAllowed('order', execution),
    },
    {
      value: 'stock',
      title: stockLabel ?? t('transferDraft.sourceLabels.warehouseStock'),
      description: t(`${OF}.stockSourceDescription`),
      icon: PackageOpen,
      allowed: isAllowed('stock', execution),
    },
  ];

  return (
    <section className="wms-ops-flow" data-no-auto-localize="true">
      {showExecutionSection ? (
        <FlowTabGroup
          label={t(`${OF}.executionModel`)}
          ariaLabel={t(`${OF}.executionAriaLabel`)}
          tabs={executionTabs}
          value={execution}
          onChange={onExecutionChange}
          disabledHint={t(`${OF}.combinationDisabled`)}
        />
      ) : null}
      {showSourceSection ? (
        <FlowTabGroup
          label={showExecutionSection ? t(`${OF}.documentSource`) : t(`${OF}.documentSourceStandalone`)}
          ariaLabel={t(`${OF}.sourceAriaLabel`)}
          tabs={sourceTabs}
          value={source}
          onChange={onSourceChange}
          disabledHint={t(`${OF}.combinationDisabled`)}
        />
      ) : null}
      {children ? (
        <p className="wms-ops-flow__note">
          <Info className="wms-ops-flow__note-icon size-3.5" aria-hidden />
          <span className="min-w-0">{children}</span>
        </p>
      ) : null}
    </section>
  );
}

function FlowTabGroup<TValue extends string>({
  label,
  ariaLabel,
  tabs,
  value,
  onChange,
  disabledHint,
}: {
  label: string;
  ariaLabel: string;
  tabs: Array<FlowTab<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  disabledHint: string;
}): ReactElement {
  const groupId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );

  /** Tablist klavye sözleşmesi: yön tuşları yalnızca seçilebilir sekmelerde dolaşır. */
  const moveFocus = useCallback(
    (from: number, step: 1 | -1) => {
      for (let offset = 1; offset <= tabs.length; offset += 1) {
        const next = (from + step * offset + tabs.length * offset) % tabs.length;
        if (!tabs[next]?.allowed) continue;
        buttonsRef.current[next]?.focus();
        onChange(tabs[next].value);
        return;
      }
    },
    [onChange, tabs],
  );

  return (
    <div className="wms-ops-flow__group">
      <p className="wms-ops-flow__label">{label}</p>
      <div
        className="wms-ops-flow__tabs"
        role="tablist"
        aria-label={ariaLabel}
        style={{ '--flow-tab-count': tabs.length, '--flow-tab-index': activeIndex } as CSSProperties}
      >
        <span className="wms-ops-flow__indicator" aria-hidden />
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${groupId}-tab-${tab.value}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              disabled={!tab.allowed}
              title={tab.allowed ? tab.title : `${tab.title} — ${disabledHint}`}
              data-state={active ? 'active' : 'inactive'}
              onClick={() => onChange(tab.value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                moveFocus(index, event.key === 'ArrowRight' ? 1 : -1);
              }}
              className={cn('wms-ops-flow__tab', !tab.allowed && 'wms-ops-flow__tab--locked')}
            >
              <span className="wms-ops-flow__tab-head">
                <Icon className="wms-ops-flow__tab-icon size-4" aria-hidden />
                <span className="wms-ops-flow__tab-title">{tab.title}</span>
                {tab.allowed ? null : <Lock className="wms-ops-flow__tab-lock size-3" aria-hidden />}
              </span>
              <span className="wms-ops-flow__tab-desc">
                {tab.allowed ? tab.description : disabledHint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
