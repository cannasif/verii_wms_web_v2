import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  ScanBarcode,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput } from "@/components/shared/AppInput";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { StockTrackingPolicyField } from "@/features/stock-tracking/effective-stock-tracking";
import { stockTrackingApi } from "@/features/stock-tracking/api/stock-tracking.api";
import { qualityApi } from "@/features/quality/api/quality.api";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import {
  formatProjectNumber,
  parseLocalizedNumber,
} from "@/lib/project-format";
import { useAuthStore } from "@/stores/auth-store";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import type {
  ActiveUserOption,
  CreateGoodsReceiptResult,
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

const customerOption = (x: {
  id: number;
  branchCode: string;
  customerCode: string;
  customerName: string;
}) => ({
  value: `${x.id}|${x.branchCode}|${x.customerCode}`,
  label: `${x.customerCode} · ${x.customerName}`,
});
const warehouseOption = (x: WarehouseOption) => ({
  value: `${x.id}|${x.branchCode}|${x.warehouseCode}`,
  label: `${x.warehouseCode} · ${x.warehouseName}`,
});
const locationOption = (x: {
  id: number;
  code: string;
  name: string;
  locationType: string;
}) => ({
  value: String(x.id),
  label: `${x.code} · ${x.name}`,
  description: x.locationType,
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
  const branchCode = useAuthStore((state) => state.branch?.code ?? "0");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerValue, setCustomerValue] = useState<string | null>(null);
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
    if (!customerValue) return null;
    const [id, branch, code] = customerValue.split("|");
    return { id: Number(id), branch, code };
  }, [customerValue]);
  const primaryLine = lines[0];
  const selectedQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

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
      toast.error("Önce tedarikçi cari seçin.");
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
        "Bağımsız sipariş/proje araması için API’de customerCode olmadan filtre desteği gerekir. Şimdilik tedarikçi cariyi de seçin.",
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
      setStep(1);
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
    setStep(2);
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
  const steps = [0, 1, 2];
  if (!moduleReady)
    return (
      <div className="grid min-h-[20rem] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );
  return (
    <section className="wms-ops-form space-y-5">
      <header className="wms-ops-form-card rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]">
            <PackageCheck />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              {t("createFlow.subtitle")}
            </p>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        <Panel
          title={t("createFlow.orderSelection")}
          icon={<ClipboardList className="size-5" />}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["customer", "Tedarikçi Cari"],
                ["orderNo", "Sipariş Numarası"],
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
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="grid gap-3 md:grid-cols-2">
              <PagedAppDropdown
                queryKey={["gr-customers", branchCode]}
                fetchPage={(request) =>
                  goodsReceiptV2Api.customers(request, branchCode)
                }
                toOption={customerOption}
                value={customerValue}
                onValueChange={(value) => {
                  setCustomerValue(value);
                  setOrders([]);
                  setSelectedOrders([]);
                }}
                placeholder={t("selectCustomer")}
                searchable
                minSearchLength={2}
              />
              {searchMode === "orderNo" && (
                <input
                  className="input font-mono"
                  value={orderNumberQuery}
                  onChange={(event) => setOrderNumberQuery(event.target.value)}
                  placeholder="Sipariş numarası"
                  aria-label="Sipariş numarası"
                />
              )}
              {searchMode === "projectCode" && (
                <input
                  className="input font-mono"
                  value={projectCodeQuery}
                  onChange={(event) => setProjectCodeQuery(event.target.value)}
                  placeholder="Proje kodu"
                  aria-label="Proje kodu"
                />
              )}
            </div>
            <button
              disabled={busy}
              onClick={() => void loadOrders()}
              className="rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto size-4 animate-spin" />
              ) : (
                t("loadOrders")
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tedarikçi üzerinden ilerleyebilir; sipariş no veya proje kodu ile
            sonuçları daraltabilirsiniz. Miktar alanları siparişten gelir,
            kabul miktarı bir sonraki adımda düzenlenir.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left dark:bg-white/5">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Sipariş No</th>
                  <th className="p-3">Proje Kodu</th>
                  <th className="p-3">Tarih</th>
                  <th className="p-3 text-right">Sipariş Miktarı</th>
                  <th className="p-3 text-right">Kalan</th>
                  <th className="p-3 text-right">Mal Kabul</th>
                  <th className="p-3">Depo Kodu</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.siparisNo}
                    className="border-t border-[var(--wms-app-border)]"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.siparisNo)}
                        onChange={(event) =>
                          setSelectedOrders((current) =>
                            event.target.checked
                              ? [...current, order.siparisNo]
                              : current.filter((x) => x !== order.siparisNo),
                          )
                        }
                      />
                    </td>
                    <td className="p-3 font-mono font-semibold">
                      {order.siparisNo}
                    </td>
                    <td className="p-3 font-mono">{order.projectCode || "—"}</td>
                    <td className="p-3">
                      {order.orderDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatProjectNumber(order.orderedQuantity ?? 0)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatProjectNumber(
                        order.remainingQuantity ??
                          order.availableQuantity ??
                          0,
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-cyan-600">
                      {formatProjectNumber(order.availableQuantity ?? 0)}
                    </td>
                    <td className="p-3">{order.targetWarehouseCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                {t("noOrders")}
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              disabled={selectedOrders.length === 0 || busy}
              onClick={() => void loadLines()}
              className="rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {t("loadLines")}
            </button>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {lines.map((line) => (
            <ReceiptLineCard
              key={lineKey(line)}
              line={line}
              branch={customer?.branch ?? branchCode}
              updateLine={updateLine}
              updateTracking={updateTracking}
              addTracking={addTracking}
              removeTracking={removeTracking}
              createSerialRows={createSerialRows}
              cancelGeneratedSerials={cancelGeneratedSerials}
            />
          ))}
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
              deposu ve rafını kalem bazında değiştirebilir. Farklı depolar için
              aynı başlık altında ayrı görevler oluşturulur.
            </p>
            <Footer
              back={() => setStep(0)}
              next={goToConfirmation}
              disabled={lines.length === 0 || busy}
              t={t}
            />
          </Panel>
        </div>
      )}

      {step === 2 && (
        <Panel
          title="Kontrol ve oluşturma"
          icon={<CheckCircle2 className="size-5" />}
        >
          {result ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <h2 className="mt-3 text-xl font-bold">{t("created")}</h2>
              <p className="mt-2 font-mono text-lg">{result.documentNo}</p>
              <p className="mt-1 text-sm text-slate-500">
                {result.tasks.length} görev · {result.lineCount} satır ·{" "}
                {result.reservedQuantity} · {assignees.length} sorumlu
              </p>
              {result.tasks.map((task) => (
                <p key={task.id} className="mt-1 font-mono text-xs">
                  {task.taskNo} · depo #{task.warehouseId} · {task.lineCount}{" "}
                  satır · {task.plannedQuantity}
                </p>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Summary label="Cari" value={customer?.code ?? "—"} />
              <Summary label="Sipariş" value={selectedOrders.join(", ")} />
              <Summary
                label="Satır / miktar"
                value={`${lines.length} / ${selectedQuantity}`}
              />
              <Summary
                label="Depo sayısı"
                value={String(
                  new Set(lines.map((x) => x.targetWarehouseId)).size,
                )}
              />
              <Summary
                label="Emir sorumluları"
                value={assignees.map(userLabel).join(", ") || "—"}
              />
              <Summary
                label="Lot/seri satırı"
                value={String(
                  lines.reduce((sum, x) => sum + x.trackings.length, 0),
                )}
              />
              <Summary
                label="Kaliteye gidecek"
                value={
                  lines.some((x) => x.requireQualityControl)
                    ? `${lines.filter((x) => x.requireQualityControl).length} kalem · Mal kabul bitince kalite listesine düşer`
                    : "Yok"
                }
              />
              <Summary
                label="Belge serisi"
                value={
                  series.find((x) => String(x.id) === seriesValue)
                    ?.previewDocumentNumber ?? "—"
                }
              />
              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border px-5 py-2.5"
                >
                  {t("back")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void create()}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  ) : (
                    t("create")
                  )}
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

function ReceiptLineCard({
  line,
  branch,
  updateLine,
  updateTracking,
  addTracking,
  removeTracking,
  createSerialRows,
  cancelGeneratedSerials,
}: {
  line: SelectedReceiptLine;
  branch: string;
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
  const [quantityText, setQuantityText] = useState(
    formatProjectNumber(line.quantity, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }),
  );
  useEffect(() => {
    setQuantityText(
      formatProjectNumber(line.quantity, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }),
    );
  }, [line.quantity]);
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
          if (!line.receivingLocationId && items[0])
            updateLine(key, {
              receivingLocationId: items[0].id,
              receivingLocationValue: String(items[0].id),
            });
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
  }, [
    key,
    line.quantity,
    line.receivingLocationId,
    line.stockCode,
    line.targetWarehouseId,
    updateLine,
  ]);
  return (
    <Panel
      title={`${line.siparisNo} · ${line.stockCode ?? line.orderId}`}
      icon={<PackageCheck className="size-5" />}
    >
      <div className="mb-4 grid gap-3 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/5 md:grid-cols-4">
        <Info label="Stok" value={line.stockName ?? "—"} />
        <Info label="YAP" value={line.yapCode || "—"} />
        <Info
          label="Kullanılabilir"
          value={`${formatProjectNumber(line.availableQuantity ?? 0)} ${line.unitCode ?? ""}`}
        />
        <Info
          label="Sipariş deposu"
          value={String(line.targetWarehouseCode ?? "—")}
        />
      </div>
      {line.requireQualityControl && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <ShieldCheck className="size-4 shrink-0" />
          Bu stok kodunda kalite kuralı var; mal kabul bitince kalite inceleme
          listesine aktarılır.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Kabul miktarı">
          <input
            className="input font-mono"
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
              const capped = Math.min(parsed, line.availableQuantity ?? parsed);
              updateLine(key, { quantity: capped });
              setQuantityText(
                formatProjectNumber(capped, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 6,
                }),
              );
            }}
          />
        </Field>
        <Field label="Hedef depo">
          <PagedAppDropdown
            queryKey={["gr-line-warehouse", key, branch]}
            fetchPage={(request) =>
              goodsReceiptV2Api.warehouses(request, branch)
            }
            toOption={warehouseOption}
            value={line.targetWarehouseValue ?? null}
            onValueChange={(value) => {
              const [id] = (value ?? "").split("|");
              updateLine(key, {
                targetWarehouseValue: value,
                targetWarehouseId: Number(id) || undefined,
                receivingLocationId: undefined,
                receivingLocationValue: null,
              });
            }}
            placeholder="Hedef depo"
            searchable
          />
        </Field>
        <Field label="Kabul rafı">
          <PagedAppDropdown
            queryKey={["gr-line-location", key, line.targetWarehouseId]}
            fetchPage={(request) =>
              goodsReceiptV2Api.locations(request, line.targetWarehouseId!)
            }
            toOption={locationOption}
            enabled={Boolean(line.targetWarehouseId)}
            value={line.receivingLocationValue ?? null}
            onValueChange={(value) =>
              updateLine(key, {
                receivingLocationValue: value,
                receivingLocationId: value ? Number(value) : undefined,
              })
            }
            placeholder="Kabul rafı"
            searchable
          />
        </Field>
        <Field label="Stok takip politikası">
          <StockTrackingPolicyField policy={line.trackingPolicy} />
        </Field>
      </div>
      {(suggestionsBusy || suggestions.length > 0) && (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-500">
            {suggestionsBusy && <Loader2 className="size-3.5 animate-spin" />}
            Akıllı raf önerileri
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  updateLine(key, {
                    receivingLocationId: item.id,
                    receivingLocationValue: String(item.id),
                  })
                }
                className={`rounded-lg border px-3 py-2 text-left text-xs ${line.receivingLocationId === item.id ? "border-cyan-500 bg-cyan-500/15" : "border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"}`}
              >
                <strong>
                  {index + 1}. {item.code}
                </strong>
                <span className="ml-2 text-slate-500">{item.reason}</span>
                {item.remainingCapacity != null && (
                  <span className="ml-2 font-mono text-slate-500">
                    Kalan: {item.remainingCapacity}
                  </span>
                )}
              </button>
            ))}
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
      {line.trackingType !== "None" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] p-3">
          <div>
            <strong>Lot / seri dağılımı</strong>
            <p className="text-xs text-slate-500">
              Dağıtılan:{" "}
              {formatProjectNumber(
                line.trackings.reduce(
                  (sum, x) => sum + Number(x.quantity || 0),
                  0,
                ),
              )}{" "}
              / {formatProjectNumber(line.quantity)}
              {serialMode ? ` · ${line.trackings.filter((x) => x.serialNo).length} seri` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSerialOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ScanBarcode className="size-4" />
            {serialMode ? "Seri no yönet" : "Lot / izleme yönet"}
          </button>
        </div>
      )}
      {serialMode && line.serialGenerationKey && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Bu satırın otomatik serileri rezerve edildi. Miktar değişirse eski
            seri grubu iptal edilerek yenisi üretilir.
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
    </Panel>
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
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--wms-brand-primary)]">
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
      <button onClick={back} className="rounded-xl border px-5 py-2.5">
        {t("back")}
      </button>
      <button
        disabled={disabled}
        onClick={next}
        className="rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-40"
      >
        {t("continue")}
      </button>
    </div>
  );
}
function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--wms-app-border)] px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div>
      <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
