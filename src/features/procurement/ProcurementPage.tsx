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
  ClipboardList,
  Eye,
  FileCheck2,
  FileSearch,
  Mail,
  Plus,
  Settings2,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { requiredActionColumn } from "@/components/shared/GridSystemColumns";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { goodsReceiptV2Api } from "@/features/goods-receipt-v2/api/goods-receipt.api";
import type {
  CustomerOption,
  StockOption,
} from "@/features/goods-receipt-v2/types/goods-receipt.types";
import { usePermissionAccess } from "@/features/access-control/hooks/usePermissionAccess";
import type { DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import { useAuthStore } from "@/stores/auth-store";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import type { PagedResponse } from "@/types/api";
import {
  LineAttachmentBadge,
  LineAttachmentsDialog,
  PendingAttachmentsEditor,
  SavedAttachmentsViewer,
  revokePendingAttachments,
  uploadPendingAttachments,
  type PendingAttachment,
} from "./ProcurementAttachments";
import { procurementApi } from "./api";
import type {
  ProcurementDocumentDetail,
  ProcurementDocumentType,
  ProcurementGridRow,
  ProcurementPolicy,
  ProcurementRequestLineInput,
  ProcurementSummary,
  QuoteOrderLineInput,
  RfqRequestLineInput,
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

const today = () => new Date().toLocaleDateString("en-CA");
const tabs: Array<{
  key: ProcurementDocumentType;
  label: string;
  description: string;
  href: string;
  icon: typeof ClipboardList;
}> = [
  {
    key: "request",
    label: "Satınalma Talepleri",
    description: "Yeni ihtiyaçları ve onay durumlarını yönetin.",
    href: "/procurement/requests",
    icon: ClipboardList,
  },
  {
    key: "rfq",
    label: "Teklif Talepleri",
    description: "Onaylanan talepler için tedarikçilerden fiyat toplayın.",
    href: "/procurement/rfqs",
    icon: FileSearch,
  },
  {
    key: "quote",
    label: "Tedarikçi Teklifleri",
    description:
      "Satın alma taleplerine gelen fiyat ve terminleri karşılaştırıp siparişe dönüştürün.",
    href: "/procurement/quotes",
    icon: FileCheck2,
  },
  {
    key: "order",
    label: "Satınalma Siparişleri",
    description:
      "Siparişleri onaylayın, tedarikçiye gönderin ve mal kabul kaynağına dönüştürün.",
    href: "/procurement/orders",
    icon: ShoppingCart,
  },
];
const statusLabel: Record<string, string> = {
  Draft: "Taslak",
  PendingApproval: "Onay Bekliyor",
  Approved: "Onaylandı",
  Rejected: "Reddedildi",
  Converted: "Tamamı Sipariş Verildi",
  PartiallyConverted: "Kısmi Sipariş Verildi",
  Cancelled: "İptal",
  Sent: "Gönderildi",
  Quoted: "Teklif Geldi",
  Closed: "Kapandı",
  Submitted: "Sunuldu",
  SentToSupplier: "Tedarikçiye Gönderildi",
  PartiallyReceived: "Kısmi Kabul",
  Received: "Tamamlandı",
};
const blankLine = (): ProcurementRequestLineInput & {
  key: string;
  stockValue: string | null;
} => ({
  key: crypto.randomUUID(),
  stockValue: null,
  stockName: "",
  unitCode: "ADET",
  quantity: 1,
});
export function ProcurementHubPage(): ReactElement {
  const { can } = usePermissionAccess();
  const [summary, setSummary] = useState<ProcurementSummary>();
  const [policyOpen, setPolicyOpen] = useState(false);
  useEffect(() => {
    void procurementApi
      .summary()
      .then(setSummary)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Satınalma özeti alınamadı.",
        ),
      );
  }, []);
  const counters: Record<ProcurementDocumentType, number> = {
    request: (summary?.draftRequests ?? 0) + (summary?.pendingRequests ?? 0),
    rfq: summary?.openRfqs ?? 0,
    quote: summary?.submittedQuotes ?? 0,
    order: (summary?.pendingOrders ?? 0) + (summary?.approvedOpenOrders ?? 0),
  };
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-cyan-500/20 bg-[var(--wms-app-panel)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-500">
          PROCURE_TO_PAY / SATINALMA
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Satınalma Süreç Merkezi</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              İhtiyaç talebinden satınalma siparişine kadar her aşamayı ayrı iş
              kuyruğunda yönetin.
            </p>
          </div>
          {can("WMS.PROCUREMENT.APPROVE") ? (
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => setPolicyOpen(true)}
            >
              <Settings2 size={16} /> Süreç politikası
            </OpsActionButton>
          ) : null}
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tabs.map((step, index) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.key}
              to={step.href}
              className="group rounded-2xl border border-cyan-500/15 bg-[var(--wms-app-panel)] p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/40"
            >
              <div className="flex items-start justify-between">
                <span className="rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
                  <Icon size={22} />
                </span>
                <span className="rounded-full border border-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-400">
                  {counters[step.key]} açık
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Aşama {index + 1}
              </p>
              <h2 className="mt-1 text-lg font-bold">{step.label}</h2>
              <p className="mt-2 text-sm text-slate-500">{step.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-500">
                İş kuyruğunu aç{" "}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </Link>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Taslak talep", summary?.draftRequests ?? 0],
          ["Onay bekleyen", summary?.pendingRequests ?? 0],
          ["Açık RFQ", summary?.openRfqs ?? 0],
          ["Gelen teklif", summary?.submittedQuotes ?? 0],
          ["Sipariş onayı", summary?.pendingOrders ?? 0],
          ["Mal kabule açık", summary?.approvedOpenOrders ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-cyan-500/15 bg-[var(--wms-app-panel)] p-4"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-cyan-400">{value}</p>
          </div>
        ))}
      </div>
      {policyOpen ? (
        <ProcurementPolicyDialog
          onClose={() => setPolicyOpen(false)}
          onSaved={() => {
            setPolicyOpen(false);
            toast.success("Satınalma politikası kaydedildi.");
          }}
        />
      ) : null}
    </section>
  );
}

