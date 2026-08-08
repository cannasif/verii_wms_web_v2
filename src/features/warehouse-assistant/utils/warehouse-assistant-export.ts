import { registerPdfExportFont } from '@/lib/pdf-export-font';
import type { WarehouseAssistantChatResponse } from '../types/warehouse-assistant.types';

export type WarehouseAssistantExportCell = string | number | Date;
export type WarehouseAssistantExportTranslator = (key: string, options?: Record<string, unknown>) => string;

export interface WarehouseAssistantExportColumn {
  key: string;
  label: string;
  width: number;
  includeInPdf?: boolean;
}

export interface WarehouseAssistantExportSection {
  key: string;
  title: string;
  columns: WarehouseAssistantExportColumn[];
  rows: Record<string, WarehouseAssistantExportCell>[];
}

export interface WarehouseAssistantExportModel {
  title: string;
  fileName: string;
  generatedAt: Date;
  metadata: Array<{ label: string; value: WarehouseAssistantExportCell }>;
  sections: WarehouseAssistantExportSection[];
}

interface WarehouseAssistantExportParams {
  result: WarehouseAssistantChatResponse;
  question: string;
  language: string;
  t: WarehouseAssistantExportTranslator;
  generatedAt?: Date;
}

const dateValue = (value?: string | null): Date | string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
};

const textValue = (value?: string | null): string => value?.trim() ?? '';

const col = (
  t: WarehouseAssistantExportTranslator,
  key: string,
  width: number,
  includeInPdf = true,
): WarehouseAssistantExportColumn => ({ key, label: t(`export.columns.${key}`), width, includeInPdf });

const section = (
  key: string,
  title: string,
  columns: WarehouseAssistantExportColumn[],
  rows: Record<string, WarehouseAssistantExportCell>[],
): WarehouseAssistantExportSection | null => rows.length > 0 ? { key, title, columns, rows } : null;

export function createWarehouseAssistantExportFileName(intent: string, generatedAt: Date): string {
  const timestamp = generatedAt.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  const safeIntent = intent.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'result';
  return `wms-ai-${safeIntent}-${timestamp}`;
}

