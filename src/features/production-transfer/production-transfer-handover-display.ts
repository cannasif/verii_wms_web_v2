import type { ProductionTransferExecutionLine } from './api';

export function productionTransferHandoverDisplayKey(line: Pick<
  ProductionTransferExecutionLine,
  'stockId' | 'unitCode' | 'trackingType'
>): string {
  return `${line.stockId}|${line.unitCode.trim().toUpperCase()}|${line.trackingType}`;
}

/** Teslim ekranı: aynı stok satırlarını gösterim için birleştirir; API satırlarına dokunmaz. */
export function groupProductionTransferHandoverDisplayLines(
  lines: readonly ProductionTransferExecutionLine[],
): ProductionTransferExecutionLine[] {
  const grouped = new Map<string, ProductionTransferExecutionLine>();
  for (const line of lines) {
    if (line.pickedQuantity <= 0) continue;
    const key = productionTransferHandoverDisplayKey(line);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...line });
      continue;
    }

    current.requestedQuantity += line.requestedQuantity;
    current.pickedQuantity += line.pickedQuantity;
    current.handedOverQuantity += line.handedOverQuantity;
    current.remainingToPickQuantity += line.remainingToPickQuantity;
    current.shortageQuantity += line.shortageQuantity;
    current.overIssueQuantity += line.overIssueQuantity;
  }

  return [...grouped.values()];
}
