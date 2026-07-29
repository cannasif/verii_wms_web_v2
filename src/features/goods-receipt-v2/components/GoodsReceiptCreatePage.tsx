import {
  useCallback,
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
  CircleHelp,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackageOpen,
  ScanBarcode,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import { PremiumEyebrow } from "@/components/shared/PremiumEyebrow";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { StockTrackingPolicyField } from "@/features/stock-tracking/effective-stock-tracking";
import { stockTrackingApi } from "@/features/stock-tracking/api/stock-tracking.api";
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
  ManualGoodsReceiptResult,
  OpenOrderHeader,
  OpenOrderLine,
  PlannedReceiptTracking,
  SelectedReceiptLine,
  SeriesOption,
  StockOption,
  UserWarehouseAccess,
  WarehouseOption,
} from "../types/goods-receipt.types";
import {
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "../utils/goods-receipt-document-reference";

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
const groupOrderLines = (rows: OpenOrderLine[]): OpenOrderHeader[] => {
  const grouped = new Map<string, OpenOrderHeader>();
  for (const line of rows) {
    const current = grouped.get(line.siparisNo);
    grouped.set(line.siparisNo, {
      siparisNo: line.siparisNo,
      customerCode: line.customerCode,
      customerName: line.customerName,
      branchCode: line.branchCode,
      targetWarehouseCode:
        current?.targetWarehouseCode ?? line.targetWarehouseCode,
      orderDate: current?.orderDate ?? line.orderDate,
      projectCode: current?.projectCode ?? line.projectCode,
      orderedQuantity:
        (current?.orderedQuantity ?? 0) + (line.orderedQuantity ?? 0),
      deliveredQuantity:
        (current?.deliveredQuantity ?? 0) + (line.deliveredQuantity ?? 0),
      remainingQuantity:
        (current?.remainingQuantity ?? 0) + (line.remainingQuantity ?? 0),
      plannedQuantity:
        (current?.plannedQuantity ?? 0) + (line.plannedQuantity ?? 0),
      availableQuantity:
        (current?.availableQuantity ?? 0) + (line.availableQuantity ?? 0),
    });
  }
  return [...grouped.values()];
};

export function GoodsReceiptCreatePage({
  direct = false,
  embedded = false,
}: {
  direct?: boolean;
  embedded?: boolean;
} = {}): ReactElement {
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
  const [projectCodeFilter, setProjectCodeFilter] = useState("");
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  const [orders, setOrders] = useState<OpenOrderHeader[]>([]);
  const [directOrderLines, setDirectOrderLines] = useState<OpenOrderLine[]>([]);
  const [selectedDirectLineKeys, setSelectedDirectLineKeys] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [warehouseAccess, setWarehouseAccess] = useState<UserWarehouseAccess | null>(null);
  const [lines, setLines] = useState<SelectedReceiptLine[]>([]);
  const [confirmedLineOrder, setConfirmedLineOrder] = useState<string[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesValue, setSeriesValue] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [documentDate, setDocumentDate] = useState(today);
  const [waybillDate, setWaybillDate] = useState(today);
  const [receiptNo, setReceiptNo] = useState("");
  const [isElectronicReceipt, setIsElectronicReceipt] = useState(true);
  const [plannedArrival, setPlannedArrival] = useState("");
  const [priority, setPriority] = useState("3");
  const [labelStrategy, setLabelStrategy] = useState("None");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<CreateGoodsReceiptResult | ManualGoodsReceiptResult | null>(null);

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
  const directProjectCodes = useMemo(
    () =>
      [...new Set(
        directOrderLines
          .map((line) => line.projectCode?.trim())
          .filter((value): value is string => Boolean(value)),
      )].sort((left, right) => left.localeCompare(right, "tr-TR")),
    [directOrderLines],
  );
  const visibleDirectOrderLines = useMemo(
    () =>
      projectCodeFilter
        ? directOrderLines.filter((line) => line.projectCode?.trim() === projectCodeFilter)
        : directOrderLines,
    [directOrderLines, projectCodeFilter],
  );
  const primaryLine = lines[0];
  const selectedQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const orderedLines = useMemo(() => {
    const byKey = new Map(lines.map((line) => [lineKey(line), line] as const));
    const confirmed = confirmedLineOrder
      .map((key) => byKey.get(key))
      .filter((line): line is SelectedReceiptLine => Boolean(line));
    const confirmedSet = new Set(confirmedLineOrder);
    const rest = lines.filter((line) => !confirmedSet.has(lineKey(line)));
    return [...confirmed, ...rest];
  }, [lines, confirmedLineOrder]);
  const selectedOrderWarehouseCode = useMemo(
    () => orders.find((order) => selectedOrders.includes(order.siparisNo))?.targetWarehouseCode,
    [orders, selectedOrders],
  );
  const selectedDirectWarehouseCode = useMemo(
    () =>
      directOrderLines.find((line) =>
        selectedDirectLineKeys.includes(lineKey(line)),
      )?.targetWarehouseCode,
    [directOrderLines, selectedDirectLineKeys],
  );
  const canUseOrderWarehouse = useCallback(
    (warehouseCode?: number): boolean =>
      !warehouseAccess?.isRestricted
      || (warehouseCode != null && warehouseAccess.warehouseCodes.includes(warehouseCode)),
    [warehouseAccess],
  );

  useEffect(() => {
    let active = true;
    void goodsReceiptV2Api.warehouseAccess()
      .then((access) => { if (active) setWarehouseAccess(access); })
      .catch((cause: Error) => { if (active) report(cause, "Depo yetkileri alınamadı."); });
    return () => { active = false; };
  }, [branchCode]);

  useEffect(() => {
    const keys = new Set(lines.map((line) => lineKey(line)));
    setConfirmedLineOrder((current) => {
      const next = current.filter((key) => keys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [lines]);

  const clearCustomerDependent = (): void => {
    setProjectCodeFilter("");
    setOrders([]);
    setDirectOrderLines([]);
    setSelectedDirectLineKeys([]);
    setSelectedOrders([]);
    setLines([]);
    setConfirmedLineOrder([]);
  };

  const findCustomerByCode = async (customerCode: string): Promise<CustomerOption> => {
    const page = await goodsReceiptV2Api.customers(
      {
        pageNumber: 1,
        pageSize: 20,
        search: customerCode,
        sortBy: "customerCode",
        sortDirection: "asc",
        signal: new AbortController().signal,
      },
      branchCode,
    );
    const match = page.items.find(
      (item) =>
        item.customerCode.trim().toLocaleUpperCase("tr-TR") ===
        customerCode.trim().toLocaleUpperCase("tr-TR"),
    );
    if (!match)
      throw new Error(
        `${customerCode} cari kodu ERP tedarikçi mirror tablosunda bulunamadı.`,
      );
    return match;
  };

  const loadOrderByNumber = async (): Promise<void> => {
    const orderNumber = orderNumberSearch.trim().toLocaleUpperCase("tr-TR");
    if (!orderNumber) {
      toast.error("Sipariş numarasını girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fetched = await goodsReceiptV2Api.orderLines(
        undefined,
        branchCode,
        [orderNumber],
        direct,
      );
      const rows = fetched.filter(
        (line) =>
          line.siparisNo.trim().toLocaleUpperCase("tr-TR") === orderNumber,
      );
      if (rows.length === 0)
        throw new Error(`${orderNumber} numaralı açık sipariş bulunamadı.`);

      const customerCodes = [
        ...new Set(
          rows
            .map((line) => line.customerCode?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      if (customerCodes.length !== 1)
        throw new Error(
          `${orderNumber} siparişinin tek bir cari kodu bulunamadı.`,
        );

      const resolvedCustomer = await findCustomerByCode(customerCodes[0]);
      const groupedOrders = groupOrderLines(rows);
      setSelectedCustomer(resolvedCustomer);
      setProjectCodeFilter("");
      setOrders(groupedOrders);
      setDirectOrderLines(direct ? rows : []);
      setSelectedDirectLineKeys([]);
      setSelectedOrders(
        !direct &&
          groupedOrders.length === 1 &&
          canUseOrderWarehouse(groupedOrders[0].targetWarehouseCode)
          ? [groupedOrders[0].siparisNo]
          : [],
      );
      setLines([]);
      toast.success(
        `${orderNumber} siparişi ve ${resolvedCustomer.customerCode} tedarikçisi getirildi.`,
      );
    } catch (cause) {
      report(cause, "Sipariş numarasıyla arama başarısız.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setSeries([]);
    setSeriesValue(null);
    void goodsReceiptV2Api
      .series()
      .then((items) => {
        setSeries(items);
        const preferred = items.find((x) => x.isDefault) ?? items[0];
        setSeriesValue(preferred ? String(preferred.id) : null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [branchCode]);

  const loadOrders = async (): Promise<void> => {
    if (!customer) {
      toast.error("Önce tedarikçi seçin.");
      return;
    }
    setBusy(true);
    setError(null);
    setSelectedOrders([]);
    setLines([]);
    setConfirmedLineOrder([]);
    try {
      if (direct) {
        const allLines = await goodsReceiptV2Api.orderLines(
          customer.code,
          customer.branch,
          [],
          true,
        );
        const filteredLines = allLines;
        setDirectOrderLines(filteredLines);
        setSelectedDirectLineKeys([]);
        const directOrders = groupOrderLines(filteredLines);
        setOrders(directOrders);
        if (
          directOrders.length === 1 &&
          canUseOrderWarehouse(directOrders[0].targetWarehouseCode)
        )
          setSelectedOrders([directOrders[0].siparisNo]);
        return;
      }
      const rows = await goodsReceiptV2Api.orderHeaders({
        branchCode: customer.branch,
        customerCode: customer.code,
      });
      const filtered = rows;
      setOrders(filtered);
      if (filtered.length === 1 && canUseOrderWarehouse(filtered[0].targetWarehouseCode))
        setSelectedOrders([filtered[0].siparisNo]);
    } catch (cause) {
      report(cause, "Siparişler alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const loadLines = async (): Promise<void> => {
    if (
      !customer ||
      (direct
        ? selectedDirectLineKeys.length === 0
        : selectedOrders.length === 0)
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const rows =
        direct && directOrderLines.length > 0
          ? directOrderLines.filter((line) =>
              selectedDirectLineKeys.includes(lineKey(line)),
            )
          : await goodsReceiptV2Api.orderLines(
              customer.code,
              customer.branch,
              selectedOrders,
            );
      if (
        direct &&
        new Set(rows.map((line) => line.targetWarehouseCode).filter((code) => code != null)).size > 1
      ) {
        toast.warning(
          "Farklı hedef depolara ait sipariş kalemleri tek mal kabulde hazırlanamaz. Her depo için ayrı kabul oluşturun.",
        );
        return;
      }
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
      const yapCodes = [
        ...new Set(
          rows
            .map((x) => x.yapCode?.trim())
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      const yapLookups = await Promise.all(
        yapCodes.map(async (code) => {
          const page = await goodsReceiptV2Api.yapCodes(
            {
              pageNumber: 1,
              pageSize: 20,
              search: code,
              sortBy: "configurationCode",
              sortDirection: "asc",
              signal: new AbortController().signal,
            },
            customer.branch,
          );
          const item = page.items.find(
            (candidate) =>
              candidate.configurationCode.toLocaleUpperCase("tr-TR") ===
              code.toLocaleUpperCase("tr-TR"),
          );
          if (!item)
            throw new Error(`${code} YAP kodu ERP mirror tablosunda bulunamadı.`);
          return [code.toLocaleUpperCase("tr-TR"), item.id] as const;
        }),
      );
      const yapIdByCode = new Map<string, number>(yapLookups);
      const trackingPolicies = new Map<
        number,
        ReturnType<typeof goodsReceiptV2Api.trackingPolicy>
      >();
      const qualityRequirements = await goodsReceiptV2Api.qualityRequirements(
        customer.branch,
        [...stockByCode.values()].map((stock) => stock.id),
      );
      const qualityByStockId = new Map(
        qualityRequirements.stocks.map((requirement) => [
          requirement.stockId,
          requirement.requiresQualityControl,
        ]),
      );
      const preparedLines = await Promise.all(
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
              yapCodeId: x.yapCode
                ? yapIdByCode.get(x.yapCode.toLocaleUpperCase("tr-TR"))
                : undefined,
              unitCode: stock.unitCode,
              quantity: x.availableQuantity ?? 0,
              targetWarehouseId: warehouse?.id,
              targetWarehouseValue: warehouse
                ? warehouseOption(warehouse).value
                : null,
              targetWarehouseName: warehouse?.warehouseName,
              receivingLocationValue: null,
              trackingType: trackingPolicy.trackingType,
              trackingPolicy,
              trackings: [],
              requireQualityControl: qualityByStockId.get(stock.id) === true,
            };
          }),
        );
      setLines(preparedLines);
      setConfirmedLineOrder([]);
      window.requestAnimationFrame(() =>
        document
          .getElementById("goods-receipt-selected-lines")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (cause) {
      report(cause, "Sipariş satırları alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (key: string, patch: Partial<SelectedReceiptLine>): void =>
    setLines((current) => {
      const primaryKey = current[0] ? lineKey(current[0]) : null;
      const primaryWarehouseChanged =
        key === primaryKey &&
        patch.targetWarehouseId != null &&
        patch.targetWarehouseId !== current[0]?.targetWarehouseId;

      return current.map((line) => {
        if (lineKey(line) === key)
          return { ...line, ...patch };
        if (!primaryWarehouseChanged)
          return line;
        return {
          ...line,
          targetWarehouseValue: patch.targetWarehouseValue ?? null,
          targetWarehouseId: patch.targetWarehouseId,
          targetWarehouseName: patch.targetWarehouseName,
          receivingLocationId: undefined,
          receivingLocationValue: null,
          receivingLocationCode: undefined,
          putawayLocationId: undefined,
          putawayLocationCode: undefined,
        };
      });
    });
  const toggleLineConfirmed = (key: string, next: boolean): void => {
    if (next) {
      const line = lines.find((item) => lineKey(item) === key);
      if (!line || line.quantity <= 0) {
        toast.error("Önce miktar girin.");
        return;
      }
      setConfirmedLineOrder((current) =>
        current.includes(key) ? current : [...current, key],
      );
      return;
    }
    setConfirmedLineOrder((current) => current.filter((item) => item !== key));
  };
  const confirmableLineKeys = useMemo(
    () =>
      lines
        .filter((line) => line.quantity > 0)
        .map((line) => lineKey(line)),
    [lines],
  );
  const allLinesConfirmed =
    confirmableLineKeys.length > 0 &&
    confirmableLineKeys.every((key) => confirmedLineOrder.includes(key));
  const toggleAllLinesConfirmed = (): void => {
    if (confirmableLineKeys.length === 0) {
      toast.error("Onaylanacak miktarı olan kalem yok.");
      return;
    }
    if (allLinesConfirmed) {
      setConfirmedLineOrder([]);
      return;
    }
    setConfirmedLineOrder(confirmableLineKeys);
  };
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
    if (!isValidGoodsReceiptDocumentNo(receiptNo, isElectronicReceipt))
      return isElectronicReceipt
        ? "E-irsaliye numarası 3 karakter birim kodu, 4 karakter yıl ve 9 karakter sıra numarasından oluşmalıdır."
        : "Normal irsaliye numarası tam 15 rakam olmalıdır.";
    if (!waybillDate) return "İrsaliye tarihi zorunludur.";
    const warehouseIds = [...new Set(lines.map((line) => line.targetWarehouseId).filter(Boolean))];
    if (warehouseIds.length > 1)
      return "Bir mal kabul emrinde yalnızca tek depo seçilebilir. Farklı depolar için ayrı emir oluşturun.";
    if (warehouseAccess?.isRestricted && warehouseIds.some((id) => !warehouseAccess.warehouseIds.includes(id!)))
      return "Seçilen depo kullanıcıya tanımlı değildir; bu depoda mal kabul işlemi yapılamaz.";
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
    if (!direct && assignees.length === 0)
      return "Emir için en az bir operasyon kullanıcısı atanmalıdır.";
    return null;
  };

  const goToConfirmation = async (): Promise<void> => {
    const message = validatePlan();
    if (message) {
      setError(message);
      toast.error(message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const requirement = await goodsReceiptV2Api.qualityRequirements(
        customer?.branch ?? branchCode,
        lines.map((line) => line.stockId),
      );
      const qualityByStockId = new Map(
        requirement.stocks.map((stock) => [
          stock.stockId,
          stock.requiresQualityControl,
        ]),
      );
      setLines((current) => current.map((line) => ({
        ...line,
        requireQualityControl: qualityByStockId.get(line.stockId) === true,
      })));
      setStep(1);
    } catch (cause) {
      report(cause, "Kalite kontrol kuralları doğrulanamadı.");
    } finally {
      setBusy(false);
    }
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
      const commonPayload = {
        idempotencyKey: crypto.randomUUID(),
        branchCode: customer.branch,
        documentSeriesId: Number(seriesValue),
        supplierId: customer.id,
        targetWarehouseId: primaryLine.targetWarehouseId,
        receivingLocationId: primaryLine.receivingLocationId,
        documentDate,
        waybillNo: isElectronicReceipt ? null : receiptNo,
        waybillDate,
        electronicWaybillNo: isElectronicReceipt ? receiptNo : null,
        plannedArrivalAtUtc: !direct && plannedArrival
          ? new Date(plannedArrival).toISOString()
          : null,
        occurredAtUtc: direct ? new Date().toISOString() : null,
        labelStrategy,
        allowOverReceipt: false,
        overReceiptTolerancePercent: 0,
        allowUnderReceipt: true,
        requireQualityControl: lines.some((line) => line.requireQualityControl),
        requirePutaway: true,
        priority: direct ? 1 : Number(priority),
        description: description.trim() || null,
        assignedUserIds: direct ? null : assignees.map((user) => user.id),
      };
      const created = direct
        ? await goodsReceiptV2Api.createDirect({
          ...commonPayload,
          executionMode: labelStrategy === "SupplierLabel" ? "SupplierLabel" : "Manual",
          deviceId: null,
          lines: lines.flatMap((line) => {
            const trackings = line.trackings.length > 0 ? line.trackings : [{
              quantity: line.quantity,
              lotNo: undefined,
              serialNo: undefined,
              manufacturingDate: undefined,
              expirationDate: undefined,
              description: undefined,
            }];
            return trackings.map((tracking) => ({
              stockId: line.stockId,
              yapCodeId: line.yapCodeId ?? null,
              quantity: tracking.quantity,
              unitCode: line.unitCode,
              trackingType: line.trackingType,
              trackings: line.trackingType === "None" ? [] : [{
                quantity: tracking.quantity,
                lotNo: tracking.lotNo?.trim() || null,
                serialNo: tracking.serialNo?.trim() || null,
                manufacturingDate: tracking.manufacturingDate || null,
                expirationDate: tracking.expirationDate || null,
                description: tracking.description?.trim() || null,
              }],
              lotNo: tracking.lotNo?.trim() || null,
              serialNo: tracking.serialNo?.trim() || null,
              manufacturingDate: tracking.manufacturingDate || null,
              expirationDate: tracking.expirationDate || null,
              scannedBarcode: tracking.serialNo?.trim() || null,
              goodsReceiptLabelId: null,
              description: tracking.description?.trim() || null,
              targetWarehouseId: line.targetWarehouseId,
              receivingLocationId: line.receivingLocationId,
              sourceOrderNumber: line.siparisNo,
              sourceOrderId: line.orderId,
            }));
          }),
        })
        : await goodsReceiptV2Api.create({
          ...commonPayload,
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
      report(cause, direct ? "Doğrudan mal kabul tamamlanamadı." : "Mal kabul emri oluşturulamadı.");
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
  const toggleOrder = (order: OpenOrderHeader): void => {
    const { siparisNo, targetWarehouseCode } = order;
    if (!selectedOrders.includes(siparisNo) && !canUseOrderWarehouse(targetWarehouseCode)) {
      toast.error(`Depo ${targetWarehouseCode ?? "belirsiz"} kullanıcınıza tanımlı olmadığı için bu siparişi seçemezsiniz.`);
      return;
    }
    if (!selectedOrders.includes(siparisNo)
      && selectedOrderWarehouseCode != null
      && targetWarehouseCode !== selectedOrderWarehouseCode) {
      toast.warning("Bir mal kabul emrinde farklı depolara ait siparişler seçilemez. Önce mevcut seçimi kaldırın veya ayrı emir oluşturun.");
      return;
    }
    setSelectedOrders((current) =>
      current.includes(siparisNo)
        ? current.filter((x) => x !== siparisNo)
        : [...current, siparisNo],
    );
  };

  const selectableDirectOrderLines = useMemo(
    () =>
      visibleDirectOrderLines.filter(
        (line) =>
          (line.availableQuantity ?? 0) > 0 &&
          canUseOrderWarehouse(line.targetWarehouseCode),
      ),
    [visibleDirectOrderLines, canUseOrderWarehouse],
  );
  const directSelectAllWarehouseCode =
    selectedDirectWarehouseCode ??
    selectableDirectOrderLines[0]?.targetWarehouseCode;
  const directSelectAllTargets = useMemo(
    () =>
      selectableDirectOrderLines.filter(
        (line) => line.targetWarehouseCode === directSelectAllWarehouseCode,
      ),
    [selectableDirectOrderLines, directSelectAllWarehouseCode],
  );
  const directSelectAllKeys = useMemo(
    () => directSelectAllTargets.map((line) => lineKey(line)),
    [directSelectAllTargets],
  );
  const allDirectLinesSelected =
    directSelectAllKeys.length > 0 &&
    directSelectAllKeys.every((key) => selectedDirectLineKeys.includes(key));
  const toggleAllDirectLines = (): void => {
    if (directSelectAllKeys.length === 0) return;
    if (allDirectLinesSelected) {
      setSelectedDirectLineKeys([]);
      setLines([]);
      return;
    }
    if (
      selectableDirectOrderLines.length > directSelectAllTargets.length
    ) {
      toast.warning(
        "Farklı hedef depolara ait kalemler aynı mal kabulde seçilemez. Aynı depodaki uygun kalemler seçildi.",
      );
    }
    setSelectedDirectLineKeys(directSelectAllKeys);
    setLines([]);
  };

  if (!moduleReady)
    return (
      <div className="grid min-h-[20rem] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );

  return (
    <section className="wms-ops-form space-y-5">
      {!embedded ? (
        <header className="space-y-2">
          {isPremium ? (
            <PremiumEyebrow eyebrow={createEyebrow} />
          ) : (
            <div className="wms-ops-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
              {createEyebrow}
            </div>
          )}
          <p className="max-w-3xl text-sm leading-6 text-[var(--wms-app-text-muted)]">
            {direct
              ? "Tedarikçinin açık siparişlerini seçin; kabul deposu, miktar, raf ve lot/seri bilgisini tamamlayıp fiziksel kabulü tek akışta bitirin."
              : t("createFlow.subtitle")}
          </p>
        </header>
      ) : null}

      <nav className="wms-ops-create-steps" aria-label="Oluşturma adımları">
        {steps.map((value) => {
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
              <span className="wms-ops-create-steps__label">
                {t(`createFlow.steps.${value}`)}
              </span>
            </div>
          );
        })}
      </nav>

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
            <div className="wms-ops-order-lookup mb-4">
              <label className="wms-ops-entry-label mb-1.5 block">
                {t("customer")} <span className="text-red-500">*</span>
              </label>
              <div className="wms-ops-order-lookup__row">
                <div className="wms-ops-order-lookup__field min-w-0 flex-1">
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
                      setOrderNumberSearch("");
                      clearCustomerDependent();
                    }}
                  />
                </div>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={busy || !customer}
                  onClick={() => void loadOrders()}
                  className="wms-ops-order-lookup__action w-full shrink-0 sm:w-auto"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    t("loadOrders")
                  )}
                </OpsActionButton>
              </div>
            </div>

            <div className="wms-ops-order-lookup mb-5">
              <div className="wms-ops-order-lookup__row">
                <div className="wms-ops-order-lookup__field min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="wms-ops-entry-label">
                      Sipariş No
                    </span>
                    <TooltipProvider delayDuration={180}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="wms-ops-order-lookup__help"
                            aria-label="Sipariş numarasıyla getirme hakkında"
                          >
                            <CircleHelp className="size-3.5" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="wms-ops-order-lookup__tooltip !bg-[var(--wms-app-panel)] !text-[var(--wms-app-text)] border-[color-mix(in_oklab,var(--wms-ops-accent)_40%,var(--wms-app-border))]"
                        >
                          Siparişin cari kodu Netsis’ten okunur; eşleşen
                          tedarikçi otomatik seçilir ve sipariş bakiyesi aşağıda
                          açılır.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <AppInput
                    leadingIcon={<Search className="size-4" aria-hidden />}
                    className="font-mono uppercase"
                    value={orderNumberSearch}
                    onChange={(event) =>
                      setOrderNumberSearch(
                        event.target.value.toLocaleUpperCase("tr-TR"),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void loadOrderByNumber();
                      }
                    }}
                    placeholder="Örn. SAS202600000001"
                    maxLength={50}
                  />
                </div>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={busy || !orderNumberSearch.trim()}
                  onClick={() => void loadOrderByNumber()}
                  className="wms-ops-order-lookup__action w-full sm:w-auto"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    "Siparişi getir"
                  )}
                </OpsActionButton>
              </div>
            </div>

            {direct && (
              <section className="mb-5 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">İrsaliye bilgileri</h3>
                    <p className="text-xs text-slate-500">
                      Belge türü, numarası ve tarihleri sipariş seçiminden önce
                      girilir.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-2">
                    <OpsSkinCheckbox
                      checked={isElectronicReceipt}
                      onCheckedChange={(next) => {
                        setIsElectronicReceipt(next);
                        setReceiptNo("");
                        setError(null);
                      }}
                      aria-label="E-irsaliye"
                    />
                    <span className="text-sm font-semibold">E-irsaliye</span>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label={
                      isElectronicReceipt
                        ? "E-irsaliye numarası"
                        : "İrsaliye numarası"
                    }
                    errorTarget="receiptNo"
                    errorKeys="irsaliye numarası|e-irsaliye numarası|normal irsaliye"
                  >
                    <AppInput
                      className="font-mono tracking-wider"
                      inputMode="text"
                      maxLength={isElectronicReceipt ? 16 : 15}
                      placeholder={
                        isElectronicReceipt
                          ? "GIB2026AB0000001"
                          : "IRS202600000001"
                      }
                      value={receiptNo}
                      invalid={
                        Boolean(receiptNo) &&
                        !isValidGoodsReceiptDocumentNo(
                          receiptNo,
                          isElectronicReceipt,
                        )
                      }
                      onChange={(event) => {
                        setReceiptNo(
                          normalizeGoodsReceiptDocumentNo(
                            event.target.value,
                            isElectronicReceipt,
                          ),
                        );
                        setError(null);
                      }}
                      trailingContent={
                        <span className="pr-1 text-xs font-bold text-[var(--wms-ops-field-placeholder-fg)]">
                          {receiptNo.length}/{isElectronicReceipt ? 16 : 15}
                        </span>
                      }
                    />
                  </Field>
                  <Field
                    label="İrsaliye tarihi"
                    errorTarget="waybillDate"
                    errorKeys="irsaliye tarihi"
                  >
                    <AppDateInput
                      value={waybillDate}
                      onChange={(event) => setWaybillDate(event.target.value)}
                    />
                  </Field>
                  <div className="hidden">
                    <Field
                      label={t("documentDate")}
                      errorTarget="documentDate"
                      errorKeys="belge tarihi"
                    >
                      <AppDateInput
                        value={documentDate}
                        onChange={(event) => setDocumentDate(event.target.value)}
                      />
                    </Field>
                    <Field
                      label="Mal kabul belge serisi"
                      errorTarget="documentSeries"
                      errorKeys="belge serisi|mal kabul belge serisi"
                    >
                      <AppDropdown
                        value={seriesValue}
                        onValueChange={setSeriesValue}
                        options={series.map((x) => ({
                          value: String(x.id),
                          label: `${x.code} · ${x.name}`,
                          description: x.previewDocumentNumber,
                        }))}
                        placeholder="Belge serisi seçin"
                        searchable
                      />
                    </Field>
                  </div>
                </div>
              </section>
            )}

            <div className="wms-ops-order-fetch space-y-4">
              {direct && directProjectCodes.length > 0 ? (
                <div className="max-w-sm">
                  <label className="wms-ops-entry-label mb-1.5 block">
                    Proje filtresi
                  </label>
                  <select
                    className={cn(OPS_FIELD_CLASS, "h-10 w-full font-mono text-xs")}
                    value={projectCodeFilter}
                    onChange={(event) => setProjectCodeFilter(event.target.value)}
                  >
                    <option value="">Tüm projeler</option>
                    {directProjectCodes.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {direct && directOrderLines.length > 0 && (
                <div className="wms-ops-order-fetch__table-wrap">
                  <table className="wms-ops-order-fetch__table w-full min-w-[840px] text-left text-xs">
                    <thead>
                      <tr>
                        <th className="w-14 text-center">
                          <OpsSkinCheckbox
                            checked={allDirectLinesSelected}
                            disabled={directSelectAllKeys.length === 0}
                            onCheckedChange={() => toggleAllDirectLines()}
                            aria-label="Tümünü seç"
                            title="Tümünü seç"
                          />
                        </th>
                        <th>Sipariş No</th>
                        <th>Proje Kodu</th>
                        <th>Stok Kodu</th>
                        <th>Stok Adı</th>
                        <th className="wms-ops-order-fetch__qty">Kalan</th>
                        <th>Hedef Depo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDirectOrderLines.map((line) => {
                        const key = lineKey(line);
                        const checked = selectedDirectLineKeys.includes(key);
                        const unavailable = (line.availableQuantity ?? 0) <= 0;
                        const warehouseDenied = !canUseOrderWarehouse(
                          line.targetWarehouseCode,
                        );
                        const toggle = (): void => {
                          if (unavailable) {
                            toast.error(
                              "Bu sipariş kaleminin açık miktarı aktif bir mal kabul emrine ayrılmış.",
                            );
                            return;
                          }
                          if (warehouseDenied) {
                            toast.error(
                              "Bu sipariş kaleminin deposu kullanıcınıza tanımlı değil.",
                            );
                            return;
                          }
                          if (
                            !checked &&
                            selectedDirectWarehouseCode != null &&
                            line.targetWarehouseCode !== selectedDirectWarehouseCode
                          ) {
                            toast.warning(
                              "Farklı hedef depolara ait kalemler aynı mal kabulde seçilemez. Önce mevcut seçimi kaldırın veya ayrı kabul oluşturun.",
                            );
                            return;
                          }
                          setSelectedDirectLineKeys((current) =>
                            current.includes(key)
                              ? current.filter((item) => item !== key)
                              : [...current, key],
                          );
                          setLines([]);
                        };
                        return (
                          <tr
                            key={key}
                            className={cn(
                              checked && "wms-ops-order-fetch__row--selected",
                              (warehouseDenied || unavailable) &&
                                "cursor-not-allowed opacity-50",
                            )}
                            onClick={toggle}
                          >
                            <td
                              className="text-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <OpsSkinCheckbox
                                checked={checked}
                                disabled={warehouseDenied || unavailable}
                                onCheckedChange={() => toggle()}
                                aria-label={`${line.siparisNo} ${line.stockCode ?? ""} seç`}
                                title={
                                  unavailable
                                    ? "Aktif bir mal kabul emrine ayrılmış."
                                    : warehouseDenied
                                      ? "Bu depo kullanıcınıza tanımlı değil."
                                      : undefined
                                }
                              />
                            </td>
                            <td className="font-mono font-semibold">
                              {line.siparisNo}
                            </td>
                            <td className="font-mono">
                              {line.projectCode || "—"}
                            </td>
                            <td className="font-mono font-semibold">
                              {line.stockCode || "—"}
                            </td>
                            <td>{line.stockName || "—"}</td>
                            <td className="wms-ops-order-fetch__qty font-mono">
                              {formatProjectNumber(
                                line.availableQuantity ??
                                  line.remainingQuantity ??
                                  0,
                              )}
                              {unavailable ? (
                                <span className="ml-2 whitespace-nowrap text-[10px] text-amber-600">
                                  Ayrılmış
                                </span>
                              ) : null}
                            </td>
                            <td>{line.targetWarehouseCode ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(direct ? directOrderLines.length === 0 : orders.length === 0) ? (
                <div className="wms-ops-panel-empty py-10 text-center">
                  <PackageOpen className="mx-auto size-8 opacity-50" aria-hidden />
                  <p className="mt-3 text-sm text-[var(--wms-app-text-muted)]">
                    {t("noOrders")}
                  </p>
                </div>
              ) : !direct ? (
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
                        const warehouseDenied = !canUseOrderWarehouse(order.targetWarehouseCode);
                        return (
                          <tr
                            key={order.siparisNo}
                            className={cn(
                              checked && "wms-ops-order-fetch__row--selected",
                              warehouseDenied && "cursor-not-allowed opacity-50",
                            )}
                            onClick={() => toggleOrder(order)}
                          >
                            <td
                              className="text-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <OpsSkinCheckbox
                                checked={checked}
                                disabled={warehouseDenied}
                                onCheckedChange={() => toggleOrder(order)}
                                aria-label={`${order.siparisNo} seç`}
                                title={warehouseDenied ? "Bu depo kullanıcınıza tanımlı değil." : undefined}
                              />
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
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  {direct
                    ? `${selectedDirectLineKeys.length} sipariş kalemi seçildi`
                    : `${selectedOrders.length} sipariş seçildi`}
                </p>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  disabled={
                    (direct
                      ? selectedDirectLineKeys.length === 0
                      : selectedOrders.length === 0) || busy
                  }
                  onClick={() => void loadLines()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    direct ? "Seçili kalemleri hazırla" : t("loadLines")
                  )}
                </OpsActionButton>
              </div>
            </div>
          </Panel>

          {lines.length > 0 && (
            <section
              id="goods-receipt-selected-lines"
              className="scroll-mt-5 overflow-hidden rounded-2xl border border-cyan-500/30 bg-[var(--wms-app-panel)] shadow-sm"
              data-wms-error-target="selectedLines"
              data-wms-error-keys="hedef depo|kabul rafı|miktar|lot/seri|seri satırı|üretim tarihi|son kullanma|aynı seri|tek depo|seçilen depo"
            >
                  <header className="border-b border-[var(--wms-app-border)] bg-cyan-500/[.07] px-5 py-4">
                    <h2 className="text-xl font-black">
                      Seçili Kalemler ve Mal Kabul Detayları
                    </h2>
                    <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
                      Miktar, depo, raf ve seri/lot bilgilerini bu ekrandan ayrılmadan
                      kalem bazında yönetin.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 font-semibold text-cyan-600">
                          {lines.length} kalem
                        </span>
                        <span className="rounded-lg border border-[var(--wms-app-border)] px-3 py-2 font-mono">
                          {formatProjectNumber(selectedQuantity)}
                        </span>
                        {confirmedLineOrder.length > 0 ? (
                          <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-300">
                            {confirmedLineOrder.length} seçili
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={toggleAllLinesConfirmed}
                          disabled={confirmableLineKeys.length === 0}
                          className={cn(
                            "ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                            allLinesConfirmed
                              ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 hover:border-cyan-500/50 hover:bg-cyan-500/15 dark:text-cyan-200",
                            confirmableLineKeys.length === 0 && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <span className="pointer-events-none" aria-hidden>
                            <OpsSkinCheckbox
                              checked={allLinesConfirmed}
                              onCheckedChange={() => undefined}
                              disabled={confirmableLineKeys.length === 0}
                            />
                          </span>
                          {allLinesConfirmed ? "Seçimi kaldır" : "Tümünü seç"}
                        </button>
                    </div>
                  </header>

                  <div className="px-4 py-4 sm:px-5">
                    <div className="wms-ops-selected-order-items space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  Kalem detayları · miktar girdikten sonra kutuyu işaretleyin;
                  onaylananlar sırayla üste gelir
                </p>
              </div>
              <div className="space-y-2">
                {orderedLines.map((line) => {
                  const key = lineKey(line);
                  return (
                  <ReceiptEntryRow
                    key={key}
                    line={line}
                    confirmed={confirmedLineOrder.includes(key)}
                    onConfirmedChange={(next) => toggleLineConfirmed(key, next)}
                    updateLine={updateLine}
                    updateTracking={updateTracking}
                    addTracking={addTracking}
                    removeTracking={removeTracking}
                    createSerialRows={createSerialRows}
                    cancelGeneratedSerials={cancelGeneratedSerials}
                  />
                  );
                })}
              </div>

              <Panel
                title="Emir ve işlem ayarları"
                icon={<PackageCheck className="size-5" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {!direct && <Field label={t("documentDate")}>
                    <AppDateInput
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.target.value)}
                    />
                  </Field>}
                  {!direct && <div className="md:col-span-2 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold">
                          {isElectronicReceipt
                            ? "E-irsaliye bilgisi"
                            : "Normal irsaliye bilgisi"}
                          <span className="text-red-500"> *</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          {isElectronicReceipt
                            ? "3 karakter birim kodu + 4 karakter yıl + 9 karakter sıra numarası."
                            : "Normal irsaliye numarası tam 15 rakam olmalıdır."}
                        </p>
                      </div>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-2">
                        <OpsSkinCheckbox
                          checked={isElectronicReceipt}
                          onCheckedChange={(next) => {
                            setIsElectronicReceipt(next);
                            setReceiptNo("");
                            setError(null);
                          }}
                          aria-label="E-irsaliye"
                        />
                        <span className="text-sm font-semibold">E-irsaliye</span>
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field
                        label={
                          isElectronicReceipt
                            ? "E-irsaliye numarası"
                            : "İrsaliye numarası"
                        }
                        errorTarget="receiptNo"
                        errorKeys="irsaliye numarası|e-irsaliye numarası|normal irsaliye"
                      >
                        <AppInput
                          className="font-mono tracking-wider"
                          inputMode="text"
                          maxLength={isElectronicReceipt ? 16 : 15}
                          placeholder={
                            isElectronicReceipt
                              ? "GIB2026AB0000001"
                              : "IRS202600000001"
                          }
                          value={receiptNo}
                          invalid={
                            Boolean(receiptNo) &&
                            !isValidGoodsReceiptDocumentNo(
                              receiptNo,
                              isElectronicReceipt,
                            )
                          }
                          onChange={(event) => {
                            setReceiptNo(
                              normalizeGoodsReceiptDocumentNo(
                                event.target.value,
                                isElectronicReceipt,
                              ),
                            );
                            setError(null);
                          }}
                          trailingContent={
                            <span className="pr-1 text-xs font-bold text-[var(--wms-ops-field-placeholder-fg)]">
                              {receiptNo.length}/{isElectronicReceipt ? 16 : 15}
                            </span>
                          }
                        />
                      </Field>
                      <Field
                        label="İrsaliye tarihi"
                        errorTarget="waybillDate"
                        errorKeys="irsaliye tarihi"
                      >
                        <AppDateInput
                          value={waybillDate}
                          onChange={(event) =>
                            setWaybillDate(event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Mal kabul belge serisi"
                        errorTarget="documentSeries"
                        errorKeys="belge serisi|mal kabul belge serisi"
                      >
                        <AppDropdown
                          value={seriesValue}
                          onValueChange={setSeriesValue}
                          options={series.map((x) => ({
                            value: String(x.id),
                            label: `${x.code} · ${x.name}`,
                            description: x.previewDocumentNumber,
                          }))}
                          placeholder="Belge serisi seçin"
                          searchable
                        />
                      </Field>
                    </div>
                  </div>}
                  {!direct && <Field label={t("plannedArrival")}>
                    <AppDateInput
                      type="datetime-local"
                      value={plannedArrival}
                      onChange={(event) => setPlannedArrival(event.target.value)}
                    />
                  </Field>}
                  {!direct && <Field label={t("priority")}>
                    <AppDropdown
                      value={priority}
                      onValueChange={setPriority}
                      options={[1, 2, 3, 4, 5].map((x) => ({
                        value: String(x),
                        label: String(x),
                      }))}
                    />
                  </Field>}
                  <Field label={t("labelStrategy")}>
                    <AppDropdown
                      value={labelStrategy}
                      onValueChange={setLabelStrategy}
                      options={[
                        { value: "None", label: "Etiket yok" },
                        ...(!direct ? [{ value: "PreGenerate", label: "Önceden üret" }] : []),
                        { value: "SupplierLabel", label: "Tedarikçi etiketi" },
                        { value: "GenerateOnReceipt", label: "Kabulde üret" },
                      ]}
                    />
                  </Field>
                  <Field label={t("description")}>
                    <AppInput
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </Field>
                </div>
                {!direct && <section
                  className="mt-4 rounded-xl border border-[var(--wms-app-border)] p-4"
                  data-wms-error-target="assignees"
                  data-wms-error-keys="operasyon kullanıcısı|emir sorumluları|kullanıcı atan"
                >
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
                </section>}
                <p className="mt-4 text-xs text-slate-500">
                  Siparişteki depo kaleme varsayılan gelir; yetkili kullanıcı kabul
                  deposu ve rafını kalem bazında değiştirebilir. Putaway önerileri
                  yalnızca tercih olarak saklanır; kabul rafını (Receiving/Staging)
                  değiştirmez.
                </p>
                <Footer
                  back={() => {
                    setError(null);
                    setLines([]);
                  }}
                  next={() => void goToConfirmation()}
                  disabled={lines.length === 0 || busy}
                  t={t}
                />
              </Panel>
                    </div>
                  </div>
            </section>
          )}
        </>
      )}

      {step === 1 && (
        <Panel
          title="Kontrol ve oluşturma"
          icon={<CheckCircle2 className="size-5" />}
        >
          {result ? (
            direct && "quantity" in result ? (
              <DirectCreateSuccessPanel
                result={result}
                supplierCode={customer?.code}
                onNew={() => {
                  setResult(null);
                  setStep(0);
                  setLines([]);
                  setSelectedOrders([]);
                  setOrders([]);
                  setReceiptNo("");
                  setIsElectronicReceipt(false);
                  setWaybillDate(today());
                  setError(null);
                }}
              />
            ) : (
            <CreateSuccessPanel
              result={result as CreateGoodsReceiptResult}
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
                setReceiptNo("");
                setIsElectronicReceipt(false);
                setWaybillDate(today());
                setError(null);
              }}
            />)
          ) : (
            <div className="wms-ops-gr-review">
              <dl className="wms-ops-gr-review__list">
                <ReviewRow label="Tedarikçi" value={customer?.code ?? "—"} />
                <ReviewRow
                  label="Sipariş"
                  value={selectedOrders.join(", ") || "—"}
                />
                <ReviewRow
                  label={isElectronicReceipt ? "E-irsaliye" : "İrsaliye"}
                  value={`${receiptNo || "—"} · ${waybillDate || "—"}`}
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
                {!direct && <ReviewRow
                  label="Emir sorumluları"
                  value={assignees.map(userLabel).join(", ") || "—"}
                />}
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
                  ) : null}
                  {direct
                    ? lines.some((line) => line.requireQualityControl)
                      ? "Kaliteye Gönder"
                      : "İrsaliye Oluştur"
                    : t("create")}
                </OpsActionButton>
              </div>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

function ReceiptEntryRow({
  line,
  confirmed,
  onConfirmedChange,
  updateLine,
  updateTracking,
  addTracking,
  removeTracking,
  createSerialRows,
  cancelGeneratedSerials,
}: {
  line: SelectedReceiptLine;
  confirmed: boolean;
  onConfirmedChange: (next: boolean) => void;
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
  const [locationLookupOpen, setLocationLookupOpen] = useState(false);
  const [quantityText, setQuantityText] = useState(
    formatProjectNumber(line.quantity, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }),
  );

  const warehouseCode =
    line.targetWarehouseCode ??
    (line.targetWarehouseValue
      ? Number(line.targetWarehouseValue.split("|")[2]) || undefined
      : undefined);
  const warehouseBadge =
    line.targetWarehouseName && warehouseCode != null
      ? `${line.targetWarehouseName} (${warehouseCode})`
      : line.targetWarehouseName
        ? line.targetWarehouseName
        : warehouseCode != null
          ? `Depo ${warehouseCode}`
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
    <div
      className={cn(
        "wms-ops-receipt-entry-row space-y-3 rounded-xl transition-[box-shadow,border-color,background-color] duration-300",
        confirmed && "wms-ops-receipt-entry-row--confirmed",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">
              {line.stockName || line.stockCode || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="wms-ops-code-badge">{line.stockCode}</span>
              {warehouseBadge ? (
                <>
                  <span>•</span>
                  <span className="wms-ops-code-badge">{warehouseBadge}</span>
                </>
              ) : null}
              <span>•</span>
              <span className="font-mono">{line.siparisNo}</span>
              {line.projectCode ? (
                <>
                  <span>•</span>
                  <span className="font-mono">Proje: {line.projectCode}</span>
                </>
              ) : null}
              <span>•</span>
              <span>
                Kalan:{" "}
                <strong className="text-foreground">
                  {formatProjectNumber(line.availableQuantity ?? line.remainingQuantity ?? 0, {
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

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

        <div className="flex shrink-0 flex-col items-center gap-1 self-start pt-0.5">
          <OpsSkinCheckbox
            checked={confirmed}
            onCheckedChange={onConfirmedChange}
            aria-label={`${line.stockCode ?? line.siparisNo} onayla`}
            title={
              confirmed
                ? "Onayı kaldır"
                : "Miktar girildikten sonra onayla (üste taşınır)"
            }
          />
          <span className="text-[0.58rem] font-semibold uppercase tracking-wider text-[var(--wms-app-text-muted)]">
            {confirmed ? "Onay" : "Hazır"}
          </span>
        </div>
      </div>

      {(suggestionsBusy || suggestions.length > 0 || line.putawayLocationCode) && (
        <div className="mt-2.5 overflow-hidden rounded-xl border border-emerald-500/15 bg-[color-mix(in_oklab,var(--wms-app-panel)_88%,transparent)] shadow-[inset_0_1px_0_color-mix(in_oklab,white_4%,transparent)]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                {suggestionsBusy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-emerald-500/80" aria-hidden />
                )}
                Önerilen Raf
              </span>
              <span className="hidden text-[0.62rem] text-[var(--wms-app-text-muted)] sm:inline">
                İlk öneri otomatik · kabul rafı değildir
              </span>
            </div>
            {line.putawayLocationCode ? (
              <span className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 font-mono text-[0.6rem] text-emerald-700 dark:text-emerald-200">
                <CheckCircle2 className="size-2.5 shrink-0 opacity-80" aria-hidden />
                <span className="truncate">{line.putawayLocationCode}</span>
              </span>
            ) : null}
          </div>

          {suggestions.length > 0 ? (
            <div className="grid gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                      "relative flex flex-col gap-0.5 overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition duration-150",
                      selected
                        ? "border-emerald-500/45 bg-emerald-500/[0.1] shadow-[inset_3px_0_0_0_rgb(16_185_129)]"
                        : "border-transparent bg-black/[0.025] hover:-translate-y-px hover:border-emerald-500/25 hover:bg-emerald-500/[0.05] dark:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono text-[0.58rem] tabular-nums",
                          selected
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-[var(--wms-app-text-muted)]",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate font-mono text-[0.68rem] font-semibold tracking-tight",
                          selected
                            ? "text-emerald-800 dark:text-emerald-50"
                            : "text-[var(--wms-app-text)]",
                        )}
                        title={item.code}
                      >
                        {item.code}
                      </span>
                      {selected ? (
                        <CheckCircle2
                          className="size-3 shrink-0 text-emerald-500"
                          aria-label="Seçili"
                        />
                      ) : index === 0 ? (
                        <span className="shrink-0 text-[0.55rem] font-medium uppercase tracking-wider text-[var(--wms-app-text-muted)]">
                          öneri
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-[1.35rem]">
                      <span
                        className="min-w-0 flex-1 truncate text-[0.6rem] leading-4 text-[var(--wms-app-text-muted)]"
                        title={item.reason}
                      >
                        {item.reason}
                      </span>
                      {item.remainingCapacity != null ? (
                        <span className="shrink-0 rounded bg-black/5 px-1 py-px font-mono text-[0.55rem] text-[var(--wms-app-text-muted)] dark:bg-white/5">
                          {item.remainingCapacity}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
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

function DirectCreateSuccessPanel({
  result,
  supplierCode,
  onNew,
}: {
  result: ManualGoodsReceiptResult;
  supplierCode?: string;
  onNew: () => void;
}): ReactElement {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 via-[var(--wms-app-panel)] to-transparent shadow-sm">
      <div className="border-b border-emerald-500/20 px-8 py-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-9" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Siparişten doğrudan mal kabul
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Mal kabul tamamlandı</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {supplierCode ? `${supplierCode} tedarikçisinin ` : ""}
          seçilen sipariş kalemleri kabul edildi ve sipariş kaynaklarıyla ilişkilendirildi.
        </p>
        <div className="mx-auto mt-5 inline-flex rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Belge No</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">{result.documentNo}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 px-8 py-6 sm:grid-cols-3">
        <SummaryCard label="Satır" value={String(result.lineCount)} />
        <SummaryCard label="Miktar" value={formatProjectNumber(result.quantity)} />
        <SummaryCard label="Durum" value={result.qualityInspectionId ? "Kaliteye gönderildi" : result.status} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-emerald-500/20 px-8 py-5">
        <button type="button" onClick={onNew} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white">Yeni kayıt</button>
        <button type="button" onClick={() => navigate("/warehouse/goods-receipts")} className="rounded-xl border border-emerald-500/40 px-5 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300">Mal kabul listesi</button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): ReactElement {
  return <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center"><div className="text-xs text-slate-500">{label}</div><strong className="mt-1 block text-lg">{value}</strong></div>;
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
  errorTarget,
  errorKeys,
}: {
  label: string;
  children: ReactNode;
  errorTarget?: string;
  errorKeys?: string;
}): ReactElement {
  return (
    <label
      className="space-y-1.5 text-sm"
      data-wms-error-target={errorTarget || undefined}
      data-wms-error-keys={errorKeys || undefined}
    >
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
