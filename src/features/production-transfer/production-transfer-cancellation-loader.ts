import { transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { WarehouseTransferDetail, WarehouseTransferGridRow } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionTransferPolicy,
} from './api';
import {
  analyzeProductionCancellationReadiness,
  type ProductionCancellationReadiness,
} from './production-transfer-cancellation';

export interface ProductionCancellationContext {
  board: ProductionTaskBoard;
  policy: ProductionTransferPolicy;
  readiness: ProductionCancellationReadiness;
  sourceWarehouseId: number;
}

export function sumTransferPickedQuantity(detail: Pick<WarehouseTransferDetail, 'lines'>): number {
  return detail.lines.reduce((sum, line) => sum + line.pickedQuantity, 0);
}

function emptyBoardFromDetail(
  row: Pick<WarehouseTransferGridRow, 'id' | 'documentNo' | 'status'>,
  detail: WarehouseTransferDetail,
): ProductionTaskBoard {
  return {
    transferId: row.id,
    documentNo: row.documentNo,
    transferStatus: row.status,
    sourceWarehouseId: detail.header.sourceWarehouseId,
    tasks: [],
    workloads: [],
    eligibleAssignees: [],
  };
}

/** Liste veya operasyon ekranı için iptal ön kontrol verisini yükler. */
export async function loadProductionCancellationContext(
  row: Pick<WarehouseTransferGridRow, 'id' | 'documentNo' | 'status' | 'pickedQuantity'>,
  branchCode: string,
): Promise<ProductionCancellationContext> {
  const transferApi = transferApiFor('production');
  const [policy, detail] = await Promise.all([
    productionTransferApi.policy(branchCode),
    transferApi.detail(row.id),
  ]);
  const transferPickedQuantity = sumTransferPickedQuantity(detail);

  let board: ProductionTaskBoard;
  try {
    board = await productionTransferApi.taskBoard(row.id);
  } catch {
    board = emptyBoardFromDetail(row, detail);
  }

  const readiness = analyzeProductionCancellationReadiness(board, {
    pickedQuantityHint: Math.max(row.pickedQuantity, transferPickedQuantity),
    transferPickedQuantity,
  });

  return {
    board,
    policy,
    readiness,
    sourceWarehouseId: board.sourceWarehouseId,
  };
}
