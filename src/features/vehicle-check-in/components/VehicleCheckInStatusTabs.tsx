import type {ReactElement} from 'react';
import {useTranslation} from 'react-i18next';
import {cn} from '@/lib/utils';
import {
  VEHICLE_CHECK_IN_STATUS_TAB_ALL,
  VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN,
  type VehicleCheckInStatusTab,
} from '../utils/vehicle-check-in-list-filters';

const G='dataGrid.sacVehicleCheckIns';

export function VehicleCheckInStatusTabs({
  value,
  onChange,
}: {
  value: VehicleCheckInStatusTab;
  onChange: (value: VehicleCheckInStatusTab) => void;
}): ReactElement {
  const {t}=useTranslation('common');
  const tabs=[
    {id: VEHICLE_CHECK_IN_STATUS_TAB_ALL, label: t(`${G}.tabAll`, {defaultValue: 'Tümü'})},
    {id: VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN, label: t(`${G}.tabUnknown`, {defaultValue: 'Bilinmeyen'})},
  ] as const;

  return (
    <div
      className="inline-grid w-[12.5rem] shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]"
      role="tablist"
      aria-label={t(`${G}.statusTabs`, {defaultValue: 'Durum sekmeleri'})}
      data-no-auto-localize="true"
    >
      {tabs.map(tab=>(
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value===tab.id}
          onClick={()=>onChange(tab.id)}
          className={cn(
            'min-h-9 px-3 text-center text-xs font-bold tracking-wide transition',
            'border-r border-[var(--wms-app-border)] last:border-r-0',
            value===tab.id
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
              : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