export function buildWarehouseAssistantExportModel({
  result,
  question,
  language,
  t,
  generatedAt = new Date(),
}: WarehouseAssistantExportParams): WarehouseAssistantExportModel {
  const yesNo = (value: boolean): string => t(value ? 'export.values.yes' : 'export.values.no');
  const sections = [
    section(
      'activities',
      t('results.activities'),
      [
        col(t, 'occurredAt', 21), col(t, 'user', 24), col(t, 'action', 18),
        col(t, 'description', 42), col(t, 'entityType', 20, false), col(t, 'entityId', 16), col(t, 'result', 18),
      ],
      result.activities.map((row) => ({
        occurredAt: dateValue(row.occurredAtUtc), user: row.userDisplayName, action: row.action,
        description: row.description, entityType: row.entityType, entityId: row.entityId, result: row.result,
      })),
    ),
    section(
      'serial-balances',
      t('results.serialBalances'),
      [
        col(t, 'stockCode', 20), col(t, 'stockName', 36), col(t, 'serialNo', 24), col(t, 'lotNo', 18),
        col(t, 'warehouseCode', 14, false), col(t, 'warehouseName', 26), col(t, 'locationCode', 18), col(t, 'locationName', 24, false),
        col(t, 'quantity', 14, false), col(t, 'reservedQuantity', 16, false), col(t, 'availableQuantity', 16),
        col(t, 'unitCode', 12), col(t, 'stockStatus', 16), col(t, 'lastTransactionAt', 21, false),
      ],
      result.serialBalances.map((row) => ({
        stockCode: row.stockCode, stockName: row.stockName, serialNo: row.serialNo, lotNo: textValue(row.lotNo),
        warehouseCode: row.warehouseCode, warehouseName: row.warehouseName, locationCode: row.locationCode,
        locationName: row.locationName, quantity: row.quantity, reservedQuantity: row.reservedQuantity,
        availableQuantity: row.availableQuantity, unitCode: row.unitCode, stockStatus: row.stockStatus,
        lastTransactionAt: dateValue(row.lastTransactionAtUtc),
      })),
    ),
    section(
      'serial-receipts',
      t('results.serialReceipts'),
      [
        col(t, 'receivedAt', 21), col(t, 'goodsReceiptNo', 24), col(t, 'stockCode', 20), col(t, 'stockName', 34),
        col(t, 'serialNo', 24), col(t, 'warehouseCode', 14, false), col(t, 'warehouseName', 24),
        col(t, 'locationCode', 18), col(t, 'locationName', 22, false), col(t, 'quantity', 14), col(t, 'unitCode', 12), col(t, 'receivedBy', 24),
      ],
      result.serialReceipts.map((row) => ({
        receivedAt: dateValue(row.receivedAtUtc), goodsReceiptNo: row.goodsReceiptNo, stockCode: row.stockCode,
        stockName: row.stockName, serialNo: row.serialNo, warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName, locationCode: row.locationCode, locationName: row.locationName,
        quantity: row.quantity, unitCode: row.unitCode, receivedBy: row.receivedByDisplayName,
      })),
    ),
    section(
      'stock-locations',
      t('results.stockLocations'),
      [
        col(t, 'stockCode', 20), col(t, 'stockName', 36), col(t, 'warehouseCode', 14, false),
        col(t, 'warehouseName', 26), col(t, 'locationCode', 18), col(t, 'locationName', 24),
        col(t, 'quantity', 14), col(t, 'reservedQuantity', 16), col(t, 'availableQuantity', 16), col(t, 'unitCode', 12),
      ],
      result.stockLocations.map((row) => ({
        stockCode: row.stockCode, stockName: row.stockName, warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName, locationCode: row.locationCode, locationName: row.locationName,
        quantity: row.quantity, reservedQuantity: row.reservedQuantity, availableQuantity: row.availableQuantity, unitCode: row.unitCode,
      })),
    ),
    section(
      'barcode',
      t('results.barcode'),
      [
        col(t, 'barcode', 30), col(t, 'source', 22), col(t, 'stockCode', 20), col(t, 'stockName', 34),
        col(t, 'configurationCode', 18, false), col(t, 'serialNo', 24), col(t, 'lotNo', 18),
        col(t, 'quantity', 14), col(t, 'unitCode', 12), col(t, 'manufacturingDate', 18, false),
        col(t, 'expirationDate', 18), col(t, 'missingFields', 30, false),
      ],
      result.barcode ? [{
        barcode: result.barcode.barcode, source: t(`barcodeSources.${result.barcode.source}`, { defaultValue: result.barcode.source }),
        stockCode: result.barcode.stockCode, stockName: result.barcode.stockName,
        configurationCode: textValue(result.barcode.yapCode), serialNo: textValue(result.barcode.serialNo),
        lotNo: textValue(result.barcode.lotNo), quantity: result.barcode.encodedQuantity ?? '', unitCode: result.barcode.unitCode,
        manufacturingDate: dateValue(result.barcode.manufacturingDate), expirationDate: dateValue(result.barcode.expirationDate),
        missingFields: result.barcode.missingFields.join(', '),
      }] : [],
    ),
    section(
      'movements',
      t('results.movements'),
      [
        col(t, 'occurredAt', 21), col(t, 'movementType', 20), col(t, 'movementStatus', 18, false),
        col(t, 'referenceNo', 22), col(t, 'stockCode', 20), col(t, 'stockName', 32, false),
        col(t, 'serialNo', 24), col(t, 'lotNo', 18, false), col(t, 'warehouseName', 24),
        col(t, 'locationCode', 18), col(t, 'quantityChange', 16), col(t, 'unitCode', 12),
        col(t, 'stockStatus', 16, false), col(t, 'isReversal', 14),
      ],
      result.movements.map((row) => ({
        occurredAt: dateValue(row.occurredAtUtc), movementType: t(`movementTypes.${row.operationType}`, { defaultValue: row.operationType }),
        movementStatus: row.operationStatus, referenceNo: textValue(row.referenceNo) || textValue(row.referenceType),
        stockCode: row.stockCode, stockName: row.stockName, serialNo: textValue(row.serialNo), lotNo: textValue(row.lotNo),
        warehouseName: row.warehouseName, locationCode: row.locationCode, quantityChange: row.quantityDelta,
        unitCode: row.unitCode, stockStatus: row.stockStatus, isReversal: yesNo(row.isReversal),
      })),
    ),
    section(
      'tasks',
      t('results.tasks'),
      [
        col(t, 'module', 22), col(t, 'taskNo', 22), col(t, 'taskType', 18, false), col(t, 'documentNo', 22),
        col(t, 'warehouseName', 24), col(t, 'assignee', 24), col(t, 'status', 18), col(t, 'priority', 12),
        col(t, 'plannedQuantity', 16, false), col(t, 'processedQuantity', 16, false), col(t, 'remainingQuantity', 16),
        col(t, 'plannedAt', 21, false), col(t, 'dueAt', 21),
      ],
      result.tasks.map((row) => ({
        module: t(`taskModules.${row.module}`, { defaultValue: row.module }), taskNo: row.taskNo, taskType: row.taskType,
        documentNo: row.documentNo, warehouseName: row.warehouseName, assignee: row.assigneeDisplayName,
        status: t(`taskStatuses.${row.status}`, { defaultValue: row.status }), priority: row.priority,
        plannedQuantity: row.plannedQuantity, processedQuantity: row.processedQuantity,
        remainingQuantity: row.remainingQuantity, plannedAt: dateValue(row.plannedAtUtc), dueAt: dateValue(row.dueAtUtc),
      })),
    ),
    section(
      'goods-receipts',
      t('results.goodsReceipts'),
      [
        col(t, 'receivedAt', 21), col(t, 'goodsReceiptNo', 24), col(t, 'stockCode', 20),
        col(t, 'stockName', 34), col(t, 'configurationCode', 18, false), col(t, 'warehouseCode', 14, false),
        col(t, 'warehouseName', 24), col(t, 'quantity', 14), col(t, 'unitCode', 12),
        col(t, 'status', 18), col(t, 'receivedBy', 24),
      ],
      (result.goodsReceipts ?? []).map((row) => ({
        receivedAt: dateValue(row.receivedAtUtc ?? row.documentDate), goodsReceiptNo: row.documentNo,
        stockCode: row.stockCode, stockName: row.stockName, configurationCode: textValue(row.yapCode),
        warehouseCode: row.warehouseCode, warehouseName: row.warehouseName, quantity: row.receivedQuantity,
        unitCode: row.unitCode, status: row.status, receivedBy: row.receivedByDisplayName,
      })),
    ),
  ].filter((item): item is WarehouseAssistantExportSection => item !== null);

  return {
    title: t('export.reportTitle'),
    fileName: createWarehouseAssistantExportFileName(result.intent, generatedAt),
    generatedAt,
    metadata: [
      { label: t('export.metadata.question'), value: question },
      { label: t('export.metadata.answer'), value: result.answer },
      {
        label: t('export.metadata.scope'),
        value: t(`exportScopes.${result.scope}`, { defaultValue: result.scope }),
      },
      { label: t('export.metadata.generatedAt'), value: generatedAt },
      { label: t('export.metadata.conversationId'), value: result.conversationId },
      { label: t('export.metadata.messageId'), value: result.messageId },
      { label: t('export.metadata.language'), value: language },
    ],
    sections,
  };
}

