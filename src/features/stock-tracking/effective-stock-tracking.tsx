import { BadgeCheck, CircleSlash2, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { api } from '@/lib/axios';
import { localizeEnumValue } from '@/lib/enum-localization';

export type StockTrackingType = 'None' | 'Lot' | 'Serial' | 'LotAndSerial';

export interface EffectiveStockTrackingPolicy {
  stockId: number;
  stockCode: string;
  stockGroupCode?: string | null;
  trackingType: StockTrackingType;
  requireSerial: boolean;
  serialQuantityRule: 'NotApplicable' | 'OneSerialPerLine' | 'OneSerialPerBaseUnit';
  autoGenerateSerials: boolean;
  requireLot: boolean;
  requireManufacturingDate: boolean;
  requireExpirationDate: boolean;
  minimumRemainingShelfLifeDays?: number | null;
  hasPolicy: boolean;
  source: string;
  policyId?: number | null;
  policyVersion?: number | null;
  policyCode?: string | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function resolveStockTrackingPolicy(
  branchCode: string,
  stockId: number,
): Promise<EffectiveStockTrackingPolicy> {
  const response = await api.get<Envelope<EffectiveStockTrackingPolicy>>(
    '/api/stock-tracking-policies/resolve',
    { params: { branchCode, stockId } },
  );
  if (!response.success) throw new Error(response.message || 'Stok takip politikası alınamadı.');
  return response.data;
}

export function trackingTypeLabel(type: StockTrackingType): string {
  switch (type) {
    case 'Lot': return 'Lot takibi';
    case 'Serial': return 'Seri takibi';
    case 'LotAndSerial': return 'Lot + seri takibi';
    default: return 'Takip yok';
  }
}

export function StockTrackingPolicyField({
  policy,
  loading = false,
}: {
  policy?: EffectiveStockTrackingPolicy;
  loading?: boolean;
}): ReactElement {
  if (loading) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] bg-black/5 px-3 text-sm text-slate-500 dark:bg-white/5">
        <Loader2 className="size-4 animate-spin" /> Takip politikası yükleniyor
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-sm text-amber-600">
        <CircleSlash2 className="size-4" /> Önce stok seçin
      </div>
    );
  }

  const requirements = [
    policy.requireSerial && 'Seri zorunlu',
    policy.serialQuantityRule === 'OneSerialPerBaseUnit' && 'Miktar kadar seri',
    policy.autoGenerateSerials && 'Otomatik seri',
    policy.requireLot && 'Lot zorunlu',
    policy.requireManufacturingDate && 'Üretim tarihi',
    policy.requireExpirationDate && 'SKT',
  ].filter(Boolean);

  return (
    <div className="min-h-11 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-cyan-600 dark:text-cyan-400">
        <BadgeCheck className="size-4 shrink-0" />
        {trackingTypeLabel(policy.trackingType)}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {policy.hasPolicy ? `${policy.policyCode ?? 'Aktif politika'} · ${localizeEnumValue(policy.source)}` : 'Aktif kural yok · sistem varsayılanı'}
        {requirements.length > 0 ? ` · ${requirements.join(' · ')}` : ''}
      </p>
    </div>
  );
}
