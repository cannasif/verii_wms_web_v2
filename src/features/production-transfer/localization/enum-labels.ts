import type { TFunction } from 'i18next';
import i18n, { normalizeLanguage } from '@/lib/i18n';
import { localizeEnumValue } from '@/lib/enum-localization';

export type ProductionTransferEnumGroup =
  | 'transferStatus'
  | 'workflowStatus'
  | 'taskStatus'
  | 'lineStatus'
  | 'taskType';

const ENUM_LABEL_MISSING = '__MISSING__';

export function productionTransferEnumLabel(
  t: TFunction,
  group: ProductionTransferEnumGroup,
  value?: string | null,
): string {
  if (!value) return '—';
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const translated = t(`enums.${group}.${value}`, { defaultValue: ENUM_LABEL_MISSING });
  if (translated !== ENUM_LABEL_MISSING) return String(translated);
  return localizeEnumValue(value, language);
}