export function ProcurementPage({
  documentType,
}: {
  documentType: ProcurementDocumentType;
}): ReactElement {
  const branch = useAuthStore((x) => x.branch?.code ?? "0");
  const { can } = usePermissionAccess();
  const navigate = useNavigate();
  const type = documentType;
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<ProcurementDocumentDetail>();
  const [policy, setPolicy] = useState<ProcurementPolicy>();
  const [creating, setCreating] = useState(false);
  const [rfqSource, setRfqSource] = useState<ProcurementDocumentDetail>();
  const [orderSource, setOrderSource] = useState<ProcurementDocumentDetail>();
  const [requestFilter, setRequestFilter] = useState<{
    id: string;
    documentNo: string;
    subject: string;
    documentDate: string;
    status: string;
  } | null>(null);
  const [requestPickerOpen, setRequestPickerOpen] = useState(false);
  const requestFilterId = requestFilter?.id ?? null;
  useEffect(() => {
    void procurementApi
      .policy()
      .then(setPolicy)
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Satınalma politikası yüklenemedi.",
        ),
      );
  }, [branch]);
  const fetchPage = useCallback(
    (request: GridRequest) => {
      if (type !== "quote" || !requestFilterId) {
        return procurementApi.paged(type, request);
      }
      return procurementApi.paged(type, {
        ...request,
        filters: [
          ...(request.filters ?? []),
          {
            column: "requestId",
            operator: "eq",
            value: requestFilterId,
          },
        ],
      });
    },
    [requestFilterId, type],
  );
  const page = tabs.find((x) => x.key === type) ?? tabs[0];
  const openDetail = useCallback(
    (id: number) => {
      void procurementApi
        .detail(type, id)
        .then(setDetail)
        .catch((e) =>
          toast.error(
            e instanceof Error ? e.message : "Belge detayı alınamadı.",
          ),
        );
    },
    [type],
  );
  const columns = useMemo<GridColumn<ProcurementGridRow>[]>(
    () => [
      {
        key: "documentNo",
        label: "Belge No",
        sortable: true,
        render: (x) => (
          <button
            className="font-semibold text-cyan-500 hover:underline"
            onClick={() => openDetail(x.id)}
          >
            {x.documentNo}
          </button>
        ),
      },
      {
        key: "documentDate",
        label: "Tarih",
        sortable: true,
        render: (x) => formatProjectDate(x.documentDate),
      },
      {
        key: "status",
        label: "Durum",
        sortable: true,
        render: (x) => (
          <span className="rounded-full border border-cyan-500/25 px-2 py-1 text-xs text-cyan-400">
            {statusLabel[x.status] ?? x.status}
          </span>
        ),
      },
      {
        key: "subject",
        label: type === "quote" ? "Konu / Talep" : "Konu",
        sortable: true,
        render: (x) =>
          type === "quote" ? (
            <div>
              <p>{x.subject}</p>
              {x.requestNo ? (
                <p className="mt-0.5 text-xs text-slate-500">{x.requestNo}</p>
              ) : null}
            </div>
          ) : (
            x.subject
          ),
      },
      {
        key: "counterparty",
        label: "Tedarikçi",
        render: (x) => x.counterparty || "—",
      },
      {
        key: "lineCount",
        label: "Satır",
        sortable: true,
        render: (x) => formatProjectNumber(x.lineCount),
      },
      {
        key: "totalAmount",
        label: "Toplam",
        render: (x) =>
          x.totalAmount
            ? `${formatProjectNumber(x.totalAmount)} ${x.currencyCode}`
            : "—",
      },
      {
        key: "dueDate",
        label: "Termin",
        render: (x) => (x.dueDate ? formatProjectDate(x.dueDate) : "—"),
      },
      {
        key: "actions",
        label: "Detay",
        ...requiredActionColumn,
        width: 72,
        render: (x) => (
          <div className="wms-ops-row-actions">
            <button
              type="button"
              title="Detay"
              aria-label="Detay"
              onClick={() => openDetail(x.id)}
              className="wms-ops-grid-icon-btn"
            >
              <Eye className="size-3.5" aria-hidden />
            </button>
          </div>
        ),
      },
    ],
    [openDetail, type],
  );
  const headerToolbarActions =
    type === "request" && can("WMS.PROCUREMENT.REQUEST.MANAGE")
      ? [
          {
            label: "Yeni ihtiyaç talebi",
            icon: <Plus size={16} />,
            run: async () => {
              setCreating(true);
            },
          },
        ]
      : type === "quote"
        ? [
            {
              label: requestFilter ? "Talebi değiştir" : "Talep seç",
              icon: <FileSearch size={15} />,
              run: async () => {
                setRequestPickerOpen(true);
              },
            },
            ...(can("WMS.PROCUREMENT.QUOTE.MANAGE")
              ? [
                  {
                    label: "Yeni teklif gir",
                    icon: <Plus size={16} />,
                    run: async () => {
                      navigate("/procurement/quotes/new");
                    },
                  },
                ]
              : []),
          ]
        : undefined;

  return (
    <section className="space-y-4">
      <div className="px-0.5">
        <OpsActionButton asChild variant="secondary">
          <Link to="/procurement">
            <ArrowRight size={16} className="rotate-180" /> Süreç merkezine dön
          </Link>
        </OpsActionButton>
      </div>

      <AdvancedDataGrid
        key={`${type}-${requestFilterId ?? "all"}`}
        refreshKey={revision}
        pageKey={`procurement-${type}`}
        eyebrow={
          <>
            <span>PROCURE_TO_PAY</span>
            <span className="mx-2 opacity-60">/</span>
            <span>SATINALMA</span>
          </>
        }
        title={page.label}
        description={page.description}
        toolbarActions={headerToolbarActions}
        toolbarBelowExtra={
          type === "quote" && requestFilter ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-100">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{requestFilter.documentNo}</span>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span className="text-[var(--wms-app-text-muted)]">
                    {requestFilter.subject}
                  </span>
                </span>
                <button
                  type="button"
                  title="Talebi temizle"
                  aria-label="Talebi temizle"
                  className="shrink-0 rounded p-0.5 text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
                  onClick={() => {
                    setRequestFilter(null);
                    setRevision((x) => x + 1);
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          ) : undefined
        }
        columns={columns}
        fetchPage={fetchPage}
      />
      {type === "quote" && requestPickerOpen ? (
        <RequestFilterPickerDialog
          selectedId={requestFilterId}
          onClose={() => setRequestPickerOpen(false)}
          onSelect={(row) => {
            setRequestFilter(
              row
                ? {
                    id: String(row.id),
                    documentNo: row.documentNo,
                    subject: row.subject,
                    documentDate: row.documentDate,
                    status: row.status,
                  }
                : null,
            );
            setRequestPickerOpen(false);
            setRevision((x) => x + 1);
          }}
        />
      ) : null}
      {creating ? (
        <CreateRequestDialog
          branch={branch}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setRevision((x) => x + 1);
            toast.success("Satınalma talebi oluşturuldu.");
          }}
        />
      ) : null}
      {detail ? (
        <DetailDialog
          detail={detail}
          policy={policy}
          can={can}
          onClose={() => setDetail(undefined)}
          onCreateRfq={() => {
            setRfqSource(detail);
            setDetail(undefined);
          }}
          onCreateQuote={() => {
            const requestId = detail.requestId;
            const id = detail.id;
            setDetail(undefined);
            navigate(
              requestId
                ? `/procurement/quotes/new?requestId=${requestId}`
                : `/procurement/quotes/new?rfqId=${id}`,
            );
          }}
          onEnterQuoteFromRequest={() => {
            const id = detail.id;
            setDetail(undefined);
            navigate(`/procurement/quotes/new?requestId=${id}`);
          }}
          onCreateOrder={() => {
            setOrderSource(detail);
            setDetail(undefined);
          }}
          onChanged={async () => {
            setDetail(
              await procurementApi.detail(detail.documentType, detail.id),
            );
            setRevision((x) => x + 1);
          }}
        />
      ) : null}
      {rfqSource ? (
        <CreateRfqDialog
          source={rfqSource}
          branch={branch}
          onClose={() => setRfqSource(undefined)}
          onSaved={() => {
            setRfqSource(undefined);
            toast.success(
              "Teklif talebi oluşturuldu; göndermeden önce kontrol edebilirsiniz.",
            );
            navigate("/procurement/rfqs");
          }}
        />
      ) : null}
      {orderSource ? (
        <CreateOrderFromQuoteDialog
          source={orderSource}
          onClose={() => setOrderSource(undefined)}
          onSaved={() => {
            setOrderSource(undefined);
            toast.success(
              "Seçilen miktarlar için satınalma siparişi oluşturuldu.",
            );
            navigate("/procurement/orders");
          }}
        />
      ) : null}
    </section>
  );
}

export const ProcurementRequestsPage = (): ReactElement => (
  <ProcurementPage documentType="request" />
);
export const ProcurementRfqsPage = (): ReactElement => (
  <ProcurementPage documentType="rfq" />
);
export const ProcurementQuotesPage = (): ReactElement => (
  <ProcurementPage documentType="quote" />
);
export const ProcurementOrdersPage = (): ReactElement => (
  <ProcurementPage documentType="order" />
);

