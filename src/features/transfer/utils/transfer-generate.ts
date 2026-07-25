import { DocumentType } from '@/types/document-type';
import { useAuthStore } from '@/stores/auth-store';
import type {
  TransferGenerateRequest,
  TransferProcessRequest,
  TransferFormData,
  SelectedTransferOrderItem,
  SelectedTransferStockItem,
} from '../types/transfer';

function getActiveBranchCode(): string {
  return useAuthStore.getState().branch?.code?.trim() || '0';
}

export function buildTransferGenerateRequest(
  formData: TransferFormData,
  selectedItems: (SelectedTransferOrderItem | SelectedTransferStockItem)[],
  isStockBased: boolean = false,
): TransferGenerateRequest {
  const now = new Date().toISOString();
  const lines: TransferGenerateRequest['lines'] = [];
  const lineSerials: TransferGenerateRequest['lineSerials'] = [];

  selectedItems.forEach((item) => {
    const clientKey = crypto.randomUUID();
    const clientGuid = crypto.randomUUID();

    lines.push({
      clientKey,
      clientGuid,
      stockId: item.stockId,
      stockCode: item.stockCode,
      yapKod: '',
      orderId: 0,
      quantity: item.transferQuantity,
      siparisMiktar: isStockBased ? item.transferQuantity : ('orderedQty' in item ? item.orderedQty || item.transferQuantity : undefined),
      unit: 'unit' in item ? item.unit || '' : '',
      erpOrderNo: isStockBased ? '' : ('siparisNo' in item ? item.siparisNo || '' : ''),
      erpOrderId: isStockBased ? '' : ('orderID' in item ? String(item.orderID || '') : ''),
      erpLineReference: '',
      description: '',
    });

    lineSerials.push({
      quantity: item.transferQuantity,
      serialNo: item.serialNo || '',
      serialNo2: item.serialNo2 || '',
      serialNo3: item.lotNo || '',
      serialNo4: item.batchNo || '',
      sourceWarehouseId: undefined,
      targetWarehouseId: formData.targetWarehouseId,
      sourceCellCode: '',
      targetCellCode: '',
      lineClientKey: clientKey,
      lineGroupGuid: clientGuid,
    });
  });

  const userIdsAsNumbers = formData.userIds ? formData.userIds.map((id) => Number(id)) : [];

  const terminalLines = userIdsAsNumbers.length > 0
    ? userIdsAsNumbers.map((userId) => ({
        terminalUserId: userId,
      }))
    : [];

  const request: TransferGenerateRequest = {
    header: {
      branchCode: getActiveBranchCode(),
      projectCode: formData.projectCode || '',
      orderId: '',
      documentType: DocumentType.WT,
      yearCode: new Date().getFullYear().toString(),
      description1: formData.notes || '',
      description2: '',
      priorityLevel: 0,
      plannedDate: formData.transferDate,
      isPlanned: true,
      isCompleted: false,
      completedDate: now,
      documentNo: formData.documentNo,
      documentDate: formData.transferDate,
      customerId: formData.customerRefId,
      customerCode: formData.customerId || '',
      customerName: '',
      sourceWarehouseId: formData.sourceWarehouseId,
      sourceWarehouse: formData.sourceWarehouse || '',
      targetWarehouseId: formData.targetWarehouseId,
      targetWarehouse: formData.targetWarehouse,
      priority: '',
      documentSeriesDefinitionId: formData.documentSeriesDefinitionId,
      requiresEDispatch: formData.requiresEDispatch,
      type: isStockBased ? 1 : 0,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    lines,
    lineSerials,
    terminalLines,
    userIds: userIdsAsNumbers.length > 0 ? userIdsAsNumbers : undefined,
  };

  return request;
}

export function buildTransferProcessRequest(
  formData: TransferFormData,
  selectedItems: SelectedTransferStockItem[],
): TransferProcessRequest {
  const now = new Date().toISOString();

  return {
    header: {
      branchCode: getActiveBranchCode(),
      projectCode: formData.projectCode || '',
      orderId: '',
      documentType: DocumentType.WT,
      yearCode: new Date().getFullYear().toString(),
      description1: formData.notes || '',
      description2: '',
      priorityLevel: 0,
      plannedDate: formData.transferDate,
      isPlanned: true,
      isCompleted: false,
      completedDate: now,
      documentNo: formData.documentNo,
      documentDate: formData.transferDate,
      customerId: undefined,
      customerCode: '',
      customerName: '',
      sourceWarehouseId: formData.sourceWarehouseId,
      sourceWarehouse: formData.sourceWarehouse || '',
      targetWarehouseId: formData.targetWarehouseId,
      targetWarehouse: formData.targetWarehouse || '',
      priority: '',
      documentSeriesDefinitionId: formData.documentSeriesDefinitionId,
      requiresEDispatch: formData.requiresEDispatch,
      type: 1,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    routes: selectedItems
      .filter((item) => Number.isFinite(item.transferQuantity) && item.transferQuantity > 0)
      .map((item) => ({
        stockId: item.stockId,
        stockCode: item.stockCode,
        yapKodId: item.yapKodId,
        yapKod: item.configCode || undefined,
        quantity: item.transferQuantity,
        serialNo: item.serialNo || '',
        serialNo2: item.serialNo2 || '',
        serialNo3: item.lotNo || '',
        serialNo4: item.batchNo || '',
        scannedBarcode: item.stockCode,
        sourceWarehouse: formData.sourceWarehouse ? Number(formData.sourceWarehouse) : undefined,
        targetWarehouse: formData.targetWarehouse ? Number(formData.targetWarehouse) : undefined,
        sourceCellCode: item.sourceCellCode || '',
        targetCellCode: item.targetCellCode || '',
      })),
  };
}
