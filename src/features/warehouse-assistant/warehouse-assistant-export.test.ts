import { describe, expect, it } from 'vitest';
import en from './localization/en.json';
import tr from './localization/tr.json';
import type { WarehouseAssistantChatResponse } from './types/warehouse-assistant.types';
import {
  buildWarehouseAssistantExportModel,
  createWarehouseAssistantExportFileName,
  type WarehouseAssistantExportTranslator,
} from './utils/warehouse-assistant-export';

function translator(resource: Record<string, unknown>): WarehouseAssistantExportTranslator {
  return (key, options) => {
    const value = key.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, resource);
    return typeof value === 'string' ? value : String(options?.defaultValue ?? key);
  };
}

const result: WarehouseAssistantChatResponse = {
  conversationId: 15,
  messageId: 29,
  answer: 'Yetkili olduğunuz kayıtlar bulundu.',
  intent: 'stockMovementHistory',
  scope: 'authorized-warehouses',
  providerMode: 'deterministic',
  activities: [{
    id: 1, action: 'Update', description: 'Raf güncellendi', entityType: 'Location', entityId: '74',
    result: 'Success', userId: 2, userDisplayName: 'Depo Kullanıcısı', occurredAtUtc: '2026-08-08T08:30:00Z',
  }],
  serialBalances: [{
    id: 3, serialNo: 'DTG-1', stockId: 4, stockCode: '01/013', stockName: 'Test levha',
    warehouseCode: 1, warehouseName: 'Ana Depo', locationCode: 'R-01', locationName: 'Raf 1', lotNo: 'LOT-9',
    unitCode: 'AD', stockStatus: 'Available', quantity: 9, reservedQuantity: 2, availableQuantity: 7,
    lastTransactionAtUtc: '2026-08-08T09:00:00Z',
  }],
  serialReceipts: [],
  stockLocations: [{
    stockId: 4, stockCode: '01/013', stockName: 'Test levha', warehouseCode: 1, warehouseName: 'Ana Depo',
    locationCode: 'R-01', locationName: 'Raf 1', unitCode: 'AD', quantity: 9, reservedQuantity: 2, availableQuantity: 7,
  }],
  barcode: {
    barcode: '01/013/DTG-1/LOT-9', source: 'GeneratedBarcode', stockId: 4, stockCode: '01/013',
    stockName: 'Test levha', yapCodeId: null, yapCode: null, encodedQuantity: 1, unitCode: 'AD', lotNo: 'LOT-9',
    serialNo: 'DTG-1', manufacturingDate: '2026-08-01', expirationDate: null, requireSerial: true, requireLot: true,
    requireManufacturingDate: false, requireExpirationDate: false, missingFields: [],
  },
  movements: [{
    entryId: 7, operationId: 8, operationType: 'Transfer', operationStatus: 'Completed', referenceType: 'ProductionTransfer',
    referenceNo: 'PT-1', referenceId: 9, stockId: 4, stockCode: '01/013', stockName: 'Test levha', warehouseCode: 1,
    warehouseName: 'Ana Depo', locationCode: 'R-01', locationName: 'Raf 1', quantityDelta: -1, unitCode: 'AD',
    lotNo: 'LOT-9', serialNo: 'DTG-1', stockStatus: 'Available', occurredAtUtc: '2026-08-08T10:00:00Z', isReversal: false,
  }],
  tasks: [{
    module: 'ProductionTransfer', taskId: 11, taskNo: 'TASK-1', taskType: 'Picking', status: 'Assigned', priority: 1,
    documentId: 12, documentNo: 'PT-1', warehouseId: 13, warehouseCode: 1, warehouseName: 'Ana Depo',
    plannedQuantity: 3, processedQuantity: 1, remainingQuantity: 2, plannedAtUtc: '2026-08-08T07:00:00Z',
    dueAtUtc: '2026-08-09T07:00:00Z', assigneeUserId: 2, assigneeDisplayName: 'Depo Kullanıcısı',
  }],
  goodsReceipts: [{
    goodsReceiptId: 21, documentNo: 'GR-21', documentDate: '2026-08-08', receivedAtUtc: '2026-08-08T10:30:00Z',
    supplierId: 20, supplierCode: 'ABC', supplierName: 'ABC TEDARIK', warehouseCode: 1, warehouseName: 'Ana Depo',
    stockId: 4, stockCode: '01/013', stockName: 'Test levha', yapCode: null, unitCode: 'AD', receivedQuantity: 9,
    acceptedQuantity: 9, rejectedQuantity: 0, quarantineQuantity: 0, putawayQuantity: 9, status: 'Completed',
    qualityStatus: 'NotRequired', erpIntegrationStatus: 'Posted', receivedByUserId: 2, receivedByDisplayName: 'Depo Kullanıcısı',
  }],
  suggestions: [],
};

describe('warehouse assistant export model', () => {
  it('creates a deterministic and file-system-safe name', () => {
    expect(createWarehouseAssistantExportFileName('stock movement/history', new Date('2026-08-08T10:15:00Z')))
      .toBe('wms-ai-stock-movement-history-20260808-1015');
  });

  it('creates localized metadata and separate result sections without losing numeric/date types', () => {
    const model = buildWarehouseAssistantExportModel({
      result,
      question: 'DTG-1 hareketlerini göster',
      language: 'tr',
      t: translator(tr),
      generatedAt: new Date('2026-08-08T10:15:00Z'),
    });

    expect(model.title).toContain('Depo Asistanı');
    expect(model.metadata[0]).toEqual({ label: 'Kullanıcı sorusu', value: 'DTG-1 hareketlerini göster' });
    expect(model.metadata[2]).toEqual({ label: 'Yetki kapsamı', value: 'Yalnız yetkili olduğum depolar' });
    expect(model.sections.map((item) => item.key)).toEqual([
      'activities', 'serial-balances', 'stock-locations', 'barcode', 'movements', 'tasks', 'goods-receipts',
    ]);
    expect(model.sections.find((item) => item.key === 'serial-balances')?.rows[0].availableQuantity).toBe(7);
    expect(model.sections.find((item) => item.key === 'movements')?.rows[0].occurredAt).toBeInstanceOf(Date);
    expect(model.sections.find((item) => item.key === 'serial-balances')?.rows[0].stockStatus)
      .toBe(translator(tr)('stockStatuses.Available'));
    expect(model.sections.find((item) => item.key === 'movements')?.rows[0].movementStatus)
      .toBe(translator(tr)('operationStatuses.Completed'));
    expect(model.sections.find((item) => item.key === 'goods-receipts')?.rows[0].status)
      .toBe(translator(tr)('operationStatuses.Completed'));
  });

  it('keeps PDF tables limited to readable operational columns', () => {
    const model = buildWarehouseAssistantExportModel({
      result,
      question: 'Show movements',
      language: 'en',
      t: translator(en),
      generatedAt: new Date('2026-08-08T10:15:00Z'),
    });

    model.sections.forEach((item) => {
      const pdfColumns = item.columns.filter((column) => column.includeInPdf !== false);
      expect(pdfColumns.length).toBeGreaterThan(0);
      expect(pdfColumns.length).toBeLessThanOrEqual(10);
    });
    expect(model.sections.find((item) => item.key === 'tasks')?.title).toBe('Open and assigned tasks');
  });
});
