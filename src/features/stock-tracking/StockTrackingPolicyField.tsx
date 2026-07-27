import { BadgeCheck, CircleSlash2, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeEnumValue } from '@/lib/enum-localization';
import {
  trackingTypeLabel,
  type EffectiveStockTrackingPolicy,
} from './effective-stock-tracking.service';

const ST = 'stockTrackingPolicyField';

export function StockTrackingPolicyField({
  policy,
  loading = false,
}: {
  policy?: EffectiveStockTrackingPolicy;
  loading?: boolean;
}): ReactElement {
  const { t } = useTranslation('common');

  if (loading) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] bg-black/5 px-3 text-sm text-slate-500 dark:bg-white/5" data-no-auto-localize="true">
        <Loader2 className="size-4 animate-spin" /> {t(`${ST}.loading`)}
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-sm text-amber-600" data-no-auto-localize="true">
        <CircleSlash2 className="size-4" /> {t(`${ST}.selectStockFirst`)}
      </div>
    );
  }

  const requirements = [
    policy.requireSerial && t(`${ST}.requireSerial`),
    policy.serialQuantityRule === 'OneSerialPerBaseUnit' && t(`${ST}.oneSerialPerUnit`),
    policy.autoGenerateSerials && t(`${ST}.autoGenerateSerials`),
    policy.requireLot && t(`${ST}.requireLot`),
    policy.requireManufacturingDate && t(`${ST}.manufacturingDate`),
    policy.requireExpirationDate && t(`${ST}.expirationDate`),
  ].filter(Boolean);

  return (
    <div className="min-h-11 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm" data-no-auto-localize="true">
      <div className="flex items-center gap-2 font-semibold text-cyan-600 dark:text-cyan-400">
        <BadgeCheck className="size-4 shrink-0" />
        {trackingTypeLabel(policy.trackingType)}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {policy.hasPolicy
          ? `${policy.policyCode ?? t(`${ST}.activePolicy`)} · ${localizeEnumValue(policy.source)}`
          : t(`${ST}.noActiveRule`)}
        {requirements.length > 0 ? ` · ${requirements.join(' · ')}` : ''}
      </p>
    </div>
  );
}
