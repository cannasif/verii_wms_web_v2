import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackageOpen,
  ScanBarcode,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput } from "@/components/shared/AppInput";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import { PremiumEyebrow } from "@/components/shared/PremiumEyebrow";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { useTheme } from "@/components/theme-provider";
import { StockTrackingPolicyField } from "@/features/stock-tracking/effective-stock-tracking";
import { stockTrackingApi } from "@/features/stock-tracking/api/stock-tracking.api";
import { qualityApi } from "@/features/quality/api/quality.api";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import type { DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import {
  formatProjectNumber,
  parseLocalizedNumber,
} from "@/lib/project-format";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import type { PagedResponse } from "@/types/api";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import type {
  ActiveUserOption,
  CreateGoodsReceiptResult,
  CustomerOption,
  LocationOption,
  OpenOrderHeader,
  PlannedReceiptTracking,
  SelectedReceiptLine,
  SeriesOption,
  StockOption,
  WarehouseOption,
} from "../types/goods-receipt.types";

type OrderSearchMode = "customer" | "orderNo" | "projectCode";
const QUALITY_REQUIRED_MODES = new Set([
  "InspectionRequired",
  "QuickCheck",
  "QualityCheck",
  "Required",
]);

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

const warehouseOption = (x: WarehouseOption) => ({
  value: `${x.id}|${x.branchCode}|${x.warehouseCode}`,
  label: `${x.warehouseCode} · ${x.warehouseName}`,
});
const userLabel = (x: ActiveUserOption): string =>
  `${x.firstName} ${x.lastName}`.trim() || x.username;
const userOption = (x: ActiveUserOption) => ({
  value: encodeURIComponent(JSON.stringify(x)),
  label: userLabel(x),
  description: `${x.username} · ${x.email}`,
});
const decodeUser = (value: string): ActiveUserOption =>
  JSON.parse(decodeURIComponent(value)) as ActiveUserOption;
const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const lineKey = (
  line: Pick<SelectedReceiptLine, "siparisNo" | "orderId">,
): string => `${line.siparisNo}|${line.orderId}`;

export function GoodsReceiptCreatePage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation("goods-receipt-v2");
  const { skin } = useTheme();
  const isPremium = skin === "premium";
  const branchCode = useAuthStore((state) => state.branch?.code ?? "0");
  const createEyebrow = `${t("list.eyebrowParent")} / ${t("list.eyebrowModule")}`;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<OrderSearchMode>("customer");
  const [orderNumberQuery, setOrderNumberQuery] = useState("");
  const [projectCodeQuery, setProjectCodeQuery] = useState("");
  const [orders, setOrders] = useState<OpenOrderHeader[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [lines, setLines] = useState<SelectedReceiptLine[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesValue, setSeriesValue] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [documentDate, setDocumentDate] = useState(today);
  const [plannedArrival, setPlannedArrival] = useState("");
  const [priority, setPriority] = useState("3");
  const [labelStrategy, setLabelStrategy] = useState("None");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<CreateGoodsReceiptResult | null>(null);

  const customer = useMemo(() => {
    if (!selectedCustomer) return null;
    return {
      id: selectedCustomer.id,
      branch: selectedCustomer.branchCode,
      code: selectedCustomer.customerCode,
    };
  }, [selectedCustomer]);
  const customerDisplay = selectedCustomer
    ? `${selectedCustomer.customerName} (${selectedCustomer.customerCode})`
    : "";
  const primaryLine = lines[0];
  const selectedQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  const clearCustomerDependent = (): void => {
    setOrders([]);
    setSelectedOrders([]);
    setLines([]);
  };

  useEffect(() => {
    setSeries([]);
    setSeriesValue(null);
    if (!primaryLine?.targetWarehouseId) return;
    void goodsReceiptV2Api
      .series(primaryLine.targetWarehouseId)
      .then((items) => {
        setSeries(items);
        const preferred = items.find((x) => x.isDefault) ?? items[0];
        setSeriesValue(preferred ? String(preferred.id) : null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [primaryLine?.targetWarehouseId]);

  const loadOrders = async (): Promise<void> => {
    const orderNumber = orderNumberQuery.trim();
    const projectCode = projectCodeQuery.trim();
    if (searchMode === "customer" && !customer) {
      toast.error("Önce tedarikçi seçin.");
      return;
    }
    if (searchMode === "orderNo" && !orderNumber) {
      toast.error("Sipariş numarası girin.");
      return;
    }
    if (searchMode === "projectCode" && !projectCode) {
      toast.error("Proje kodu girin.");
      return;
    }
    if ((searchMode === "orderNo" || searchMode === "projectCode") && !customer) {
      toast.error(
        "Bağımsız sipariş/proje araması için API’de customerCode olmadan filtre desteği gerekir. Şimdilik tedarikçiyi de seçin.",
      );
      return;
    }
    if (!customer) return;
    setBusy(true);
    setError(null);
    setSelectedOrders([]);
    setLines([]);
    try {
      const rows = await goodsReceiptV2Api.orderHeaders({
        branchCode: customer.branch,
        customerCode: customer.code,
        orderNumber: searchMode === "orderNo" ? orderNumber : undefined,
        projectCode: searchMode === "projectCode" ? projectCode : undefined,
      });
      const normalizedOrder = orderNumber.toLocaleUpperCase("tr-TR");
      const normalizedProject = projectCode.toLocaleUpperCase("tr-TR");
      const filtered = rows.filter((row) => {
        if (
          searchMode === "orderNo" &&
          normalizedOrder &&
          !row.siparisNo.toLocaleUpperCase("tr-TR").includes(normalizedOrder)
        )
          return false;
        if (
          searchMode === "projectCode" &&
          normalizedProject &&
          !(row.projectCode ?? "")
            .toLocaleUpperCase("tr-TR")
            .includes(normalizedProject)
        )
          return false;
        return true;
      });
      setOrders(filtered);
      if (filtered.length === 1) setSelectedOrders([filtered[0].siparisNo]);
    } catch (cause) {
      report(cause, "Siparişler alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const loadLines = async (): Promise<void> => {
    if (!customer || selectedOrders.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const rows = await goodsReceiptV2Api.orderLines(
        customer.code,
        customer.branch,
        selectedOrders,
      );
      const warehouseCodes = [
        ...new Set(
          rows
            .map((x) => x.targetWarehouseCode)
            .filter((x): x is number => x != null),
        ),
      ];
      const lookups = await Promise.all(
        warehouseCodes.map(async (code) => {
          const page = await goodsReceiptV2Api.warehouses(
            {
              pageNumber: 1,
              pageSize: 20,
              search: String(code),
              sortBy: "warehouseCode",
              sortDirection: "asc",
              signal: new AbortController().signal,
            },
            customer.branch,
          );
          return [
            code,
            page.items.find((item) => item.warehouseCode === code),
          ] as const;
        }),
      );
      const warehouseByCode = new Map(lookups);
      const stockCodes = [
        ...new Set(
          rows
            .map((x) => x.stockCode?.trim())
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      const stockLookups = await Promise.all(
        stockCodes.map(async (code) => {
          const page = await goodsReceiptV2Api.stocks(
            {
              pageNumber: 1,
              pageSize: 20,
              search: code,
              sortBy: "erpStockCode",
              sortDirection: "asc",
              signal: new AbortController().signal,
            },
            customer.branch,
          );
          const stock = page.items.find(
            (item) =>
              item.erpStockCode.toLocaleUpperCase("tr-TR") ===
              code.toLocaleUpperCase("tr-TR"),
          );
          if (!stock)
            throw new Error(`${code} ERP stok mirror tablosunda bulunamadı.`);
          return [code.toLocaleUpperCase("tr-TR"), stock] as const;
        }),
      );
      const stockByCode = new Map<string, StockOption>(stockLookups);
      const trackingPolicies = new Map<
        number,
        ReturnType<typeof goodsReceiptV2Api.trackingPolicy>
      >();
      let qualityStockIds = new Set<number>();
      try {
        const rules = await qualityApi.rulesPaged({
          pageNumber: 1,
          pageSize: 500,
          search: null,
          sortBy: "id",
          sortDirection: "asc",
          filterLogic: "and",
          filters: [
            { column: "branchCode", operator: "equals", value: customer.branch },
            { column: "isActive", operator: "equals", value: "true" },
          ],
        });
        qualityStockIds = new Set(
          rules.items
            .filter(
              (rule) =>
                rule.stockId != null &&
                QUALITY_REQUIRED_MODES.has(rule.inspectionMode),
            )
            .map((rule) => rule.stockId as number),
        );
      } catch {
        qualityStockIds = new Set();
      }
      setLines(
        await Promise.all(
          rows.map(async (x) => {
            const warehouse =
              x.targetWarehouseCode == null
                ? undefined
                : warehouseByCode.get(x.targetWarehouseCode);
            if (!x.stockCode)
              throw new Error(
                `${x.siparisNo}/${x.orderId}: stok kodu bulunamadı.`,
              );
            const stock = stockByCode.get(
              x.stockCode.toLocaleUpperCase("tr-TR"),
            );
            if (!stock)
              throw new Error(
                `${x.stockCode} ERP stok mirror tablosunda bulunamadı.`,
              );
            if (!stock.unitCode)
              throw new Error(
                `${x.stockCode} stok kartının ölçü birimi tanımlı değil.`,
              );
            if (!trackingPolicies.has(stock.id))
              trackingPolicies.set(
                stock.id,
                goodsReceiptV2Api.trackingPolicy(customer.branch, stock.id),
              );
            const trackingPolicy = await trackingPolicies.get(stock.id)!;
            return {
              ...x,
              stockId: stock.id,
              unitCode: stock.unitCode,
              quantity: x.availableQuantity ?? 0,
              targetWarehouseId: warehouse?.id,
              targetWarehouseValue: warehouse
                ? warehouseOption(warehouse).value
                : null,
              receivingLocationValue: null,
              trackingType: trackingPolicy.trackingType,
              trackingPolicy,
              trackings: [],
              requireQualityControl: qualityStockIds.has(stock.id),
            };
          }),
        ),
      );
    } catch (cause) {
      report(cause, "Sipariş satırları alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (key: string, patch: Partial<SelectedReceiptLine>): void =>
    setLines((current) =>
      current.map((line) =>
        lineKey(line) === key ? { ...line, ...patch } : line,
      ),
    );
  const removeLine = (key: string): void =>
    setLines((current) => current.filter((line) => lineKey(line) !== key));
  const updateTracking = (
    key: string,
    trackingId: string,
    patch: Partial<PlannedReceiptTracking>,
  ): void =>
    setLines((current) =>
      current.map((line) =>
        lineKey(line) !== key
          ? line
          : {
              ...line,
              trackings: line.trackings.map((tracking) =>
                tracking.localId === trackingId
                  ? { ...tracking, ...patch }
                  : tracking,
              ),
            },
      ),
    );
  const addTracking = (key: string): void =>
    setLines((current) =>
      current.map((line) =>
        lineKey(line) !== key
          ? line
          : {
              ...line,
              trackings: [
                ...line.trackings,
                {
                  localId: crypto.randomUUID(),
                  quantity:
                    line.trackingType === "Serial" ||
                    line.trackingType === "LotAndSerial"
                      ? 1
                      : Math.max(
                          line.quantity -
                            line.trackings.reduce(
                              (sum, x) => sum + x.quantity,
                              0,
                            ),
                          0,
                        ),
                },
              ],
            },
      ),
    );
  const removeTracking = (key: string, trackingId: string): void =>
    setLines((current) =>
      current.map((line) =>
        lineKey(line) !== key
          ? line
          : {
              ...line,
              trackings: line.trackings.filter((x) => x.localId !== trackingId),
            },
      ),
    );
  const createSerialRows = async (key: string): Promise<void> => {
    const line = lines.find((item) => lineKey(item) === key);
    if (!line) return;
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 500
    ) {
      toast.error(
        "Seri satırları için miktar 1-500 arasında tam sayı olmalıdır.",
      );
      return;
    }
    if (!line.trackingPolicy.autoGenerateSerials) {
      updateLine(key, {
        trackings: Array.from({ length: line.quantity }, () => ({
          localId: crypto.randomUUID(),
          quantity: 1,
        })),
      });
      return;
    }
    let idempotencyKey = line.serialGenerationKey;
    try {
      if (idempotencyKey && line.trackings.length !== line.quantity) {
        await stockTrackingApi.voidGeneratedSerials({
          branchCode: customer?.branch ?? branchCode,
          stockId: line.stockId,
          idempotencyKey,
          reason: "Mal kabul taslağında miktar veya seri planı değiştirildi.",
        });
        idempotencyKey = undefined;
      }
      idempotencyKey ??= crypto.randomUUID();
      const serials = await stockTrackingApi.generateSerials({
        branchCode: customer?.branch ?? branchCode,
        stockId: line.stockId,
        quantity: line.quantity,
        idempotencyKey,
        sourceOperationType: "GoodsReceiptDraft",
      });
      updateLine(key, {
        serialGenerationKey: idempotencyKey,
        trackings: serials.map((item) => ({
          localId: crypto.randomUUID(),
          quantity: 1,
          serialNo: item.serialNo,
        })),
      });
      toast.success(`${serials.length} seri stok kuralına göre üretildi.`);
    } catch (cause) {
      report(cause, "Seriler üretilemedi.");
    }
  };
  const cancelGeneratedSerials = async (key: string): Promise<void> => {
    const line = lines.find((item) => lineKey(item) === key);
    if (!line?.serialGenerationKey) return;
    try {
      await stockTrackingApi.voidGeneratedSerials({
        branchCode: customer?.branch ?? branchCode,
        stockId: line.stockId,
        idempotencyKey: line.serialGenerationKey,
        reason:
          "Kullanıcı mal kabul taslağındaki otomatik seri üretimini iptal etti.",
      });
      updateLine(key, { serialGenerationKey: undefined, trackings: [] });
      toast.success(
        "Üretilen seriler iptal edildi ve tekrar kullanıma kapatıldı.",
      );
    } catch (cause) {
      report(cause, "Üretilen seriler iptal edilemedi.");
    }
  };

  const validatePlan = (): string | null => {
    for (const line of lines) {
      const name = `${line.siparisNo} / ${line.stockCode ?? line.orderId}`;
      if (line.quantity <= 0 || line.quantity > (line.availableQuantity ?? 0))
        return `${name}: miktar kullanılabilir miktar aralığında olmalıdır.`;
      if (!line.targetWarehouseId || !line.receivingLocationId)
        return `${name}: hedef depo ve kabul rafı seçilmelidir.`;
      if (line.trackingType === "None") {
        if (line.trackings.length > 0)
          return `${name}: takipsiz kalemde lot/seri satırı bulunamaz.`;
        continue;
      }
      if (line.trackings.length === 0)
        return `${name}: lot/seri planı girilmelidir.`;
      const total = line.trackings.reduce(
        (sum, x) => sum + Number(x.quantity || 0),
        0,
      );
      if (Math.abs(total - line.quantity) > 0.000001)
        return `${name}: lot/seri toplamı (${total}) kabul miktarına (${line.quantity}) eşit olmalıdır.`;
      if (
        (line.trackingType === "Serial" ||
          line.trackingType === "LotAndSerial") &&
        line.trackings.some((x) => !x.serialNo?.trim() || x.quantity !== 1)
      )
        return `${name}: her seri satırı benzersiz bir seri ve 1 miktar içermelidir.`;
      if (
        (line.trackingType === "Lot" || line.trackingType === "LotAndSerial") &&
        line.trackings.some((x) => !x.lotNo?.trim())
      )
        return `${name}: her takip satırında lot zorunludur.`;
      if (
        line.trackingPolicy.requireManufacturingDate &&
        line.trackings.some((x) => !x.manufacturingDate)
      )
        return `${name}: üretim tarihi zorunludur.`;
      if (
        line.trackingPolicy.requireExpirationDate &&
        line.trackings.some((x) => !x.expirationDate)
      )
        return `${name}: son kullanma tarihi zorunludur.`;
      if (
        line.trackingPolicy.serialQuantityRule === "OneSerialPerBaseUnit" &&
        (!Number.isInteger(line.quantity) ||
          line.trackings.length !== line.quantity)
      )
        return `${name}: miktar kadar benzersiz seri girilmelidir.`;
      const serials = line.trackings
        .map((x) => x.serialNo?.trim())
        .filter(Boolean);
      if (new Set(serials).size !== serials.length)
        return `${name}: aynı seri birden fazla kullanılamaz.`;
    }
    if (!seriesValue) return "Belge serisi seçilmelidir.";
    if (assignees.length === 0)
      return "Emir için en az bir operasyon kullanıcısı atanmalıdır.";
    return null;
  };

  const goToConfirmation = (): void => {
    const message = validatePlan();
    if (message) {
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setStep(1);
  };
  const create = async (): Promise<void> => {
    if (
      !customer ||
      !primaryLine?.targetWarehouseId ||
      !primaryLine.receivingLocationId ||
      !seriesValue
    )
      return;
    const validation = validatePlan();
    if (validation) {
      setError(validation);
      toast.error(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await goodsReceiptV2Api.create({
        idempotencyKey: crypto.randomUUID(),
        branchCode: customer.branch,
        documentSeriesId: Number(seriesValue),
        supplierId: customer.id,
        targetWarehouseId: primaryLine.targetWarehouseId,
        receivingLocationId: primaryLine.receivingLocationId,
        documentDate,
        plannedArrivalAtUtc: plannedArrival
          ? new Date(plannedArrival).toISOString()
          : null,
        labelStrategy,
        allowOverReceipt: false,
        overReceiptTolerancePercent: 0,
        allowUnderReceipt: true,
        requireQualityControl: lines.some((line) => line.requireQualityControl),
        requirePutaway: true,
        priority: Number(priority),
        description: description.trim() || null,
        assignedUserIds: assignees.map((user) => user.id),
        lines: lines.map((line) => ({
          orderNumber: line.siparisNo,
          orderId: line.orderId,
          quantity: line.quantity,
          targetWarehouseId: line.targetWarehouseId,
          receivingLocationId: line.receivingLocationId,
          trackingType: line.trackingType,
          trackings: line.trackings.map((x) => ({
            quantity: x.quantity,
            lotNo: x.lotNo?.trim() || null,
            serialNo: x.serialNo?.trim() || null,
            manufacturingDate: x.manufacturingDate || null,
            expirationDate: x.expirationDate || null,
            description: x.description?.trim() || null,
          })),
        })),
      });
      setResult(created);
      toast.success(`${t("created")}: ${created.documentNo}`);
    } catch (cause) {
      report(cause, "Mal kabul emri oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const report = (cause: unknown, fallback: string): void => {
    const message = cause instanceof Error ? cause.message : fallback;
    setError(message);
    toast.error(message);
  };
  const steps = [0, 1];
  const toggleOrder = (siparisNo: string): void => {
    setSelectedOrders((current) =>
      current.includes(siparisNo)
        ? current.filter((x) => x !== siparisNo)
        : [...current, siparisNo],
    );
  };

  if (!moduleReady)
    return (
      <div className="grid min-h-[20rem] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );

  return (
    <section className="wms-ops-form space-y-5">
      <header className="space-y-2">
        {isPremium ? (
          <PremiumEyebrow eyebrow={createEyebrow} />
        ) : (
          <div className="wms-ops-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
            {createEyebrow}
          </div>
        )}
        <p className="max-w-3xl text-sm leading-6 text-[var(--wms-app-text-muted)]">
          {t("createFlow.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {steps.map((value) => (
          <div
            key={value}
            className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${value <= step ? "border-[var(--wms-brand-primary)] bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]" : "border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)]"}`}
          >
            {value + 1}. {t(`createFlow.steps.${value}`)}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {step === 0 && (
        <>
          <Panel
            title={t("createFlow.orderSelection")}
            icon={<ClipboardList className="size-5" />}
          >
            <div className="mb-4 space-y-3">
              <label className="wms-ops-entry-label block">
                {t("customer")} <span className="text-red-500">*</span>
              </label>
              <PagedLookupDialog<CustomerOption>
                variant="ops"
                triggerMode="combobox"
                autoSearchMinLength={2}
                open={customerLookupOpen}
                onOpenChange={setCustomerLookupOpen}
                title={t("selectCustomer")}
                value={customerDisplay}
                placeholder={t("selectCustomer")}
                searchPlaceholder={t("searchCustomer")}
                emptyText={t("customerEmpty")}
                triggerClassName={OPS_FIELD_CLASS}
                queryKey={["gr-customers-lookup", branchCode]}
                fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
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
                      branchCode,
                    ),
                  )
                }
                getKey={(item) => String(item.id)}
                getLabel={(item) =>
                  `${item.customerName} (${item.customerCode})`
                }
                onSelect={(item) => {
                  setSelectedCustomer(item);
                  clearCustomerDependent();
                }}
              />
              {selectedCustomer ? (
                <OpsSelectedEntityCard
                  label={t("selectedCustomer")}
                  eyebrow="TEDARIKCI"
                  status="SEÇİLDİ"
                  value={customerDisplay}
                />
              ) : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ["customer", "Tedarikçi"],
                  ["orderNo", "Sipariş No"],
                  ["projectCode", "Proje Kodu"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSearchMode(mode)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${searchMode === mode ? "border-cyan-500 bg-cyan-500/10 text-cyan-600" : "border-[var(--wms-app-border)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="wms-ops-order-fetch space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  {searchMode === "orderNo" ? (
                    <OpsFieldShell>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 opacity-60" />
                        <input
                          className={cn(OPS_FIELD_CLASS, "h-10 w-full pl-8 font-mono text-xs")}
                          value={orderNumberQuery}
                          onChange={(event) =>
                            setOrderNumberQuery(event.target.value)
                          }
                          placeholder="Sipariş numarası"
                          aria-label="Sipariş numarası"
                        />
                      </div>
                    </OpsFieldShell>
                  ) : searchMode === "projectCode" ? (
                    <OpsFieldShell>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 opacity-60" />
                        <input
                          className={cn(OPS_FIELD_CLASS, "h-10 w-full pl-8 font-mono text-xs")}
                          value={projectCodeQuery}
                          onChange={(event) =>
                            setProjectCodeQuery(event.target.value)
                          }
                          placeholder="Proje kodu"
                          aria-label="Proje kodu"
                        />
                      </div>
                    </OpsFieldShell>
                  ) : (
                    <p className="text-xs text-[var(--wms-app-text-muted)]">
                      Seçili tedarikçiye ait açık siparişleri getirin.
                    </p>
                  )}
                </div>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void loadOrders()}
                  className="h-10 w-full shrink-0 sm:w-auto sm:min-w-[11rem]"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="size-3.5" aria-hidden />
                      {t("loadOrders")}
                    </>
                  )}
                </OpsActionButton>
              </div>

              {orders.length === 0 ? (
                <div className="wms-ops-panel-empty py-10 text-center">
                  <PackageOpen className="mx-auto size-8 opacity-50" aria-hidden />
                  <p className="mt-3 text-sm text-[var(--wms-app-text-muted)]">
                    {t("noOrders")}
                  </p>
                </div>
              ) : (
                <div className="wms-ops-order-fetch__table-wrap">
                  <table className="wms-ops-order-fetch__table w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr>
                        <th className="w-14 text-center" />
                        <th>Sipariş No</th>
                        <th>Proje Kodu</th>
                        <th>Tarih</th>
                        <th className="wms-ops-order-fetch__qty">Sipariş Miktarı</th>
                        <th className="wms-ops-order-fetch__qty">Kalan</th>
                        <th className="wms-ops-order-fetch__qty">Mal Kabul</th>
                        <th>Depo Kodu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const checked = selectedOrders.includes(order.siparisNo);
                        return (
                          <tr
                            key={order.siparisNo}
                            className={cn(
                              checked && "wms-ops-order-fetch__row--selected",
                            )}
                            onClick={() => toggleOrder(order.siparisNo)}
                          >
                            <td
                              className="text-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <label className="wms-ops-order-checkbox">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOrder(order.siparisNo)}
                                  aria-label={`${order.siparisNo} seç`}
                                />
                                <span
                                  className="wms-ops-order-checkbox__mark"
                                  aria-hidden
                                />
                              </label>
                            </td>
                            <td className="font-mono font-semibold">
                              {order.siparisNo}
                            </td>
                            <td className="font-mono">
                              {order.projectCode || "—"}
                            </td>
                            <td>{order.orderDate?.slice(0, 10) ?? "—"}</td>
                            <td className="wms-ops-order-fetch__qty font-mono">
                              {formatProjectNumber(order.orderedQuantity ?? 0)}
                            </td>
                            <td className="wms-ops-order-fetch__qty font-mono">
                              {formatProjectNumber(
                                order.remainingQuantity ??
                                  order.availableQuantity ??
                                  0,
                              )}
                            </td>
                            <td className="wms-ops-order-fetch__qty font-mono font-semibold">
                              {formatProjectNumber(order.availableQuantity ?? 0)}
                            </td>
                            <td>{order.targetWarehouseCode ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  {selectedOrders.length} sipariş seçildi
                </p>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={selectedOrders.length === 0 || busy}
                  onClick={() => void loadLines()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    t("loadLines")
                  )}
                </OpsActionButton>
              </div>
            </div>
          </Panel>

          {lines.length > 0 && (
            <div className="wms-ops-selected-order-items space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  {lines.length} kalem seçildi · miktar/seri/raf bu satırlarda
                  düzenlenir
                </p>
              </div>
              <div className="space-y-2">
                {lines.map((line) => (
                  <ReceiptEntryRow
                    key={lineKey(line)}
                    line={line}
                    branch={customer?.branch ?? branchCode}
                    updateLine={updateLine}
                    removeLine={removeLine}
                    updateTracking={updateTracking}
                    addTracking={addTracking}
                    removeTracking={removeTracking}
                    createSerialRows={createSerialRows}
                    cancelGeneratedSerials={cancelGeneratedSerials}
                  />
                ))}
              </div>

              <Panel
                title="Belge ve emir ayarları"
                icon={<PackageCheck className="size-5" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Belge serisi">
                    <AppDropdown
                      value={seriesValue}
                      onValueChange={setSeriesValue}
                      options={series.map((x) => ({
                        value: String(x.id),
                        label: `${x.code} · ${x.name}`,
                        description: x.previewDocumentNumber,
                      }))}
                      placeholder="Belge serisi"
                      searchable
                    />
                  </Field>
                  <Field label={t("documentDate")}>
                    <AppDateInput
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.target.value)}
                    />
                  </Field>
                  <Field label={t("plannedArrival")}>
                    <AppDateInput
                      type="datetime-local"
                      value={plannedArrival}
                      onChange={(event) => setPlannedArrival(event.target.value)}
                    />
                  </Field>
                  <Field label={t("priority")}>
                    <AppDropdown
                      value={priority}
                      onValueChange={setPriority}
                      options={[1, 2, 3, 4, 5].map((x) => ({
                        value: String(x),
                        label: String(x),
                      }))}
                    />
                  </Field>
                  <Field label={t("labelStrategy")}>
                    <AppDropdown
                      value={labelStrategy}
                      onValueChange={setLabelStrategy}
                      options={[
                        { value: "None", label: "Etiket yok" },
                        { value: "PreGenerate", label: "Önceden üret" },
                        { value: "SupplierLabel", label: "Tedarikçi etiketi" },
                        { value: "GenerateOnReceipt", label: "Kabulde üret" },
                      ]}
                    />
                  </Field>
                  <Field label={t("description")}>
                    <input
                      className="input"
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </Field>
                </div>
                <section className="mt-4 rounded-xl border border-[var(--wms-app-border)] p-4">
                  <div className="mb-3 flex items-start gap-2">
                    <UserRoundCog className="mt-0.5 size-5 text-cyan-500" />
                    <div>
                      <h3 className="font-bold">
                        Emir sorumluları <span className="text-red-500">*</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Seçilen kullanıcılar oluşturulan tüm depo görevlerine
                        atanır; kullanıcılar kendi “Bana Atanan Emirler” ekranında
                        görevi görür.
                      </p>
                    </div>
                  </div>
                  <PagedAppDropdown
                    queryKey={["gr-create-active-users"]}
                    fetchPage={goodsReceiptV2Api.activeUsersPaged}
                    toOption={(user) => ({
                      ...userOption(user),
                      disabled: assignees.some(
                        (selected) => selected.id === user.id,
                      ),
                    })}
                    value={null}
                    onValueChange={(value) => {
                      const user = decodeUser(value);
                      setAssignees((current) =>
                        current.some((x) => x.id === user.id)
                          ? current
                          : [...current, user],
                      );
                    }}
                    placeholder="Operasyon kullanıcısı ekle"
                    searchable
                    minSearchLength={2}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignees.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm"
                      >
                        <span>
                          <strong>{userLabel(user)}</strong>
                          <small className="ml-1 text-slate-500">
                            ({user.username})
                          </small>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAssignees((current) =>
                              current.filter((x) => x.id !== user.id),
                            )
                          }
                          className="rounded-full p-0.5 text-slate-500 hover:bg-red-500/15 hover:text-red-500"
                          aria-label={`${userLabel(user)} atamasını kaldır`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    {assignees.length === 0 && (
                      <span className="text-xs text-amber-500">
                        Henüz kullanıcı atanmadı.
                      </span>
                    )}
                  </div>
                </section>
                <p className="mt-4 text-xs text-slate-500">
                  Siparişteki depo kaleme varsayılan gelir; yetkili kullanıcı kabul
                  deposu ve rafını kalem bazında değiştirebilir. Putaway önerileri
                  yalnızca tercih olarak saklanır; kabul rafını (Receiving/Staging)
                  değiştirmez.
                </p>
                <Footer
                  back={() => {
                    setLines([]);
                    setError(null);
                  }}
                  next={goToConfirmation}
                  disabled={lines.length === 0 || busy}
                  t={t}
                />
              </Panel>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <Panel
          title="Kontrol ve oluşturma"
          icon={<CheckCircle2 className="size-5" />}
        >
          {result ? (
            <CreateSuccessPanel
              result={result}
              supplierCode={customer?.code}
              assigneeCount={assignees.length}
              qualityLines={lines.flatMap((x) =>
                x.requireQualityControl && x.stockCode
                  ? [
                      {
                        stockCode: x.stockCode,
                        stockName: x.stockName,
                        quantity: x.quantity,
                        unitCode: x.unitCode,
                      },
                    ]
                  : [],
              )}
              onNew={() => {
                setResult(null);
                setStep(0);
                setLines([]);
                setSelectedOrders([]);
                setOrders([]);
                setAssignees([]);
                setError(null);
              }}
            />
          ) : (
            <div className="wms-ops-gr-review">
              <dl className="wms-ops-gr-review__list">
                <ReviewRow label="Tedarikçi" value={customer?.code ?? "—"} />
                <ReviewRow
                  label="Sipariş"
                  value={selectedOrders.join(", ") || "—"}
                />
                <ReviewRow
                  label="Satır / miktar"
                  value={`${lines.length} / ${formatProjectNumber(selectedQuantity, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}`}
                  emphasis
                />
                <ReviewRow
                  label="Depo sayısı"
                  value={String(
                    new Set(lines.map((x) => x.targetWarehouseId)).size,
                  )}
                />
                <ReviewRow
                  label="Emir sorumluları"
                  value={assignees.map(userLabel).join(", ") || "—"}
                />
                <ReviewRow
                  label="Lot/seri satırı"
                  value={String(
                    lines.reduce((sum, x) => sum + x.trackings.length, 0),
                  )}
                />
                <ReviewRow
                  label="Kaliteye gidecek"
                  value={
                    lines.some((x) => x.requireQualityControl)
                      ? `${lines.filter((x) => x.requireQualityControl).length} kalem · Mal kabul bitince kalite listesine düşer`
                      : "Yok"
                  }
                />
                <ReviewRow
                  label="Belge serisi"
                  value={
                    series.find((x) => String(x.id) === seriesValue)
                      ?.previewDocumentNumber ?? "—"
                  }
                  accent
                />
              </dl>
              <div className="wms-ops-gr-review__actions">
                <OpsActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(0)}
                >
                  {t("back")}
                </OpsActionButton>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void create()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    t("create")
                  )}
                </OpsActionButton>
              </div>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

function OpsSelectedEntityCard({
  label,
  eyebrow,
  status,
  value,
}: {
  label: string;
  eyebrow?: string;
  status?: string;
  value: string;
}): ReactElement {
  const match = value.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const primary = match ? match[2].trim() : value.trim();
  const secondary = match ? match[1].trim() : undefined;
  return (
    <div className="wms-ops-entity-card" role="status" aria-label={label}>
      <div className="wms-ops-entity-card__rail" aria-hidden />
      <div className="wms-ops-entity-card__body">
        <div className="wms-ops-entity-card__icon" aria-hidden>
          <UserRound className="size-4" />
        </div>
        <div className="wms-ops-entity-card__meta">
          <div className="wms-ops-entity-card__header">
            <span className="wms-ops-entity-card__eyebrow">
              {eyebrow ?? label}
            </span>
            {status ? (
              <span className="wms-ops-entity-card__status">{status}</span>
            ) : null}
          </div>
          <div className="wms-ops-entity-card__code">{primary}</div>
          {secondary ? (
            <div className="wms-ops-entity-card__name">{secondary}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReceiptEntryRow({
  line,
  branch,
  updateLine,
  removeLine,
  updateTracking,
  addTracking,
  removeTracking,
  createSerialRows,
  cancelGeneratedSerials,
}: {
  line: SelectedReceiptLine;
  branch: string;
  updateLine: (key: string, patch: Partial<SelectedReceiptLine>) => void;
  removeLine: (key: string) => void;
  updateTracking: (
    key: string,
    id: string,
    patch: Partial<PlannedReceiptTracking>,
  ) => void;
  addTracking: (key: string) => void;
  removeTracking: (key: string, id: string) => void;
  createSerialRows: (key: string) => Promise<void>;
  cancelGeneratedSerials: (key: string) => Promise<void>;
}): ReactElement {
  const key = lineKey(line);
  const serialMode =
    line.trackingType === "Serial" || line.trackingType === "LotAndSerial";
  const needsTracking = line.trackingType !== "None";
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: number;
      code: string;
      reason: string;
      remainingCapacity?: number;
    }>
  >([]);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);
  const [warehouseLookupOpen, setWarehouseLookupOpen] = useState(false);
  const [locationLookupOpen, setLocationLookupOpen] = useState(false);
  const [quantityText, setQuantityText] = useState(
    formatProjectNumber(line.quantity, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }),
  );

  const warehouseLabel = line.targetWarehouseValue
    ? (() => {
        const code = line.targetWarehouseValue.split("|")[2];
        return code ? `Depo ${code}` : "";
      })()
    : "";
  const receivingLabel =
    line.receivingLocationCode ||
    (line.receivingLocationValue
      ? `Raf #${line.receivingLocationValue}`
      : "");
  const serialSummary = needsTracking
    ? line.trackings.length > 0
      ? serialMode
        ? `${line.trackings.filter((x) => x.serialNo).length} seri`
        : `${line.trackings.length} lot/satır`
      : "Planla…"
    : "—";

  useEffect(() => {
    setQuantityText(
      formatProjectNumber(line.quantity, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }),
    );
  }, [line.quantity]);

  useEffect(() => {
    if (!line.targetWarehouseId) return;
    let cancelled = false;
    void goodsReceiptV2Api
      .receivingLocations(
        {
          pageNumber: 1,
          pageSize: 100,
          search: undefined,
          filterLogic: "and",
          filters: [],
          sortBy: "code",
          sortDirection: "asc",
          signal: new AbortController().signal,
        },
        line.targetWarehouseId,
      )
      .then((page) => {
        if (cancelled) return;
        const preferred =
          page.items.find((item) => item.locationType === "Receiving") ??
          page.items[0];
        if (!preferred) return;
        const selectedIsValid =
          line.receivingLocationId != null &&
          page.items.some((item) => item.id === line.receivingLocationId);
        if (!selectedIsValid) {
          updateLine(key, {
            receivingLocationId: preferred.id,
            receivingLocationValue: String(preferred.id),
            receivingLocationCode: preferred.code,
          });
        } else if (
          line.receivingLocationId &&
          !line.receivingLocationCode
        ) {
          const current = page.items.find(
            (item) => item.id === line.receivingLocationId,
          );
          if (current) {
            updateLine(key, { receivingLocationCode: current.code });
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    key,
    line.receivingLocationCode,
    line.receivingLocationId,
    line.targetWarehouseId,
    updateLine,
  ]);

  useEffect(() => {
    if (!line.targetWarehouseId || !line.stockCode || line.quantity <= 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSuggestionsBusy(true);
      void goodsReceiptV2Api
        .putawaySuggestions(line.targetWarehouseId!, {
          stockCode: line.stockCode,
          quantity: line.quantity,
        })
        .then((items) => {
          if (cancelled) return;
          setSuggestions(items);
          const top = items[0];
          if (!top) return;
          const stillValid = items.some(
            (item) => item.id === line.putawayLocationId,
          );
          if (!stillValid) {
            updateLine(key, {
              putawayLocationId: top.id,
              putawayLocationCode: top.code,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestionsBusy(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // putawayLocationId intentionally omitted — only used to preserve manual pick within same suggestion set
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-pick first suggestion without refetch loops
  }, [key, line.quantity, line.stockCode, line.targetWarehouseId, updateLine]);

  return (
    <div className="wms-ops-receipt-entry-row space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">
              {line.stockName || line.stockCode || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="wms-ops-code-badge">{line.stockCode}</span>
              <span>•</span>
              <span className="font-mono">{line.siparisNo}</span>
              <span>•</span>
              <span>
                Sipariş:{" "}
                <strong className="text-foreground">
                  {formatProjectNumber(line.orderedQuantity ?? line.availableQuantity ?? 0, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {line.unitCode || ""}
                </strong>
              </span>
              {line.requireQualityControl ? (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <ShieldCheck className="size-3" />
                  Kalite
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1 sm:col-span-2 xl:col-span-1">
              <label className="wms-ops-entry-label">Hedef Depo</label>
              <OpsFieldShell
                className={cn(
                  warehouseLookupOpen && "wms-ops-field-shell--active",
                )}
              >
                <PagedLookupDialog<WarehouseOption>
                  variant="ops"
                  open={warehouseLookupOpen}
                  onOpenChange={setWarehouseLookupOpen}
                  title="Hedef depo seçin"
                  value={warehouseLabel}
                  placeholder="Hedef depo"
                  searchPlaceholder="Depo ara…"
                  emptyText="Depo bulunamadı."
                  triggerClassName={cn(OPS_FIELD_CLASS, "h-9")}
                  queryKey={["gr-line-warehouse-lookup", key, branch]}
                  fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                    toPagedResponse(
                      await goodsReceiptV2Api.warehouses(
                        {
                          pageNumber,
                          pageSize,
                          search,
                          sortBy: "warehouseCode",
                          sortDirection: "asc",
                          signal: signal ?? new AbortController().signal,
                        },
                        branch,
                      ),
                    )
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={(item) =>
                    `${item.warehouseName} (${item.warehouseCode})`
                  }
                  onSelect={(warehouse) => {
                    updateLine(key, {
                      targetWarehouseValue: warehouseOption(warehouse).value,
                      targetWarehouseId: warehouse.id,
                      receivingLocationId: undefined,
                      receivingLocationValue: null,
                      receivingLocationCode: undefined,
                      putawayLocationId: undefined,
                      putawayLocationCode: undefined,
                    });
                  }}
                />
              </OpsFieldShell>
            </div>

            <div className="space-y-1">
              <label className="wms-ops-entry-label">Miktar</label>
              <OpsFieldShell>
                <div className="wms-ops-qty-stepper relative">
                  <input
                    className={cn(
                      OPS_FIELD_CLASS,
                      "h-9 w-full pr-8 text-right font-mono text-sm",
                    )}
                    inputMode="decimal"
                    value={quantityText}
                    onChange={(event) => setQuantityText(event.target.value)}
                    onBlur={() => {
                      const parsed = parseLocalizedNumber(quantityText);
                      if (!Number.isFinite(parsed) || parsed <= 0) {
                        setQuantityText(
                          formatProjectNumber(line.quantity, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 6,
                          }),
                        );
                        return;
                      }
                      const capped = Math.min(
                        parsed,
                        line.availableQuantity ?? parsed,
                      );
                      updateLine(key, { quantity: capped });
                      setQuantityText(
                        formatProjectNumber(capped, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 6,
                        }),
                      );
                    }}
                  />
                  <div className="wms-ops-qty-stepper__controls absolute inset-y-0 right-0 flex flex-col justify-center pr-0.5">
                    <button
                      type="button"
                      className="wms-ops-qty-stepper__btn"
                      aria-label="Miktarı artır"
                      onClick={() => {
                        const base =
                          parseLocalizedNumber(quantityText) || line.quantity;
                        const next = Math.min(
                          base + 1,
                          line.availableQuantity ?? base + 1,
                        );
                        updateLine(key, { quantity: next });
                      }}
                    >
                      <ChevronUp className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="wms-ops-qty-stepper__btn"
                      aria-label="Miktarı azalt"
                      onClick={() => {
                        const base =
                          parseLocalizedNumber(quantityText) || line.quantity;
                        const next = Math.max(base - 1, 0.000001);
                        updateLine(key, { quantity: next });
                      }}
                    >
                      <ChevronDown className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
              </OpsFieldShell>
            </div>

            <div className="space-y-1">
              <label className="wms-ops-entry-label">Seri No</label>
              {needsTracking ? (
                <OpsFieldShell>
                  <button
                    type="button"
                    className={cn(
                      "wms-ops-lookup-trigger wms-ops-field h-9",
                      !line.trackings.length && "wms-ops-field--placeholder",
                    )}
                    onClick={() => setSerialOpen(true)}
                  >
                    <span className="truncate font-mono text-sm">
                      {serialSummary}
                    </span>
                    <ScanBarcode className="size-3.5 shrink-0 opacity-60" />
                  </button>
                </OpsFieldShell>
              ) : (
                <OpsFieldShell>
                  <div
                    className={cn(
                      OPS_FIELD_CLASS,
                      "flex h-9 items-center text-xs text-muted-foreground",
                    )}
                  >
                    Takipsiz
                  </div>
                </OpsFieldShell>
              )}
            </div>

            <div className="space-y-1">
              <label className="wms-ops-entry-label">Raf Kodu</label>
              <OpsFieldShell
                className={cn(
                  locationLookupOpen && "wms-ops-field-shell--active",
                )}
              >
                <PagedLookupDialog<LocationOption>
                  variant="ops"
                  open={locationLookupOpen}
                  onOpenChange={setLocationLookupOpen}
                  title="Kabul rafı (Receiving / Staging)"
                  value={receivingLabel}
                  placeholder="Receiving / Staging"
                  searchPlaceholder="Raf kodu ara…"
                  emptyText="Raf bulunamadı."
                  disabled={!line.targetWarehouseId}
                  triggerClassName={cn(OPS_FIELD_CLASS, "h-9")}
                  queryKey={[
                    "gr-line-receiving-lookup",
                    key,
                    line.targetWarehouseId,
                  ]}
                  fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                    toPagedResponse(
                      await goodsReceiptV2Api.receivingLocations(
                        {
                          pageNumber,
                          pageSize,
                          search,
                          sortBy: "code",
                          sortDirection: "asc",
                          signal: signal ?? new AbortController().signal,
                        },
                        line.targetWarehouseId!,
                      ),
                    )
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={(item) => `${item.code} · ${item.name}`}
                  onSelect={(location) => {
                    updateLine(key, {
                      receivingLocationValue: String(location.id),
                      receivingLocationId: location.id,
                      receivingLocationCode: location.code,
                    });
                  }}
                />
              </OpsFieldShell>
            </div>
          </div>

          <StockTrackingPolicyField policy={line.trackingPolicy} compact />
        </div>

        <OpsActionButton
          type="button"
          variant="secondary"
          className="wms-ops-receipt-row__remove-btn shrink-0 self-start"
          aria-label="Kalemi kaldır"
          onClick={() => removeLine(key)}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </OpsActionButton>
      </div>

      {(suggestionsBusy || suggestions.length > 0 || line.putawayLocationCode) && (
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {suggestionsBusy && <Loader2 className="size-3.5 animate-spin" />}
            Önerilen Raf
            {line.putawayLocationCode ? (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[0.7rem] normal-case tracking-normal text-emerald-700 dark:text-emerald-200">
                Otomatik seçili: {line.putawayLocationCode}
              </span>
            ) : null}
          </div>
          <p className="text-[0.7rem] text-slate-500">
            İlk öneri otomatik seçilir; üzerine tıklayarak değiştirebilirsiniz.
            Kabul rafı (Receiving/Staging) yerine geçmez — raflama rehberidir.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item, index) => {
              const selected = line.putawayLocationId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    updateLine(key, {
                      putawayLocationId: item.id,
                      putawayLocationCode: item.code,
                    })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition",
                    selected
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-800 ring-1 ring-emerald-500/40 dark:text-emerald-200"
                      : "border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] hover:border-emerald-500/50",
                  )}
                >
                  <strong>
                    {index === 0 ? "Öneri · " : `${index + 1}. `}
                    {item.code}
                  </strong>
                  <span className="ml-2 text-slate-500">{item.reason}</span>
                  {item.remainingCapacity != null && (
                    <span className="ml-2 font-mono text-slate-500">
                      Kalan: {item.remainingCapacity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {line.targetWarehouseValue &&
        Number(line.targetWarehouseValue.split("|")[2]) !==
          line.targetWarehouseCode && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            Sipariş deposu {line.targetWarehouseCode}; bu kalem için farklı bir
            kabul deposu seçildi.
          </p>
        )}

      {serialMode && line.serialGenerationKey && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Otomatik seriler rezerve edildi.
          </span>
          <button
            type="button"
            onClick={() => void cancelGeneratedSerials(key)}
            className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
          >
            Otomatik serileri iptal et
          </button>
        </div>
      )}

      {serialOpen && (
        <SerialTrackingDialog
          line={line}
          onClose={() => setSerialOpen(false)}
          updateLine={updateLine}
          updateTracking={updateTracking}
          addTracking={addTracking}
          removeTracking={removeTracking}
          createSerialRows={createSerialRows}
          cancelGeneratedSerials={cancelGeneratedSerials}
        />
      )}
    </div>
  );
}

function SerialTrackingDialog({
  line,
  onClose,
  updateLine,
  updateTracking,
  addTracking,
  removeTracking,
  createSerialRows,
  cancelGeneratedSerials,
}: {
  line: SelectedReceiptLine;
  onClose: () => void;
  updateLine: (key: string, patch: Partial<SelectedReceiptLine>) => void;
  updateTracking: (
    key: string,
    id: string,
    patch: Partial<PlannedReceiptTracking>,
  ) => void;
  addTracking: (key: string) => void;
  removeTracking: (key: string, id: string) => void;
  createSerialRows: (key: string) => Promise<void>;
  cancelGeneratedSerials: (key: string) => Promise<void>;
}): ReactElement {
  const key = lineKey(line);
  const serialMode =
    line.trackingType === "Serial" || line.trackingType === "LotAndSerial";
  const lotMode =
    line.trackingType === "Lot" || line.trackingType === "LotAndSerial";
  const [bulkText, setBulkText] = useState("");
  const applyBulk = () => {
    const serials = [
      ...new Set(
        bulkText
          .split(/[\n,;]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (!serials.length) {
      toast.error("En az bir seri girin.");
      return;
    }
    if (serials.length > Math.floor(line.quantity)) {
      toast.error("Seri sayısı kabul miktarını aşamaz.");
      return;
    }
    updateLine(key, {
      serialGenerationKey: undefined,
      trackings: serials.map((serialNo) => ({
        localId: crypto.randomUUID(),
        quantity: 1,
        serialNo,
      })),
    });
    setBulkText("");
    toast.success(`${serials.length} seri satıra bölündü.`);
  };
  return (
    <ResponsiveDialog
      onClose={onClose}
      title="Seri / lot yönetimi"
      className="!max-w-5xl"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
            İzlenebilirlik
          </p>
          <h2 className="text-xl font-bold">
            {line.stockCode} · {formatProjectNumber(line.quantity)}{" "}
            {line.unitCode}
          </h2>
          <p className="text-sm text-slate-500">
            Sistem önerisi, miktardan bölme veya tekli giriş.
          </p>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-xl hover:bg-[var(--wms-brand-soft)]"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {serialMode && (
          <button
            type="button"
            onClick={() => void createSerialRows(key)}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-left text-sm font-semibold text-cyan-700 dark:text-cyan-300"
          >
            Otomatik seri öner
            <span className="mt-1 block text-xs font-normal opacity-80">
              Miktardan stok kuralına göre seri üret
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => addTracking(key)}
          className="rounded-xl border border-[var(--wms-app-border)] px-4 py-3 text-left text-sm font-semibold"
        >
          Tekli satır ekle
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Manuel lot / seri girişi
          </span>
        </button>
        {serialMode && line.serialGenerationKey && (
          <button
            type="button"
            onClick={() => void cancelGeneratedSerials(key)}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm font-semibold text-amber-700 dark:text-amber-300"
          >
            Otomatik serileri iptal
            <span className="mt-1 block text-xs font-normal opacity-80">
              Rezerve serileri bırak
            </span>
          </button>
        )}
      </div>
      {serialMode && (
        <div className="mb-4 rounded-xl border border-[var(--wms-app-border)] p-3">
          <label className="text-sm font-semibold">
            Mevcut seriyi böl / toplu yapıştır
          </label>
          <textarea
            className="input mt-2 min-h-24 font-mono text-sm"
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={"SN-0001\nSN-0002\nSN-0003"}
          />
          <button
            type="button"
            onClick={applyBulk}
            className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            Toplu serileri uygula
          </button>
        </div>
      )}
      <div className="space-y-2">
        {line.trackings.map((tracking, index) => (
          <div
            key={tracking.localId}
            className="grid gap-2 rounded-lg bg-black/5 p-2 dark:bg-white/5 md:grid-cols-[4rem_8rem_1fr_1fr_9rem_9rem_auto]"
          >
            <span className="self-center text-center text-xs font-semibold">
              #{index + 1}
            </span>
            <QuantityInput
              value={tracking.quantity}
              disabled={serialMode}
              onCommit={(quantity) =>
                updateTracking(key, tracking.localId, { quantity })
              }
            />
            {lotMode ? (
              <input
                className="input"
                aria-label="Lot"
                placeholder="Lot no"
                value={tracking.lotNo ?? ""}
                onChange={(event) =>
                  updateTracking(key, tracking.localId, {
                    lotNo: event.target.value,
                  })
                }
              />
            ) : (
              <span />
            )}
            {serialMode ? (
              <input
                className="input"
                aria-label="Seri"
                placeholder="Seri no"
                value={tracking.serialNo ?? ""}
                onChange={(event) =>
                  updateTracking(key, tracking.localId, {
                    serialNo: event.target.value,
                  })
                }
              />
            ) : (
              <span />
            )}
            <AppDateInput
              aria-label="Üretim tarihi"
              value={tracking.manufacturingDate ?? ""}
              onChange={(event) =>
                updateTracking(key, tracking.localId, {
                  manufacturingDate: event.target.value,
                })
              }
            />
            <AppDateInput
              aria-label="Son kullanma tarihi"
              value={tracking.expirationDate ?? ""}
              onChange={(event) =>
                updateTracking(key, tracking.localId, {
                  expirationDate: event.target.value,
                })
              }
            />
            <button
              type="button"
              aria-label="Takip satırını sil"
              onClick={() => removeTracking(key, tracking.localId)}
              className="grid size-10 place-items-center rounded-lg text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {line.trackings.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
            Henüz lot/seri satırı yok. Otomatik öner veya tekli satır ekleyin.
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white"
        >
          Tamam
        </button>
      </div>
    </ResponsiveDialog>
  );
}

function QuantityInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}): ReactElement {
  const [text, setText] = useState(
    formatProjectNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }),
  );
  useEffect(() => {
    setText(
      formatProjectNumber(value, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }),
    );
  }, [value]);
  return (
    <input
      className="input font-mono"
      aria-label="Miktar"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = parseLocalizedNumber(text);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setText(
            formatProjectNumber(value, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 6,
            }),
          );
          return;
        }
        onCommit(parsed);
      }}
    />
  );
}

function CreateSuccessPanel({
  result,
  supplierCode,
  assigneeCount,
  qualityLines,
  onNew,
}: {
  result: CreateGoodsReceiptResult;
  supplierCode?: string;
  assigneeCount: number;
  qualityLines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
  }>;
  onNew: () => void;
}): ReactElement {
  const navigate = useNavigate();
  const qualityCount = qualityLines.length;
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 via-[var(--wms-app-panel)] to-transparent shadow-sm">
      <div className="border-b border-emerald-500/20 px-8 py-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-9" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Mal kabul sonrası
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">
          Mal kabul sonrası irsaliye oluşturuldu
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {supplierCode
            ? `${supplierCode} tedarikçisi için belge hazır.`
            : "Mal kabul belgesi hazır."}{" "}
          Emir atanan kullanıcıların kuyruğuna düştü; fiziksel kabul bitince
          kaliteye gidecek kalemler listelenir.
        </p>
        <div className="mx-auto mt-5 inline-flex rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Belge No
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {result.documentNo}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-8 py-6 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">Görev</div>
          <strong className="mt-1 block text-lg">{result.tasks.length}</strong>
        </div>
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">Satır / miktar</div>
          <strong className="mt-1 block text-lg">
            {result.lineCount} · {formatProjectNumber(result.reservedQuantity)}
          </strong>
        </div>
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">Emir sorumlusu</div>
          <strong className="mt-1 block text-lg">{assigneeCount}</strong>
        </div>
      </div>

      {qualityCount > 0 ? (
        <div className="mx-8 mb-5 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <OpsStatusBadge
              tone="quality"
              title="Fiziksel kabul bitince kalite listesine düşer"
            >
              Kalite kontrol bekliyor
            </OpsStatusBadge>
            <span className="text-sm font-semibold">
              {qualityCount} kalem kalite kontrol aşamasında
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {qualityLines.map((line) => (
              <li
                key={line.stockCode}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-violet-500/20 bg-black/10 px-3 py-2 text-sm dark:bg-black/20"
              >
                <span className="min-w-0">
                  <span className="font-mono text-xs text-violet-600 dark:text-violet-300">
                    {line.stockCode}
                  </span>
                  <span className="ml-2 font-medium">
                    {line.stockName || "—"}
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {formatProjectNumber(line.quantity, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {line.unitCode || ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mx-8 mb-5 rounded-xl border border-[var(--wms-app-border)] px-4 py-3 text-sm text-slate-500">
          Bu emirde kalite kontrol gerektiren kalem yok.
        </div>
      )}

      {result.tasks.length > 0 && (
        <div className="space-y-2 border-t border-emerald-500/20 px-8 py-4 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Oluşturulan görevler
          </div>
          {result.tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2 font-mono text-xs"
            >
              <span className="font-semibold text-cyan-600 dark:text-cyan-300">
                {task.taskNo}
              </span>
              <span className="text-slate-500">
                depo #{task.warehouseId} · {task.lineCount} satır ·{" "}
                {formatProjectNumber(task.plannedQuantity)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-emerald-500/20 px-8 py-5">
        <button
          type="button"
          onClick={onNew}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white"
        >
          Yeni kayıt
        </button>
        <button
          type="button"
          onClick={() => navigate("/warehouse/goods-receipts/tasks")}
          className="rounded-xl border border-emerald-500/40 px-5 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300"
        >
          Emir yönetimine git
        </button>
        <Link
          to="/warehouse/goods-receipts/list"
          className="rounded-xl border border-[var(--wms-app-border)] px-5 py-2.5 font-semibold"
        >
          Mal kabul listesi
        </Link>
      </div>
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
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Footer({
  back,
  next,
  disabled,
  t,
}: {
  back: () => void;
  next: () => void;
  disabled: boolean;
  t: (key: string) => string;
}): ReactElement {
  return (
    <div className="mt-5 flex justify-between border-t border-[var(--wms-app-border)] pt-4">
      <OpsActionButton type="button" variant="secondary" onClick={back}>
        {t("back")}
      </OpsActionButton>
      <OpsActionButton
        type="button"
        variant="primary"
        disabled={disabled}
        onClick={next}
      >
        {t("continue")}
      </OpsActionButton>
    </div>
  );
}
function ReviewRow({
  label,
  value,
  emphasis,
  accent,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: boolean;
}): ReactElement {
  return (
    <div
      className={cn(
        "wms-ops-gr-review__row",
        emphasis && "wms-ops-gr-review__row--emphasis",
        accent && "wms-ops-gr-review__row--accent",
      )}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
