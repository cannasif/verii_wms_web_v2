import type { ProductionTransferExecution, ProductionTransferExecutionLine } from '@/features/production-transfer/api';
import type { PreparedNetsisProductionMaterial, PreparedNetsisProductionWorkOrder } from '../types';

function normalizeStockCode(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR');
}

function transferLineRemainingQuantity(line: ProductionTransferExecutionLine): number {
  if (line.remainingToPickQuantity > 0) return line.remainingToPickQuantity;
  return Math.max(0, line.requestedQuantity - line.pickedQuantity);
}

function findMatchingTransferLine(
  material: PreparedNetsisProductionMaterial,
  lines: ProductionTransferExecutionLine[],
  usedLineIds: ReadonlySet<number>,
): ProductionTransferExecutionLine | undefined {
  const byStockId = material.stockId
    ? lines.find((line) => !usedLineIds.has(line.lineId) && line.stockId === material.stockId)
    : undefined;
  if (byStockId) return byStockId;

  const stockCode = normalizeStockCode(material.stockCode);
  return lines.find(
    (line) => !usedLineIds.has(line.lineId)
      && normalizeStockCode(line.stockCode) === stockCode,
  );
}

function scaleMaterialQuantity(
  material: PreparedNetsisProductionMaterial,
  remainingQuantity: number,
): PreparedNetsisProductionMaterial {
  if (remainingQuantity <= 0 || material.requiredQuantity <= 0) {
    return { ...material, requiredQuantity: remainingQuantity };
  }

  const ratio = remainingQuantity / material.requiredQuantity;
  return {
    ...material,
    requiredQuantity: remainingQuantity,
    recipeQuantity: material.recipeQuantity * ratio,
    wasteQuantity: material.wasteQuantity * ratio,
  };
}

/** Kısmi transfer kalanında ERP reçetesini yalnızca kalan transfer satırlarıyla sınırlar. */
export function applyPartialTransferRemainderToPreparedWorkOrder(
  workOrder: PreparedNetsisProductionWorkOrder,
  execution: ProductionTransferExecution,
): PreparedNetsisProductionWorkOrder {
  const activeLines = execution.lines.filter((line) => transferLineRemainingQuantity(line) > 0);
  if (activeLines.length === 0) {
    return { ...workOrder, materials: [] };
  }

  const usedLineIds = new Set<number>();
  const materials = workOrder.materials.flatMap((material) => {
    const line = findMatchingTransferLine(material, activeLines, usedLineIds);
    if (!line) return [];

    const remainingQuantity = transferLineRemainingQuantity(line);
    if (remainingQuantity <= 0) return [];

    usedLineIds.add(line.lineId);
    return [scaleMaterialQuantity(material, remainingQuantity)];
  });

  return { ...workOrder, materials };
}
