import { BadgeCheck, CircleSlash2, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeEnumValue } from '@/lib/enum-localization';
import type { EffectiveStockTrackingPolicy } from './effective-stock-tracking.service';

const ST = 'stockTrackingPolicyField';

export function StockTrackingPolicyField({
  policy,
  loading = false,
  compact = false,
  badge = false,
}: {
  policy?: EffectiveStockTrackingPolicy;
  loading?: boolean;
  /** Inline under inputs — no heavy card chrome. */
  compact?: boolean;
  /** Tek satırlık rozet — kart başlıklarında stok adının yanına sığar, detay tooltip'te. */
  badge?: boolean;
}): ReactElement {
  const { t } = useTranslation('common');

  if (loading) {
    if (badge) {
      return (
        <span className="wms-ops-track-badge" data-tracking="loading" data-no-auto-localize="true">
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          <span>{t(`${ST}.loading`)}</span>
        </span>
      );
    }
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-[0.7rem] text-slate-500" data-no-auto-localize="true">
          <Loader2 className="size-3 animate-spin" /> {t(`${ST}.loading`)}
        </div>
      );
    }
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] bg-black/5 px-3 text-sm text-slate-500 dark:bg-white/5" data-no-auto-localize="true">
        <Loader2 className="size-4 animate-spin" /> {t(`${ST}.loading`)}
      </div>
    );
  }

  if (!policy) {
    if (badge) {
      return (
        <span className="wms-ops-track-badge" data-tracking="unknown" data-no-auto-localize="true">
          <CircleSlash2 className="size-3 shrink-0" aria-hidden />
          <span>{t(`${ST}.selectStockFirst`)}</span>
        </span>
      );
    }
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-[0.7rem] text-amber-600/90" data-no-auto-localize="true">
          <CircleSlash2 className="size-3 shrink-0" /> {t(`${ST}.selectStockFirst`)}
        </div>
      );
    }
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-sm text-amber-600" data-no-auto-localize="true">
        <CircleSlash2 className="size-4" /> {t(`${ST}.selectStockFirst`)}
      </div>
    );
  }

  const trackingTypeText = (() => {
    switch (policy.trackingType) {
      case 'Lot':
        return t(`${ST}.trackingTypes.lot`);
      case 'Serial':
        return t(`${ST}.trackingTypes.serial`);
      case 'LotAndSerial':
        return t(`${ST}.trackingTypes.lotAndSerial`);
      default:
        return t(`${ST}.trackingTypes.none`);
    }
  })();

  const requirements = [
    policy.requireSerial && t(`${ST}.requireSerial`),
    policy.serialQuantityRule === 'OneSerialPerBaseUnit' && t(`${ST}.oneSerialPerUnit`),
    policy.autoGenerateSerials && t(`${ST}.autoGenerateSerials`),
    policy.requireLot && t(`${ST}.requireLot`),
    policy.requireManufacturingDate && t(`${ST}.manufacturingDate`),
    policy.requireExpirationDate && t(`${ST}.expirationDate`),
  ].filter(Boolean);

  const detail = policy.hasPolicy
    ? `${policy.policyCode ?? t(`${ST}.activePolicy`)} · ${localizeEnumValue(policy.source)}`
    : t(`${ST}.noActiveRule`);

  if (badge) {
    return (
      <span
        className="wms-ops-track-badge"
        data-tracking={policy.trackingType}
        data-no-auto-localize="true"
      >
        <BadgeCheck className="size-3 shrink-0" aria-hidden />
        <span className="wms-ops-track-badge__type">{trackingTypeText}</span>
        <span className="wms-ops-track-badge__detail">
          {[detail, ...requirements].join(' · ')}
        </span>
      </span>
    );
  }

  if (compact) {
    return (
      <div
        className="wms-ops-tracking-hint flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.7rem] leading-snug"
        data-no-auto-localize="true"
      >
        <BadgeCheck className="size-3 shrink-0 text-cyan-500" aria-hidden />
        <span className="font-semibold text-cyan-600/90 dark:text-cyan-400/90">
          {trackingTypeText}
        </span>
        <span className="text-slate-500">{detail}</span>
        {requirements.length > 0 ? (
          <span className="text-slate-500">· {requirements.join(' · ')}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-11 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm" data-no-auto-localize="true">
      <div className="flex items-center gap-2 font-semibold text-cyan-600 dark:text-cyan-400">
        <BadgeCheck className="size-4 shrink-0" />
        {trackingTypeText}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {detail}
        {requirements.length > 0 ? ` · ${requirements.join(' · ')}` : ''}
      </p>
    </div>
  );
}
