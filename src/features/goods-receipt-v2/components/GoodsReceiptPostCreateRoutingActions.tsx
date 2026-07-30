import { useState, type ReactElement } from 'react';
import { ArrowRightLeft, Loader2, PackageMinus } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type { GoodsReceiptDetail, GoodsReceiptSplitRoutingResult } from '../types/goods-receipt.types';
import { GoodsReceiptRoutingDialog } from './GoodsReceiptRoutingDialog';

type RouteKind = 'transfer' | 'outbound';

export function GoodsReceiptPostCreateRoutingActions({
  goodsReceiptId,
  transferLabel = 'Depo Transferi',
  outboundLabel = 'Ambar Çıkış',
  onCompleted,
}: {
  goodsReceiptId: number;
  transferLabel?: string;
  outboundLabel?: string;
  onCompleted?: (result: GoodsReceiptSplitRoutingResult) => void | Promise<void>;
}): ReactElement {
  const [busyKind, setBusyKind] = useState<RouteKind | null>(null);
  const [routeKind, setRouteKind] = useState<RouteKind | null>(null);
  const [detail, setDetail] = useState<GoodsReceiptDetail | null>(null);

  const openRoute = async (kind: RouteKind) => {
    setBusyKind(kind);
    try {
      const loaded = await goodsReceiptV2Api.detail(goodsReceiptId);
      setDetail(loaded);
      setRouteKind(kind);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Mal kabul detayı açılamadı.',
      );
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <>
      <OpsActionButton
        type="button"
        variant="secondary"
        disabled={busyKind !== null}
        onClick={() => void openRoute('transfer')}
      >
        {busyKind === 'transfer' ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <ArrowRightLeft className="size-3.5 shrink-0" />
        )}
        {transferLabel}
      </OpsActionButton>
      <OpsActionButton
        type="button"
        variant="secondary"
        disabled={busyKind !== null}
        onClick={() => void openRoute('outbound')}
      >
        {busyKind === 'outbound' ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <PackageMinus className="size-3.5 shrink-0" />
        )}
        {outboundLabel}
      </OpsActionButton>

      {routeKind && detail ? (
        <GoodsReceiptRoutingDialog
          detail={detail}
          initialKind={routeKind}
          onClose={() => {
            setRouteKind(null);
            setDetail(null);
          }}
          onCompleted={async (result) => {
            setRouteKind(null);
            setDetail(null);
            await onCompleted?.(result);
          }}
        />
      ) : null}
    </>
  );
}
