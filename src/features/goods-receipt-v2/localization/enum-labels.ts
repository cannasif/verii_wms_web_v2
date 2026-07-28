import type { TFunction } from 'i18next';
import i18n, { normalizeLanguage } from '@/lib/i18n';
import { localizeEnumValue } from '@/lib/enum-localization';

export type GoodsReceiptEnumGroup =
  | 'operationStatus'
  | 'approvalStatus'
  | 'qualityStatus'
  | 'putawayStatus'
  | 'erpStatus'
  | 'lineStatus'
  | 'taskStatus'
  | 'assignmentStatus'
  | 'labelBatchStatus'
  | 'labelStatus'
  | 'processType'
  | 'initiationMode'
  | 'executionMode';

/**
 * Keeps API enum values stable while resolving their user-facing label from
 * the Goods Receipt module namespace. Unknown future values remain visible
 * instead of rendering an empty label.
 */
export function goodsReceiptEnumLabel(
  t: TFunction,
  group: GoodsReceiptEnumGroup,
  value?: string | null,
): string {
  if (!value) return '—';
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  if (language !== 'tr' && language !== 'en') {
    return localizeEnumValue(value, language);
  }
  return String(t(`enums.${group}.${value}`, { defaultValue: value }));
}

/** Longer hover hint for compact list badges (falls back to the short label). */
export function goodsReceiptEnumHint(
  t: TFunction,
  group: GoodsReceiptEnumGroup,
  value?: string | null,
): string {
  if (!value) return '';
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  if (language !== 'tr' && language !== 'en') {
    return localizeEnumValue(value, language);
  }
  const hint = t(`enums.${group}Hint.${value}`, { defaultValue: '' });
  if (hint) return String(hint);
  return goodsReceiptEnumLabel(t, group, value);
}
