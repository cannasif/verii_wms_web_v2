import { DocumentType } from '@/types/document-type';
import { useAuthStore } from '@/stores/auth-store';
import type {
  ShipmentGenerateRequest,
  ShipmentProcessRequest,
  ShipmentFormData,
  SelectedShipmentOrderItem,
  SelectedShipmentStockItem,
} from '../types/shipment';

function getActiveBranchCode(): string {
  return useAuthStore.getState().branch?.code?.trim() || '0';
}

export function buildShipmentGenerateRequest(
  formData: ShipmentFormData,
  selectedItems: (SelectedShipmentOrderItem | SelectedShipmentStockItem)[],
  isStockBased: boolean = false,
): ShipmentGenerateRequest {
  const now = new Date().toISOString();
  const lines: ShipmentGenerateRequest['lines'] = [];
  const lineSerials: ShipmentGenerateRequest['lineSerials'] = [];

  selectedItems.forEach((item) => {
    const clientKey = crypto.randomUUID();
    const clientGuid = crypto.randomUUID();

    lines.push({
      clientKey,
      clientGuid,
      stockCode: item.stockCode,
      stockName: item.stockName,
      yapKod: ('yapKod' in item ? item.yapKod : item.configCode) || '',
      yapAcik: ('yapAcik' in item ? item.yapAcik : '') || '',
      orderId: isStockBased ? 0 : ('orderID' in item ? item.orderID || 0 : 0),
      quantity: item.transferQuantity,
      unit: '',
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
      sourceCellCode: item.sourceCellCode || '',
      targetCellCode: item.targetCellCode || '',
      lineClientKey: clientKey,
      lineGroupGuid: clientGuid,
    });
  });

  const request: ShipmentGenerateRequest = {
    header: {
      branchCode: getActiveBranchCode(),
      projectCode: formData.projectCode || '',
      orderId: '',
      documentType: DocumentType.SH,
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
      customerCode: formData.customerId || '',
      customerName: '',
      sourceWarehouse: formData.sourceWarehouse,
      targetWarehouse: '',
      priority: '',
      documentSeriesDefinitionId: formData.documentSeriesDefinitionId,
      requiresEDispatch: formData.requiresEDispatch,
      type: isStockBased ? 1 : 0,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    lines,
    lineSerials,
    terminalLines: formData.userIds && formData.userIds.length > 0
      ? formData.userIds.map((id) => ({ terminalUserId: Number(id) }))
      : [],
    userIds: formData.userIds ? formData.userIds.map((id) => Number(id)) : undefined,
  };

  return request;
}

export function buildShipmentProcessRequest(
  formData: ShipmentFormData,
  selectedItems: SelectedShipmentStockItem[],
): ShipmentProcessRequest {
  const now = new Date().toISOString();
  const validItems = selectedItems.filter(
    (item) => Number.isFinite(item.transferQuantity) && item.transferQuantity > 0,
  );
  const keyedItems = validItems.map((item) => ({
    item,
    importLineClientKey: crypto.randomUUID(),
  }));

  return {
    header: {
      branchCode: getActiveBranchCode(),
      projectCode: formData.projectCode || '',
      orderId: '',
      documentType: DocumentType.SH,
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
      customerCode: formData.customerId || '',
      customerName: '',
      sourceWarehouse: formData.sourceWarehouse,
      targetWarehouse: '',
      priority: '',
      documentSeriesDefinitionId: formData.documentSeriesDefinitionId,
      requiresEDispatch: formData.requiresEDispatch,
      type: 1,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    importLines: keyedItems.map(({ item, importLineClientKey }) => ({
      clientKey: importLineClientKey,
      stockId: item.stockId,
      stockCode: item.stockCode,
      yapKodId: item.yapKodId,
      yapKod: item.configCode || undefined,
    })),
    routes: keyedItems.map(({ item, importLineClientKey }) => ({
      importLineClientKey,
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
      targetWarehouse: undefined,
      sourceCellCode: item.sourceCellCode || '',
      targetCellCode: item.targetCellCode || '',
    })),
    terminalLines: formData.userIds?.map((id) => ({ terminalUserId: Number(id) })) ?? [],
  };
}
