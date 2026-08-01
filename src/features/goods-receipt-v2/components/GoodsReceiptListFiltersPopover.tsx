import { useMemo, type ReactElement } from 'react';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { OpsFieldShell } from '@/components/shared/OpsFieldShell';
import { OPS_FIELD_CLASS } from '@/components/shared/ops-field-styles';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { cn } from '@/lib/utils';
import { goodsReceiptEnumLabel } from '../localization/enum-labels';
import {
  countGoodsReceiptListFacets,
  EMPTY_GOODS_RECEIPT_LIST_FACETS,
  GOODS_RECEIPT_ERP_OPTIONS,
  GOODS_RECEIPT_PROCESS_TYPE_OPTIONS,
  GOODS_RECEIPT_QUALITY_OPTIONS,
  GOODS_RECEIPT_STATUS_OPTIONS,
  setGoodsReceiptFacetValue,
  type GoodsReceiptListFacetKey,
  type GoodsReceiptListFacets,
} from '../utils/goods-receipt-list-filters';

/** Boş string AppDropdown’da sorun çıkarabildiği için “Tümü” sentinel. */
const ALL_VALUE = '__all__';

type FacetField = {
  key: GoodsReceiptListFacetKey;
  titleKey: string;
  enumGroup: 'operationStatus' | 'qualityStatus' | 'erpStatus' | 'processType';
  options: readonly string[];
};

const FIELDS: FacetField[] = [
  {
    key: 'status',
    titleKey: 'list.facetStatus',
    enumGroup: 'operationStatus',
    options: GOODS_RECEIPT_STATUS_OPTIONS,
  },
  {
    key: 'qualityStatus',
    titleKey: 'list.facetQuality',
    enumGroup: 'qualityStatus',
    options: GOODS_RECEIPT_QUALITY_OPTIONS,
  },
  {
    key: 'erpIntegrationStatus',
    titleKey: 'list.facetErp',
    enumGroup: 'erpStatus',
    options: GOODS_RECEIPT_ERP_OPTIONS,
  },
  {
    key: 'processType',
    titleKey: 'list.facetProcessType',
    enumGroup: 'processType',
    options: GOODS_RECEIPT_PROCESS_TYPE_OPTIONS,
  },
];

export function GoodsReceiptListFiltersPopover({
  facets,
  onFacetsChange,
}: {
  facets: GoodsReceiptListFacets;
  onFacetsChange: (facets: GoodsReceiptListFacets) => void;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const appliedCount = useMemo(() => countGoodsReceiptListFacets(facets), [facets]);

  const optionsByKey = useMemo(() => {
    void moduleReady;
    const allLabel = t('list.facetAll');
    const map = {} as Record<GoodsReceiptListFacetKey, AppDropdownOption[]>;
    for (const field of FIELDS) {
      map[field.key] = [
        { value: ALL_VALUE, label: allLabel },
        ...field.options.map((value) => ({
          value,
          label: goodsReceiptEnumLabel(t, field.enumGroup, value),
        })),
      ];
    }
    return map;
  }, [moduleReady, t]);

  return (
    <div
      className="wms-ops-gr-list-facets"
      aria-label={t('list.facetFiltersTitle')}
      data-no-auto-localize="true"
    >
      {FIELDS.map((field) => {
        const stored = facets[field.key];
        const value = stored ? stored : ALL_VALUE;
        return (
          <div key={field.key} className="wms-ops-gr-list-facets__field">
            <span className="wms-ops-gr-list-facets__label">{t(field.titleKey)}</span>
            <OpsFieldShell className="wms-ops-gr-list-facets__shell">
              <AppDropdown
                value={value}
                onValueChange={(next) => {
                  onFacetsChange(
                    setGoodsReceiptFacetValue(
                      facets,
                      field.key,
                      next === ALL_VALUE ? '' : next,
                    ),
                  );
                }}
                options={optionsByKey[field.key]}
                ariaLabel={t(field.titleKey)}
                searchable={field.options.length > 6}
                className={cn(OPS_FIELD_CLASS, 'wms-ops-gr-list-facets__control')}
                matchTriggerWidth={false}
                contentClassName="min-w-[12rem]"
              />
            </OpsFieldShell>
          </div>
        );
      })}
      {appliedCount > 0 ? (
        <button
          type="button"
          className="wms-ops-gr-list-facets__clear"
          onClick={() => onFacetsChange(EMPTY_GOODS_RECEIPT_LIST_FACETS)}
        >
          {t('list.facetClear')}
        </button>
      ) : null}
    </div>
  );
}
