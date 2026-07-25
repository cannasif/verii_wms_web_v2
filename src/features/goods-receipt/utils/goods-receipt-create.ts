import { DocumentType } from '@/types/document-type';
import { useAuthStore } from '@/stores/auth-store';
import type {
  GoodsReceiptFormData,
  SelectedOrderItem,
  SelectedStockItem,
  BulkCreateRequest,
  GenerateGoodsReceiptOrderRequest,
  ProcessGoodsReceiptRequest,
} from '../types/goods-receipt';

function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getActiveBranchCode(): string {
  return useAuthStore.getState().branch?.code?.trim() || '0';
}

export function buildGoodsReceiptBulkCreateRequest(
  formData: GoodsReceiptFormData,
  selectedItems: (SelectedOrderItem | SelectedStockItem)[],
  isStockBased: boolean = false,
): BulkCreateRequest {
  const currentYear = new Date().getFullYear().toString();
  const plannedDate = formData.receiptDate ? new Date(formData.receiptDate).toISOString() : new Date().toISOString();

  const lines = isStockBased ? [] : selectedItems.map((item) => {
    const clientKey = generateGuid();
    const orderItem = item as SelectedOrderItem;
    return {
      clientKey,
      stockId: orderItem.stockId,
      stockCode: orderItem.stockCode || orderItem.productCode || '',
      quantity: orderItem.orderedQty || 0,
      siparisMiktar: orderItem.orderedQty || 0,
      unit: orderItem.unit || undefined,
      erpOrderNo: orderItem.siparisNo || undefined,
      erpOrderId: orderItem.orderID?.toString() || undefined,
      description: orderItem.stockName || orderItem.productName || undefined,
    };
  });

  const importLines = selectedItems.map((item) => {
    const clientKey = generateGuid();
    const correspondingLine = isStockBased ? null : lines.find((line) => {
      const itemStockCode = item.stockCode;
      return line.stockCode === itemStockCode;
    });
    const stockCode = item.stockCode;
    return {
      lineClientKey: correspondingLine?.clientKey || null,
      clientKey,
      stockId: item.stockId,
      stockCode,
      yapKodId: item.yapKodId,
      yapKod: item.configCode || undefined,
    };
  });

  const serialLines = selectedItems
    .map((item, index) => {
      if (!item.serialNo && !item.lotNo && !item.batchNo && !item.configCode) {
        return null;
      }
      const importLine = importLines[index];
      if (!importLine) return null;
      return {
        lineClientKey: importLine.lineClientKey,
        stockCode: importLine.stockCode,
        yapKod: importLine.yapKod,
        serialNo: item.serialNo || '',
        quantity: item.receiptQuantity || 0,
        sourceWarehouseId: undefined,
        targetWarehouseId: item.warehouseId,
        sourceCellCode: undefined,
        targetCellCode: undefined,
        serialNo2: item.lotNo,
        serialNo3: item.batchNo,
        serialNo4: item.configCode,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const routes = selectedItems
    .map((item, index) => {
      const importLine = importLines[index];
      if (!importLine || !item.receiptQuantity || item.receiptQuantity <= 0) return null;
      const stockName = item.stockName;
      return {
        lineClientKey: importLine.lineClientKey,
        stockCode: importLine.stockCode,
        yapKod: importLine.yapKod,
        scannedBarcode: '',
        quantity: item.receiptQuantity,
        description: stockName || undefined,
        serialNo: item.serialNo,
        serialNo2: item.lotNo,
        serialNo3: item.batchNo,
        serialNo4: item.configCode,
        sourceWarehouse: undefined,
        targetWarehouse: item.warehouseId,
        sourceCellCode: undefined,
        targetCellCode: undefined,
      };
    })
    .filter((route): route is NonNullable<typeof route> => route !== null);

  const request: BulkCreateRequest = {
    header: {
      branchCode: getActiveBranchCode(),
      documentNo: formData.documentNo,
      documentDate: plannedDate,
      projectCode: formData.projectCode || undefined,
      orderId: isStockBased ? undefined : (selectedItems[0] && 'siparisNo' in selectedItems[0] ? selectedItems[0].siparisNo : undefined),
      documentType: DocumentType.GR,
      yearCode: currentYear,
      description1: formData.notes || undefined,
      description2: undefined,
      priorityLevel: 0,
      plannedDate,
      isPlanned: false,
      customerId: formData.customerRefId,
      customerCode: formData.customerId || '',
      returnCode: false,
      ocrSource: false,
      description3: undefined,
      description4: undefined,
      description5: undefined,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    lines: lines.length > 0 ? lines : undefined,
    importLines: importLines.length > 0 ? importLines : undefined,
    serialLines: serialLines.length > 0 ? serialLines : undefined,
    routes: routes.length > 0 ? routes : undefined,
  };

  return request;
}

export function buildGoodsReceiptGenerateOrderRequest(
  formData: GoodsReceiptFormData,
  selectedItems: (SelectedOrderItem | SelectedStockItem)[],
  isStockBased: boolean = false,
): GenerateGoodsReceiptOrderRequest {
  const currentYear = new Date().getFullYear().toString();
  const plannedDate = formData.receiptDate ? new Date(formData.receiptDate).toISOString() : new Date().toISOString();

  const lines = selectedItems.map((item) => {
    const clientKey = generateGuid();
    const quantity = isStockBased
      ? (item.receiptQuantity || 0)
      : ((item as SelectedOrderItem).orderedQty || 0);
    return {
      clientKey,
      stockId: item.stockId,
      stockCode: item.stockCode || ('productCode' in item ? item.productCode : '') || '',
      quantity,
      siparisMiktar: quantity,
      unit: item.unit || undefined,
      erpOrderNo: isStockBased ? undefined : ('siparisNo' in item ? item.siparisNo : undefined),
      erpOrderId: isStockBased ? undefined : ('orderID' in item ? item.orderID?.toString() : undefined),
      description: item.stockName || ('productName' in item ? item.productName : undefined) || undefined,
      yapKodId: item.yapKodId,
      yapKod: item.configCode || undefined,
    };
  });

  const lineSerials = selectedItems
    .map((item, index) => {
      if (!item.serialNo && !item.lotNo && !item.batchNo && !item.configCode) {
        return null;
      }

      return {
        lineClientKey: lines[index]?.clientKey,
        stockCode: item.stockCode,
        yapKod: item.configCode || undefined,
        serialNo: item.serialNo || '',
        quantity: item.receiptQuantity || 0,
        sourceWarehouseId: undefined,
        targetWarehouseId: item.warehouseId,
        sourceCellCode: undefined,
        targetCellCode: undefined,
        serialNo2: item.lotNo,
        serialNo3: item.batchNo,
        serialNo4: item.configCode,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  return {
    header: {
      branchCode: getActiveBranchCode(),
      documentNo: formData.documentNo,
      documentDate: plannedDate,
      projectCode: formData.projectCode || undefined,
      orderId: isStockBased ? undefined : ('siparisNo' in (selectedItems[0] ?? {}) ? (selectedItems[0] as SelectedOrderItem).siparisNo : undefined),
      documentType: DocumentType.GR,
      yearCode: currentYear,
      description1: formData.notes || undefined,
      description2: undefined,
      priorityLevel: 0,
      plannedDate,
      isPlanned: false,
      customerId: formData.customerRefId,
      customerCode: formData.customerId || '',
      returnCode: false,
      ocrSource: false,
      description3: undefined,
      description4: undefined,
      description5: undefined,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    lines,
    lineSerials: lineSerials.length > 0 ? lineSerials : undefined,
    terminalLines: undefined,
  };
}

export function buildGoodsReceiptProcessRequest(
  formData: GoodsReceiptFormData,
  selectedItems: Array<SelectedOrderItem | SelectedStockItem>,
  isStockBased: boolean = true,
): ProcessGoodsReceiptRequest {
  const currentYear = new Date().getFullYear().toString();
  const plannedDate = formData.receiptDate ? new Date(formData.receiptDate).toISOString() : new Date().toISOString();

  const routes = selectedItems
    .map((item) => {
      if (!item.receiptQuantity || item.receiptQuantity <= 0) {
        return null;
      }

      return {
        stockId: item.stockId,
        stockCode: item.stockCode,
        yapKodId: item.yapKodId,
        yapKod: item.configCode || undefined,
        scannedBarcode: '',
        quantity: item.receiptQuantity,
        serialNo: item.serialNo,
        serialNo2: item.lotNo,
        serialNo3: item.batchNo,
        serialNo4: item.configCode,
        sourceWarehouse: undefined,
        targetWarehouse: item.warehouseId,
        sourceCellCode: undefined,
        targetCellCode: undefined,
      };
    })
    .filter((route): route is NonNullable<typeof route> => route !== null);

  return {
    header: {
      branchCode: getActiveBranchCode(),
      documentNo: formData.documentNo,
      documentDate: plannedDate,
      projectCode: formData.projectCode || undefined,
      orderId: isStockBased ? undefined : ('siparisNo' in (selectedItems[0] ?? {}) ? (selectedItems[0] as SelectedOrderItem).siparisNo : undefined),
      documentType: DocumentType.GR,
      yearCode: currentYear,
      description1: formData.notes || undefined,
      description2: undefined,
      priorityLevel: 0,
      plannedDate,
      isPlanned: false,
      customerId: formData.customerRefId,
      customerCode: formData.customerId || '',
      returnCode: false,
      ocrSource: false,
      description3: undefined,
      description4: undefined,
      description5: undefined,
      allowLessQuantityBasedOnOrder: formData.allowLessQuantityBasedOnOrder,
      allowMoreQuantityBasedOnOrder: formData.allowMoreQuantityBasedOnOrder,
    },
    routes: routes.length > 0 ? routes : undefined,
  };
}
