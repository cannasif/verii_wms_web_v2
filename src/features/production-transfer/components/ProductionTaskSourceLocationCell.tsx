import type { ProductionTaskLine } from '../api';
import { formatProjectNumber } from '@/lib/project-format';

interface Props {
  line: ProductionTaskLine;
  getAvailable: (transferLineId: number, sourceLocationId?: number) => number | undefined;
  loading?: boolean;
}

export function ProductionTaskSourceLocationCell({ line, getAvailable, loading }: Props) {
  const available = line.sourceLocationId
    ? getAvailable(line.transferLineId, line.sourceLocationId)
    : undefined;

  return (
    <td className="p-2">
      {line.sourceLocationCode ?? '—'}
      {line.sourceLocationName && (
        <div className="text-xs text-[var(--wms-app-text-muted)]">{line.sourceLocationName}</div>
      )}
      {line.sourceLocationId && (
        <div className="text-xs font-semibold text-[var(--wms-brand-primary)]">
          {loading && available === undefined
            ? 'Kullanılabilir yükleniyor…'
            : available !== undefined
              ? `Kullanılabilir: ${formatProjectNumber(available)}`
              : null}
        </div>
      )}
    </td>
  );
}
