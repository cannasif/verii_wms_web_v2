import type {
  GridPage,
  GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { api } from "@/lib/axios";
import type {
  ProcurementDocumentDetail,
  ProcurementDocumentType,
  ProcurementGridRow,
  ProcurementPolicy,
  ProcurementRequestLineInput,
  ProcurementSummary,
  QuoteOrderLineInput,
  RfqRequestLineInput,
  SupplierPortalQuote,
  SupplierQuoteLineInput,
} from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}
const unwrap = <T>(x: Envelope<T>): T => {
  if (!x.success) throw new Error(x.message || "Satınalma işlemi başarısız.");
  return x.data;
};
export const procurementApi = {
  summary: async (): Promise<ProcurementSummary> =>
    unwrap(
      await api.get<Envelope<ProcurementSummary>>("/api/procurement/summary"),
    ),
  paged: async (
    type: ProcurementDocumentType,
    request: GridRequest,
  ): Promise<GridPage<ProcurementGridRow>> =>
    unwrap(
      await api.post<Envelope<GridPage<ProcurementGridRow>>>(
        `/api/procurement/${type}/paged`,
        request,
      ),
    ),
  detail: async (
    type: ProcurementDocumentType,
    id: number,
  ): Promise<ProcurementDocumentDetail> =>
    unwrap(
      await api.get<Envelope<ProcurementDocumentDetail>>(
        `/api/procurement/${type}/${id}`,
      ),
    ),
  createRequest: async (payload: {
    requestDate: string;
    requiredDate?: string;
    departmentCode?: string;
    projectCode?: string;
    subject: string;
    description?: string;
    lines: ProcurementRequestLineInput[];
  }): Promise<number> =>
    unwrap<{ id: number }>(
      await api.post<Envelope<{ id: number }>>(
        "/api/procurement/requests",
        payload,
      ),
    ).id,
  policy: async (): Promise<ProcurementPolicy> =>
    unwrap(
      await api.get<Envelope<ProcurementPolicy>>("/api/procurement/policy"),
    ),
  updatePolicy: async (
    payload: Omit<
      ProcurementPolicy,
      "id" | "branchCode" | "updatedBy" | "updatedDate"
    >,
  ): Promise<ProcurementPolicy> =>
    unwrap(
      await api.put<Envelope<ProcurementPolicy>>(
        "/api/procurement/policy",
        payload,
        { useNativeHttpMethod: true },
      ),
    ),
  convertRequestToRfq: async (
    id: number,
    payload: {
      responseDueDate: string;
      supplierIds: number[];
      buyerMessage?: string;
      lines: RfqRequestLineInput[];
    },
  ): Promise<number> =>
    unwrap<{ rfqId: number }>(
      await api.post<Envelope<{ rfqId: number }>>(
        `/api/procurement/requests/${id}/convert-to-rfq`,
        payload,
      ),
    ).rfqId,
  createQuote: async (
    rfqId: number,
    payload: {
      supplierId: number;
      quoteNo: string;
      quoteDate?: string;
      validUntil?: string;
      currencyCode: string;
      exchangeRate: number;
      note?: string;
      lines: SupplierQuoteLineInput[];
    },
  ): Promise<number> =>
    unwrap<{ id: number }>(
      await api.post<Envelope<{ id: number }>>(
        `/api/procurement/rfqs/${rfqId}/quotes`,
        payload,
      ),
    ).id,
  convertQuoteToOrder: async (
    id: number,
    payload: {
      lines: QuoteOrderLineInput[];
      orderDate?: string;
      deliveryDate?: string;
      projectCode?: string;
      description?: string;
    },
  ): Promise<number> =>
    unwrap<{ orderId: number }>(
      await api.post<Envelope<{ orderId: number }>>(
        `/api/procurement/quotes/${id}/convert-to-order`,
        payload,
      ),
    ).orderId,
  transition: async (
    type: ProcurementDocumentType,
    id: number,
    action: string,
    note?: string,
  ): Promise<void> => {
    await api.post(`/api/procurement/${type}s/${id}/${action}`, {
      note: note?.trim() || null,
    });
  },
  sendInvitation: async (
    rfqId: number,
    payload: { supplierId: number; recipientEmail: string },
  ): Promise<void> => {
    await api.post(`/api/procurement/rfqs/${rfqId}/invitations`, payload);
  },
  revokeInvitation: async (
    rfqId: number,
    supplierId: number,
  ): Promise<void> => {
    await api.post(
      `/api/procurement/rfqs/${rfqId}/invitations/${supplierId}/revoke`,
    );
  },
  requestRevision: async (quoteId: number, note?: string): Promise<void> => {
    await api.post(`/api/procurement/quotes/${quoteId}/request-revision`, {
      note: note?.trim() || null,
    });
  },
  portalGet: async (token: string): Promise<SupplierPortalQuote> =>
    unwrap(
      await api.get<Envelope<SupplierPortalQuote>>(
        `/api/public/procurement/quotes/${encodeURIComponent(token)}`,
        { skipAuth: true, skipSessionExpiredOn401: true },
      ),
    ),
  portalSave: async (token: string, payload: unknown): Promise<void> => {
    await api.put(
      `/api/public/procurement/quotes/${encodeURIComponent(token)}/draft`,
      payload,
      {
        skipAuth: true,
        skipSessionExpiredOn401: true,
        useNativeHttpMethod: true,
      },
    );
  },
  portalSubmit: async (token: string, payload: unknown): Promise<void> => {
    await api.post(
      `/api/public/procurement/quotes/${encodeURIComponent(token)}/submit`,
      payload,
      { skipAuth: true, skipSessionExpiredOn401: true },
    );
  },
};