const safeSheetName = (value: string, fallback: string): string => {
  const normalized = value.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, 31);
};

export async function exportWarehouseAssistantToExcel(params: WarehouseAssistantExportParams): Promise<void> {
  const model = buildWarehouseAssistantExportModel(params);
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const summaryRows: WarehouseAssistantExportCell[][] = [
    [model.title],
    [],
    ...model.metadata.map((item) => [item.label, item.value]),
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows, { cellDates: true, dateNF: 'yyyy-mm-dd hh:mm:ss' });
  summary['!cols'] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, summary, safeSheetName(params.t('export.summarySheet'), 'Summary'));

  model.sections.forEach((item, index) => {
    const rows = [
      item.columns.map((column) => column.label),
      ...item.rows.map((row) => item.columns.map((column) => row[column.key] ?? '')),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'yyyy-mm-dd hh:mm:ss' });
    worksheet['!cols'] = item.columns.map((column) => ({ wch: column.width }));
    if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(item.title, `Data ${index + 1}`));
  });

  XLSX.writeFile(workbook, `${model.fileName}.xlsx`, { compression: true });
}

const formatCellForPdf = (value: WarehouseAssistantExportCell, language: string): string => {
  if (value instanceof Date) return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(value);
  if (typeof value === 'number') return new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
  return value;
};

export async function exportWarehouseAssistantToPdf(params: WarehouseAssistantExportParams): Promise<void> {
  const model = buildWarehouseAssistantExportModel(params);
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const font = await registerPdfExportFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 62, 'F');
  doc.setFont(font, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(model.title, margin, 37);
  doc.setFontSize(8);
  doc.text(new Intl.DateTimeFormat(params.language, { dateStyle: 'medium', timeStyle: 'short' }).format(model.generatedAt), pageWidth - margin, 37, { align: 'right' });

  let cursorY = 82;
  doc.setTextColor(30, 41, 59);
  for (const item of model.metadata.slice(0, 3)) {
    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.text(`${item.label}:`, margin, cursorY);
    doc.setFont(font, 'normal');
    const lines = doc.splitTextToSize(String(item.value || '-'), pageWidth - margin * 2 - 115);
    doc.text(lines, margin + 112, cursorY);
    cursorY += Math.max(16, lines.length * 10 + 4);
    if (cursorY > pageHeight - 70) {
      doc.addPage();
      cursorY = 34;
    }
  }

  for (const item of model.sections) {
    const pdfColumns = item.columns.filter((column) => column.includeInPdf !== false);
    if (cursorY > pageHeight - 110) {
      doc.addPage();
      cursorY = 34;
    }
    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(8, 145, 178);
    doc.text(item.title, margin, cursorY);
    cursorY += 8;
    autoTable(doc, {
      startY: cursorY,
      head: [pdfColumns.map((column) => column.label)],
      body: item.rows.map((row) => pdfColumns.map((column) => formatCellForPdf(row[column.key] ?? '', params.language))),
      theme: 'grid',
      styles: { font, fontStyle: 'normal', fontSize: 6.8, cellPadding: 3, overflow: 'linebreak', textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.3 },
      headStyles: { font, fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { top: 30, right: margin, bottom: 30, left: margin },
      showHead: 'everyPage',
    });
    const tableState = doc as typeof doc & { lastAutoTable?: { finalY?: number } };
    cursorY = (tableState.lastAutoTable?.finalY ?? cursorY) + 20;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
  }

  doc.save(`${model.fileName}.pdf`);
}