function RequestFilterPickerDialog({
  selectedId,
  onClose,
  onSelect,
}: {
  selectedId: string | null;
  onClose: () => void;
  onSelect: (row: ProcurementGridRow | null) => void;
}): ReactElement {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<ProcurementGridRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(selectedId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void procurementApi
      .paged("request", {
        pageNumber: 1,
        pageSize: 50,
        search: debouncedSearch || null,
        searchFields: ["documentNo", "subject"],
        sortBy: "documentDate",
        sortDirection: "desc",
        filterLogic: "and",
        filters: [],
      })
      .then((page) => {
        if (!cancelled) setItems(page.data ?? page.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Talepler yüklenemedi.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const picked = items.find((x) => String(x.id) === pickedId) ?? null;

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Satın alma talebi seç"
      description="Listelenen teklifleri bir talebe göre daraltmak için talep seçin."
      variant="lookup"
      className="!max-w-2xl"
    >
      <div className="space-y-4">
        <AppInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Talep no veya konu ara…"
        />
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {busy ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Talepler yükleniyor…
            </p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Kayıt bulunamadı.
            </p>
          ) : (
            items.map((row) => {
              const active = String(row.id) === pickedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setPickedId(String(row.id))}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : "border-cyan-500/15 hover:border-cyan-500/35 hover:bg-cyan-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-cyan-300">
                        {row.documentNo}
                      </p>
                      <p className="mt-0.5 truncate text-sm">{row.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatProjectDate(row.documentDate)}
                        {" · "}
                        {statusLabel[row.status] ?? row.status}
                      </p>
                    </div>
                    <span
                      className={`mt-1 size-4 shrink-0 rounded-full border ${
                        active
                          ? "border-cyan-400 bg-cyan-400"
                          : "border-cyan-500/40"
                      }`}
                      aria-hidden
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cyan-500/15 pt-3">
          <OpsActionButton
            type="button"
            variant="secondary"
            onClick={() => onSelect(null)}
          >
            Tüm talepler
          </OpsActionButton>
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            İptal
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            disabled={!picked}
            onClick={() => {
              if (picked) onSelect(picked);
            }}
          >
            Seç
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function CreateRequestDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch: string;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const [requestNo, setRequestNo] = useState("");
  const [subject, setSubject] = useState("");
  const [requestDate, setRequestDate] = useState(today);
  const [requiredDate, setRequiredDate] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [stockLookupKey, setStockLookupKey] = useState<string | null>(null);
  const [headerFiles, setHeaderFiles] = useState<PendingAttachment[]>([]);
  const [lineFiles, setLineFiles] = useState<Record<string, PendingAttachment[]>>(
    {},
  );
  const [lineAttachKey, setLineAttachKey] = useState<string | null>(null);
  useEffect(() => {
    void procurementApi
      .nextDocumentNo("request")
      .then(setRequestNo)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Talep numarası alınamadı.",
        ),
      );
  }, []);
  useEffect(
    () => () => {
      revokePendingAttachments(headerFiles);
      for (const files of Object.values(lineFiles))
        revokePendingAttachments(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
    [],
  );
  const patch = (key: string, next: Partial<(typeof lines)[number]>) =>
    setLines((xs) => xs.map((x) => (x.key === key ? { ...x, ...next } : x)));
  const save = async () => {
    if (
      !requestNo.trim() ||
      !subject.trim() ||
      lines.some((x) => !x.stockName.trim() || x.quantity <= 0)
    ) {
      toast.error(
        "Talep no, konu ve her satır için ürün/stok tanımı ile geçerli miktar zorunludur.",
      );
      return;
    }
    setBusy(true);
    try {
      const id = await procurementApi.createRequest({
        requestNo: requestNo.trim(),
        requestDate,
        requiredDate: requiredDate || undefined,
        departmentCode: departmentCode || undefined,
        projectCode: projectCode || undefined,
        subject,
        description: description || undefined,
        lines: lines.map((x) => ({
          stockId: x.stockId,
          stockCode: x.stockCode,
          stockName: x.stockName.trim(),
          unitCode: x.unitCode,
          quantity: x.quantity,
          requiredDate: x.requiredDate,
          projectCode: x.projectCode,
          description: x.description,
        })),
      });
      const detail = await procurementApi.detail("request", id);
      await uploadPendingAttachments("request", id, headerFiles);
      for (let i = 0; i < lines.length; i += 1) {
        const pending = lineFiles[lines[i].key] ?? [];
        const lineId = detail.lines[i]?.id;
        if (lineId && pending.length > 0)
          await uploadPendingAttachments("request-line", lineId, pending);
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Talep oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Yeni satınalma talebi"
      description="İhtiyacı tanımlayın; tedarikçi ve fiyat süreci onaydan sonra RFQ aşamasında yürütülür."
      className="!max-w-6xl"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Talep No *">
            <AppInput
              value={requestNo}
              onChange={(e) => setRequestNo(e.target.value)}
              maxLength={50}
            />
          </Field>
          <Field label="Talep konusu">
            <AppInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="Departman">
            <AppInput
              value={departmentCode}
              onChange={(e) => setDepartmentCode(e.target.value)}
            />
          </Field>
          <Field label="Talep tarihi">
            <AppDateInput
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
            />
          </Field>
          <Field label="İstenen tarih">
            <AppDateInput
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </Field>
          <Field label="Proje kodu">
            <AppInput
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
            />
          </Field>
          <Field label="Açıklama">
            <AppInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <PendingAttachmentsEditor
          title="Talep Ekleri"
          hint="Talebe ait fotoğraf, teknik doküman veya dosyaları ekleyebilirsiniz."
          files={headerFiles}
          onChange={setHeaderFiles}
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Talep satırları</h3>
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => setLines((x) => [...x, blankLine()])}
            >
              <Plus size={15} /> Satır ekle
            </OpsActionButton>
          </div>
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid gap-3 rounded-xl border border-cyan-500/15 p-4 md:grid-cols-[minmax(260px,2fr)_100px_120px_140px_auto_42px]"
            >
              <Field label={`Stok ${index + 1}`}>
                <PagedLookupDialog<StockOption>
                  variant="ops"
                  triggerMode="combobox"
                  autoSearchMinLength={0}
                  popoverPortalContainer={null}
                  open={stockLookupKey === line.key}
                  onOpenChange={(open) =>
                    setStockLookupKey(open ? line.key : null)
                  }
                  title="Stok seç"
                  value={
                    line.stockId && line.stockCode
                      ? `${line.stockCode} · ${line.stockName}`
                      : line.stockName
                  }
                  placeholder="Stok kodu, adı veya kendi tanımınızı yazın…"
                  searchPlaceholder="Stok kodu veya adı yazın…"
                  emptyText="Stok bulunamadı — yazdığınız metin ürün tanımı olarak kullanılabilir"
                  triggerClassName={OPS_FIELD_CLASS}
                  queryKey={["procurement-stock-lookup", branch, line.key]}
                  fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                    toPagedResponse(
                      await goodsReceiptV2Api.stocks(
                        {
                          pageNumber,
                          pageSize,
                          search,
                          sortBy: "erpStockCode",
                          sortDirection: "asc",
                          signal: signal ?? new AbortController().signal,
                        },
                        branch,
                      ),
                    )
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={(item) =>
                    `${item.erpStockCode} · ${item.stockName}${item.unitCode ? ` · ${item.unitCode}` : ""}`
                  }
                  onComboboxTextChange={(text) => {
                    patch(line.key, {
                      stockId: undefined,
                      stockCode: undefined,
                      stockName: text,
                      stockValue: text.trim() ? text : null,
                    });
                  }}
                  onSelect={(item) => {
                    patch(line.key, {
                      stockValue: `${item.erpStockCode} · ${item.stockName}`,
                      stockId: item.id,
                      stockCode: item.erpStockCode,
                      stockName: item.stockName,
                      unitCode: item.unitCode || "ADET",
                    });
                    setStockLookupKey(null);
                  }}
                />
              </Field>
              <Field label="Miktar">
                <AppInput
                  type="number"
                  min="0.000001"
                  step="any"
                  value={line.quantity}
                  onChange={(e) =>
                    patch(line.key, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Birim">
                <AppInput
                  value={line.unitCode}
                  onChange={(e) =>
                    patch(line.key, { unitCode: e.target.value })
                  }
                />
              </Field>
              <Field label="Termin">
                <AppDateInput
                  value={line.requiredDate ?? ""}
                  onChange={(e) =>
                    patch(line.key, { requiredDate: e.target.value })
                  }
                />
              </Field>
              <div className="mt-6">
                <LineAttachmentBadge
                  count={(lineFiles[line.key] ?? []).length}
                  onClick={() => setLineAttachKey(line.key)}
                />
              </div>
              <button
                type="button"
                className="mt-6 text-rose-400"
                disabled={lines.length === 1}
                onClick={() => {
                  setLines((x) => x.filter((y) => y.key !== line.key));
                  setLineFiles((prev) => {
                    const copy = { ...prev };
                    const removed = copy[line.key] ?? [];
                    revokePendingAttachments(removed);
                    delete copy[line.key];
                    return copy;
                  });
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        {lineAttachKey ? (
          <LineAttachmentsDialog
            open
            onClose={() => setLineAttachKey(null)}
            title="Stok satırı ekleri"
            subtitle={
              lines.find((x) => x.key === lineAttachKey)?.stockName ||
              "Seçili satır"
            }
          >
            <PendingAttachmentsEditor
              title="Kalem Ekleri"
              hint="Bu stok satırına özel fotoğraf veya dosya ekleyin."
              files={lineFiles[lineAttachKey] ?? []}
              onChange={(next) =>
                setLineFiles((prev) => ({ ...prev, [lineAttachKey]: next }))
              }
              compact
            />
          </LineAttachmentsDialog>
        ) : null}
        <div className="flex justify-end gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void save()}
          >
            Talebi oluştur
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function CreateRfqDialog({
  source,
  branch,
  onClose,
  onSaved,
}: {
  source: ProcurementDocumentDetail;
  branch: string;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const [rfqNo, setRfqNo] = useState("");
  const [dueDate, setDueDate] = useState(source.dueDate ?? "");
  const [message, setMessage] = useState("");
  const [suppliers, setSuppliers] = useState<CustomerOption[]>([]);
  const [supplierValue, setSupplierValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<RfqRequestLineInput[]>(
    source.lines
      .filter((x) => x.openQuantity > 0)
      .map((x) => ({ requestLineId: x.id, quantity: x.openQuantity })),
  );
  useEffect(() => {
    void procurementApi
      .nextDocumentNo("rfq")
      .then(setRfqNo)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Teklif talebi numarası alınamadı.",
        ),
      );
  }, []);
  const patchLine = (id: number, next: Partial<RfqRequestLineInput>) =>
    setLines((xs) =>
      xs.map((x) => (x.requestLineId === id ? { ...x, ...next } : x)),
    );
  const toggleLine = (id: number) =>
    setLines((xs) =>
      xs.some((x) => x.requestLineId === id)
        ? xs.filter((x) => x.requestLineId !== id)
        : [
            ...xs,
            {
              requestLineId: id,
              quantity:
                source.lines.find((x) => x.id === id)?.openQuantity ?? 0,
            },
          ],
    );
  const addSupplier = (value: string | null) => {
    setSupplierValue(null);
    if (!value) return;
    const item = JSON.parse(decodeURIComponent(value)) as CustomerOption;
    setSuppliers((xs) =>
      xs.some((x) => x.id === item.id) ? xs : [...xs, item],
    );
  };
  const save = async () => {
    if (
      !rfqNo.trim() ||
      !dueDate ||
      suppliers.length === 0 ||
      lines.length === 0 ||
      lines.some((x) => x.quantity <= 0)
    ) {
      toast.error(
        "RFQ no, teklif son tarihi, en az bir tedarikçi ve geçerli bir kalem zorunludur.",
      );
      return;
    }
    setBusy(true);
    try {
      await procurementApi.convertRequestToRfq(source.id, {
        responseDueDate: dueDate,
        supplierIds: suppliers.map((x) => x.id),
        buyerMessage: message || undefined,
        rfqNo: rfqNo.trim(),
        lines,
      });
      onSaved();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Teklif talebi oluşturulamadı.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Teklif talebi oluştur"
      description={`${source.documentNo} numaralı onaylı ihtiyaç için fiyat toplayın.`}
      className="!max-w-3xl"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
          <p className="text-xs uppercase text-slate-500">Kaynak ihtiyaç</p>
          <p className="mt-1 font-semibold">{source.subject}</p>
          <p className="mt-1 text-sm text-slate-500">
            {source.lines.length} kalem · toplam{" "}
            {formatProjectNumber(
              source.lines.reduce((sum, x) => sum + x.quantity, 0),
            )}{" "}
            birim
          </p>
        </div>
        <Field label="RFQ No *">
          <AppInput
            value={rfqNo}
            onChange={(e) => setRfqNo(e.target.value)}
            maxLength={50}
          />
        </Field>
        <Field label="Teklif cevap son tarihi *">
          <AppDateInput
            value={dueDate}
            min={today()}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Tedarikçi ekle *">
          <PagedAppDropdown<CustomerOption>
            queryKey={["procurement-suppliers", branch]}
            fetchPage={(r) => goodsReceiptV2Api.customers(r, branch)}
            toOption={(x) => ({
              value: encodeURIComponent(JSON.stringify(x)),
              label: `${x.customerCode} · ${x.customerName}`,
            })}
            value={supplierValue}
            onValueChange={addSupplier}
            searchable
            minSearchLength={2}
            placeholder="Kod veya unvan ile tedarikçi ara…"
          />
        </Field>
        {suppliers.length ? (
          <div className="flex flex-wrap gap-2">
            {suppliers.map((x) => (
              <span
                key={x.id}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-sm"
              >
                {x.customerCode} · {x.customerName}
                <button
                  aria-label={`${x.customerName} tedarikçisini kaldır`}
                  onClick={() =>
                    setSuppliers((xs) => xs.filter((y) => y.id !== x.id))
                  }
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-cyan-500/20 p-3 text-sm text-slate-500">
            Henüz tedarikçi eklenmedi. Karşılaştırma için birden fazla tedarikçi
            seçebilirsiniz.
          </p>
        )}
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold">Fiyat istenecek kalemler</h3>
            <p className="text-xs text-slate-500">
              Aynı talep için farklı kalem ve miktarlarla yeni teklif turları
              daha sonra da açılabilir.
            </p>
          </div>
          {source.lines
            .filter((x) => x.openQuantity > 0)
            .map((line) => {
              const selected = lines.find((x) => x.requestLineId === line.id);
              return (
                <div
                  key={line.id}
                  className={`grid items-center gap-3 rounded-xl border p-3 md:grid-cols-[32px_1fr_150px] ${selected ? "border-cyan-500/35 bg-cyan-500/5" : "border-cyan-500/10"}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => toggleLine(line.id)}
                  />
                  <div>
                    <b>
                      {line.stockCode ? `${line.stockCode} · ` : ""}
                      {line.stockName}
                    </b>
                    <p className="text-xs text-slate-500">
                      Açık talep: {formatProjectNumber(line.openQuantity)}{" "}
                      {line.unitCode}
                    </p>
                  </div>
                  <Field label="Teklif miktarı">
                    <AppInput
                      type="number"
                      min="0.000001"
                      max={line.openQuantity}
                      step="any"
                      disabled={!selected}
                      value={selected?.quantity ?? line.openQuantity}
                      onChange={(e) =>
                        patchLine(line.id, { quantity: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
              );
            })}
        </div>
        <Field label="Tedarikçiye not">
          <AppInput
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Teslim, paketleme veya teklif koşulları…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void save()}
          >
            Teklif talebi oluştur
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function CreateOrderFromQuoteDialog({
  source,
  onClose,
  onSaved,
}: {
  source: ProcurementDocumentDetail;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const available = source.lines.filter((x) => x.openQuantity > 0);
  const [lines, setLines] = useState<QuoteOrderLineInput[]>(
    available.map((x) => ({ quoteLineId: x.id, quantity: x.openQuantity })),
  );
  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [deliveryDate, setDeliveryDate] = useState(source.dueDate ?? "");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void procurementApi
      .nextDocumentNo("order")
      .then(setOrderNo)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Sipariş numarası alınamadı.",
        ),
      );
  }, []);
  const toggle = (id: number) =>
    setLines((xs) =>
      xs.some((x) => x.quoteLineId === id)
        ? xs.filter((x) => x.quoteLineId !== id)
        : [
            ...xs,
            {
              quoteLineId: id,
              quantity: available.find((x) => x.id === id)?.openQuantity ?? 0,
            },
          ],
    );
  const patch = (id: number, quantity: number) =>
    setLines((xs) =>
      xs.map((x) => (x.quoteLineId === id ? { ...x, quantity } : x)),
    );
  const total = lines.reduce((sum, x) => {
    const line = source.lines.find((y) => y.id === x.quoteLineId);
    return (
      sum +
      (line
        ? x.quantity *
          line.unitPrice *
          (1 - line.discountRate / 100) *
          (1 + line.vatRate / 100)
        : 0)
    );
  }, 0);
  const save = async () => {
    if (
      !orderNo.trim() ||
      lines.length === 0 ||
      lines.some((x) => x.quantity <= 0)
    ) {
      toast.error(
        "Sipariş no ve en az bir geçerli teklif kalemi zorunludur.",
      );
      return;
    }
    setBusy(true);
    try {
      await procurementApi.convertQuoteToOrder(source.id, {
        lines,
        orderNo: orderNo.trim(),
        orderDate,
        deliveryDate: deliveryDate || undefined,
        projectCode: projectCode || undefined,
        description: description || undefined,
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sipariş oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Tekliften sipariş oluştur"
      description="Teklif miktarının tamamını veya bir bölümünü bu siparişe ayırın; kalan miktar daha sonra başka siparişe dönüştürülebilir."
      className="!max-w-5xl"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Sipariş No *">
            <AppInput
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              maxLength={50}
            />
          </Field>
          <Field label="Sipariş tarihi">
            <AppDateInput
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </Field>
          <Field label="Genel teslim tarihi">
            <AppDateInput
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </Field>
          <Field label="Proje kodu">
            <AppInput
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
            />
          </Field>
          <Info
            label="Seçili sipariş toplamı"
            value={`${formatProjectNumber(total)} ${source.currencyCode}`}
          />
        </div>
        <div className="space-y-2">
          {available.map((line) => {
            const selected = lines.find((x) => x.quoteLineId === line.id);
            return (
              <div
                key={line.id}
                className={`grid items-center gap-3 rounded-xl border p-3 md:grid-cols-[32px_1fr_150px_150px] ${selected ? "border-cyan-500/35 bg-cyan-500/5" : "border-cyan-500/10"}`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={() => toggle(line.id)}
                />
                <div>
                  <b>
                    {line.stockCode ? `${line.stockCode} · ` : ""}
                    {line.stockName}
                  </b>
                  <p className="text-xs text-slate-500">
                    Teklif: {formatProjectNumber(line.quantity)} · Önceki
                    siparişler: {formatProjectNumber(line.secondaryQuantity)}
                  </p>
                </div>
                <Field label="Açık teklif">
                  <AppInput
                    readOnly
                    value={`${formatProjectNumber(line.openQuantity)} ${line.unitCode}`}
                  />
                </Field>
                <Field label="Bu sipariş">
                  <AppInput
                    type="number"
                    min="0.000001"
                    max={line.openQuantity}
                    step="any"
                    disabled={!selected}
                    value={selected?.quantity ?? line.openQuantity}
                    onChange={(e) => patch(line.id, Number(e.target.value))}
                  />
                </Field>
              </div>
            );
          })}
        </div>
        <Field label="Sipariş açıklaması">
          <AppInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sipariş veya teslimat notu…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void save()}
          >
            Seçili miktarlardan sipariş oluştur
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function ProcurementPolicyDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const [policy, setPolicy] = useState<ProcurementPolicy>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    procurementApi
      .policy()
      .then(setPolicy)
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Satınalma politikası alınamadı.",
        );
        onClose();
      });
  }, [onClose]);
  if (!policy)
    return (
      <ResponsiveDialog
        open
        onClose={onClose}
        title="Satınalma süreç politikası"
      >
        <p className="p-5 text-sm text-slate-500">Politika yükleniyor…</p>
      </ResponsiveDialog>
    );
  type PolicyFlag =
    | "allowMultipleRfqsPerRequest"
    | "allowPartialRfqLines"
    | "allowMultipleQuotesPerSupplier"
    | "allowMultipleOrdersPerQuote"
    | "allowPartialOrderLines"
    | "allowSplitAwardsAcrossSuppliers"
    | "allowSupplierDraftSave"
    | "allowSupplierQuantityChange"
    | "allowSupplierRevisions"
    | "requireSupplierDeliveryDate"
    | "allowZeroUnitPrice";
  const toggle = (key: PolicyFlag) =>
    setPolicy((x) => (x ? { ...x, [key]: !x[key] } : x));
  const options: Array<{
    key: PolicyFlag;
    title: string;
    description: string;
  }> = [
    {
      key: "allowMultipleRfqsPerRequest",
      title: "Bir talepten birden fazla teklif turu",
      description:
        "Aynı ihtiyaç için farklı zamanlarda veya farklı tedarikçi gruplarıyla yeni RFQ açılabilir.",
    },
    {
      key: "allowPartialRfqLines",
      title: "Kısmi kalem ve miktarla fiyat toplama",
      description:
        "Talebin seçilen kalemleri ya da açık miktarın bir bölümü fiyatlamaya çıkarılabilir.",
    },
    {
      key: "allowMultipleQuotesPerSupplier",
      title: "Tedarikçi revize teklifleri",
      description:
        "Aynı tedarikçi aynı RFQ için farklı teklif numaralarıyla birden fazla teklif verebilir.",
    },
    {
      key: "allowMultipleOrdersPerQuote",
      title: "Bir tekliften birden fazla sipariş",
      description:
        "Teklif miktarı farklı tarihlerde birden fazla siparişe bölünebilir.",
    },
    {
      key: "allowPartialOrderLines",
      title: "Kısmi teklif ödüllendirme",
      description:
        "Teklifin yalnızca seçilen kalem veya miktarı siparişe dönüştürülebilir.",
    },
    {
      key: "allowSplitAwardsAcrossSuppliers",
      title: "Talebi tedarikçilere paylaştır",
      description:
        "Aynı talebin miktarları birden fazla tedarikçiye sipariş edilebilir.",
    },
    {
      key: "allowSupplierDraftSave",
      title: "Tedarikçi taslak kaydedebilir",
      description:
        "Portal kullanıcısı teklifini göndermeden önce ara kayıt oluşturabilir.",
    },
    {
      key: "allowSupplierQuantityChange",
      title: "Tedarikçi miktarı değiştirebilir",
      description:
        "Kapalıysa tedarikçi yalnız istenen miktara fiyat verebilir.",
    },
    {
      key: "allowSupplierRevisions",
      title: "Teklif revizyonuna izin ver",
      description:
        "Satınalma sorumlusu gönderilmiş teklif için yeni bir revizyon açabilir.",
    },
    {
      key: "requireSupplierDeliveryDate",
      title: "Kalem termin tarihi zorunlu",
      description:
        "Her teklif kaleminde teslim tarihi girilmeden teklif gönderilemez.",
    },
    {
      key: "allowZeroUnitPrice",
      title: "Sıfır fiyatlı kaleme izin ver",
      description:
        "Numune veya bedelsiz kalemlerde sıfır birim fiyat kabul edilir.",
    },
  ];
  const save = async () => {
    setBusy(true);
    try {
      await procurementApi.updatePolicy({
        allowMultipleRfqsPerRequest: policy.allowMultipleRfqsPerRequest,
        allowPartialRfqLines: policy.allowPartialRfqLines,
        allowMultipleQuotesPerSupplier: policy.allowMultipleQuotesPerSupplier,
        allowMultipleOrdersPerQuote: policy.allowMultipleOrdersPerQuote,
        allowPartialOrderLines: policy.allowPartialOrderLines,
        allowSplitAwardsAcrossSuppliers: policy.allowSplitAwardsAcrossSuppliers,
        supplierQuoteChannelMode: policy.supplierQuoteChannelMode,
        invitationValidityDays: policy.invitationValidityDays,
        allowSupplierDraftSave: policy.allowSupplierDraftSave,
        allowSupplierQuantityChange: policy.allowSupplierQuantityChange,
        allowSupplierRevisions: policy.allowSupplierRevisions,
        maximumSupplierRevisionCount: policy.maximumSupplierRevisionCount,
        requireSupplierDeliveryDate: policy.requireSupplierDeliveryDate,
        allowZeroUnitPrice: policy.allowZeroUnitPrice,
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Politika kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Satınalma süreç politikası"
      description="Bu şubede satınalma ekibinin ve tedarikçilerin nasıl çalışacağını basit seçeneklerle belirleyin."
      className="!max-w-3xl"
    >
      <div className="space-y-3">
        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <h3 className="font-bold">Tedarikçi teklif portalı</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tedarikçinin fiyatı e-postayla açılan kolay ekrandan mı, satınalma
            personelinin mi gireceğini seçin.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Teklif toplama kanalı">
              <AppDropdown
                value={policy.supplierQuoteChannelMode}
                onValueChange={(value) =>
                  setPolicy((x) =>
                    x
                      ? {
                          ...x,
                          supplierQuoteChannelMode:
                            value as ProcurementPolicy["supplierQuoteChannelMode"],
                        }
                      : x,
                  )
                }
                options={[
                  { value: "InternalOnly", label: "Yalnız şirket içi giriş" },
                  {
                    value: "PortalOptional",
                    label: "Portal veya şirket içi giriş",
                  },
                  {
                    value: "PortalRequired",
                    label: "Yalnız tedarikçi portalı",
                  },
                ]}
                portalContainer={null}
              />
            </Field>
            <Field label="Bağlantı süresi (gün)">
              <AppInput
                type="number"
                min="1"
                max="30"
                value={policy.invitationValidityDays}
                onChange={(e) =>
                  setPolicy((x) =>
                    x
                      ? { ...x, invitationValidityDays: Number(e.target.value) }
                      : x,
                  )
                }
              />
            </Field>
            <Field label="Azami revizyon sayısı">
              <AppInput
                type="number"
                min="0"
                max="20"
                disabled={!policy.allowSupplierRevisions}
                value={policy.maximumSupplierRevisionCount}
                onChange={(e) =>
                  setPolicy((x) =>
                    x
                      ? {
                          ...x,
                          maximumSupplierRevisionCount: Number(e.target.value),
                        }
                      : x,
                  )
                }
              />
            </Field>
          </div>
          <p className="mt-4 rounded-lg border border-cyan-500/20 bg-[var(--wms-app-panel)] p-3 text-sm">
            <b>Bu seçimin sonucu: </b>
            {policy.supplierQuoteChannelMode === "InternalOnly"
              ? "Tedarikçiye bağlantı gönderilmez; teklifleri satınalma personeli sisteme girer."
              : policy.supplierQuoteChannelMode === "PortalRequired"
                ? "Teklif yalnızca tedarikçinin e-postadaki bağlantıyı açıp göndermesiyle alınır."
                : "İsterseniz tedarikçiye bağlantı gönderir, isterseniz teklifi içeriden girersiniz."}
          </p>
        </section>
        {[
          {
            title: "Talep ve sipariş esnekliği",
            description:
              "Bir talebin nasıl fiyatlamaya ve siparişe dönüşeceğini belirler.",
            items: options.slice(0, 6),
          },
          {
            title: "Tedarikçinin göreceği teklif ekranı",
            description:
              "Tedarikçinin hangi bilgileri değiştirebileceğini ve göndermek için neleri tamamlaması gerektiğini belirler.",
            items: options.slice(6),
          },
        ].map((group) => (
          <section
            key={group.title}
            className="rounded-xl border border-cyan-500/15 p-4"
          >
            <h3 className="font-bold">{group.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{group.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.items.map((x) => (
                <label
                  key={String(x.key)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    policy[x.key]
                      ? "border-cyan-400/40 bg-cyan-500/10"
                      : "border-slate-700/60 bg-[var(--wms-app-panel)]"
                  }`}
                >
                  <input
                    className="mt-1 h-5 w-5 accent-cyan-500"
                    type="checkbox"
                    checked={Boolean(policy[x.key])}
                    onChange={() => toggle(x.key)}
                  />
                  <span>
                    <b>{x.title}</b>
                    <span className="mt-1 block text-sm text-slate-500">
                      {x.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-cyan-500/15 bg-[var(--wms-app-bg)]/95 py-3 backdrop-blur">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void save()}
          >
            Politikayı kaydet
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function DetailDialog({
  detail,
  policy,
  can,
  onClose,
  onChanged,
  onCreateRfq,
  onCreateQuote,
  onEnterQuoteFromRequest,
  onCreateOrder,
}: {
  detail: ProcurementDocumentDetail;
  policy?: ProcurementPolicy;
  can: (permission: string) => boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onCreateRfq: () => void;
  onCreateQuote: () => void;
  onEnterQuoteFromRequest: () => void;
  onCreateOrder: () => void;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const [inviteSupplierId, setInviteSupplierId] = useState<number>();
  const [lineAttachId, setLineAttachId] = useState<number | null>(null);
  const lineAttach = detail.lines.find((x) => x.id === lineAttachId);
  const actions = [
    ...(detail.documentType === "quote" &&
    detail.status === "Submitted" &&
    policy?.allowSupplierRevisions !== false &&
    (policy?.maximumSupplierRevisionCount ?? 1) > 0 &&
    can("WMS.PROCUREMENT.QUOTE.MANAGE")
      ? [{ action: "request-revision", label: "Revizyon iste" }]
      : []),
    ...allowedActions(detail, can).filter(
      (item) =>
        !(
          detail.documentType === "rfq" &&
          item.action === "send" &&
          policy?.supplierQuoteChannelMode === "PortalRequired"
        ),
    ),
  ];
  const run = async (action: string) => {
    setBusy(true);
    try {
      if (action === "request-revision")
        await procurementApi.requestRevision(
          detail.id,
          "Fiyat, termin veya ticari koşullar için revizyon istendi.",
        );
      else
        await procurementApi.transition(detail.documentType, detail.id, action);
      toast.success(
        action === "request-revision"
          ? "Tedarikçiye revizyon bağlantısı gönderildi."
          : "Belge durumu güncellendi.",
      );
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };
  const processedLabel =
    detail.documentType === "request"
      ? "Sipariş verilen"
      : detail.documentType === "order"
        ? "Mal kabul edilen"
        : detail.documentType === "quote"
          ? "Sipariş verilen"
          : "—";
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={`${detail.documentNo} · ${detail.subject}`}
      description={`${formatProjectDate(detail.documentDate)} · ${statusLabel[detail.status] ?? detail.status}`}
      className="!max-w-6xl"
    >
      <div className="space-y-5">
        <NextStepBanner detail={detail} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Info
            label="Tedarikçi"
            value={detail.counterpartyName || "Henüz seçilmedi"}
          />
          <Info label="Para birimi" value={detail.currencyCode} />
          <Info
            label="Termin"
            value={detail.dueDate ? formatProjectDate(detail.dueDate) : "—"}
          />
          <Info label="Satır" value={String(detail.lines.length)} />
        </div>
        {detail.documentType === "request" ||
        detail.documentType === "quote" ? (
          <SavedAttachmentsViewer
            title={
              detail.documentType === "request"
                ? "Talep Ekleri"
                : "Teklif Ekleri"
            }
            attachments={detail.attachments ?? []}
            canDelete={
              detail.documentType === "request"
                ? can("WMS.PROCUREMENT.REQUEST.MANAGE")
                : can("WMS.PROCUREMENT.QUOTE.MANAGE")
            }
            onChanged={onChanged}
            emptyText="Bu belgeye ait genel ek bulunmuyor."
          />
        ) : null}
        {detail.suppliers?.length ? (
          <div>
            <h3 className="mb-2 font-semibold">Davet edilen tedarikçiler</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {detail.suppliers.map((x) => (
                <div
                  key={`${x.supplierId ?? "manual"}-${x.supplierName}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/15 p-3"
                >
                  <div>
                    <b>
                      {x.supplierCode
                        ? `${x.supplierCode} · ${x.supplierName}`
                        : x.supplierName}
                    </b>
                    <p className="text-xs text-slate-500">
                      {x.supplierId
                        ? x.recipientEmail ||
                          "Henüz portal daveti gönderilmedi"
                        : "Manuel tedarikçi"}
                      {x.invitationStatus
                        ? ` · ${invitationLabel[x.invitationStatus] ?? x.invitationStatus}`
                        : ""}
                    </p>
                  </div>
                  {can("WMS.PROCUREMENT.RFQ.MANAGE") &&
                  policy?.supplierQuoteChannelMode !== "InternalOnly" &&
                  x.supplierId != null &&
                  x.invitationStatus !== "Submitted" ? (
                    <OpsActionButton
                      type="button"
                      variant="secondary"
                      onClick={() => setInviteSupplierId(x.supplierId!)}
                    >
                      <Mail size={15} />
                      {x.invitationStatus
                        ? "Yeniden gönder"
                        : "E-posta ile davet et"}
                    </OpsActionButton>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-cyan-500/15">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-cyan-500/10 text-left text-xs uppercase text-cyan-400">
              <tr>
                <th className="p-3">#</th>
                <th>Stok</th>
                <th>Miktar</th>
                <th>{processedLabel}</th>
                <th>Açık</th>
                <th>Birim fiyat</th>
                <th>Termin</th>
                {detail.documentType === "request" ||
                detail.documentType === "quote" ? (
                  <th>Ekler</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((x) => (
                <tr key={x.id} className="border-t border-cyan-500/10">
                  <td className="p-3">{x.lineNo}</td>
                  <td>
                    {x.stockCode ? `${x.stockCode} · ` : ""}
                    {x.stockName}
                  </td>
                  <td>
                    {formatProjectNumber(x.quantity)} {x.unitCode}
                  </td>
                  <td>
                    {processedLabel === "—"
                      ? "—"
                      : formatProjectNumber(x.secondaryQuantity)}
                  </td>
                  <td className="font-semibold text-cyan-400">
                    {formatProjectNumber(x.openQuantity)}
                  </td>
                  <td>
                    {x.unitPrice > 0
                      ? `${formatProjectNumber(x.unitPrice)} ${detail.currencyCode}`
                      : "—"}
                  </td>
                  <td>
                    {x.requiredDate ? formatProjectDate(x.requiredDate) : "—"}
                  </td>
                  {detail.documentType === "request" ||
                  detail.documentType === "quote" ? (
                    <td className="p-2">
                      <LineAttachmentBadge
                        count={x.attachments?.length ?? 0}
                        onClick={() => setLineAttachId(x.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lineAttach ? (
          <LineAttachmentsDialog
            open
            onClose={() => setLineAttachId(null)}
            title="Kalem Ekleri"
            subtitle={`${lineAttach.stockCode ? `${lineAttach.stockCode} · ` : ""}${lineAttach.stockName}`}
          >
            <SavedAttachmentsViewer
              title="Kalem Ekleri"
              attachments={lineAttach.attachments ?? []}
              canDelete={
                detail.documentType === "request"
                  ? can("WMS.PROCUREMENT.REQUEST.MANAGE")
                  : can("WMS.PROCUREMENT.QUOTE.MANAGE")
              }
              onChanged={onChanged}
              emptyText="Bu kaleme ait ek bulunmuyor."
            />
          </LineAttachmentsDialog>
        ) : null}
        <div>
          <h3 className="mb-2 font-semibold">Karar geçmişi</h3>
          <div className="space-y-2">
            {detail.history.length ? (
              detail.history.map((x, i) => (
                <div
                  key={`${x.changedAtUtc}-${i}`}
                  className="rounded-lg border border-cyan-500/10 p-3 text-sm"
                >
                  <b>
                    {(statusLabel[x.fromStatus] ?? x.fromStatus) ||
                      "Oluşturuldu"}{" "}
                    → {statusLabel[x.toStatus] ?? x.toStatus}
                  </b>
                  <span className="ml-3 text-slate-500">
                    {formatProjectDateTime(x.changedAtUtc)} · Kullanıcı #
                    {x.actorUserId}
                  </span>
                  {x.note ? (
                    <p className="mt-1 text-slate-500">{x.note}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Henüz durum hareketi yok.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {detail.documentType === "request" &&
          (detail.status === "Approved" ||
            detail.status === "PartiallyConverted") &&
          detail.lines.some((x) => x.openQuantity > 0) &&
          can("WMS.PROCUREMENT.QUOTE.MANAGE") ? (
            <OpsActionButton
              type="button"
              variant="primary"
              disabled={busy}
              onClick={onEnterQuoteFromRequest}
            >
              <Plus size={16} /> Teklif gir
            </OpsActionButton>
          ) : null}
          {detail.documentType === "request" &&
          (detail.status === "Approved" ||
            detail.status === "PartiallyConverted") &&
          detail.lines.some((x) => x.openQuantity > 0) &&
          can("WMS.PROCUREMENT.RFQ.MANAGE") ? (
            <OpsActionButton
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onCreateRfq}
            >
              Yeni teklif turu oluştur <ArrowRight size={16} />
            </OpsActionButton>
          ) : null}
          {detail.documentType === "rfq" &&
          (detail.status === "Sent" || detail.status === "Quoted") &&
          policy?.supplierQuoteChannelMode !== "PortalRequired" &&
          can("WMS.PROCUREMENT.QUOTE.MANAGE") ? (
            <OpsActionButton
              type="button"
              variant="primary"
              disabled={busy}
              onClick={onCreateQuote}
            >
              <Plus size={16} /> Tedarikçi teklifi gir
            </OpsActionButton>
          ) : null}
          {detail.documentType === "quote" &&
          (detail.status === "Approved" ||
            detail.status === "PartiallyConverted") &&
          detail.lines.some((x) => x.openQuantity > 0) &&
          can("WMS.PROCUREMENT.ORDER.MANAGE") ? (
            <OpsActionButton
              type="button"
              variant="primary"
              disabled={busy}
              onClick={onCreateOrder}
            >
              Sipariş paylaştır <ArrowRight size={16} />
            </OpsActionButton>
          ) : null}
          {actions.map((x) => (
            <OpsActionButton
              key={x.action}
              type="button"
              variant={
                x.action === "cancel" || x.action === "reject"
                  ? "secondary"
                  : "primary"
              }
              disabled={busy}
              onClick={() => void run(x.action)}
            >
              {x.label}
            </OpsActionButton>
          ))}
        </div>
        {inviteSupplierId ? (
          <SupplierInvitationDialog
            rfq={detail}
            supplierId={inviteSupplierId}
            onClose={() => setInviteSupplierId(undefined)}
            onSaved={async () => {
              setInviteSupplierId(undefined);
              await onChanged();
            }}
          />
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
const invitationLabel: Record<string, string> = {
  Sent: "Gönderildi",
  Opened: "Açıldı",
  DraftSaved: "Taslak kaydedildi",
  Submitted: "Teklif gönderildi",
  RevisionRequested: "Revizyon istendi",
  Revoked: "İptal edildi",
  Expired: "Süresi doldu",
};
function SupplierInvitationDialog({
  rfq,
  supplierId,
  onClose,
  onSaved,
}: {
  rfq: ProcurementDocumentDetail;
  supplierId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): ReactElement {
  const supplier = rfq.suppliers?.find((x) => x.supplierId === supplierId);
  const [email, setEmail] = useState(supplier?.recipientEmail ?? "");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Geçerli bir tedarikçi e-posta adresi girin.");
      return;
    }
    setBusy(true);
    try {
      await procurementApi.sendInvitation(rfq.id, {
        supplierId,
        recipientEmail: email,
      });
      toast.success("Güvenli teklif bağlantısı tedarikçiye gönderildi.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Davet gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Tedarikçiye teklif bağlantısı gönder"
      description={`${supplier?.supplierCode ?? ""} · ${supplier?.supplierName ?? ""}`}
      className="!max-w-lg"
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-slate-400">
          Tedarikçi kendisine özel, satınalma politikasında belirlenen süre
          boyunca geçerli bağlantıdan fiyat ve termin girer.
        </p>
        <Field label="Tedarikçi e-posta adresi *">
          <AppInput
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void send()}
          >
            <Mail size={16} />
            Bağlantıyı gönder
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
const allowedActions = (
  d: ProcurementDocumentDetail,
  can: (permission: string) => boolean,
): Array<{ action: string; label: string }> =>
  d.documentType === "request"
    ? d.status === "Draft" && can("WMS.PROCUREMENT.REQUEST.MANAGE")
      ? [{ action: "submit", label: "Onaya gönder" }]
      : d.status === "PendingApproval" && can("WMS.PROCUREMENT.APPROVE")
        ? [
            { action: "approve", label: "Onayla" },
            { action: "reject", label: "Reddet" },
          ]
        : []
    : d.documentType === "order"
      ? d.status === "Draft" && can("WMS.PROCUREMENT.ORDER.MANAGE")
        ? [{ action: "submit", label: "Onaya gönder" }]
        : d.status === "PendingApproval" && can("WMS.PROCUREMENT.APPROVE")
          ? [
              { action: "approve", label: "Onayla" },
              { action: "reject", label: "Taslağa döndür" },
            ]
          : d.status === "Approved" && can("WMS.PROCUREMENT.ORDER.MANAGE")
            ? [{ action: "send", label: "Tedarikçiye gönder" }]
            : []
      : d.documentType === "rfq" &&
          d.status === "Draft" &&
          can("WMS.PROCUREMENT.RFQ.MANAGE")
        ? [{ action: "send", label: "Tedarikçilere gönder" }]
        : d.documentType === "quote" &&
            d.status === "Submitted" &&
            can("WMS.PROCUREMENT.APPROVE")
          ? [
              { action: "approve", label: "Teklifi onayla" },
              { action: "reject", label: "Reddet" },
            ]
          : [];
function NextStepBanner({ detail }: { detail: ProcurementDocumentDetail }) {
  const text =
    detail.documentType === "request"
      ? detail.status === "Draft"
        ? "Sonraki adım: Talebi onaya gönderin."
        : detail.status === "PendingApproval"
          ? "Onay kararı bekleniyor."
          : detail.status === "Approved"
            ? "Talep hazır: Bir veya birden fazla teklif toplama turu oluşturabilirsiniz."
            : detail.status === "PartiallyConverted"
              ? "Talebin bir bölümü sipariş edildi; açık miktar için yeni teklif turu veya sipariş oluşturabilirsiniz."
              : detail.status === "Converted"
                ? "Talebin tüm miktarı satınalma siparişlerine bağlandı."
                : "Bu talep için işlem kapandı."
      : detail.documentType === "rfq"
        ? detail.status === "Draft"
          ? "Sonraki adım: Teklif talebini tedarikçilere gönderin."
          : detail.status === "Sent"
            ? "Tedarikçi cevaplarını teklif olarak kaydedebilirsiniz."
            : detail.status === "Quoted"
              ? "En az bir teklif geldi; diğer teklifleri de kaydedebilir veya süreci kapatabilirsiniz."
              : "Teklif toplama süreci kapandı."
        : detail.documentType === "quote"
          ? detail.status === "Submitted"
            ? "Teklifi inceleyip onaylayın veya reddedin."
            : detail.status === "Approved"
              ? "Teklif hazır: Seçilen kalem ve miktarları siparişe dönüştürün."
              : detail.status === "PartiallyConverted"
                ? "Teklifin bir bölümü sipariş edildi; kalan miktar için yeni sipariş oluşturabilirsiniz."
                : detail.status === "Converted"
                  ? "Teklifin tüm miktarı satınalma siparişlerine dönüştürüldü."
                  : "Teklif için işlem kapandı."
          : detail.status === "Draft"
            ? "Sonraki adım: Siparişi onaya gönderin."
            : detail.status === "PendingApproval"
              ? "Sipariş onay kararı bekliyor."
              : detail.status === "Approved"
                ? "Siparişi tedarikçiye gönderin."
                : detail.status === "SentToSupplier"
                  ? "Sipariş gönderildi; mal kabul için açık kaynak belgedir."
                  : "Sipariş süreci devam ediyor.";
  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-sm text-cyan-200">
      <b>Şimdi ne olacak?</b>
      <span className="ml-2 text-slate-400">{text}</span>
    </div>
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
    <div className="rounded-xl border border-cyan-500/15 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
