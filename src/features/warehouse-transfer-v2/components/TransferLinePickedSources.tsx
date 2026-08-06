import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { formatProjectNumber } from '@/lib/project-format';
import { productionTransferApi } from '@/features/production-transfer/api';
import type { WarehouseTransferPickedSourceLocation } from '../types/warehouse-transfer.types';

interface Props {
  transferId: number;
  lineId: number;
  inlineSources?: WarehouseTransferPickedSourceLocation[];
}

export function TransferLinePickedSources({ transferId, lineId, inlineSources }: Props): ReactElement | null {
  const query = useQuery({
    queryKey: ['production-transfer', 'picked-sources', transferId, lineId],
    queryFn: () => productionTransferApi.linePickedSources(transferId, lineId),
    enabled: !inlineSources?.length && transferId > 0 && lineId > 0,
    staleTime: 15_000,
  });

  const sources = inlineSources?.length ? inlineSources : query.data ?? [];
  if (sources.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] px-3 py-2 text-xs">
      <p className="font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Toplanan kaynak raflar</p>
      <ul className="mt-1 space-y-1">
        {sources.map((source) => (
          <li key={source.locationId} className="flex items-center justify-between gap-3">
            <span>
              <strong>{source.locationCode}</strong>
              {source.locationName && (
                <span className="ml-1 text-[var(--wms-app-text-muted)]">· {source.locationName}</span>
              )}
            </span>
            <span className="font-semibold text-emerald-600">{formatProjectNumber(source.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
