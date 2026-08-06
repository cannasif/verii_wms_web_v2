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
  Loader2,
  Mail,
  Plus,
  Settings2,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import {
  requiredActionColumn,
  systemColumns,
} from "@/components/shared/GridSystemColumns";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import {
  OpsStatusBadge,
  type OpsStatusTone,
} from "@/components/shared/OpsStatusBadge";
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
  PartiallyApproved: "Kalem Bazlı İşlem Devam Ediyor",
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
type HubRecentItem = ProcurementGridRow & { href: string };

const hubRecentQuery = (type: ProcurementDocumentType) =>
  procurementApi.paged(type, {
    pageNumber: 1,
    pageSize: 4,
    search: null,
    searchFields: ["documentNo", "subject", "counterparty"],
    sortBy: "createdDate",
    sortDirection: "desc",
    filterLogic: "and",
    filters: [],
  });

export function ProcurementHubPage(): ReactElement {
  const { can } = usePermissionAccess();
  const [summary, setSummary] = useState<ProcurementSummary>();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [recent, setRecent] = useState<HubRecentItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [summaryTick, setSummaryTick] = useState(0);

  useEffect(() => {
    setSummaryLoading(true);
    setSummaryError(null);
    void procurementApi
      .summary()
      .then((data) => {
        setSummary(data);
        setSummaryError(null);
      })
      .catch((e) => {
        setSummary(undefined);
        setSummaryError(
          e instanceof Error ? e.message : "Satınalma özeti yüklenemedi.",
        );
      })
      .finally(() => setSummaryLoading(false));
  }, [summaryTick]);

  useEffect(() => {
    setRecentLoading(true);
    void Promise.all([
      hubRecentQuery("request"),
      hubRecentQuery("rfq"),
      hubRecentQuery("quote"),
      hubRecentQuery("order"),
    ])
      .then(([requests, rfqs, quotes, orders]) => {
        const map = (
          page: Awaited<ReturnType<typeof procurementApi.paged>>,
          hrefBase: string,
        ): HubRecentItem[] =>
          (page.data ?? page.items ?? []).map((row) => ({
            ...row,
            href: hrefBase,
          }));
        const merged = [
          ...map(requests, "/procurement/requests"),
          ...map(rfqs, "/procurement/rfqs"),
          ...map(quotes, "/procurement/quotes"),
          ...map(orders, "/procurement/orders"),
        ].sort((a, b) => {
          const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return db - da;
        });
        setRecent(merged.slice(0, 8));
      })
      .catch(() => setRecent([]))
      .finally(() => setRecentLoading(false));
  }, [summaryTick]);

  const pendingRequests = summary?.pendingRequests ?? 0;
  const draftRequests = summary?.draftRequests ?? 0;
  const openRfqs = summary?.openRfqs ?? 0;
  const submittedQuotes = summary?.submittedQuotes ?? 0;
  const pendingOrders = summary?.pendingOrders ?? 0;
  const approvedOpenOrders = summary?.approvedOpenOrders ?? 0;
  const requestTotal = pendingRequests + draftRequests;
  const orderTotal = pendingOrders + approvedOpenOrders;
  const hasAnyWork =
    requestTotal + openRfqs + submittedQuotes + orderTotal > 0;

  const workflow = [
    {
      key: "request" as const,
      step: "01",
      short: "TALEP",
      title: "Satınalma Talepleri",
      blurb: "İç ihtiyaçlar ve onaylar",
      href: "/procurement/requests",
      icon: ClipboardList,
      primary: requestTotal,
      primaryLabel: "aktif talep",
      secondary: pendingRequests,
      secondaryLabel: "onay bekliyor",
      tertiary: draftRequests,
      tertiaryLabel: "taslak",
      attention: pendingRequests > 0,
      live: requestTotal > 0,
    },
    {
      key: "rfq" as const,
      step: "02",
      short: "RFQ",
      title: "Teklif Talepleri",
      blurb: "Tedarikçilerden fiyat topla",
      href: "/procurement/rfqs",
      icon: FileSearch,
      primary: openRfqs,
      primaryLabel: "açık RFQ",
      secondary: openRfqs,
      secondaryLabel: "cevap bekliyor",
      tertiary: 0,
      tertiaryLabel: "",
      attention: openRfqs > 0,
      live: openRfqs > 0,
    },
    {
      key: "quote" as const,
      step: "03",
      short: "TEKLİF",
      title: "Tedarikçi Teklifleri",
      blurb: "Fiyatları değerlendir",
      href: "/procurement/quotes",
      icon: FileCheck2,
      primary: submittedQuotes,
      primaryLabel: "gelen teklif",
      secondary: submittedQuotes,
      secondaryLabel: "değerlendirme",
      tertiary: 0,
      tertiaryLabel: "",
      attention: submittedQuotes > 0,
      live: submittedQuotes > 0,
    },
    {
      key: "order" as const,
      step: "04",
      short: "SİPARİŞ",
      title: "Satınalma Siparişleri",
      blurb: "Onaylanan teklifleri siparişe dönüştür",
      href: "/procurement/orders",
      icon: ShoppingCart,
      primary: orderTotal,
      primaryLabel: "aktif sipariş",
      secondary: pendingOrders,
      secondaryLabel: "onay bekliyor",
      tertiary: approvedOpenOrders,
      tertiaryLabel: "mal kabule açık",
      attention: pendingOrders > 0,
      live: orderTotal > 0,
    },
  ];

  const flowMax = Math.max(
    1,
    ...workflow.map((s) => s.primary),
  );

  const actionItems = [
    pendingRequests > 0
      ? {
          key: "pending-requests",
          eyebrow: "Onay bekliyor",
          title: `${pendingRequests} satın alma talebi`,
          detail: "Onayınız gerekiyor",
          href: "/procurement/requests",
          cta: "Taleplere Git",
        }
      : null,
    submittedQuotes > 0
      ? {
          key: "submitted-quotes",
          eyebrow: "Teklif değerlendir",
          title: `${submittedQuotes} tedarikçi teklifi`,
          detail: "Karar bekliyor",
          href: "/procurement/quotes",
          cta: "Tekliflere Git",
        }
      : null,
    pendingOrders > 0
      ? {
          key: "pending-orders",
          eyebrow: "Sipariş onayı",
          title: `${pendingOrders} satınalma siparişi`,
          detail: "Onay bekliyor",
          href: "/procurement/orders",
          cta: "Siparişlere Git",
        }
      : null,
    openRfqs > 0
      ? {
          key: "open-rfqs",
          eyebrow: "RFQ takibi",
          title: `${openRfqs} açık teklif talebi`,
          detail: "Cevap / teklif bekleniyor",
          href: "/procurement/rfqs",
          cta: "RFQ’lara Git",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    eyebrow: string;
    title: string;
    detail: string;
    href: string;
    cta: string;
  }>;

  const quickActions = [
    can("WMS.PROCUREMENT.REQUEST.MANAGE")
      ? { key: "new-request", label: "+ Yeni Talep", href: "/procurement/requests" }
      : null,
    can("WMS.PROCUREMENT.RFQ.MANAGE")
      ? { key: "new-rfq", label: "+ RFQ Oluştur", href: "/procurement/rfqs" }
      : null,
    can("WMS.PROCUREMENT.QUOTE.MANAGE")
      ? {
          key: "new-quote",
          label: "+ Teklif Gir",
          href: "/procurement/quotes/new",
        }
      : null,
    can("WMS.PROCUREMENT.ORDER.MANAGE")
      ? {
          key: "new-order",
          label: "+ Sipariş Oluştur",
          href: "/procurement/orders",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  const pipeline = [
    {
      key: "request",
      title: "Talepler",
      total: requestTotal,
      href: "/procurement/requests",
      segments: [
        { label: "Onay bekliyor", value: pendingRequests, tone: "pending" },
        { label: "Taslak", value: draftRequests, tone: "neutral" },
      ],
    },
    {
      key: "rfq",
      title: "RFQ",
      total: openRfqs,
      href: "/procurement/rfqs",
      segments: [
        { label: "Açık / cevap bekliyor", value: openRfqs, tone: "active" },
      ],
    },
    {
      key: "quote",
      title: "Teklifler",
      total: submittedQuotes,
      href: "/procurement/quotes",
      segments: [
        {
          label: "Değerlendiriliyor",
          value: submittedQuotes,
          tone: "pending",
        },
      ],
    },
    {
      key: "order",
      title: "Siparişler",
      total: orderTotal,
      href: "/procurement/orders",
      segments: [
        { label: "Onay bekliyor", value: pendingOrders, tone: "pending" },
        {
          label: "Mal kabule açık",
          value: approvedOpenOrders,
          tone: "done",
        },
      ],
    },
  ] as const;

  const activityMeta = (type: string) => {
    if (type === "request")
      return { icon: ClipboardList, label: "Satın alma talebi" };
    if (type === "rfq") return { icon: FileSearch, label: "Teklif talebi" };
    if (type === "quote")
      return { icon: FileCheck2, label: "Tedarikçi teklifi" };
    return { icon: ShoppingCart, label: "Satınalma siparişi" };
  };

  return (
    <section className="relative space-y-6 overflow-visible">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-6 -right-6 -top-8 h-72 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 12% 0%, color-mix(in oklab, var(--wms-brand-primary) 16%, transparent), transparent 72%)",
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4 overflow-visible pb-2 pt-1">
        <div className="min-w-0 space-y-2.5 overflow-visible">
          <p className="text-[11px] font-semibold uppercase leading-normal tracking-[0.22em] text-[var(--wms-brand-primary)]">
            Satın Alma · Procurement Flow
          </p>
          <h1 className="text-2xl font-bold leading-[1.35] tracking-tight text-[var(--wms-app-text)]">
            Süreç Merkezi
          </h1>
          <p className="max-w-2xl pb-0.5 text-sm leading-relaxed text-[var(--wms-app-text-muted)]">
            Talepten siparişe kadar satın alma sürecini canlı olarak buradan
            yönetin.
          </p>
        </div>
        {can("WMS.PROCUREMENT.APPROVE") ? (
          <OpsActionButton
            type="button"
            variant="secondary"
            className="shrink-0 self-start"
            onClick={() => setPolicyOpen(true)}
          >
            <Settings2 size={16} /> Süreç Politikası
          </OpsActionButton>
        ) : null}
      </div>

      {summaryError ? (
        <div className="relative rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-4 py-5">
          <p className="text-sm font-semibold text-[var(--wms-app-text)]">
            Satın alma özeti yüklenemedi.
          </p>
          <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
            {summaryError}
          </p>
          <OpsActionButton
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => setSummaryTick((x) => x + 1)}
          >
            Tekrar Dene
          </OpsActionButton>
        </div>
      ) : null}

      {/* FLOW — visual backbone */}
      <section
        aria-label="Satın alma süreç akışı"
        className="relative overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklab, var(--wms-app-border) 55%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--wms-app-border) 55%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse 90% 80% at 50% 40%, black 20%, transparent 75%)",
          }}
        />
        <div className="relative border-b border-[var(--wms-app-border)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--wms-brand-primary)]">
                Procurement Flow
              </h2>
              <p className="mt-0.5 text-sm text-[var(--wms-app-text-muted)]">
                Talep → RFQ → Teklif → Sipariş
              </p>
            </div>
            {!summaryLoading && hasAnyWork ? (
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--wms-app-text-muted)]">
                <span className="text-[var(--wms-app-text)]">{requestTotal}</span>
                <span className="opacity-40">━━</span>
                <span className="text-[var(--wms-app-text)]">{openRfqs}</span>
                <span className="opacity-40">━━</span>
                <span className="text-[var(--wms-app-text)]">
                  {submittedQuotes}
                </span>
                <span className="opacity-40">━━</span>
                <span className="text-[var(--wms-app-text)]">{orderTotal}</span>
              </div>
            ) : null}
          </div>
        </div>

        {summaryLoading ? (
          <div className="relative grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-border)_35%,transparent)]"
              />
            ))}
          </div>
        ) : !hasAnyWork ? (
          <div className="relative px-5 py-10 text-center">
            <p className="text-base font-semibold text-[var(--wms-app-text)]">
              Satın alma süreciniz burada görünecek.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--wms-app-text-muted)]">
              Henüz aktif bir satın alma işlemi bulunmuyor. İlk talebi
              oluşturarak süreci başlatın.
            </p>
            {can("WMS.PROCUREMENT.REQUEST.MANAGE") ? (
              <OpsActionButton asChild variant="primary" className="mt-4">
                <Link to="/procurement/requests">
                  <Plus size={16} /> Yeni Talep Oluştur
                </Link>
              </OpsActionButton>
            ) : null}
          </div>
        ) : (
          <ol className="relative flex flex-col gap-0 px-3 py-5 sm:px-4 lg:flex-row lg:items-stretch lg:px-5">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              const next = workflow[index + 1];
              const connectorLive = step.live && Boolean(next?.live);
              const connectorAttention = step.attention || next?.attention;
              return (
                <li
                  key={step.key}
                  className="relative flex flex-1 flex-col lg:flex-row lg:items-stretch"
                >
                  <Link
                    to={step.href}
                    title={`${step.primary} ${step.primaryLabel}${step.secondary > 0 ? ` · ${step.secondary} ${step.secondaryLabel}` : ""}`}
                    className={cn(
                      "group relative flex min-h-[168px] flex-1 flex-col rounded-xl border px-4 py-4 transition duration-200",
                      "bg-[color-mix(in_oklab,var(--wms-app-panel)_88%,transparent)]",
                      "border-[var(--wms-app-border)] hover:border-[var(--wms-brand-primary)]/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]",
                      step.attention &&
                        "border-[var(--wms-brand-primary)]/45 shadow-[0_0_0_1px_color-mix(in_oklab,var(--wms-brand-primary)_25%,transparent)]",
                      !step.live && "opacity-75",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full border transition duration-200",
                          step.attention
                            ? "border-[var(--wms-brand-primary)] bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)]"
                            : step.live
                              ? "border-[var(--wms-brand-primary)]/50 text-[var(--wms-brand-primary)] group-hover:bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)]"
                              : "border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)]",
                        )}
                      >
                        <Icon size={17} strokeWidth={1.75} />
                      </span>
                      <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--wms-app-text-muted)]">
                        {step.step}
                      </span>
                    </div>

                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-brand-primary)]">
                      {step.short}
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-[var(--wms-app-text)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
                      {step.blurb}
                    </p>

                    <div className="mt-auto pt-4">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold tabular-nums tracking-tight text-[var(--wms-app-text)]">
                            {step.primary}
                          </p>
                          <p className="text-[11px] text-[var(--wms-app-text-muted)]">
                            {step.primaryLabel}
                          </p>
                        </div>
                        {step.secondary > 0 ? (
                          <OpsStatusBadge
                            tone={step.attention ? "pending" : "neutral"}
                          >
                            {step.secondary} {step.secondaryLabel}
                          </OpsStatusBadge>
                        ) : (
                          <OpsStatusBadge tone="neutral">Sakin</OpsStatusBadge>
                        )}
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--wms-app-border)_70%,transparent)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            step.attention
                              ? "bg-[var(--wms-brand-primary)]"
                              : "bg-[color-mix(in_oklab,var(--wms-brand-primary)_55%,var(--wms-app-border))]",
                          )}
                          style={{
                            width: `${Math.max(6, Math.round((step.primary / flowMax) * 100))}%`,
                          }}
                        />
                      </div>
                      {step.tertiary > 0 && step.tertiaryLabel ? (
                        <p className="mt-1.5 text-[11px] text-[var(--wms-app-text-muted)]">
                          {step.tertiary} {step.tertiaryLabel}
                        </p>
                      ) : null}
                    </div>
                  </Link>

                  {index < workflow.length - 1 ? (
                    <div
                      className="flex items-center justify-center py-1 lg:w-10 lg:shrink-0 lg:px-1 lg:py-0"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "hidden h-[2px] w-full rounded-full transition duration-200 lg:block",
                          connectorLive
                            ? connectorAttention
                              ? "bg-[var(--wms-brand-primary)]"
                              : "bg-[color-mix(in_oklab,var(--wms-brand-primary)_55%,var(--wms-app-border))]"
                            : "bg-[var(--wms-app-border)]",
                        )}
                      />
                      <div
                        className={cn(
                          "h-8 w-[2px] rounded-full lg:hidden",
                          connectorLive
                            ? "bg-[var(--wms-brand-primary)]"
                            : "bg-[var(--wms-app-border)]",
                        )}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Pipeline + Actions */}
      <div className="relative grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-app-text-muted)]">
            Satın Alma Pipeline
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {pipeline.map((col) => {
              const segMax = Math.max(
                1,
                ...col.segments.map((s) => s.value),
                col.total,
              );
              return (
                <Link
                  key={col.key}
                  to={col.href}
                  className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/70 px-3.5 py-3 transition duration-200 hover:border-[var(--wms-brand-primary)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--wms-app-text-muted)]">
                      {col.title}
                    </p>
                    <p className="text-lg font-bold tabular-nums text-[var(--wms-app-text)]">
                      {summaryLoading ? "—" : col.total}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {col.segments.map((seg) => (
                      <div key={seg.label}>
                        <div className="mb-1 flex justify-between gap-2 text-[11px]">
                          <span className="text-[var(--wms-app-text-muted)]">
                            {seg.label}
                          </span>
                          <span className="font-semibold tabular-nums text-[var(--wms-app-text)]">
                            {summaryLoading ? "—" : seg.value}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--wms-app-border)_65%,transparent)]">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              seg.tone === "pending" &&
                                "bg-[var(--wms-brand-primary)]",
                              seg.tone === "done" && "bg-emerald-500/80",
                              seg.tone === "active" &&
                                "bg-[color-mix(in_oklab,var(--wms-brand-primary)_70%,white)]",
                              seg.tone === "neutral" &&
                                "bg-[var(--wms-app-text-muted)]/50",
                            )}
                            style={{
                              width: summaryLoading
                                ? "20%"
                                : `${Math.max(seg.value > 0 ? 8 : 0, Math.round((seg.value / segMax) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-app-text-muted)]">
            Şimdi ilgilenmen gerekenler
          </h2>
          <div className="mt-3 space-y-2.5">
            {summaryLoading ? (
              <div className="h-24 animate-pulse rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-border)_30%,transparent)]" />
            ) : actionItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--wms-app-border)] px-4 py-5 text-sm text-[var(--wms-app-text-muted)]">
                Şu an aksiyon gerektiren bekleyen iş yok. Süreç sakin.
              </div>
            ) : (
              actionItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.href}
                  className={cn(
                    "group relative block overflow-hidden rounded-xl border border-l-[3px] px-4 py-3.5 transition duration-200",
                    "border-[var(--wms-app-border)] border-l-[var(--wms-brand-primary)]",
                    "bg-[color-mix(in_oklab,var(--wms-brand-primary)_7%,var(--wms-app-panel))]",
                    "hover:border-[var(--wms-brand-primary)]/45",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-brand-primary)]">
                    ● {item.eyebrow}
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[var(--wms-app-text)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
                    {item.detail}
                  </p>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--wms-brand-primary)]">
                    {item.cta}
                    <ArrowRight
                      size={13}
                      className="transition duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))
            )}
          </div>

          {quickActions.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-app-text-muted)]">
                Hızlı işlemler
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.key}
                    to={action.href}
                    className="inline-flex items-center rounded-lg border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--wms-app-text)] transition duration-200 hover:border-[var(--wms-brand-primary)]/45 hover:text-[var(--wms-brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* Recent activity timeline */}
      <section className="relative">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-app-text-muted)]">
          Son işlemler
        </h2>
        <div className="mt-3">
          {recentLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-[color-mix(in_oklab,var(--wms-app-border)_30%,transparent)]"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              Henüz görüntülenecek işlem yok.
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-[var(--wms-app-border)] pl-4">
              {recent.map((row) => {
                const meta = activityMeta(row.documentType);
                const Icon = meta.icon;
                return (
                  <li key={`${row.documentType}-${row.id}`} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[21px] top-1 flex size-6 items-center justify-center rounded-full border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] text-[var(--wms-brand-primary)]">
                      <Icon size={12} strokeWidth={2} />
                    </span>
                    <Link
                      to={row.href}
                      className="block rounded-lg px-2 py-1.5 transition duration-200 hover:bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--wms-app-text-muted)]">
                            {row.documentDate
                              ? formatProjectDate(row.documentDate)
                              : "—"}{" "}
                            · {meta.label}
                          </p>
                          <p className="mt-0.5 text-sm">
                            <span className="font-mono font-semibold text-[var(--wms-app-text)]">
                              {row.documentNo}
                            </span>
                            <span className="mx-1.5 text-[var(--wms-app-text-muted)]">
                              ·
                            </span>
                            <span className="text-[var(--wms-app-text-muted)]">
                              {row.subject}
                            </span>
                          </p>
                        </div>
                        <OpsStatusBadge
                          tone={
                            row.status === "PendingApproval" ||
                            row.status === "Submitted"
                              ? "pending"
                              : row.status === "Approved" ||
                                  row.status === "Converted"
                                ? "done"
                                : row.status === "Rejected" ||
                                    row.status === "Cancelled"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {statusLabel[row.status] ?? row.status}
                        </OpsStatusBadge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

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
  const openDocumentDetail = useCallback(
    (documentType: ProcurementDocumentType, id: number) => {
      void procurementApi
        .detail(documentType, id)
        .then(setDetail)
        .catch((e) =>
          toast.error(
            e instanceof Error ? e.message : "Belge detayı alınamadı.",
          ),
        );
    },
    [],
  );
  const openDetail = useCallback(
    (id: number) => openDocumentDetail(type, id),
    [openDocumentDetail, type],
  );
  const columns = useMemo<GridColumn<ProcurementGridRow>[]>(
    () => {
      const sourceColumns: GridColumn<ProcurementGridRow>[] = [];
      const linkedColumn = (
        key: "requestNo" | "rfqNo" | "quoteNo",
        label: string,
        documentType: ProcurementDocumentType,
        idOf: (row: ProcurementGridRow) => number | null | undefined,
        noOf: (row: ProcurementGridRow) => string | null | undefined,
      ): GridColumn<ProcurementGridRow> => ({
        key,
        label,
        sortable: true,
        defaultSearch: true,
        contextValue: noOf,
        render: (row) => {
          const id = idOf(row);
          const no = noOf(row);
          return id && no ? (
            <button
              type="button"
              className="font-mono text-xs font-semibold text-cyan-500 hover:underline"
              onClick={() => openDocumentDetail(documentType, id)}
            >
              {no}
            </button>
          ) : (
            "—"
          );
        },
      });
      if (type !== "request")
        sourceColumns.push(
          linkedColumn(
            "requestNo",
            "Kaynak Talep",
            "request",
            (row) => row.requestId,
            (row) => row.requestNo,
          ),
        );
      if (type === "quote" || type === "order")
        sourceColumns.push(
          linkedColumn(
            "rfqNo",
            "Teklif Talebi",
            "rfq",
            (row) => row.rfqId,
            (row) => row.rfqNo,
          ),
        );
      if (type === "order")
        sourceColumns.push(
          linkedColumn(
            "quoteNo",
            "Kaynak Teklif",
            "quote",
            (row) => row.quoteId,
            (row) => row.quoteNo,
          ),
        );

      return [
      ...systemColumns<ProcurementGridRow>(),
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
      ...sourceColumns,
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
    ];
    },
    [openDetail, openDocumentDetail, type],
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
          onOpenLinkedDocument={openDocumentDetail}
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
      .filter(
        (x) =>
          x.openQuantity > 0 &&
          (!x.status || x.status === "Approved"),
      )
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
            .filter(
              (x) =>
                x.openQuantity > 0 &&
                (!x.status || x.status === "Approved"),
            )
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

function PolicyToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--wms-app-border)] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--wms-app-text)]">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--wms-app-text-muted)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onChange}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-[var(--wms-brand-primary)] bg-[var(--wms-brand-primary)]"
            : "border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
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
  const [section, setSection] = useState<
    "general" | "suppliers" | "quotes" | "portal"
  >("general");
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

  const toggle = (key: PolicyFlag) =>
    setPolicy((x) => (x ? { ...x, [key]: !x[key] } : x));

  const save = async () => {
    if (!policy) return;
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

  if (!policy)
    return (
      <ResponsiveDialog open onClose={onClose} title="Süreç Politikası">
        <p className="flex items-center gap-2 p-2 text-sm text-[var(--wms-app-text-muted)]">
          <Loader2 className="size-4 animate-spin" /> Politika yükleniyor…
        </p>
      </ResponsiveDialog>
    );

  const groups: Record<
    "general" | "suppliers" | "quotes",
    {
      title: string;
      items: Array<{ key: PolicyFlag; title: string; description: string }>;
    }
  > = {
    general: {
      title: "Genel süreç",
      items: [
        {
          key: "allowMultipleRfqsPerRequest",
          title: "Bir talepten birden fazla RFQ",
          description:
            "Aynı satın alma talebi için farklı zamanlarda veya tedarikçi gruplarıyla yeni teklif turu açmaya izin verir.",
        },
        {
          key: "allowPartialRfqLines",
          title: "Bir talepten kısmi RFQ",
          description:
            "Talebin seçilen kalemlerini veya açık miktarın bir bölümünü fiyatlamaya çıkarmaya izin verir.",
        },
        {
          key: "allowMultipleQuotesPerSupplier",
          title: "Aynı tedarikçiden birden fazla teklif",
          description:
            "Aynı tedarikçinin aynı RFQ için birden fazla teklif kaydı oluşturmasına izin verir.",
        },
      ],
    },
    suppliers: {
      title: "Tedarikçi & paylaşım",
      items: [
        {
          key: "allowSplitAwardsAcrossSuppliers",
          title: "Talebi tedarikçilere böl",
          description:
            "Bir satın alma talebinin farklı kalemlerini farklı tedarikçilerden karşılamaya izin verir.",
        },
        {
          key: "allowPartialOrderLines",
          title: "Kısmi tedarik",
          description:
            "Teklifin yalnızca seçilen kalem veya miktarını siparişe dönüştürmeye izin verir.",
        },
        {
          key: "allowMultipleOrdersPerQuote",
          title: "Birden fazla tedarikçiye / siparişe ödül",
          description:
            "Aynı tekliften farklı tarihlerde birden fazla sipariş oluşturmaya izin verir.",
        },
      ],
    },
    quotes: {
      title: "Teklif",
      items: [
        {
          key: "allowSupplierQuantityChange",
          title: "Teklifte miktar değiştirme",
          description:
            "Tedarikçinin istenen miktardan farklı miktar teklif etmesine izin verir.",
        },
        {
          key: "allowZeroUnitPrice",
          title: "Sıfır fiyat",
          description:
            "Numune veya bedelsiz kalemlerde sıfır birim fiyat kabul edilir.",
        },
        {
          key: "requireSupplierDeliveryDate",
          title: "Termin zorunluluğu",
          description:
            "Her teklif kaleminde teslim tarihi girilmeden teklif gönderilemez.",
        },
        {
          key: "allowSupplierRevisions",
          title: "Revizyon",
          description:
            "Gönderilmiş teklif için satınalma ekibinin revizyon isteği açmasına izin verir.",
        },
      ],
    },
  };

  const nav: Array<{
    id: "general" | "suppliers" | "quotes" | "portal";
    label: string;
  }> = [
    { id: "general", label: "Genel" },
    { id: "suppliers", label: "Tedarikçiler" },
    { id: "quotes", label: "Teklifler" },
    { id: "portal", label: "Portal" },
  ];

  const portalModes: Array<{
    value: ProcurementPolicy["supplierQuoteChannelMode"];
    label: string;
  }> = [
    { value: "InternalOnly", label: "Internal Only" },
    { value: "PortalOptional", label: "Optional" },
    { value: "PortalRequired", label: "Required" },
  ];

  const activeGroup = section === "portal" ? null : groups[section];

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Süreç Politikası"
      description="Satın alma sürecinin nasıl çalışacağını belirleyin."
      className="!max-w-4xl"
    >
      <div className="flex max-h-[min(74vh,760px)] flex-col">
        <div className="min-h-0 flex-1 md:grid md:grid-cols-[160px_minmax(0,1fr)] md:gap-4">
          <nav
            className="mb-3 flex gap-1 overflow-x-auto border-b border-[var(--wms-app-border)] pb-2 md:mb-0 md:block md:overflow-visible md:border-b-0 md:border-r md:pb-0 md:pr-3"
            aria-label="Politika bölümleri"
          >
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-left text-xs font-semibold transition duration-200 md:w-full",
                  section === item.id
                    ? "bg-[color-mix(in_oklab,var(--wms-brand-primary)_14%,transparent)] text-[var(--wms-brand-primary)]"
                    : "text-[var(--wms-app-text-muted)] hover:bg-[color-mix(in_oklab,var(--wms-brand-primary)_7%,transparent)] hover:text-[var(--wms-app-text)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {activeGroup ? (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-brand-primary)]">
                  {activeGroup.title}
                </h3>
                <div className="mt-2 rounded-xl border border-[var(--wms-app-border)] px-3">
                  {activeGroup.items.map((item) => (
                    <PolicyToggleRow
                      key={item.key}
                      title={item.title}
                      description={item.description}
                      checked={Boolean(policy[item.key])}
                      onChange={() => toggle(item.key)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-brand-primary)]">
                  Tedarikçi portalı
                </h3>
                <div className="mt-2 space-y-4 rounded-xl border border-[var(--wms-app-border)] p-3">
                  <div>
                    <p className="text-sm font-semibold">Portal kullanım şekli</p>
                    <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
                      Tekliflerin şirket içinden mi, tedarikçi portalından mı
                      girileceğini seçin.
                    </p>
                    <div
                      className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-[var(--wms-app-border)] p-1"
                      role="radiogroup"
                      aria-label="Portal kullanım şekli"
                    >
                      {portalModes.map((mode) => {
                        const active =
                          policy.supplierQuoteChannelMode === mode.value;
                        return (
                          <button
                            key={mode.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() =>
                              setPolicy((x) =>
                                x
                                  ? {
                                      ...x,
                                      supplierQuoteChannelMode: mode.value,
                                    }
                                  : x,
                              )
                            }
                            className={cn(
                              "rounded-md px-2 py-2 text-xs font-semibold transition",
                              active
                                ? "bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)]"
                                : "text-[var(--wms-app-text-muted)] hover:bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)]",
                            )}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">
                      {policy.supplierQuoteChannelMode === "InternalOnly"
                        ? "Tedarikçiye bağlantı gönderilmez; teklifleri satınalma personeli girer."
                        : policy.supplierQuoteChannelMode === "PortalRequired"
                          ? "Teklif yalnızca tedarikçi portalından alınır."
                          : "Portal veya şirket içi giriş birlikte kullanılabilir."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Bağlantı süresi (gün)">
                      <AppInput
                        type="number"
                        min="1"
                        max="30"
                        value={policy.invitationValidityDays}
                        onChange={(e) =>
                          setPolicy((x) =>
                            x
                              ? {
                                  ...x,
                                  invitationValidityDays: Number(e.target.value),
                                }
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
                                  maximumSupplierRevisionCount: Number(
                                    e.target.value,
                                  ),
                                }
                              : x,
                          )
                        }
                      />
                    </Field>
                  </div>

                  <PolicyToggleRow
                    title="Tedarikçi taslak kaydedebilir"
                    description="Portal kullanıcısı teklifini göndermeden önce ara kayıt oluşturabilir."
                    checked={policy.allowSupplierDraftSave}
                    onChange={() => toggle("allowSupplierDraftSave")}
                  />
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 mt-3 flex justify-end gap-2 border-t border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 pt-3 backdrop-blur">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            loading={busy}
            onClick={() => void save()}
          >
            Değişiklikleri Kaydet
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function requestLineStatus(line: { status?: string | null }) {
  return line.status?.trim() || "Draft";
}

function requestLineStatusTone(status: string): OpsStatusTone {
  if (status === "Approved" || status === "Converted") return "done";
  if (status === "PendingApproval" || status === "PartiallyApproved")
    return "pending";
  if (status === "Rejected" || status === "Cancelled") return "danger";
  if (status === "Draft") return "neutral";
  return "active";
}

function DetailDialog({
  detail,
  policy,
  can,
  onClose,
  onOpenLinkedDocument,
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
  onOpenLinkedDocument: (
    documentType: ProcurementDocumentType,
    id: number,
  ) => void;
  onChanged: () => Promise<void>;
  onCreateRfq: () => void;
  onCreateQuote: () => void;
  onEnterQuoteFromRequest: () => void;
  onCreateOrder: () => void;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const [inviteSupplierId, setInviteSupplierId] = useState<number>();
  const [lineAttachId, setLineAttachId] = useState<number | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const lineAttach = detail.lines.find((x) => x.id === lineAttachId);

  const isRequest = detail.documentType === "request";
  const canSubmitLines =
    isRequest && can("WMS.PROCUREMENT.REQUEST.MANAGE");
  const canApproveLines = isRequest && can("WMS.PROCUREMENT.APPROVE");

  const selectableLineIds = useMemo(() => {
    if (!isRequest) return [] as number[];
    return detail.lines
      .filter((line) => {
        const status = requestLineStatus(line);
        if (status === "Draft" && canSubmitLines) return true;
        if (status === "PendingApproval" && canApproveLines) return true;
        return false;
      })
      .map((line) => line.id);
  }, [canApproveLines, canSubmitLines, detail.lines, isRequest]);

  useEffect(() => {
    setSelectedLineIds((prev) =>
      prev.filter((id) => selectableLineIds.includes(id)),
    );
  }, [selectableLineIds]);

  const selectedDraftIds = selectedLineIds.filter((id) => {
    const line = detail.lines.find((x) => x.id === id);
    return line && requestLineStatus(line) === "Draft";
  });
  const selectedPendingIds = selectedLineIds.filter((id) => {
    const line = detail.lines.find((x) => x.id === id);
    return line && requestLineStatus(line) === "PendingApproval";
  });

  const allSelectableChecked =
    selectableLineIds.length > 0 &&
    selectableLineIds.every((id) => selectedLineIds.includes(id));

  const toggleLine = (id: number, checked: boolean) => {
    if (!selectableLineIds.includes(id)) return;
    setSelectedLineIds((prev) =>
      checked
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((x) => x !== id),
    );
  };

  const toggleAllSelectable = (checked: boolean) => {
    setSelectedLineIds(checked ? [...selectableLineIds] : []);
  };

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
  const run = async (action: string, requestLineIds?: number[]) => {
    setBusy(true);
    try {
      if (action === "request-revision")
        await procurementApi.requestRevision(
          detail.id,
          "Fiyat, termin veya ticari koşullar için revizyon istendi.",
        );
      else
        await procurementApi.transition(
          detail.documentType,
          detail.id,
          action,
          undefined,
          requestLineIds,
        );
      toast.success(
        action === "request-revision"
          ? "Tedarikçiye revizyon bağlantısı gönderildi."
          : action === "submit"
            ? "Seçili kalemler onaya gönderildi."
            : action === "approve"
              ? "Seçili kalemler onaylandı."
              : "Belge durumu güncellendi.",
      );
      setSelectedLineIds([]);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const runSelectedSubmit = () => {
    if (selectedDraftIds.length === 0) {
      toast.error("Onaya göndermek için en az bir kalem seçin.");
      return;
    }
    void run("submit", selectedDraftIds);
  };

  const runSelectedApprove = () => {
    if (selectedPendingIds.length === 0) {
      toast.error("Onaylamak için en az bir kalem seçin.");
      return;
    }
    void run("approve", selectedPendingIds);
  };

  const runSelectedReject = () => {
    if (selectedPendingIds.length === 0) {
      toast.error("Reddetmek için en az bir kalem seçin.");
      return;
    }
    void run("reject", selectedPendingIds);
  };
  const processedLabel =
    detail.documentType === "request"
      ? "Sipariş verilen"
      : detail.documentType === "order"
        ? "Mal kabul edilen"
        : detail.documentType === "quote"
          ? "Sipariş verilen"
          : "—";
  const sourceDocuments: Array<{
    type: ProcurementDocumentType;
    id: number;
    no: string;
    label: string;
  }> = [];
  if (
    detail.documentType !== "request" &&
    detail.requestId &&
    detail.requestNo
  )
    sourceDocuments.push({
      type: "request",
      id: detail.requestId,
      no: detail.requestNo,
      label: "Satınalma Talebi",
    });
  if (
    (detail.documentType === "quote" || detail.documentType === "order") &&
    detail.rfqId &&
    detail.rfqNo
  )
    sourceDocuments.push({
      type: "rfq",
      id: detail.rfqId,
      no: detail.rfqNo,
      label: "Teklif Talebi",
    });
  if (detail.documentType === "order" && detail.quoteId && detail.quoteNo)
    sourceDocuments.push({
      type: "quote",
      id: detail.quoteId,
      no: detail.quoteNo,
      label: "Tedarikçi Teklifi",
    });
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
        {sourceDocuments.length ? (
          <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Kaynak belge zinciri
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {sourceDocuments.map((source, index) => (
                <div key={`${source.type}-${source.id}`} className="contents">
                  {index > 0 ? (
                    <ArrowRight
                      size={14}
                      className="text-[var(--wms-app-text-muted)]"
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-cyan-500/25 bg-[var(--wms-app-panel)] px-3 py-2 text-left transition hover:border-cyan-400 hover:bg-cyan-500/10"
                    onClick={() =>
                      onOpenLinkedDocument(source.type, source.id)
                    }
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                      {source.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-cyan-400">
                      {source.no} · #{source.id}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Kayıt ID" value={`#${detail.id}`} />
          <Info
            label="Oluşturan"
            value={
              detail.createdByName ||
              (detail.createdBy ? `Kullanıcı #${detail.createdBy}` : "Sistem")
            }
          />
          <Info
            label="Oluşturma zamanı"
            value={
              detail.createdDate
                ? formatProjectDateTime(detail.createdDate)
                : "—"
            }
          />
          <Info
            label="Güncelleyen"
            value={
              detail.updatedDate
                ? detail.updatedByName ||
                  (detail.updatedBy
                    ? `Kullanıcı #${detail.updatedBy}`
                    : "Sistem")
                : "—"
            }
          />
          <Info
            label="Güncelleme zamanı"
            value={
              detail.updatedDate
                ? formatProjectDateTime(detail.updatedDate)
                : "—"
            }
          />
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
        {isRequest && selectableLineIds.length > 0 ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--wms-app-text-muted)]">
            <input
              type="checkbox"
              className="size-4 rounded border-cyan-500/40 bg-transparent accent-cyan-500"
              checked={allSelectableChecked}
              onChange={(e) => toggleAllSelectable(e.target.checked)}
            />
            Tümünü seç
            <span className="text-xs text-slate-500">
              ({selectableLineIds.length} uygun kalem)
            </span>
          </label>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-cyan-500/15">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-cyan-500/10 text-left text-xs uppercase text-cyan-400">
              <tr>
                {isRequest ? <th className="p-3 w-10" /> : null}
                <th className="p-3">#</th>
                <th>Stok</th>
                <th>Miktar</th>
                <th>{processedLabel}</th>
                <th>Açık</th>
                <th>Birim fiyat</th>
                <th>Termin</th>
                {isRequest ? <th>Durum</th> : null}
                {detail.documentType === "request" ||
                detail.documentType === "quote" ? (
                  <th>Ekler</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((x) => {
                const lineStatus = requestLineStatus(x);
                const selectable = selectableLineIds.includes(x.id);
                return (
                  <tr key={x.id} className="border-t border-cyan-500/10">
                    {isRequest ? (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-cyan-500/40 bg-transparent accent-cyan-500 disabled:opacity-40"
                          checked={selectedLineIds.includes(x.id)}
                          disabled={!selectable}
                          title={
                            selectable
                              ? "Kalemi seç"
                              : `${statusLabel[lineStatus] ?? lineStatus} kalemler seçilemez`
                          }
                          onChange={(e) => toggleLine(x.id, e.target.checked)}
                        />
                      </td>
                    ) : null}
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
                    {isRequest ? (
                      <td className="p-2">
                        <OpsStatusBadge tone={requestLineStatusTone(lineStatus)}>
                          {statusLabel[lineStatus] ?? lineStatus}
                        </OpsStatusBadge>
                      </td>
                    ) : null}
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
                );
              })}
            </tbody>
          </table>
        </div>
        {isRequest ? (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              <strong className="text-[var(--wms-app-text)]">
                {selectedLineIds.length}
              </strong>{" "}
              kalem seçildi
            </p>
            <div className="flex flex-wrap gap-2">
              {canSubmitLines ? (
                <OpsActionButton
                  type="button"
                  variant="primary"
                  loading={busy}
                  disabled={selectedDraftIds.length === 0}
                  onClick={runSelectedSubmit}
                >
                  Seçili kalemleri onaya gönder
                </OpsActionButton>
              ) : null}
              {canApproveLines ? (
                <>
                  <OpsActionButton
                    type="button"
                    variant="primary"
                    loading={busy}
                    disabled={selectedPendingIds.length === 0}
                    onClick={runSelectedApprove}
                  >
                    Seçili kalemleri onayla
                  </OpsActionButton>
                  <OpsActionButton
                    type="button"
                    variant="secondary"
                    loading={busy}
                    disabled={selectedPendingIds.length === 0}
                    onClick={runSelectedReject}
                  >
                    Seçili kalemleri reddet
                  </OpsActionButton>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
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
                    {formatProjectDateTime(x.changedAtUtc)} ·{" "}
                    {x.actorUserName || `Kullanıcı #${x.actorUserId}`}
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
            detail.status === "PartiallyApproved" ||
            detail.status === "PartiallyConverted") &&
          detail.lines.some(
            (x) =>
              requestLineStatus(x) === "Approved" && x.openQuantity > 0,
          ) &&
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
            detail.status === "PartiallyApproved" ||
            detail.status === "PartiallyConverted") &&
          detail.lines.some(
            (x) =>
              requestLineStatus(x) === "Approved" && x.openQuantity > 0,
          ) &&
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
    ? // Talepte submit/approve kalem bazlı sticky footer üzerinden yapılır.
      []
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
        ? "Sonraki adım: İstediğiniz kalemleri seçip onaya gönderin."
        : detail.status === "PendingApproval"
          ? "Onaya gönderilen kalemler için onay kararı bekleniyor."
          : detail.status === "PartiallyApproved"
            ? "Kalem bazlı işlem devam ediyor: bazı kalemler onaylı, bazıları henüz taslak veya onay bekliyor."
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
