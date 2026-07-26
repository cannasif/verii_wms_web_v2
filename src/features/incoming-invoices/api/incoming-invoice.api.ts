import { api } from '@/lib/axios';
import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import type {
  ELogoConnectionRow,
  IncomingInvoiceDetail,
  IncomingInvoiceDocumentFormat,
  IncomingInvoiceGridRow,
  IncomingInvoiceGoodsReceiptResult,
  IncomingInvoiceImportResult,
  IncomingInvoiceLookupKind,
  SaveELogoConnectionInput,
} from '../types/incoming-invoice.types';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem tamamlanamadı.');
  return value.data;
};

export const incomingInvoiceApi = {
  selectableConnections: async (branchCode: string): Promise<ELogoConnectionRow[]> =>
    unwrap(await api.get<Envelope<ELogoConnectionRow[]>>(
      '/api/incoming-invoices/connections/selectable', { params: { branchCode } })),

  pagedConnections: async (
    branchCode: string, request: GridRequest,
  ): Promise<GridPage<ELogoConnectionRow>> =>
    unwrap(await api.post<Envelope<GridPage<ELogoConnectionRow>>>(
      '/api/incoming-invoices/connections/paged', request, { params: { branchCode } })),

  createConnection: async (input: SaveELogoConnectionInput): Promise<ELogoConnectionRow> =>
    unwrap(await api.post<Envelope<ELogoConnectionRow>>(
      '/api/incoming-invoices/connections', input)),

  updateConnection: async (
    id: number, input: SaveELogoConnectionInput,
  ): Promise<ELogoConnectionRow> =>
    unwrap(await api.put<Envelope<ELogoConnectionRow>>(
      `/api/incoming-invoices/connections/${id}`, input)),

  deleteConnection: async (id: number, branchCode: string): Promise<void> => {
    unwrap(await api.delete<Envelope<boolean>>(
      `/api/incoming-invoices/connections/${id}`, { params: { branchCode } }));
  },

  paged: async (
    branchCode: string, request: GridRequest,
  ): Promise<GridPage<IncomingInvoiceGridRow>> =>
    unwrap(await api.post<Envelope<GridPage<IncomingInvoiceGridRow>>>(
      '/api/incoming-invoices/paged', request, { params: { branchCode } })),

  detail: async (id: number, branchCode: string): Promise<IncomingInvoiceDetail> =>
    unwrap(await api.get<Envelope<IncomingInvoiceDetail>>(
      `/api/incoming-invoices/${id}`, { params: { branchCode } })),

  import: async (input: {
    branchCode: string;
    connectionId: number;
    uuid: string;
    invoiceKind: IncomingInvoiceLookupKind;
    includePdf: boolean;
  }): Promise<IncomingInvoiceImportResult> =>
    unwrap(await api.post<Envelope<IncomingInvoiceImportResult>>(
      '/api/incoming-invoices/import', input)),

  document: async (
    id: number, format: IncomingInvoiceDocumentFormat, branchCode: string,
  ): Promise<Blob> =>
    await api.get<Blob>(
      `/api/incoming-invoices/${id}/documents/${format}`,
      { params: { branchCode }, responseType: 'blob' }),

  createGoodsReceipt: async (
    id: number,
    input: {
      idempotencyKey: string;
      branchCode: string;
      supplierId: number;
      documentSeriesId: number;
      targetWarehouseId: number;
      receivingLocationId: number;
      isElectronicWaybill: boolean;
      waybillNo: string;
      waybillDate: string;
      plannedArrivalAtUtc?: string | null;
      labelStrategy: string;
      priority: number;
      description?: string | null;
      assignedUserIds: number[];
      lines: Array<{ incomingInvoiceLineId: number; quantity: number }>;
    },
  ): Promise<IncomingInvoiceGoodsReceiptResult> =>
    unwrap(await api.post<Envelope<IncomingInvoiceGoodsReceiptResult>>(
      `/api/incoming-invoices/${id}/goods-receipts`, input)),
};
