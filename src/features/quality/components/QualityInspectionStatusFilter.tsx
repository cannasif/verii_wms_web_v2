import { useMemo, type ReactElement } from 'react';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { OpsFieldShell } from '@/components/shared/OpsFieldShell';
import { OPS_FIELD_CLASS } from '@/components/shared/ops-field-styles';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeEnumValue } from '@/lib/enum-localization';
import { cn } from '@/lib/utils';
import {
  isQualityInspectionStatusFilterDefault,
  QUALITY_INSPECTION_STATUS_ALL,
} from '../utils/quality-inspection-list-filters';
import type { QualityInspectionStatusOption } from '../api/quality.api';

export function QualityInspectionStatusFilter({
  value,
  defaultValue,
  statusOptions,
  onChange,
}: {
  value: string;
  defaultValue: string;
  statusOptions: QualityInspectionStatusOption[];
  onChange: (value: string) => void;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('quality');

  const options = useMemo<AppDropdownOption[]>(() => {
    void moduleReady;
    return [
      {
        value: QUALITY_INSPECTION_STATUS_ALL,
        label: t('list.facetAll'),
      },
      ...statusOptions.map((status) => ({
        value: status.value,
        label: localizeEnumValue(status.value),
      })),
    ];
  }, [moduleReady, statusOptions, t]);

  const dirty = !isQualityInspectionStatusFilterDefault(value, defaultValue);

  return (
    <div
      className="wms-ops-gr-list-facets"
      aria-label={t('list.facetFiltersTitle')}
      data-no-auto-localize="true"
    >
      <div className="wms-ops-gr-list-facets__field">
        <span className="wms-ops-gr-list-facets__label">{t('list.facetStatus')}</span>
        <OpsFieldShell className="wms-ops-gr-list-facets__shell">
          <AppDropdown
            value={value}
            onValueChange={onChange}
            options={options}
            ariaLabel={t('list.facetStatus')}
            searchable
            className={cn(OPS_FIELD_CLASS, 'wms-ops-gr-list-facets__control')}
            matchTriggerWidth={false}
            contentClassName="min-w-[14rem]"
          />
        </OpsFieldShell>
      </div>
      {dirty ? (
        <button
          type="button"
          className="wms-ops-gr-list-facets__clear"
          onClick={() => onChange(defaultValue)}
        >
          {t('list.facetClear')}
        </button>
      ) : null}
    </div>
  );
}
