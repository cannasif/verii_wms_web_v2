import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Package,
  Scale,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { usePermissionAccess } from "@/features/access-control/hooks/usePermissionAccess";
import { goodsReceiptV2Api } from "@/features/goods-receipt-v2/api/goods-receipt.api";
import type { CustomerOption } from "@/features/goods-receipt-v2/types/goods-receipt.types";
import type { DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import { useAuthStore } from "@/stores/auth-store";
import {
  formatProjectDate,
  formatProjectNumber,
} from "@/lib/project-format";
import { cn } from "@/lib/utils";
import type { PagedResponse } from "@/types/api";
import { procurementApi } from "./api";
import {
  LineAttachmentBadge,
  LineAttachmentsDialog,
  PendingAttachmentsEditor,
  SavedAttachmentsViewer,
  revokePendingAttachments,
  uploadPendingAttachments,
  type PendingAttachment,
} from "./ProcurementAttachments";
import type {
  ProcurementDocumentDetail,
  ProcurementGridRow,
  SupplierQuoteLineInput,
} from "./types";

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages:
    page.totalPages ??
    Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

async function fetchApprovedRequestsPage({
  pageNumber,
  pageSize,
  search,
}: {
  pageNumber: number;
  pageSize: number;
  search: string;
}): Promise<PagedResponse<ProcurementGridRow>> {
  const page = await procurementApi.paged("request", {
    pageNumber,
    pageSize,
    search: search || null,
    searchFields: ["documentNo", "subject"],
    sortBy: "documentDate",
    sortDirection: "desc",
    filterLogic: "or",
    filters: [
      { column: "status", operator: "eq", value: "Approved" },
      { column: "status", operator: "eq", value: "PartiallyConverted" },
    ],
  });
  return {
    data: page.data ?? page.items ?? [],
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
    totalPages:
      page.totalPages ??
      Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
    hasPreviousPage: Boolean(page.hasPreviousPage),
    hasNextPage: Boolean(page.hasNextPage),
  };
}

const today = () => new Date().toLocaleDateString("en-CA");
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

const statusLabel: Record<string, string> = {
  Draft: "Taslak",
  PendingApproval: "Onay Bekliyor",
  Approved: "Onaylandı",
  Rejected: "Reddedildi",
  Converted: "Siparişe Dönüştü",
  PartiallyConverted: "Kısmi Sipariş",
  Cancelled: "İptal",
  Sent: "Gönderildi",
  Quoted: "Teklif Alındı",
  Closed: "Kapalı",
  Submitted: "Sunuldu",
};

type QuoteFormLine = {
  requestLineId: number;
  stockCode?: string;
  stockName: string;
  unitCode: string;
  requestedQuantity: number;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
  deliveryDate?: string;
  included: boolean;
};

const lineTotal = (
  x: Pick<
    QuoteFormLine,
    "quantity" | "unitPrice" | "discountRate" | "vatRate"
  >,
) =>
  x.quantity *
  x.unitPrice *
  (1 - x.discountRate / 100) *
  (1 + x.vatRate / 100);

const quoteQtyTotal = (detail: ProcurementDocumentDetail) =>
  detail.lines.reduce((sum, x) => sum + x.quantity, 0);

const quoteMoneyTotal = (detail: ProcurementDocumentDetail) =>
  detail.lines.reduce(
    (sum, x) =>
      sum +
      x.quantity *
        x.unitPrice *
        (1 - x.discountRate / 100) *
        (1 + x.vatRate / 100),
    0,
  );

const quoteTermin = (detail: ProcurementDocumentDetail) => {
  const dates = detail.lines
    .map((x) => x.requiredDate)
    .filter((x): x is string => Boolean(x))
    .sort();
  return dates[0] ?? detail.dueDate;
};

const quoteOpenQty = (detail: ProcurementDocumentDetail) =>
  detail.lines.reduce((sum, x) => sum + Math.max(0, x.openQuantity), 0);

const quoteUnitPrice = (detail: ProcurementDocumentDetail) =>
  detail.lines[0]?.unitPrice ?? 0;

const awardMoney = (detail: ProcurementDocumentDetail, awardQty: number) => {
  if (awardQty <= 0 || detail.lines.length === 0) return 0;
  let remaining = awardQty;
  let total = 0;
  for (const line of detail.lines.filter((x) => x.openQuantity > 0)) {
    if (remaining <= 0) break;
    const qty = Math.min(line.openQuantity, remaining);
    total +=
      qty *
      line.unitPrice *
      (1 - line.discountRate / 100) *
      (1 + line.vatRate / 100);
    remaining -= qty;
  }
  return total;
};

const buildAwardOrderLines = (
  quote: ProcurementDocumentDetail,
  awardQty: number,
) => {
  let remaining = awardQty;
  const lines: Array<{ quoteLineId: number; quantity: number }> = [];
  for (const line of quote.lines.filter((x) => x.openQuantity > 0)) {
    if (remaining <= 0) break;
    const quantity = Math.min(line.openQuantity, remaining);
    if (quantity > 0) {
      lines.push({ quoteLineId: line.id, quantity });
      remaining -= quantity;
    }
  }
  return { lines, leftover: remaining };
};

const isAwardableQuote = (quote: ProcurementDocumentDetail) =>
  (quote.status === "Submitted" ||
    quote.status === "Approved" ||
    quote.status === "PartiallyConverted") &&
  quoteOpenQty(quote) > 0;

async function ensureRfqForRequest(
  request: ProcurementDocumentDetail,
  supplierId: number | null,
): Promise<ProcurementDocumentDetail> {
  const page = await procurementApi.paged("rfq", {
    pageNumber: 1,
    pageSize: 50,
    search: null,
    searchFields: ["documentNo", "subject"],
    sortBy: "documentDate",
    sortDirection: "desc",
    filterLogic: "and",
    filters: [
      {
        column: "requestId",
        operator: "eq",
        value: String(request.id),
      },
    ],
  });

  const candidates = (page.data ?? page.items ?? []).filter((x) =>
    ["Draft", "Sent", "Quoted"].includes(x.status),
  );

  let chosen: ProcurementDocumentDetail | undefined;
  for (const row of candidates) {
    const detail = await procurementApi.detail("rfq", row.id);
    if (
      supplierId != null &&
      detail.suppliers?.some((s) => s.supplierId === supplierId)
    ) {
      chosen = detail;
      break;
    }
    if (!chosen && (detail.status === "Sent" || detail.status === "Quoted")) {
      chosen = detail;
    } else if (!chosen && detail.status === "Draft") {
      chosen = detail;
    }
  }

  if (!chosen) {
    const openLines = request.lines.filter((x) => x.openQuantity > 0);
    if (openLines.length === 0) {
      throw new Error("Talebin teklif girilebilecek açık miktarı yok.");
    }
    let rfqNo: string | undefined;
    try {
      rfqNo = await procurementApi.nextDocumentNo("rfq");
    } catch {
      rfqNo = undefined;
    }
    const rfqId = await procurementApi.convertRequestToRfq(request.id, {
      responseDueDate: request.dueDate || addDays(14),
      supplierIds: supplierId != null ? [supplierId] : [],
      rfqNo,
      lines: openLines.map((x) => ({
        requestLineId: x.id,
        quantity: x.openQuantity,
      })),
    });
    chosen = await procurementApi.detail("rfq", rfqId);
  }

  if (chosen.status === "Draft") {
    await procurementApi.transition("rfq", chosen.id, "send");
    chosen = await procurementApi.detail("rfq", chosen.id);
  }

  if (chosen.status !== "Sent" && chosen.status !== "Quoted") {
    throw new Error(
      "Bu talep için teklif girilebilecek açık bir tur bulunamadı.",
    );
  }

  return chosen;
}

function mapFormLinesToQuoteInputs(
  formLines: QuoteFormLine[],
  rfq: ProcurementDocumentDetail,
): SupplierQuoteLineInput[] {
  const included = formLines.filter((x) => x.included);
  return included.map((line) => {
    const rfqLine =
      rfq.lines.find((x) => x.sourceRequestLineId === line.requestLineId) ??
      rfq.lines.find(
        (x) =>
          Boolean(line.stockCode) &&
          x.stockCode === line.stockCode &&
          x.unitCode === line.unitCode,
      ) ??
      rfq.lines.find(
        (x) =>
          x.stockName === line.stockName && x.unitCode === line.unitCode,
      );
    if (!rfqLine) {
      throw new Error(
        `"${line.stockName}" kalemi için teklif satırı eşleştirilemedi.`,
      );
    }
    return {
      rfqLineId: rfqLine.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      vatRate: line.vatRate,
      deliveryDate: line.deliveryDate || undefined,
    };
  });
}

export function SupplierQuoteEntryPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRequestId =
    Number(searchParams.get("requestId") || 0) || undefined;
  const initialRfqId = Number(searchParams.get("rfqId") || 0) || undefined;
  const branch = useAuthStore((x) => x.branch?.code ?? "0");
  const { can } = usePermissionAccess();
  const canManage = can("WMS.PROCUREMENT.QUOTE.MANAGE");
  const canApprove = can("WMS.PROCUREMENT.APPROVE");
  const canOrder = can("WMS.PROCUREMENT.ORDER.MANAGE");

  const [request, setRequest] = useState<ProcurementDocumentDetail>();
  const [fetchBusy, setFetchBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [relatedBusy, setRelatedBusy] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [requestLookupOpen, setRequestLookupOpen] = useState(false);
  const [savedQuote, setSavedQuote] = useState<{
    id: number;
    documentNo: string;
    supplierName: string;
    requestNo: string;
  } | null>(null);

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCode, setSupplierCode] = useState<string | null>(null);
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [quoteNo, setQuoteNo] = useState("");
  const [quoteNoReady, setQuoteNoReady] = useState(false);
  const [quoteDate, setQuoteDate] = useState(today);
  const [validUntil, setValidUntil] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<QuoteFormLine[]>([]);
  const [headerFiles, setHeaderFiles] = useState<PendingAttachment[]>([]);
  const [lineFiles, setLineFiles] = useState<
    Record<number, PendingAttachment[]>
  >({});
  const [lineAttachId, setLineAttachId] = useState<number | null>(null);
  const hasSupplier = Boolean(supplierName.trim());

  const [relatedQuotes, setRelatedQuotes] = useState<
    ProcurementDocumentDetail[]
  >([]);
  const [awardByQuoteId, setAwardByQuoteId] = useState<Record<number, number>>(
    {},
  );
  const [viewQuote, setViewQuote] = useState<ProcurementDocumentDetail>();
  const [confirmConvertOpen, setConfirmConvertOpen] = useState(false);
  const [selectBusy, setSelectBusy] = useState(false);

  const applyRequest = useCallback((detail: ProcurementDocumentDetail) => {
    if (detail.documentType !== "request") {
      toast.error("Seçilen belge bir satın alma talebi değil.");
      return;
    }
    if (
      detail.status !== "Approved" &&
      detail.status !== "PartiallyConverted"
    ) {
      toast.error(
        "Yalnız onaylanmış veya kısmi sipariş verilmiş taleplere teklif girilebilir.",
      );
      return;
    }
    const openLines = detail.lines.filter((x) => x.openQuantity > 0);
    if (openLines.length === 0) {
      toast.error("Talebin teklif girilebilecek açık miktarı yok.");
      return;
    }
    setRequest(detail);
    setStep(0);
    setSavedQuote(null);
    setDeliveryDate(detail.dueDate ?? "");
    setLines(
      openLines.map((x) => ({
        requestLineId: x.id,
        stockCode: x.stockCode,
        stockName: x.stockName,
        unitCode: x.unitCode,
        requestedQuantity: x.quantity,
        quantity: x.openQuantity,
        unitPrice: 0,
        discountRate: 0,
        vatRate: 20,
        deliveryDate: x.requiredDate ?? detail.dueDate,
        included: true,
      })),
    );
  }, []);

  const loadRequestById = useCallback(
    async (id: number) => {
      setFetchBusy(true);
      try {
        applyRequest(await procurementApi.detail("request", id));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Satın alma talebi yüklenemedi.",
        );
      } finally {
        setFetchBusy(false);
      }
    },
    [applyRequest],
  );

  const loadRelatedQuotes = useCallback(async (reqId: number) => {
    setRelatedBusy(true);
    try {
      const page = await procurementApi.paged("quote", {
        pageNumber: 1,
        pageSize: 50,
        search: null,
        searchFields: ["documentNo", "subject", "counterparty"],
        sortBy: "documentDate",
        sortDirection: "desc",
        filterLogic: "and",
        filters: [
          {
            column: "requestId",
            operator: "eq",
            value: String(reqId),
          },
        ],
      });
      const rows = page.data ?? page.items ?? [];
      const details = await Promise.all(
        rows.map((row) => procurementApi.detail("quote", row.id)),
      );
      setRelatedQuotes(
        details.filter(
          (x) => x.status !== "Cancelled" && x.status !== "Rejected",
        ),
      );
      setAwardByQuoteId({});
    } catch (e) {
      setRelatedQuotes([]);
      setAwardByQuoteId({});
      toast.error(
        e instanceof Error ? e.message : "Talebin teklifleri yüklenemedi.",
      );
    } finally {
      setRelatedBusy(false);
    }
  }, []);

  useEffect(() => {
    if (initialRequestId) void loadRequestById(initialRequestId);
  }, [initialRequestId, loadRequestById]);

  useEffect(() => {
    if (!initialRfqId || initialRequestId) return;
    void (async () => {
      setFetchBusy(true);
      try {
        const rfq = await procurementApi.detail("rfq", initialRfqId);
        if (rfq.requestId) {
          applyRequest(await procurementApi.detail("request", rfq.requestId));
        } else {
          toast.error(
            "Bu teklif turu bir satın alma talebine bağlı değil; listeden talep seçin.",
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Talep yüklenemedi.");
      } finally {
        setFetchBusy(false);
      }
    })();
  }, [applyRequest, initialRequestId, initialRfqId]);

  useEffect(() => {
    if (request?.id) void loadRelatedQuotes(request.id);
    else {
      setRelatedQuotes([]);
      setAwardByQuoteId({});
    }
  }, [loadRelatedQuotes, request?.id]);

  const patchLine = (id: number, next: Partial<QuoteFormLine>) =>
    setLines((xs) =>
      xs.map((x) => (x.requestLineId === id ? { ...x, ...next } : x)),
    );

  const total = useMemo(
    () =>
      lines
        .filter((x) => x.included)
        .reduce((sum, x) => sum + lineTotal(x), 0),
    [lines],
  );

  const includedLines = useMemo(
    () => lines.filter((x) => x.included),
    [lines],
  );

  const quoteQtySum = useMemo(
    () => includedLines.reduce((sum, x) => sum + x.quantity, 0),
    [includedLines],
  );

  const requestQtySum = useMemo(
    () =>
      request
        ? request.lines.reduce((sum, x) => sum + x.quantity, 0)
        : lines.reduce((sum, x) => sum + x.requestedQuantity, 0),
    [lines, request],
  );

  const reviewWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!request) warnings.push("Satın alma talebi seçilmedi.");
    if (!supplierName.trim()) warnings.push("Tedarikçi seçilmedi veya adı girilmedi.");
    if (!quoteNo.trim()) warnings.push("Teklif numarası eksik.");
    if (exchangeRate <= 0) warnings.push("Kur 0'dan büyük olmalıdır.");
    if (includedLines.length === 0)
      warnings.push("En az bir teklif kalemi seçilmelidir.");
    for (const line of includedLines) {
      const label = line.stockCode
        ? `${line.stockCode} · ${line.stockName}`
        : line.stockName;
      if (line.quantity <= 0)
        warnings.push(`"${label}" için teklif miktarı 0 olamaz.`);
      if (line.quantity > line.requestedQuantity)
        warnings.push(
          `"${label}" teklif miktarı talep miktarını aşıyor.`,
        );
      if (line.unitPrice < 0)
        warnings.push(`"${label}" için birim fiyat geçersiz.`);
      if (line.discountRate < 0 || line.discountRate > 100)
        warnings.push(`"${label}" için iskonto oranı geçersiz.`);
      if (line.vatRate < 0)
        warnings.push(`"${label}" için KDV oranı geçersiz.`);
    }
    return warnings;
  }, [exchangeRate, includedLines, quoteNo, request, supplierName]);

  const loadNextQuoteNo = useCallback(async () => {
    setQuoteNoReady(false);
    try {
      setQuoteNo(await procurementApi.nextDocumentNo("quote"));
      setQuoteNoReady(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Teklif numarası alınamadı.",
      );
    }
  }, []);

  useEffect(() => {
    void loadNextQuoteNo();
  }, [loadNextQuoteNo]);

  const resetQuoteForm = () => {
    setSupplierId(null);
    setSupplierName("");
    setSupplierCode(null);
    setSupplierLookupOpen(false);
    setQuoteDate(today());
    setValidUntil("");
    setNote("");
    setExchangeRate(1);
    setCurrency("TRY");
    setStep(0);
    revokePendingAttachments(headerFiles);
    for (const files of Object.values(lineFiles))
      revokePendingAttachments(files);
    setHeaderFiles([]);
    setLineFiles({});
    setLineAttachId(null);
    void loadNextQuoteNo();
    if (request) {
      setDeliveryDate(request.dueDate ?? "");
      setLines(
        request.lines
          .filter((x) => x.openQuantity > 0)
          .map((x) => ({
            requestLineId: x.id,
            stockCode: x.stockCode,
            stockName: x.stockName,
            unitCode: x.unitCode,
            requestedQuantity: x.quantity,
            quantity: x.openQuantity,
            unitPrice: 0,
            discountRate: 0,
            vatRate: 20,
            deliveryDate: x.requiredDate ?? request.dueDate,
            included: true,
          })),
      );
    }
  };

  const validateQuoteForm = (): boolean => {
    if (!request) {
      toast.error("Önce satın alma talebi seçin.");
      return false;
    }
    if (!supplierName.trim()) {
      toast.error("Tedarikçi adı girin veya sistemden tedarikçi seçin.");
      return false;
    }
    if (!quoteNo.trim()) {
      toast.error("Teklif numarası zorunludur.");
      return false;
    }
    const included = lines.filter((x) => x.included);
    if (
      exchangeRate <= 0 ||
      included.length === 0 ||
      included.some(
        (x) =>
          x.quantity <= 0 ||
          x.quantity > x.requestedQuantity ||
          x.unitPrice < 0 ||
          x.discountRate < 0 ||
          x.discountRate > 100 ||
          x.vatRate < 0,
      )
    ) {
      toast.error(
        "Geçerli teklif kalemleri, birim fiyat ve kur zorunludur. Miktar talep miktarını aşamaz.",
      );
      return false;
    }
    return true;
  };

  const goToReview = () => {
    if (!validateQuoteForm()) return;
    setStep(1);
  };

  const save = async () => {
    if (!validateQuoteForm() || !request) return;
    const trimmedSupplierName = supplierName.trim();
    const trimmedQuoteNo = quoteNo.trim();
    const included = lines.filter((x) => x.included);
    setSaveBusy(true);
    try {
      const rfq = await ensureRfqForRequest(request, supplierId);
      const quoteLines = mapFormLinesToQuoteInputs(
        included.map((x) => ({
          ...x,
          deliveryDate: x.deliveryDate || deliveryDate || undefined,
        })),
        rfq,
      );
      const quoteId = await procurementApi.createQuote(rfq.id, {
        supplierId: supplierId ?? null,
        supplierName: trimmedSupplierName,
        quoteNo: trimmedQuoteNo,
        quoteDate,
        validUntil: validUntil || undefined,
        currencyCode: currency,
        exchangeRate,
        note: note || undefined,
        lines: quoteLines,
      });
      const quoteDetail = await procurementApi.detail("quote", quoteId);
      await uploadPendingAttachments("quote", quoteId, headerFiles);
      for (const formLine of included) {
        const pending = lineFiles[formLine.requestLineId] ?? [];
        if (pending.length === 0) continue;
        const created = quoteDetail.lines.find(
          (x) => x.sourceRequestLineId === formLine.requestLineId,
        );
        if (created)
          await uploadPendingAttachments("quote-line", created.id, pending);
      }
      toast.success("Tedarikçi teklifi kaydedildi.");
      setSavedQuote({
        id: quoteId,
        documentNo: trimmedQuoteNo,
        supplierName: trimmedSupplierName,
        requestNo: request.documentNo,
      });
      resetQuoteForm();
      await loadRelatedQuotes(request.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Teklif kaydedilemedi.");
    } finally {
      setSaveBusy(false);
    }
  };

  const distribution = useMemo(() => {
    if (!request) {
      return {
        requested: 0,
        alreadyOrdered: 0,
        awarding: 0,
        distributed: 0,
        remaining: 0,
      };
    }
    const requested = request.lines.reduce((sum, x) => sum + x.quantity, 0);
    const alreadyOrdered = request.lines.reduce(
      (sum, x) => sum + x.secondaryQuantity,
      0,
    );
    const awarding = Object.values(awardByQuoteId).reduce(
      (sum, x) => sum + (Number.isFinite(x) ? Math.max(0, x) : 0),
      0,
    );
    const distributed = alreadyOrdered + awarding;
    return {
      requested,
      alreadyOrdered,
      awarding,
      distributed,
      remaining: requested - distributed,
    };
  }, [awardByQuoteId, request]);

  const awardSelections = useMemo(
    () =>
      relatedQuotes
        .filter((quote) => (awardByQuoteId[quote.id] ?? 0) > 0)
        .map((quote) => ({
          quote,
          awardQty: awardByQuoteId[quote.id] ?? 0,
        })),
    [awardByQuoteId, relatedQuotes],
  );

  const setAwardQty = (quoteId: number, raw: number) => {
    const quote = relatedQuotes.find((x) => x.id === quoteId);
    if (!quote) return;
    const max = quoteOpenQty(quote);
    const next = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    setAwardByQuoteId((xs) => ({
      ...xs,
      [quoteId]: Math.min(next, max),
    }));
  };

  const validateAwards = (): string | null => {
    if (!request) return "Satın alma talebi seçilmedi.";
    if (awardSelections.length === 0) {
      return "En az bir tedarikçi için alınacak miktar girin.";
    }
    for (const { quote, awardQty } of awardSelections) {
      if (awardQty < 0) return "Negatif miktar kabul edilmez.";
      if (awardQty > quoteOpenQty(quote)) {
        return `${quote.counterpartyName ?? quote.documentNo} için alınacak miktar teklif açık miktarını aşıyor.`;
      }
      if (!isAwardableQuote(quote)) {
        return `${quote.documentNo} bu turda siparişe dönüştürülemez.`;
      }
      if (quote.status === "Submitted" && !canApprove) {
        return "Sunulmuş teklifleri onaylamak için yetki gerekir.";
      }
    }
    if (distribution.remaining < 0) {
      return `Dağıtılan miktar talep miktarını ${formatProjectNumber(Math.abs(distribution.remaining))} adet aşıyor.`;
    }
    const pendingByRequestLine: Record<number, number> = {};
    for (const { quote, awardQty } of awardSelections) {
      const { lines, leftover } = buildAwardOrderLines(quote, awardQty);
      if (leftover > 0) {
        return `${quote.counterpartyName ?? quote.documentNo} için alınacak miktar teklif kalemlerine sığmıyor.`;
      }
      for (const selection of lines) {
        const quoteLine = quote.lines.find(
          (x) => x.id === selection.quoteLineId,
        );
        const requestLineId =
          quoteLine?.sourceRequestLineId ??
          request.lines.find(
            (r) =>
              quoteLine &&
              r.stockName === quoteLine.stockName &&
              r.unitCode === quoteLine.unitCode,
          )?.id;
        if (!requestLineId) continue;
        pendingByRequestLine[requestLineId] =
          (pendingByRequestLine[requestLineId] ?? 0) + selection.quantity;
      }
    }
    for (const line of request.lines) {
      const pending = pendingByRequestLine[line.id] ?? 0;
      if (pending <= 0) continue;
      if (pending > line.openQuantity + 1e-9) {
        return `${line.stockName} için dağıtılan miktar açık talep bakiyesini aşıyor.`;
      }
    }
    return null;
  };

  const convertAwards = async () => {
    const error = validateAwards();
    if (error) {
      toast.error(error);
      return;
    }
    if (!canOrder) {
      toast.error("Sipariş oluşturmak için satınalma sipariş yetkisi gerekir.");
      return;
    }
    setSelectBusy(true);
    try {
      let created = 0;
      for (const { quote, awardQty } of awardSelections) {
        let current = quote;
        if (current.status === "Submitted") {
          await procurementApi.transition("quote", current.id, "approve");
          current = await procurementApi.detail("quote", current.id);
        }
        const { lines: orderLines } = buildAwardOrderLines(current, awardQty);
        if (orderLines.length === 0) {
          throw new Error(
            `${current.documentNo} için dönüştürülecek açık miktar yok.`,
          );
        }
        const orderNo = await procurementApi.nextDocumentNo("order");
        await procurementApi.convertQuoteToOrder(current.id, {
          lines: orderLines,
          orderNo,
        });
        created += 1;
      }
      toast.success(
        `${created} tedarikçi için satın alma siparişi oluşturuldu.`,
      );
      setConfirmConvertOpen(false);
      setAwardByQuoteId({});
      if (request) {
        const refreshed = await procurementApi.detail("request", request.id);
        setRequest(refreshed);
        await loadRelatedQuotes(request.id);
      }
      navigate("/procurement/orders");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Siparişler oluşturulamadı.",
      );
      if (request) {
        await loadRelatedQuotes(request.id);
        try {
          setRequest(await procurementApi.detail("request", request.id));
        } catch {
          /* ignore */
        }
      }
    } finally {
      setSelectBusy(false);
    }
  };

  if (!canManage) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-[var(--wms-app-panel)] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">
          403
        </p>
        <h1 className="mt-2 text-2xl font-bold">Yetki gerekli</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tedarikçi teklifi girmek için satınalma teklif yetkisi gerekir.
        </p>
        <div className="mt-5 flex justify-center">
          <OpsActionButton asChild variant="secondary">
            <Link to="/procurement/quotes">
              <ArrowRight size={16} className="rotate-180" /> Teklif listesine
              dön
            </Link>
          </OpsActionButton>
        </div>
      </section>
    );
  }

  return (
    <section className="wms-ops-form space-y-5">
      <header className="space-y-2">
        <div className="wms-ops-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
          TEDARİKÇİ TEKLİFİ / SATINALMA
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
              <FileCheck2 className="size-7 text-[var(--wms-brand-primary)]" />
              Tedarikçi teklifi gir
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--wms-app-text-muted)]">
              Onaylı satın alma talebini seçin, tedarikçi ve teklif kalemlerinin
              fiyat/termin bilgilerini girerek teklifi kaydedin.
            </p>
          </div>
          <OpsActionButton asChild variant="secondary">
            <Link to="/procurement/quotes">
              <ArrowRight size={16} className="rotate-180" /> Teklif listesine
              dön
            </Link>
          </OpsActionButton>
        </div>
      </header>

      {!savedQuote ? (
        <nav className="wms-ops-create-steps" aria-label="Teklif giriş adımları">
          {[
            { value: 0 as const, label: "Teklif bilgileri" },
            { value: 1 as const, label: "Kontrol ve kaydet" },
          ].map(({ value, label }) => {
            const active = value === step;
            const done = value < step;
            return (
              <div
                key={value}
                role="tab"
                aria-selected={active}
                className={cn(
                  "wms-ops-create-steps__tab",
                  active && "wms-ops-create-steps__tab--active",
                  done && "wms-ops-create-steps__tab--done",
                )}
              >
                <span className="wms-ops-create-steps__index">{value + 1}</span>
                <span className="wms-ops-create-steps__label">{label}</span>
              </div>
            );
          })}
        </nav>
      ) : null}

      {savedQuote ? (
        <div className="wms-ops-gr-success wms-ops-gr-success--done">
          <div className="wms-ops-gr-success__glow" aria-hidden />
          <header className="wms-ops-gr-success__header">
            <div className="wms-ops-gr-success__icon" aria-hidden>
              <CheckCircle2 className="size-7" />
            </div>
            <p className="wms-ops-gr-success__eyebrow">SATINALMA</p>
            <h2 className="wms-ops-gr-success__title">
              Tedarikçi teklifi kaydedildi
            </h2>
            <p className="wms-ops-gr-success__subtitle">
              Aynı talep için başka tedarikçiden teklif girebilir veya teklifleri
              karşılaştırabilirsiniz.
            </p>
          </header>
          <div className="wms-ops-gr-success__stats">
            <div className="wms-ops-gr-success__stat">
              <span className="wms-ops-gr-success__stat-label">Teklif No</span>
              <strong className="wms-ops-gr-success__stat-value">
                {savedQuote.documentNo}
              </strong>
            </div>
            <div className="wms-ops-gr-success__stat">
              <span className="wms-ops-gr-success__stat-label">Tedarikçi</span>
              <strong className="wms-ops-gr-success__stat-value">
                {savedQuote.supplierName}
              </strong>
            </div>
            <div className="wms-ops-gr-success__stat">
              <span className="wms-ops-gr-success__stat-label">Talep</span>
              <strong className="wms-ops-gr-success__stat-value">
                {savedQuote.requestNo}
              </strong>
            </div>
          </div>
          <footer className="wms-ops-gr-success__actions">
            <OpsActionButton
              type="button"
              variant="primary"
              onClick={() => {
                void (async () => {
                  try {
                    setViewQuote(
                      await procurementApi.detail("quote", savedQuote.id),
                    );
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : "Teklif detayı yüklenemedi.",
                    );
                  }
                })();
              }}
            >
              Teklif detayını görüntüle
            </OpsActionButton>
            <OpsActionButton asChild variant="secondary">
              <Link to="/procurement/quotes">Teklif listesine dön</Link>
            </OpsActionButton>
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => {
                setSavedQuote(null);
                setStep(0);
              }}
            >
              Yeni teklif gir
            </OpsActionButton>
          </footer>
        </div>
      ) : null}

      {!savedQuote && step === 0 ? (
        <>
          <Panel
            title="1. Talep ve teklif bilgileri"
            icon={<ClipboardList className="size-5" />}
          >
            <div className="space-y-5">
              <section className="space-y-3">
                <Field label="Satın Alma Talebi *">
                  {!request ? (
                    <PagedLookupDialog<ProcurementGridRow>
                      variant="ops"
                      open={requestLookupOpen}
                      onOpenChange={setRequestLookupOpen}
                      title="Satın alma talebi seç"
                      description="Onaylı veya kısmi sipariş verilmiş talepler listelenir."
                      value={null}
                      placeholder={
                        fetchBusy ? "Talep yükleniyor…" : "Talep seç"
                      }
                      searchPlaceholder="Talep no veya konu ara…"
                      emptyText="Uygun satın alma talebi bulunamadı"
                      triggerClassName={OPS_FIELD_CLASS}
                      queryKey={["procurement-request-lookup-for-quote"]}
                      fetchPage={fetchApprovedRequestsPage}
                      getKey={(item) => String(item.id)}
                      getLabel={(item) =>
                        `${item.documentNo} · ${item.subject}`
                      }
                      onSelect={(item) => {
                        setRequestLookupOpen(false);
                        void loadRequestById(item.id);
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Satın Alma Talebi
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold text-cyan-300">
                          {request.documentNo}
                        </p>
                        <p className="mt-1 text-sm">{request.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Durum: {statusLabel[request.status] ?? request.status}
                        </p>
                      </div>
                      <OpsActionButton
                        type="button"
                        variant="secondary"
                        onClick={() => setRequestLookupOpen(true)}
                      >
                        Değiştir
                      </OpsActionButton>
                      <PagedLookupDialog<ProcurementGridRow>
                        variant="ops"
                        open={requestLookupOpen}
                        onOpenChange={setRequestLookupOpen}
                        title="Satın alma talebi seç"
                        description="Onaylı veya kısmi sipariş verilmiş talepler listelenir."
                        value={`${request.documentNo} · ${request.subject}`}
                        placeholder="Talep seç"
                        searchPlaceholder="Talep no veya konu ara…"
                        emptyText="Uygun satın alma talebi bulunamadı"
                        triggerClassName="hidden"
                        queryKey={["procurement-request-lookup-for-quote"]}
                        fetchPage={fetchApprovedRequestsPage}
                        getKey={(item) => String(item.id)}
                        getLabel={(item) =>
                          `${item.documentNo} · ${item.subject}`
                        }
                        onSelect={(item) => {
                          setRequestLookupOpen(false);
                          void loadRequestById(item.id);
                        }}
                      />
                    </div>
                  )}
                </Field>

                {request ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="Talep No" value={request.documentNo} />
                    <MetricCard label="Konu" value={request.subject} />
                    <MetricCard
                      label="Talep Miktarı"
                      value={`${formatProjectNumber(requestQtySum)} ${
                        request.lines[0]?.unitCode ?? ""
                      }`.trim()}
                    />
                    <MetricCard
                      label="Termin"
                      value={
                        request.dueDate
                          ? formatProjectDate(request.dueDate)
                          : "—"
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--wms-app-text-muted)]">
                    Teklif kalemlerini doldurmak için önce bir satın alma talebi
                    seçin.
                  </p>
                )}
              </section>

              {request ? (
                <section className="space-y-3 border-t border-[var(--wms-app-border)] pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Tedarikçi Bilgileri
                  </h3>
                  <Field label="Tedarikçi *">
                    <PagedLookupDialog<CustomerOption>
                      variant="ops"
                      triggerMode="combobox"
                      autoSearchMinLength={0}
                      popoverPortalContainer={null}
                      open={supplierLookupOpen}
                      onOpenChange={setSupplierLookupOpen}
                      title="Tedarikçi seç"
                      value={
                        supplierId && supplierCode
                          ? `${supplierCode} · ${supplierName}`
                          : supplierName
                      }
                      placeholder="Kod, unvan veya kendi tedarikçi adınızı yazın…"
                      searchPlaceholder="Kod veya unvan ile tedarikçi ara…"
                      emptyText="Tedarikçi bulunamadı — yazdığınız metin tedarikçi adı olarak kullanılabilir"
                      triggerClassName={OPS_FIELD_CLASS}
                      queryKey={["procurement-quote-suppliers", branch]}
                      fetchPage={async ({
                        pageNumber,
                        pageSize,
                        search,
                        signal,
                      }) =>
                        toPagedResponse(
                          await goodsReceiptV2Api.customers(
                            {
                              pageNumber,
                              pageSize,
                              search,
                              sortBy: "customerCode",
                              sortDirection: "asc",
                              signal: signal ?? new AbortController().signal,
                            },
                            branch,
                          ),
                        )
                      }
                      getKey={(item) => String(item.id)}
                      getLabel={(item) =>
                        `${item.customerCode} · ${item.customerName}`
                      }
                      onComboboxTextChange={(text) => {
                        setSupplierId(null);
                        setSupplierCode(null);
                        setSupplierName(text);
                      }}
                      onSelect={(item) => {
                        setSupplierId(item.id);
                        setSupplierCode(item.customerCode);
                        setSupplierName(item.customerName);
                        setSupplierLookupOpen(false);
                      }}
                    />
                  </Field>
                  {hasSupplier ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard
                        label="Cari Kodu"
                        value={supplierCode || "—"}
                      />
                      <MetricCard label="Cari Adı" value={supplierName} />
                      <MetricCard
                        label="Kaynak"
                        value={
                          supplierId != null ? "Sistem carisi" : "Serbest metin"
                        }
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}

              {request && hasSupplier ? (
                <section className="space-y-3 border-t border-[var(--wms-app-border)] pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Teklif Bilgileri
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Teklif No *">
                      <AppInput
                        value={quoteNo}
                        onChange={(e) => setQuoteNo(e.target.value)}
                        maxLength={100}
                        disabled={!quoteNoReady && !quoteNo}
                      />
                    </Field>
                    <Field label="Teklif Tarihi">
                      <AppDateInput
                        value={quoteDate}
                        onChange={(e) => setQuoteDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Geçerlilik Tarihi">
                      <AppDateInput
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </Field>
                    <Field label="Genel Termin">
                      <AppDateInput
                        value={deliveryDate}
                        onChange={(e) => {
                          setDeliveryDate(e.target.value);
                          setLines((xs) =>
                            xs.map((x) => ({
                              ...x,
                              deliveryDate: e.target.value || x.deliveryDate,
                            })),
                          );
                        }}
                      />
                    </Field>
                    <Field label="Para Birimi">
                      <AppInput
                        value={currency}
                        maxLength={3}
                        onChange={(e) =>
                          setCurrency(e.target.value.toUpperCase())
                        }
                      />
                    </Field>
                    <Field label="Kur">
                      <AppInput
                        type="number"
                        min="0.000001"
                        step="any"
                        value={exchangeRate}
                        onChange={(e) =>
                          setExchangeRate(Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Açıklama / Not">
                    <AppInput
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ödeme, teslim veya teklif açıklaması…"
                    />
                  </Field>
                  <PendingAttachmentsEditor
                    title="Teklif Ekleri"
                    hint="Tedarikçiden alınan teklif belgesi, fiyat listesi, PDF veya referans görsellerini ekleyebilirsiniz."
                    files={headerFiles}
                    onChange={setHeaderFiles}
                  />
                </section>
              ) : null}
            </div>
          </Panel>

          {request && hasSupplier ? (
            <Panel
              title="Teklif Kalemleri"
              icon={<Package className="size-5" />}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Kalem"
                  value={String(includedLines.length)}
                />
                <MetricCard
                  label="Talep"
                  value={formatProjectNumber(requestQtySum)}
                />
                <MetricCard
                  label="Teklif"
                  value={formatProjectNumber(quoteQtySum)}
                />
                <MetricCard
                  label="Toplam"
                  value={`${formatProjectNumber(total)} ${currency}`}
                />
              </div>
              <p className="mb-3 text-xs text-[var(--wms-app-text-muted)]">
                Ürün ve talep miktarı talepten gelir. Teklif miktarı tedarikçinin
                verdiği miktardır; aynı talep farklı tedarikçilere bölünebilir.
              </p>
              <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-cyan-500/5 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2" />
                      <th className="px-2 py-2">Stok Kodu</th>
                      <th className="px-2 py-2">Stok Adı</th>
                      <th className="px-2 py-2">Talep Miktarı</th>
                      <th className="px-2 py-2">Teklif Miktarı</th>
                      <th className="px-2 py-2">Birim Fiyat</th>
                      <th className="px-2 py-2">Termin</th>
                      <th className="px-2 py-2">İskonto</th>
                      <th className="px-2 py-2">KDV</th>
                      <th className="px-2 py-2">Toplam</th>
                      <th className="px-2 py-2">Ek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr
                        key={line.requestLineId}
                        className={`border-t border-cyan-500/10 ${
                          line.included ? "" : "opacity-60"
                        }`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={line.included}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                included: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">
                          {line.stockCode || "—"}
                        </td>
                        <td className="px-2 py-2 font-medium">
                          {line.stockName}
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {line.unitCode}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {formatProjectNumber(line.requestedQuantity)}
                        </td>
                        <td className="px-2 py-2">
                          <AppInput
                            type="number"
                            min="0.000001"
                            max={line.requestedQuantity}
                            step="any"
                            disabled={!line.included}
                            value={line.quantity}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <AppInput
                            type="number"
                            min="0"
                            step="any"
                            disabled={!line.included}
                            value={line.unitPrice}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                unitPrice: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <AppDateInput
                            disabled={!line.included}
                            value={line.deliveryDate ?? ""}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                deliveryDate: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <AppInput
                            type="number"
                            min="0"
                            max="100"
                            disabled={!line.included}
                            value={line.discountRate}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                discountRate: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <AppInput
                            type="number"
                            min="0"
                            disabled={!line.included}
                            value={line.vatRate}
                            onChange={(e) =>
                              patchLine(line.requestLineId, {
                                vatRate: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 font-semibold text-cyan-400">
                          {line.included
                            ? `${formatProjectNumber(lineTotal(line))} ${currency}`
                            : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <LineAttachmentBadge
                            count={(lineFiles[line.requestLineId] ?? []).length}
                            onClick={() => setLineAttachId(line.requestLineId)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {lineAttachId != null ? (
            <LineAttachmentsDialog
              open
              onClose={() => setLineAttachId(null)}
              title="Teklif kalemi ekleri"
              subtitle={
                lines.find((x) => x.requestLineId === lineAttachId)?.stockName
              }
            >
              <PendingAttachmentsEditor
                title="Kalem Ekleri"
                hint="Bu teklif kalemine özel fotoğraf veya dosya ekleyin."
                files={lineFiles[lineAttachId] ?? []}
                onChange={(next) =>
                  setLineFiles((prev) => ({ ...prev, [lineAttachId]: next }))
                }
                compact
              />
            </LineAttachmentsDialog>
          ) : null}

          <footer className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur">
            <OpsActionButton asChild variant="secondary">
              <Link to="/procurement/quotes">Vazgeç</Link>
            </OpsActionButton>
            <OpsActionButton
              type="button"
              variant="primary"
              disabled={!request || !hasSupplier}
              onClick={goToReview}
            >
              Kontrol et <ArrowRight size={16} />
            </OpsActionButton>
          </footer>
        </>
      ) : null}

      {!savedQuote && step === 1 ? (
        <>
          <Panel
            title="Tedarikçi teklifi özeti"
            icon={<FileCheck2 className="size-5" />}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Tedarikçi" value={supplierName || "—"} />
              <MetricCard label="Talep" value={request?.documentNo ?? "—"} />
              <MetricCard label="Teklif No" value={quoteNo || "—"} />
              <MetricCard
                label="Teklif Tarihi"
                value={quoteDate ? formatProjectDate(quoteDate) : "—"}
              />
              <MetricCard
                label="Geçerlilik"
                value={validUntil ? formatProjectDate(validUntil) : "—"}
              />
              <MetricCard
                label="Genel Termin"
                value={deliveryDate ? formatProjectDate(deliveryDate) : "—"}
              />
              <MetricCard label="Para Birimi" value={currency} />
              <MetricCard
                label="Toplam"
                value={`${formatProjectNumber(total)} ${currency}`}
              />
            </div>
            {note ? (
              <p className="mt-4 rounded-xl border border-[var(--wms-app-border)] bg-cyan-500/5 px-3 py-2 text-sm">
                <span className="text-xs uppercase text-slate-500">Not · </span>
                {note}
              </p>
            ) : null}
            {(headerFiles.length > 0 ||
              Object.values(lineFiles).some((x) => x.length > 0)) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Teklif ekleri"
                  value={String(headerFiles.length)}
                />
                <MetricCard
                  label="Kalem ekleri"
                  value={String(
                    Object.values(lineFiles).reduce(
                      (sum, xs) => sum + xs.length,
                      0,
                    ),
                  )}
                />
              </div>
            )}
          </Panel>

          <Panel title="Teklif kalemleri" icon={<Package className="size-5" />}>
            <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-cyan-500/5 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Stok</th>
                    <th className="px-3 py-2">Talep</th>
                    <th className="px-3 py-2">Teklif</th>
                    <th className="px-3 py-2">Birim Fiyat</th>
                    <th className="px-3 py-2">Termin</th>
                    <th className="px-3 py-2">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {includedLines.map((line) => (
                    <tr
                      key={line.requestLineId}
                      className="border-t border-cyan-500/10"
                    >
                      <td className="px-3 py-2 font-medium">
                        {line.stockCode ? `${line.stockCode} · ` : ""}
                        {line.stockName}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(line.requestedQuantity)}{" "}
                        {line.unitCode}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(line.quantity)} {line.unitCode}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(line.unitPrice)} {currency}
                      </td>
                      <td className="px-3 py-2">
                        {line.deliveryDate
                          ? formatProjectDate(line.deliveryDate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-cyan-400">
                        {formatProjectNumber(lineTotal(line))} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {reviewWarnings.length > 0 ? (
            <div
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4"
              role="alert"
            >
              <p className="mb-2 text-sm font-semibold text-rose-200">
                Kaydetmeden önce düzeltin
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-rose-100">
                {reviewWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <footer className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur">
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => setStep(0)}
            >
              <ArrowRight size={16} className="rotate-180" /> Geri
            </OpsActionButton>
            <OpsActionButton
              type="button"
              variant="primary"
              loading={saveBusy}
              disabled={reviewWarnings.length > 0}
              onClick={() => void save()}
            >
              Teklifi kaydet
            </OpsActionButton>
          </footer>
        </>
      ) : null}

      {request && relatedQuotes.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-cyan-500/15 bg-[var(--wms-app-panel)] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-2">
              <Scale className="mt-0.5 size-5 text-cyan-400" />
              <div>
                <h3 className="font-semibold">
                  Teklif Karşılaştırma ve Dağıtım
                </h3>
                <p className="text-xs text-slate-500">
                  Teklif miktarı tedarikçinin verdiği miktardır. Alınacak miktar
                  bu turda siparişe dönüşecek miktardır; aynı talep birden fazla
                  tedarikçiye bölünebilir.
                </p>
              </div>
            </div>
            {relatedBusy ? (
              <span className="text-xs text-slate-500">Yükleniyor…</span>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 sm:grid-cols-4">
            <Info
              label="Talep Miktarı"
              value={formatProjectNumber(distribution.requested)}
            />
            <Info
              label="Siparişe Dönüşen"
              value={formatProjectNumber(distribution.alreadyOrdered)}
            />
            <Info
              label="Bu Turda Dağıtılan"
              value={formatProjectNumber(distribution.awarding)}
            />
            <Info
              label="Kalan"
              value={formatProjectNumber(Math.max(0, distribution.remaining))}
            />
          </div>
          {distribution.remaining > 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {formatProjectNumber(distribution.remaining)} adet henüz
              tedarikçiye dağıtılmadı.
            </p>
          ) : null}
          {distribution.remaining < 0 ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Dağıtılan miktar talep miktarını{" "}
              {formatProjectNumber(Math.abs(distribution.remaining))} adet
              aşıyor.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-cyan-500/15">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-cyan-500/5 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tedarikçi</th>
                  <th className="px-3 py-2">Teklif No</th>
                  <th className="px-3 py-2">Teklif Miktarı</th>
                  <th className="px-3 py-2">Birim Fiyat</th>
                  <th className="px-3 py-2">Teklif Toplamı</th>
                  <th className="px-3 py-2">Alınacak Miktar</th>
                  <th className="px-3 py-2">Alınacak Tutar</th>
                  <th className="px-3 py-2">Termin</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {relatedQuotes.map((quote) => {
                  const awardQty = awardByQuoteId[quote.id] ?? 0;
                  const openQty = quoteOpenQty(quote);
                  const awardable = isAwardableQuote(quote);
                  const termin = quoteTermin(quote);
                  return (
                    <tr
                      key={quote.id}
                      className={`border-t border-cyan-500/10 ${awardQty > 0 ? "bg-cyan-500/5" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        {quote.counterpartyName ||
                          quote.counterpartyCode ||
                          "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {quote.documentNo}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(quoteQtyTotal(quote))}
                        {openQty < quoteQtyTotal(quote) ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Açık: {formatProjectNumber(openQty)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(quoteUnitPrice(quote))}{" "}
                        {quote.currencyCode}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(quoteMoneyTotal(quote))}{" "}
                        {quote.currencyCode}
                      </td>
                      <td className="px-3 py-2">
                        <AppInput
                          type="number"
                          min="0"
                          max={openQty}
                          step="any"
                          disabled={!awardable || !canOrder}
                          value={awardQty}
                          onChange={(e) =>
                            setAwardQty(quote.id, Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-cyan-400">
                        {awardQty > 0
                          ? `${formatProjectNumber(awardMoney(quote, awardQty))} ${quote.currencyCode}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {termin ? formatProjectDate(termin) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-cyan-500/25 px-2 py-1 text-xs text-cyan-400">
                          {statusLabel[quote.status] ?? quote.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <OpsActionButton
                            type="button"
                            variant="secondary"
                            onClick={() => setViewQuote(quote)}
                          >
                            Görüntüle
                          </OpsActionButton>
                          {awardable && canOrder ? (
                            <OpsActionButton
                              type="button"
                              variant="secondary"
                              onClick={() => setAwardQty(quote.id, openQty)}
                            >
                              Kalanı ver
                            </OpsActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Dağıtılan: {formatProjectNumber(distribution.distributed)} /{" "}
              {formatProjectNumber(distribution.requested)} · Kalan:{" "}
              {formatProjectNumber(Math.max(0, distribution.remaining))}
            </p>
            <OpsActionButton
              type="button"
              variant="primary"
              disabled={
                !canOrder ||
                awardSelections.length === 0 ||
                distribution.remaining < 0
              }
              onClick={() => {
                const error = validateAwards();
                if (error) {
                  toast.error(error);
                  return;
                }
                setConfirmConvertOpen(true);
              }}
            >
              Seçilen Miktarları Siparişe Dönüştür
            </OpsActionButton>
          </div>
        </div>
      ) : request ? (
        <div className="rounded-2xl border border-dashed border-cyan-500/20 bg-[var(--wms-app-panel)] p-5 text-sm text-slate-500">
          Bu talep için henüz teklif kaydı yok. Yukarıdan tedarikçi teklifi
          girerek karşılaştırma ve dağıtıma başlayabilirsiniz.
        </div>
      ) : null}

      {viewQuote ? (
        <ResponsiveDialog
          open
          onClose={() => setViewQuote(undefined)}
          title={viewQuote.documentNo}
          description={`${viewQuote.counterpartyName ?? ""} · ${statusLabel[viewQuote.status] ?? viewQuote.status}`}
          className="!max-w-3xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info
                label="Toplam"
                value={`${formatProjectNumber(quoteMoneyTotal(viewQuote))} ${viewQuote.currencyCode}`}
              />
              <Info
                label="Miktar"
                value={formatProjectNumber(quoteQtyTotal(viewQuote))}
              />
              <Info
                label="Termin"
                value={
                  quoteTermin(viewQuote)
                    ? formatProjectDate(quoteTermin(viewQuote)!)
                    : "—"
                }
              />
            </div>
            <SavedAttachmentsViewer
              title="Teklif Ekleri"
              attachments={viewQuote.attachments ?? []}
              canDelete={canManage}
              onChanged={() => {
                void procurementApi
                  .detail("quote", viewQuote.id)
                  .then(setViewQuote)
                  .catch(() => undefined);
              }}
              emptyText="Bu teklife ait genel ek bulunmuyor."
            />
            <div className="overflow-x-auto rounded-xl border border-cyan-500/15">
              <table className="w-full text-left text-sm">
                <thead className="bg-cyan-500/5 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Ürün</th>
                    <th className="px-3 py-2">Miktar</th>
                    <th className="px-3 py-2">Birim Fiyat</th>
                    <th className="px-3 py-2">Toplam</th>
                    <th className="px-3 py-2">Ek</th>
                  </tr>
                </thead>
                <tbody>
                  {viewQuote.lines.map((line) => (
                    <tr key={line.id} className="border-t border-cyan-500/10">
                      <td className="px-3 py-2">
                        {line.stockCode ? `${line.stockCode} · ` : ""}
                        {line.stockName}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(line.quantity)} {line.unitCode}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(line.unitPrice)}{" "}
                        {viewQuote.currencyCode}
                      </td>
                      <td className="px-3 py-2 font-semibold text-cyan-400">
                        {formatProjectNumber(lineTotal(line))}{" "}
                        {viewQuote.currencyCode}
                      </td>
                      <td className="px-3 py-2">
                        {(line.attachments?.length ?? 0) > 0
                          ? `${line.attachments!.length} ek`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewQuote.lines.some((x) => (x.attachments?.length ?? 0) > 0) ? (
              <div className="space-y-3">
                {viewQuote.lines
                  .filter((x) => (x.attachments?.length ?? 0) > 0)
                  .map((line) => (
                    <SavedAttachmentsViewer
                      key={line.id}
                      title={`Kalem Ekleri · ${line.stockCode ? `${line.stockCode} · ` : ""}${line.stockName}`}
                      attachments={line.attachments ?? []}
                      canDelete={canManage}
                      onChanged={() => {
                        void procurementApi
                          .detail("quote", viewQuote.id)
                          .then(setViewQuote)
                          .catch(() => undefined);
                      }}
                    />
                  ))}
              </div>
            ) : null}
            <div className="flex justify-end">
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={() => setViewQuote(undefined)}
              >
                Kapat
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}

      {confirmConvertOpen ? (
        <ResponsiveDialog
          open
          onClose={() => setConfirmConvertOpen(false)}
          title="Seçilen miktarları siparişe dönüştür"
          description="Aynı satın alma talebi için seçilen tedarikçi miktarlarından ayrı siparişler oluşturulacak."
          className="!max-w-2xl"
        >
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-cyan-500/15">
              <table className="w-full text-left text-sm">
                <thead className="bg-cyan-500/5 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tedarikçi</th>
                    <th className="px-3 py-2">Alınacak</th>
                    <th className="px-3 py-2">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {awardSelections.map(({ quote, awardQty }) => (
                    <tr
                      key={quote.id}
                      className="border-t border-cyan-500/10"
                    >
                      <td className="px-3 py-2 font-medium">
                        {quote.counterpartyName || quote.documentNo}
                      </td>
                      <td className="px-3 py-2">
                        {formatProjectNumber(awardQty)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-cyan-400">
                        {formatProjectNumber(awardMoney(quote, awardQty))}{" "}
                        {quote.currencyCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 sm:grid-cols-3">
              <Info
                label="Talep"
                value={formatProjectNumber(distribution.requested)}
              />
              <Info
                label="Bu tur"
                value={formatProjectNumber(distribution.awarding)}
              />
              <Info
                label="Sonra kalan"
                value={formatProjectNumber(
                  Math.max(0, distribution.remaining),
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={() => setConfirmConvertOpen(false)}
              >
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="primary"
                loading={selectBusy}
                onClick={() => void convertAwards()}
              >
                Onayla ve siparişleri oluştur
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactElement;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="wms-ops-gr-panel rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
      <div className="wms-ops-gr-panel__title mb-4 flex items-center gap-2 text-lg font-bold text-[var(--wms-brand-primary)]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--wms-app-text)]">
        {value}
      </p>
    </div>
  );
}
