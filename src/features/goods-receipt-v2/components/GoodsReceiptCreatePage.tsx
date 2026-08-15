import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ClipboardList,
  Copy,
  Globe,
  Hash,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  PackageOpen,
  Phone,
  ScanBarcode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { CopyableDataCellValue } from "@/components/shared/CopyableDataCellValue";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { StockIdentityCell } from "@/components/shared/StockIdentityCell";
import { StockImagePeekButton } from "@/features/erp-mirror/components/StockImagePeekButton";
import { usePermissionAccess } from "@/features/access-control/hooks/usePermissionAccess";
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
  formatProjectDate,
  formatProjectNumber,
  parseLocalizedNumber,
} from "@/lib/project-format";
import { cn } from "@/lib/utils";
import { isRequestCanceled } from "@/lib/request-utils";
import { navigateToErrorTarget, toastError } from "@/lib/toast-error-navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useProjectSettingsStore } from "@/stores/project-settings-store";
import { OperationDraftRestoreDialog } from "@/features/operation-drafts/OperationDraftRestoreDialog";
import { useOperationDraft } from "@/features/operation-drafts/useOperationDraft";
import type { PagedResponse } from "@/types/api";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import {
  appendDirectLineSearchToken,
  filterVisibleDirectOrderLines,
} from "../utils/direct-order-line-filters";
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
  completeGoodsReceiptDocumentNo,
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "../utils/goods-receipt-document-reference";
import {
  matchesSerialMask,
  maxSerialRowCount,
} from "../utils/serial-mask";
import { GoodsReceiptPostCreateRoutingActions } from "./GoodsReceiptPostCreateRoutingActions";
import { GoodsReceiptStockImageDialog } from "./GoodsReceiptStockImageDialog";

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

async function resolveWarehousesByCode(
  lines: OpenOrderLine[],
  branch: string,
  existing?: ReadonlyMap<number, WarehouseOption>,
): Promise<Map<number, WarehouseOption>> {
  const codes = [
    ...new Set(
      lines
        .map((line) => line.targetWarehouseCode)
        .filter((code): code is number => code != null),
    ),
  ];
  const resolved = new Map<number, WarehouseOption>();
  const missing: number[] = [];
  for (const code of codes) {
    const cached = existing?.get(code);
    if (cached) resolved.set(code, cached);
    else missing.push(code);
  }
  if (missing.length === 0) return resolved;

  const entries = await Promise.all(
    missing.map(async (code) => {
      try {
        const page = await goodsReceiptV2Api.warehouses(
          {
            pageNumber: 1,
            pageSize: 20,
            search: String(code),
            sortBy: "warehouseCode",
            sortDirection: "asc",
            signal: new AbortController().signal,
          },
          branch,
        );
        const warehouse = page.items.find(
          (item) => Number(item.warehouseCode) === Number(code),
        );
        return warehouse ? ([code, warehouse] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  for (const entry of entries) {
    if (entry) resolved.set(entry[0], entry[1]);
  }
  return resolved;
}

function warehouseNamesFromOptions(
  warehouses: ReadonlyMap<number, WarehouseOption>,
): Map<number, string> {
  const names = new Map<number, string>();
  for (const [code, warehouse] of warehouses) {
    const name = warehouse.warehouseName?.trim();
    if (name) names.set(code, name);
  }
  return names;
}

interface GoodsReceiptDirectDraft {
  step: number;
  selectedCustomer: CustomerOption | null;
  projectCodeFilter: string;
  warehouseCodeFilter: string;
  searchTokens: string[];
  orderNumberSearch: string;
  orders: OpenOrderHeader[];
  directOrderLines: OpenOrderLine[];
  selectedDirectLineKeys: string[];
  selectedOrders: string[];
  lines: SelectedReceiptLine[];
  confirmedLineOrder: string[];
  seriesValue: string | null;
  documentDate: string;
  waybillDate: string;
  receiptNo: string;
  isElectronicReceipt: boolean;
  plannedArrival: string;
  priority: string;
  labelStrategy: string;
}

const hasGoodsReceiptDirectDraft = (draft: GoodsReceiptDirectDraft): boolean =>
  Boolean(
    draft.selectedCustomer ||
    draft.receiptNo ||
    draft.orderNumberSearch.trim() ||
    draft.selectedOrders.length ||
    draft.lines.length ||
    draft.searchTokens.length,
  );

function sameLocationId(
  left?: number | string | null,
  right?: number | string | null,
): boolean {
  if (left == null || right == null || left === "") return false;
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

function putawayLocationPatch(location: {
  id: number;
  code: string;
}): Partial<SelectedReceiptLine> {
  return {
    putawayLocationId: location.id,
    putawayLocationCode: location.code,
    receivingLocationId: location.id,
    receivingLocationValue: String(location.id),
    receivingLocationCode: location.code,
  };
}

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
  const userId = useAuthStore((state) => state.user?.id);
  const { can } = usePermissionAccess();
  const canAddStockImage =
    can("ERP.MIRROR.SYNC") ||
    can("WMS.GOODS_RECEIPT.CREATE") ||
    can("WMS.GOODS_RECEIPT.RECEIVE");
  const createEyebrow = `${t("list.eyebrowParent")} / ${t("list.eyebrowModule")}`;
  const [step, setStep] = useState(0);
  const [busyAction, setBusyAction] = useState<
    "orders" | "orderByNumber" | "lines" | "confirm" | "create" | null
  >(null);
  const busy = busyAction != null;
  const loadLinesLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitOverlay, setSubmitOverlay] = useState<{
    mode: "receipt" | "quality";
    phase: "running" | "error";
    message?: string;
  } | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [projectCodeFilter, setProjectCodeFilter] = useState("");
  const [warehouseCodeFilter, setWarehouseCodeFilter] = useState("");
  const [searchTokens, setSearchTokens] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [warehouseByCode, setWarehouseByCode] = useState<Map<number, WarehouseOption>>(
    () => new Map(),
  );
  const warehouseByCodeRef = useRef(warehouseByCode);
  warehouseByCodeRef.current = warehouseByCode;
  const warehouseNameByCode = useMemo(
    () => warehouseNamesFromOptions(warehouseByCode),
    [warehouseByCode],
  );
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  const [orders, setOrders] = useState<OpenOrderHeader[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [directOrderLines, setDirectOrderLines] = useState<OpenOrderLine[]>([]);
  const [selectedDirectLineKeys, setSelectedDirectLineKeys] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [warehouseAccess, setWarehouseAccess] = useState<UserWarehouseAccess | null>(null);
  const [showAllocatedOpenOrderLines, setShowAllocatedOpenOrderLines] = useState(false);
  const [allowAnyActiveLocation, setAllowAnyActiveLocation] = useState(false);
  const [allowManualQualityRouting, setAllowManualQualityRouting] = useState(false);
  const [lines, setLines] = useState<SelectedReceiptLine[]>([]);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [confirmedLineOrder, setConfirmedLineOrder] = useState<string[]>([]);
  const linesListRef = useRef<HTMLDivElement | null>(null);
  const pendingListFlipRef = useRef<Map<string, DOMRect> | null>(null);

  const captureReceiptListFlip = useCallback((): void => {
    const list = linesListRef.current;
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const positions = new Map<string, DOMRect>();
    list.querySelectorAll<HTMLElement>("[data-receipt-line-key]").forEach((el) => {
      const key = el.dataset.receiptLineKey;
      if (key) positions.set(key, el.getBoundingClientRect());
    });
    pendingListFlipRef.current = positions.size > 0 ? positions : null;
  }, []);

  useLayoutEffect(() => {
    const first = pendingListFlipRef.current;
    const list = linesListRef.current;
    pendingListFlipRef.current = null;
    if (!first || !list) return;

    const isPremium = document.documentElement.classList.contains("skin-premium");
    const movers: Array<{ el: HTMLElement; dy: number }> = [];
    list.querySelectorAll<HTMLElement>("[data-receipt-line-key]").forEach((el) => {
      const key = el.dataset.receiptLineKey;
      if (!key) return;
      const prev = first.get(key);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dy = prev.top - next.top;
      if (Math.abs(dy) < 0.5) return;
      movers.push({ el, dy });
    });
    if (movers.length === 0) return;

    if (isPremium) {
      movers.forEach(({ el, dy }) => {
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        el.style.zIndex = "4";
      });
      void list.offsetHeight;
      movers.forEach(({ el }) => {
        el.style.transition = "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
        const onEnd = (event: TransitionEvent) => {
          if (event.propertyName !== "transform") return;
          el.style.transition = "";
          el.style.zIndex = "";
          el.removeEventListener("transitionend", onEnd);
        };
        el.addEventListener("transitionend", onEnd);
      });
      return;
    }

    movers.forEach(({ el, dy }) => {
      el.style.setProperty("--wms-flip-dy", `${dy}px`);
      el.style.zIndex = "5";
      el.classList.add("wms-ops-receipt-entry-row--glitch-flip");
      const onEnd = (event: AnimationEvent) => {
        if (event.animationName !== "wms-ops-receipt-glitch-flip") return;
        el.classList.remove("wms-ops-receipt-entry-row--glitch-flip");
        el.style.removeProperty("--wms-flip-dy");
        el.style.zIndex = "";
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
    });
  }, [confirmedLineOrder]);

  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesValue, setSeriesValue] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [documentDate, setDocumentDate] = useState(today);
  const [waybillDate, setWaybillDate] = useState(today);
  const [receiptNo, setReceiptNo] = useState("");
  const receiptNoInvalid =
    showFieldErrors && !isValidGoodsReceiptDocumentNo(receiptNo);
  const [isElectronicReceipt, setIsElectronicReceipt] = useState(true);
  const [plannedArrival, setPlannedArrival] = useState("");
  const [priority, setPriority] = useState("3");
  const [labelStrategy, setLabelStrategy] = useState("None");
  const [reviewLinesDialog, setReviewLinesDialog] = useState<
    null | "receipt" | "quality"
  >(null);
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
  const supplierSummary = selectedCustomer
    ? `${selectedCustomer.customerName} · ${selectedCustomer.customerCode}`
    : customer?.code ?? "—";
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
      filterVisibleDirectOrderLines(directOrderLines, {
        projectCodeFilter,
        warehouseCodeFilter,
        searchTokens,
        warehouseNameByCode,
      }),
    [
      directOrderLines,
      projectCodeFilter,
      searchTokens,
      warehouseCodeFilter,
      warehouseNameByCode,
    ],
  );
  const directWarehouseOptions = useMemo(() => {
    const options = new Map<number, string>();
    for (const line of directOrderLines) {
      if (line.targetWarehouseCode == null) continue;
      if (options.has(line.targetWarehouseCode)) continue;
      options.set(
        line.targetWarehouseCode,
        warehouseNameByCode.get(line.targetWarehouseCode) ?? "",
      );
    }
    return [...options.entries()].sort((left, right) => left[0] - right[0]);
  }, [directOrderLines, warehouseNameByCode]);
  const projectFilterOptions = useMemo(
    () => [
      { value: "", label: t("createFlow.allProjects") },
      ...directProjectCodes.map((code) => ({ value: code, label: code })),
    ],
    [directProjectCodes, t],
  );
  const warehouseFilterOptions = useMemo(
    () => [
      { value: "", label: t("createFlow.allWarehouses") },
      ...directWarehouseOptions.map(([code, name]) => ({
        value: String(code),
        label: name ? `${code} · ${name}` : String(code),
      })),
    ],
    [directWarehouseOptions, t],
  );
  const hasActiveLineFilters =
    Boolean(projectCodeFilter) ||
    Boolean(warehouseCodeFilter) ||
    searchTokens.length > 0;
  const commitSearchToken = useCallback((): void => {
    setSearchTokens((current) => appendDirectLineSearchToken(current, searchDraft));
    setSearchDraft("");
  }, [searchDraft]);
  const removeSearchToken = useCallback((token: string): void => {
    setSearchTokens((current) => current.filter((item) => item !== token));
  }, []);
  const clearLineFilters = useCallback((): void => {
    setProjectCodeFilter("");
    setWarehouseCodeFilter("");
    setSearchTokens([]);
    setSearchDraft("");
  }, []);
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitSearchToken();
  };
  const confirmedLines = useMemo(
    () => lines.filter((line) => confirmedLineOrder.includes(lineKey(line))),
    [lines, confirmedLineOrder],
  );
  /** ONAY tick’li kalemler — önizleme ve kayıt yalnızca bunlar. */
  const plannedLines = confirmedLines;
  const primaryLine = plannedLines[0] ?? lines[0];
  const hasQualityLines = plannedLines.some(
    (line) => line.qualityRequiredByRule || line.forceQualityControl || line.requireQualityControl,
  );
  const receiptLines = plannedLines.flatMap((line) =>
    line.stockCode
      ? [
          {
            lineKey: lineKey(line),
            stockId: line.stockId,
            stockCode: line.stockCode,
            stockName: line.stockName,
            quantity: line.quantity,
            unitCode: line.unitCode,
            requireQualityControl:
              Boolean(line.qualityRequiredByRule)
              || Boolean(line.forceQualityControl)
              || Boolean(line.requireQualityControl),
            qualityRequiredByRule: Boolean(line.qualityRequiredByRule),
            forcedQuality:
              Boolean(line.forceQualityControl) && !line.qualityRequiredByRule,
            receivingLocationCode: line.receivingLocationCode,
            putawayLocationCode: line.putawayLocationCode,
          },
        ]
      : [],
  );
  const qualityLines = receiptLines.filter((line) => line.requireQualityControl);
  const reviewOrderNumbers = useMemo(() => {
    const source = direct
      ? plannedLines.map((line) => line.siparisNo).filter(Boolean)
      : selectedOrders;
    return [...new Set(source)];
  }, [direct, plannedLines, selectedOrders]);
  const draftPayload = useMemo<GoodsReceiptDirectDraft>(() => ({
    step,
    selectedCustomer,
    projectCodeFilter,
    warehouseCodeFilter,
    searchTokens,
    orderNumberSearch,
    orders,
    directOrderLines,
    selectedDirectLineKeys,
    selectedOrders,
    lines,
    confirmedLineOrder,
    seriesValue,
    documentDate,
    waybillDate,
    receiptNo,
    isElectronicReceipt,
    plannedArrival,
    priority,
    labelStrategy,
  }), [
    confirmedLineOrder, directOrderLines, documentDate, isElectronicReceipt,
    labelStrategy, lines, orderNumberSearch, orders, plannedArrival, priority,
    projectCodeFilter, receiptNo, searchTokens, selectedCustomer,
    selectedDirectLineKeys, selectedOrders, seriesValue, step,
    warehouseCodeFilter, waybillDate,
  ]);
  const restoreDraftPayload = useCallback((draft: GoodsReceiptDirectDraft): void => {
    setStep(Math.min(1, Math.max(0, draft.step ?? 0)));
    setSelectedCustomer(draft.selectedCustomer ?? null);
    setProjectCodeFilter(draft.projectCodeFilter ?? "");
    setWarehouseCodeFilter(draft.warehouseCodeFilter ?? "");
    setSearchTokens(draft.searchTokens ?? []);
    setSearchDraft("");
    setOrderNumberSearch(draft.orderNumberSearch ?? "");
    setOrders(draft.orders ?? []);
    setDirectOrderLines(draft.directOrderLines ?? []);
    setOrdersLoaded(
      (draft.orders?.length ?? 0) > 0 || (draft.directOrderLines?.length ?? 0) > 0,
    );
    setSelectedDirectLineKeys(draft.selectedDirectLineKeys ?? []);
    setSelectedOrders(draft.selectedOrders ?? []);
    setLines(draft.lines ?? []);
    setConfirmedLineOrder(draft.confirmedLineOrder ?? []);
    setSeriesValue(draft.seriesValue ?? null);
    setDocumentDate(draft.documentDate || today());
    setWaybillDate(draft.waybillDate || today());
    setReceiptNo(completeGoodsReceiptDocumentNo(draft.receiptNo ?? ""));
    setIsElectronicReceipt(draft.isElectronicReceipt ?? true);
    setPlannedArrival(draft.plannedArrival ?? "");
    setPriority(draft.priority ?? "3");
    setLabelStrategy(draft.labelStrategy ?? "None");
    setError(null);
  }, []);
  const operationDraft = useOperationDraft({
    operationType: "goods-receipt-direct",
    userId,
    branchCode,
    payload: draftPayload,
    isMeaningful: hasGoodsReceiptDirectDraft,
    onRestore: restoreDraftPayload,
    enabled: direct && !busy && !result,
  });
  const reviewProjectCodes = useMemo(
    () =>
      [
        ...new Set(
          plannedLines
            .map((line) => line.projectCode?.trim())
            .filter((code): code is string => Boolean(code)),
        ),
      ],
    [plannedLines],
  );
  const selectedOrderDatesForReview = useMemo(
    () =>
      [...new Set(plannedLines.map((line) => line.orderDate).filter(Boolean))]
        .map((date) => formatProjectDate(date))
        .join(", "),
    [plannedLines],
  );
  const selectedAvailableQuantity = plannedLines.reduce(
    (sum, line) => sum + Math.max(0, line.availableQuantity ?? 0),
    0,
  );
  const selectedQuantity = plannedLines.reduce((sum, line) => sum + line.quantity, 0);
  const reviewQuantityByUnit = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of plannedLines) {
      const unit = (line.unitCode ?? "").trim() || "—";
      totals.set(unit, (totals.get(unit) ?? 0) + line.quantity);
    }
    return [...totals.entries()]
      .map(([unit, quantity]) => ({ unit, quantity }))
      .sort((left, right) => left.unit.localeCompare(right.unit, "tr-TR"));
  }, [plannedLines]);
  const reviewAvailableByUnit = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of plannedLines) {
      const unit = (line.unitCode ?? "").trim() || "—";
      totals.set(
        unit,
        (totals.get(unit) ?? 0) + Math.max(0, line.availableQuantity ?? 0),
      );
    }
    return [...totals.entries()]
      .map(([unit, quantity]) => ({ unit, quantity }))
      .sort((left, right) => left.unit.localeCompare(right.unit, "tr-TR"));
  }, [plannedLines]);
  const reviewSingleUnit =
    reviewQuantityByUnit.length === 1 ? reviewQuantityByUnit[0] : null;
  const reviewAvailableSingleUnit =
    reviewAvailableByUnit.length === 1 ? reviewAvailableByUnit[0] : null;
  const lineSortOrder = useMemo(() => {
    const order = new Map<string, number>();
    confirmedLineOrder.forEach((key, index) => {
      order.set(key, index);
    });
    lines.forEach((line, index) => {
      const key = lineKey(line);
      if (!order.has(key)) {
        order.set(key, confirmedLineOrder.length + index);
      }
    });
    return order;
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
    if (!direct || directOrderLines.length === 0) return;
    const branch = customer?.branch ?? branchCode;
    let active = true;
    void resolveWarehousesByCode(
      directOrderLines,
      branch,
      warehouseByCodeRef.current,
    ).then((warehouses) => {
      if (!active || warehouses.size === 0) return;
      setWarehouseByCode((current) => {
        let changed = false;
        const next = new Map(current);
        for (const [code, warehouse] of warehouses) {
          const prev = next.get(code);
          if (
            !prev ||
            prev.id !== warehouse.id ||
            prev.warehouseName !== warehouse.warehouseName ||
            prev.defaultGoodsReceiptLocationId !== warehouse.defaultGoodsReceiptLocationId
          ) {
            next.set(code, warehouse);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    return () => {
      active = false;
    };
  }, [branchCode, customer?.branch, direct, directOrderLines]);

  useEffect(() => {
    const availableKeys = new Set(directOrderLines.map((line) => lineKey(line)));
    const visibleKeys = hasActiveLineFilters
      ? new Set(visibleDirectOrderLines.map((line) => lineKey(line)))
      : null;
    setSelectedDirectLineKeys((current) => {
      const next = current.filter((key) => {
        if (!availableKeys.has(key)) return false;
        if (visibleKeys && !visibleKeys.has(key)) return false;
        return true;
      });
      return next.length === current.length ? current : next;
    });
  }, [directOrderLines, hasActiveLineFilters, visibleDirectOrderLines]);

  useEffect(() => {
    let active = true;
    void goodsReceiptV2Api.warehouseAccess()
      .then((access) => { if (active) setWarehouseAccess(access); })
      .catch((cause: Error) => { if (active) report(cause, t("createFlow.errors.warehouseAccessLoadFailed")); });
    void goodsReceiptV2Api.policy(customer?.branch ?? branchCode)
      .then((policy) => {
        if (active) {
          setShowAllocatedOpenOrderLines(policy.showAllocatedOpenOrderLines);
          setAllowAnyActiveLocation(!policy.blockPutawayUntilQualityDecision);
          const manualQualityAllowed = policy.erpQualityGatePolicy === "AnyQualityPlan";
          setAllowManualQualityRouting(manualQualityAllowed);
          if (!manualQualityAllowed) {
            setLines((current) => current.map((line) => line.forceQualityControl
              ? {
                  ...line,
                  forceQualityControl: false,
                  requireQualityControl: Boolean(line.qualityRequiredByRule),
                }
              : line));
          }
        }
      })
      .catch(() => {
        if (active) {
          setShowAllocatedOpenOrderLines(false);
          setAllowAnyActiveLocation(false);
          setAllowManualQualityRouting(false);
        }
      });
    return () => { active = false; };
  }, [branchCode, customer?.branch]);

  useEffect(() => {
    const keys = new Set(lines.map((line) => lineKey(line)));
    setConfirmedLineOrder((current) => {
      const next = current.filter((key) => keys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [lines]);

  const clearCustomerDependent = (): void => {
    setProjectCodeFilter("");
    setWarehouseCodeFilter("");
    setSearchTokens([]);
    setSearchDraft("");
    setWarehouseByCode(new Map());
    setOrders([]);
    setDirectOrderLines([]);
    setOrdersLoaded(false);
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
        t("createFlow.errors.customerMirrorNotFound", { customerCode }),
      );
    return match;
  };

  const loadOrderByNumber = async (): Promise<void> => {
    const orderNumber = orderNumberSearch.trim().toLocaleUpperCase("tr-TR");
    if (!orderNumber) {
      toast.error(t("createFlow.validation.orderNumberRequired"));
      return;
    }
    setBusyAction("orderByNumber");
    setError(null);
    try {
      const fetched = await goodsReceiptV2Api.orderLines(
        undefined,
        branchCode,
        [orderNumber],
        showAllocatedOpenOrderLines,
      );
      const rows = fetched.filter(
        (line) =>
          line.siparisNo.trim().toLocaleUpperCase("tr-TR") === orderNumber,
      );
      if (rows.length === 0)
        throw new Error(t("createFlow.errors.openOrderNotFound", { orderNumber }));

      const customerCodes = [
        ...new Set(
          rows
            .map((line) => line.customerCode?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      if (customerCodes.length !== 1)
        throw new Error(
          t("createFlow.errors.orderCustomerCodeNotFound", { orderNumber }),
        );

      const resolvedCustomer = await findCustomerByCode(customerCodes[0]);
      const groupedOrders = groupOrderLines(rows);
      setSelectedCustomer(resolvedCustomer);
      setProjectCodeFilter("");
      setWarehouseCodeFilter("");
      setSearchTokens([]);
      setSearchDraft("");
      setOrders(groupedOrders);
      setDirectOrderLines(direct ? rows : []);
      setOrdersLoaded(true);
      setSelectedDirectLineKeys([]);
      setSelectedOrders(
        !direct &&
          groupedOrders.length === 1 &&
          canUseOrderWarehouse(groupedOrders[0].targetWarehouseCode)
          ? [groupedOrders[0].siparisNo]
          : [],
      );
      setLines([]);
      if (direct) {
        const warehouses = await resolveWarehousesByCode(
          rows,
          resolvedCustomer.branchCode,
        );
        setWarehouseByCode(warehouses);
      } else {
        setWarehouseByCode(new Map());
      }
      toast.success(
        t("createFlow.toast.orderAndSupplierFetched", {
          orderNumber,
          customerCode: resolvedCustomer.customerCode,
        }),
      );
    } catch (cause) {
      report(cause, t("createFlow.errors.orderNumberSearchFailed"));
    } finally {
      setBusyAction(null);
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
      toast.error(t("createFlow.validation.selectCustomerFirst"));
      return;
    }
    setBusyAction("orders");
    setError(null);
    setSelectedOrders([]);
    setLines([]);
    setConfirmedLineOrder([]);
    setProjectCodeFilter("");
    setWarehouseCodeFilter("");
    setSearchTokens([]);
    setSearchDraft("");
    try {
      if (direct) {
        const allLines = await goodsReceiptV2Api.orderLines(
          customer.code,
          customer.branch,
          [],
          showAllocatedOpenOrderLines,
        );
        const filteredLines = allLines;
        setDirectOrderLines(filteredLines);
        setSelectedDirectLineKeys([]);
        const directOrders = groupOrderLines(filteredLines);
        setOrders(directOrders);
        setOrdersLoaded(true);
        const warehouses = await resolveWarehousesByCode(
          filteredLines,
          customer.branch,
        );
        setWarehouseByCode(warehouses);
        if (
          directOrders.length === 1 &&
          canUseOrderWarehouse(directOrders[0].targetWarehouseCode)
        )
          setSelectedOrders([directOrders[0].siparisNo]);
        return;
      }
      setWarehouseByCode(new Map());
      const rows = await goodsReceiptV2Api.orderHeaders({
        branchCode: customer.branch,
        customerCode: customer.code,
      });
      const filtered = rows;
      setOrders(filtered);
      setOrdersLoaded(true);
      if (filtered.length === 1 && canUseOrderWarehouse(filtered[0].targetWarehouseCode))
        setSelectedOrders([filtered[0].siparisNo]);
    } catch (cause) {
      report(cause, t("createFlow.errors.ordersLoadFailed"));
    } finally {
      setBusyAction(null);
    }
  };

  const loadLines = async (): Promise<void> => {
    if (
      loadLinesLockRef.current ||
      !customer ||
      (direct
        ? selectedDirectLineKeys.length === 0
        : selectedOrders.length === 0)
    )
      return;
    loadLinesLockRef.current = true;
    setBusyAction("lines");
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
          t("createFlow.validation.directLinesMixedWarehouses"),
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
      const stockCodes = [
        ...new Set(
          rows
            .map((x) => x.stockCode?.trim())
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      const yapCodes = [
        ...new Set(
          rows
            .map((x) => x.yapCode?.trim())
            .filter((x): x is string => Boolean(x)),
        ),
      ];

      const [resolvedWarehouses, stockLookups, yapLookups] = await Promise.all([
        resolveWarehousesByCode(rows, customer.branch, warehouseByCodeRef.current),
        Promise.all(
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
              throw new Error(t("createFlow.errors.stockMirrorNotFound", { code }));
            return [code.toLocaleUpperCase("tr-TR"), stock] as const;
          }),
        ),
        Promise.all(
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
              throw new Error(t("createFlow.errors.yapMirrorNotFound", { code }));
            return [code.toLocaleUpperCase("tr-TR"), item.id] as const;
          }),
        ),
      ]);

      if (resolvedWarehouses.size > 0) {
        setWarehouseByCode((current) => {
          const next = new Map(current);
          for (const [code, warehouse] of resolvedWarehouses) next.set(code, warehouse);
          return next;
        });
      }

      const warehouseLookup = new Map<number, WarehouseOption | undefined>(
        warehouseCodes.map((code) => [
          code,
          resolvedWarehouses.get(code) ?? warehouseByCodeRef.current.get(code),
        ]),
      );
      const stockByCode = new Map<string, StockOption>(stockLookups);
      const yapIdByCode = new Map<string, number>(yapLookups);
      const stockIds = [...stockByCode.values()].map((stock) => stock.id);
      const defaultLocationIds = [
        ...new Set(
          [...warehouseLookup.values()]
            .map((warehouse) => Number(warehouse?.defaultGoodsReceiptLocationId))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];
      const [qualityRequirements, trackingPolicyEntries, defaultLocationEntries] =
        await Promise.all([
        goodsReceiptV2Api.qualityRequirements(customer.branch, stockIds),
        Promise.all(
          stockIds.map(async (stockId) => {
            const policy = await goodsReceiptV2Api.trackingPolicy(
              customer.branch,
              stockId,
            );
            return [stockId, policy] as const;
          }),
        ),
        Promise.all(
          defaultLocationIds.map(async (id) => {
            try {
              return [id, await goodsReceiptV2Api.locationById(id)] as const;
            } catch {
              return [id, undefined] as const;
            }
          }),
        ),
      ]);
      const defaultLocationById = new Map(
        defaultLocationEntries.filter(
          (entry): entry is readonly [number, LocationOption] => entry[1] != null,
        ),
      );
      const qualityByStockId = new Map(
        qualityRequirements.stocks.map((requirement) => [
          requirement.stockId,
          requirement.requiresQualityControl,
        ]),
      );
      const trackingByStockId = new Map(trackingPolicyEntries);
      const preparedLines = rows.map((x) => {
            const warehouse =
              x.targetWarehouseCode == null
                ? undefined
                : warehouseLookup.get(x.targetWarehouseCode);
            if (!x.stockCode)
              throw new Error(
                t("createFlow.errors.orderLineStockCodeNotFound", {
                  orderNumber: x.siparisNo,
                  orderId: x.orderId,
                }),
              );
            const stock = stockByCode.get(
              x.stockCode.toLocaleUpperCase("tr-TR"),
            );
            if (!stock)
              throw new Error(
                t("createFlow.errors.stockMirrorNotFound", { code: x.stockCode }),
              );
            if (!stock.unitCode)
              throw new Error(
                t("manual.validation.unitCodeMissing", { code: x.stockCode }),
              );
            const trackingPolicy = trackingByStockId.get(stock.id);
            if (!trackingPolicy)
              throw new Error(
                t("createFlow.errors.stockMirrorNotFound", { code: x.stockCode }),
              );
            const defaultLocationId = warehouse?.defaultGoodsReceiptLocationId;
            const defaultLocation =
              defaultLocationId != null
                ? defaultLocationById.get(Number(defaultLocationId))
                : undefined;
            return {
              ...x,
              stockId: stock.id,
              stockName: x.stockName || stock.stockName,
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
              warehouseDefaultLocationId: defaultLocationId,
              receivingLocationId: defaultLocationId,
              receivingLocationValue:
                defaultLocationId != null ? String(defaultLocationId) : null,
              receivingLocationCode: defaultLocation?.code,
              putawayLocationId: defaultLocation?.id,
              putawayLocationCode: defaultLocation?.code,
              trackingType: trackingPolicy.trackingType,
              trackingPolicy,
              // Serial mask loads lazily when the lot/serial dialog opens.
              serialMaskTemplate: null,
              trackings: [],
              qualityRequiredByRule: qualityByStockId.get(stock.id) === true,
              forceQualityControl: false,
              requireQualityControl: qualityByStockId.get(stock.id) === true,
            };
          });
      setLines(preparedLines);
      setConfirmedLineOrder([]);
      window.requestAnimationFrame(() =>
        document
          .getElementById("goods-receipt-selected-lines")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (cause) {
      report(cause, t("createFlow.errors.orderLinesLoadFailed"));
    } finally {
      loadLinesLockRef.current = false;
      setBusyAction(null);
    }
  };

  const updateLine = useCallback((key: string, patch: Partial<SelectedReceiptLine>): void =>
    setLines((current) => {
      const primaryKey = current[0] ? lineKey(current[0]) : null;
      const primaryWarehouseChanged =
        key === primaryKey &&
        patch.targetWarehouseId != null &&
        patch.targetWarehouseId !== current[0]?.targetWarehouseId;

      return current.map((line) => {
        if (lineKey(line) === key) {
          const warehouseChanged =
            patch.targetWarehouseId != null &&
            patch.targetWarehouseId !== line.targetWarehouseId;
          return {
            ...line,
            ...patch,
            ...(warehouseChanged
              ? {
                  receivingLocationId: undefined,
                  receivingLocationValue: null,
                  receivingLocationCode: undefined,
                  putawayLocationId: undefined,
                  putawayLocationCode: undefined,
                }
              : {}),
          };
        }
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
    }), []);
  const toggleLineConfirmed = useCallback((key: string, next: boolean): void => {
    if (next) {
      const line = linesRef.current.find((item) => lineKey(item) === key);
      if (!line || line.quantity <= 0) {
        toast.error(t("createFlow.validation.enterQuantityFirst"));
        return;
      }
      captureReceiptListFlip();
      setConfirmedLineOrder((current) =>
        current.includes(key) ? current : [...current, key],
      );
      return;
    }
    captureReceiptListFlip();
    setConfirmedLineOrder((current) => current.filter((item) => item !== key));
  }, [captureReceiptListFlip, t]);
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
      toast.error(t("createFlow.validation.noLinesToConfirm"));
      return;
    }
    captureReceiptListFlip();
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
      current.map((line) => {
        if (lineKey(line) !== key) return line;
        const serialMode =
          line.trackingType === "Serial" ||
          line.trackingType === "LotAndSerial";
        if (serialMode) {
          const maxRows = maxSerialRowCount(line.quantity);
          if (maxRows <= 0 || line.trackings.length >= maxRows) {
            toast.error(t("createFlow.validation.serialCountExceedsQuantity"));
            return line;
          }
        }
        return {
          ...line,
          trackings: [
            ...line.trackings,
            {
              localId: crypto.randomUUID(),
              quantity: serialMode
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
        };
      }),
    );
  const removeTracking = (key: string, trackingId: string): void =>
    setLines((current) =>
      current.map((line) => {
        if (lineKey(line) !== key) return line;
        const trackings = line.trackings.filter((x) => x.localId !== trackingId);
        const invalidSerialTrackingIds = (
          line.invalidSerialTrackingIds ?? []
        ).filter((id) => id !== trackingId);
        if (trackings.length === 0 && line.serialGenerationKey) {
          void stockTrackingApi
            .voidGeneratedSerials({
              branchCode: customer?.branch ?? branchCode,
              stockId: line.stockId,
              idempotencyKey: line.serialGenerationKey,
              reason: t("createFlow.audit.autoSerialGenerationCancelled"),
            })
            .catch(() => undefined);
          return {
            ...line,
            trackings,
            invalidSerialTrackingIds,
            serialGenerationKey: undefined,
          };
        }
        return { ...line, trackings, invalidSerialTrackingIds };
      }),
    );
  const createSerialRows = async (key: string): Promise<void> => {
    const line = lines.find((item) => lineKey(item) === key);
    if (!line) return;
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 500
    ) {
      toast.error(t("createFlow.validation.serialQuantityRange"));
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
          reason: t("createFlow.audit.quantityOrSerialPlanChanged"),
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
      toast.success(t("createFlow.toast.serialsGeneratedFromRule", { count: serials.length }));
    } catch (cause) {
      report(cause, t("createFlow.errors.serialsGenerationFailed"));
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
        reason: t("createFlow.audit.autoSerialGenerationCancelled"),
      });
      updateLine(key, { serialGenerationKey: undefined, trackings: [] });
      toast.success(
        t("createFlow.toast.generatedSerialsCancelled"),
      );
    } catch (cause) {
      report(cause, t("createFlow.errors.serialsCancellationFailed"));
    }
  };

  const validatePlan = (): string | null => {
    if (!isValidGoodsReceiptDocumentNo(receiptNo))
      return t(
        isElectronicReceipt
          ? "createFlow.validation.eReceiptNo"
          : "createFlow.validation.receiptNo",
      );
    if (!waybillDate) return t("createFlow.validation.waybillDate");
    if (lines.length === 0) return t("createFlow.validation.linesRequired");
    if (plannedLines.length === 0)
      return t("createFlow.validation.confirmedLinesRequired");
    const warehouseIds = [...new Set(plannedLines.map((line) => line.targetWarehouseId).filter(Boolean))];
    if (warehouseIds.length > 1)
      return t("createFlow.validation.singleWarehouse");
    if (warehouseAccess?.isRestricted && warehouseIds.some((id) => !warehouseAccess.warehouseIds.includes(id!)))
      return t("createFlow.validation.warehouseNotAllowed");
    for (const line of plannedLines) {
      const name = `${line.siparisNo} / ${line.stockCode ?? line.orderId}`;
      if (line.quantity <= 0 || line.quantity > (line.availableQuantity ?? 0))
        return t("createFlow.validation.lineQuantityRange", { name });
      if (!line.targetWarehouseId || !line.receivingLocationId)
        return t("createFlow.validation.lineWarehouseRequired", { name });
      if (line.trackingType === "None") {
        if (line.trackings.length > 0)
          return t("createFlow.validation.lineNoTrackingRows", { name });
        continue;
      }
      if (line.trackings.length === 0)
        return t("createFlow.validation.lineTrackingPlanRequired", { name });
      const total = line.trackings.reduce(
        (sum, x) => sum + Number(x.quantity || 0),
        0,
      );
      if (Math.abs(total - line.quantity) > 0.000001)
        return t("createFlow.validation.lineTrackingTotalMismatch", {
          name,
          total,
          quantity: line.quantity,
        });
      if (
        (line.trackingType === "Serial" ||
          line.trackingType === "LotAndSerial") &&
        line.trackings.some((x) => !x.serialNo?.trim() || x.quantity !== 1)
      )
        return t("createFlow.validation.lineSerialRowInvalid", { name });
      if (
        (line.trackingType === "Lot" || line.trackingType === "LotAndSerial") &&
        line.trackings.some((x) => !x.lotNo?.trim())
      )
        return t("createFlow.validation.lineLotRequired", { name });
      if (
        line.trackingPolicy.requireManufacturingDate &&
        line.trackings.some((x) => !x.manufacturingDate)
      )
        return t("createFlow.validation.lineManufacturingDateRequired", { name });
      if (
        line.trackingPolicy.requireExpirationDate &&
        line.trackings.some((x) => !x.expirationDate)
      )
        return t("createFlow.validation.lineExpirationDateRequired", { name });
      if (
        line.trackingPolicy.serialQuantityRule === "OneSerialPerBaseUnit" &&
        (!Number.isInteger(line.quantity) ||
          line.trackings.length !== line.quantity)
      )
        return t("createFlow.validation.lineSerialCountMismatch", { name });
      const serials = line.trackings
        .map((x) => x.serialNo?.trim())
        .filter(Boolean);
      if (new Set(serials).size !== serials.length)
        return t("createFlow.validation.lineDuplicateSerial", { name });
      if (
        (line.trackingType === "Serial" ||
          line.trackingType === "LotAndSerial") &&
        line.serialMaskTemplate &&
        line.trackings.some(
          (x) =>
            x.serialNo?.trim() &&
            !matchesSerialMask(x.serialNo, line.serialMaskTemplate, {
              stockCode: line.stockCode,
            }),
        )
      )
        return t("createFlow.validation.lineSerialMaskMismatch", {
          name,
          mask: line.serialMaskTemplate,
        });
    }
    if (!seriesValue) return t("createFlow.validation.documentSeries");
    if (!direct && assignees.length === 0)
      return t("createFlow.validation.assigneesRequired");
    return null;
  };

  const surfaceValidationError = (message: string): void => {
    setShowFieldErrors(true);
    setError(message);
    toast.error(message);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => navigateToErrorTarget(message), 100);
    });
  };

  const goToConfirmation = async (): Promise<void> => {
    if (plannedLines.length === 0) {
      surfaceValidationError(t("createFlow.validation.confirmedLinesRequired"));
      return;
    }
    const message = validatePlan();
    if (message) {
      surfaceValidationError(message);
      return;
    }
    setBusyAction("confirm");
    setError(null);
    setShowFieldErrors(false);
    try {
      const requirement = await goodsReceiptV2Api.qualityRequirements(
        customer?.branch ?? branchCode,
        plannedLines.map((line) => line.stockId),
      );
      const qualityByStockId = new Map(
        requirement.stocks.map((stock) => [
          stock.stockId,
          stock.requiresQualityControl,
        ]),
      );
      const confirmedKeys = new Set(confirmedLineOrder);
      setLines((current) =>
        current.map((line) => {
          const key = lineKey(line);
          if (!confirmedKeys.has(key)) return line;
          const byRule = qualityByStockId.get(line.stockId) === true;
          return {
            ...line,
            qualityRequiredByRule: byRule,
            requireQualityControl: byRule || Boolean(line.forceQualityControl),
          };
        }),
      );
      setStep(1);
    } catch (cause) {
      report(cause, t("manual.validation.qualityRulesCheckFailed"));
    } finally {
      setBusyAction(null);
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
      surfaceValidationError(validation);
      return;
    }
    const mode: "receipt" | "quality" =
      direct && hasQualityLines ? "quality" : "receipt";
    setBusyAction("create");
    setError(null);
    setShowFieldErrors(false);
    setSubmitOverlay({ mode, phase: "running" });
    const startedAt = Date.now();
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
        requireQualityControl: hasQualityLines,
        forceQualityControl: false,
        requirePutaway: true,
        priority: direct ? 1 : Number(priority),
        description: null,
        assignedUserIds: direct ? null : assignees.map((user) => user.id),
      };
      const created = direct
        ? await goodsReceiptV2Api.createDirect({
          ...commonPayload,
          executionMode: labelStrategy === "SupplierLabel" ? "SupplierLabel" : "Manual",
          deviceId: null,
          lines: plannedLines.flatMap((line) => {
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
              forceQualityControl:
                Boolean(line.forceQualityControl) && !line.qualityRequiredByRule,
            }));
          }),
        })
        : await goodsReceiptV2Api.create({
          ...commonPayload,
          lines: plannedLines.map((line) => ({
          orderNumber: line.siparisNo,
          orderId: line.orderId,
          quantity: line.quantity,
          targetWarehouseId: line.targetWarehouseId,
          receivingLocationId: line.receivingLocationId,
          trackingType: line.trackingType,
          forceQualityControl:
            Boolean(line.forceQualityControl) && !line.qualityRequiredByRule,
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
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1400) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400 - elapsed));
      }
      setSubmitOverlay(null);
      setResult(created);
      await operationDraft.clearDraft();
      toast.success(`${t("created")}: ${receiptNo}`);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : direct
            ? t("createFlow.errors.directReceiptFailed")
            : t("createFlow.errors.receiptOrderCreationFailed");
      setError(message);
      toast.error(message);
      setSubmitOverlay({ mode, phase: "error", message });
      await new Promise((resolve) => window.setTimeout(resolve, 2600));
      setSubmitOverlay(null);
    } finally {
      setBusyAction(null);
    }
  };

  const report = (cause: unknown, fallback: string): void => {
    if (isRequestCanceled(cause)) return;
    const message = cause instanceof Error ? cause.message : fallback;
    setError(message);
    toast.error(message);
  };
  const steps = [0, 1];
  const toggleOrder = (order: OpenOrderHeader): void => {
    const { siparisNo, targetWarehouseCode } = order;
    if (!selectedOrders.includes(siparisNo) && !canUseOrderWarehouse(targetWarehouseCode)) {
      toast.error(
        t("createFlow.validation.warehouseOrderNotAllowed", {
          code: targetWarehouseCode ?? t("createFlow.validation.unknownWarehouse"),
        }),
      );
      return;
    }
    if (!selectedOrders.includes(siparisNo)
      && selectedOrderWarehouseCode != null
      && targetWarehouseCode !== selectedOrderWarehouseCode) {
      toast.warning(t("createFlow.validation.ordersMixedWarehouses"));
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
        t("createFlow.validation.directLinesMixedWarehousesAutoSelected"),
      );
    }
    setSelectedDirectLineKeys(directSelectAllKeys);
    setLines([]);
  };

  const labelStrategyOptions = useMemo(
    () => [
      { value: "None", label: t("createFlow.labelOptions.none") },
      ...(!direct
        ? [{ value: "PreGenerate", label: t("createFlow.labelOptions.preGenerate") }]
        : []),
      { value: "SupplierLabel", label: t("createFlow.labelOptions.supplierLabel") },
      {
        value: "GenerateOnReceipt",
        label: t("createFlow.labelOptions.generateOnReceipt"),
      },
    ],
    [direct, t],
  );

  const waybillEReceiptToggle = (
    <label className="flex shrink-0 cursor-pointer items-center gap-2.5 self-center rounded-lg border border-[var(--wms-app-border)] px-3 py-1.5">
      <OpsSkinCheckbox
        checked={isElectronicReceipt}
        onCheckedChange={setIsElectronicReceipt}
        aria-label={t("createFlow.waybill.eReceipt")}
      />
      <span className="text-sm font-semibold">{t("createFlow.waybill.eReceipt")}</span>
    </label>
  );

  const waybillLabelStrategyField = (
    <Field label={t("labelStrategy")}>
      <AppDropdown
        value={labelStrategy}
        onValueChange={setLabelStrategy}
        options={labelStrategyOptions}
      />
    </Field>
  );

  if (!moduleReady)
    return (
      <div className="grid min-h-[20rem] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );

  return (
    <section className="wms-ops-form space-y-5">
      <OperationDraftRestoreDialog
        open={operationDraft.restoreDialogOpen}
        operationName={t('operationNames.goodsReceiptDirect')}
        updatedAt={operationDraft.pendingDraft?.updatedAt}
        onRestore={operationDraft.restoreDraft}
        onDiscard={operationDraft.discardDraft}
      />
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
              ? t("createFlow.directSubtitle")
              : t("createFlow.subtitle")}
          </p>
        </header>
      ) : null}

      {!result ? (
        <nav className="wms-ops-create-steps" aria-label={t("createFlow.stepsAriaLabel")}>
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
      ) : null}

      {error && !submitOverlay ? (
        <div className="wms-ops-gr-error" role="alert">
          <span className="wms-ops-gr-error__tag">ERR</span>
          <span className="wms-ops-gr-error__message">{error}</span>
        </div>
      ) : null}

      {!result && step === 1 && hasQualityLines ? (
        <button
          type="button"
          className="wms-ops-gr-review__quality-warn"
          onClick={() => setReviewLinesDialog("quality")}
          aria-label={t("createFlow.review.qualityWarnAria", {
            count: qualityLines.length,
          })}
        >
          <span className="wms-ops-gr-review__quality-warn-icon" aria-hidden>
            <ShieldAlert className="size-5" />
          </span>
          <span className="wms-ops-gr-review__quality-warn-copy">
            <strong className="wms-ops-gr-review__quality-warn-title">
              {t("createFlow.review.qualityWarnTitle")}
            </strong>
            <span className="wms-ops-gr-review__quality-warn-text">
              {t("createFlow.review.qualityWarnText", {
                count: qualityLines.length,
              })}
            </span>
          </span>
        </button>
      ) : null}

      {step === 0 && (
        <>
          <Panel
            title={t("createFlow.orderSelection")}
            icon={<ClipboardList className="size-5" />}
          >
            <div className="wms-ops-order-lookup-grid mb-5">
              <div className="wms-ops-order-lookup">
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
                      getPrimaryLabel={(item) => item.customerName}
                      getSecondaryLabel={(item) => item.customerCode}
                      onSelect={(item) => {
                        const sameCustomer = selectedCustomer?.id === item.id;
                        setSelectedCustomer(item);
                        if (sameCustomer) return;
                        setOrderNumberSearch("");
                        clearCustomerDependent();
                      }}
                    />
                  </div>
                  <OpsActionButton
                    type="button"
                    variant="primary"
                    loading={busyAction === "orders"}
                    disabled={busy || !customer}
                    onClick={() => loadOrders()}
                    className="wms-ops-order-lookup__action shrink-0"
                  >
                    {t("loadOrders")}
                  </OpsActionButton>
                </div>
              </div>

              <div className="wms-ops-order-lookup">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="wms-ops-entry-label">
                    {t("createFlow.orderNo")}
                  </span>
                  <TooltipProvider delayDuration={180}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="wms-ops-order-lookup__help"
                          aria-label={t("createFlow.orderNoHelpAria")}
                        >
                          <CircleHelp className="size-3.5" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={8}
                        className="wms-ops-order-lookup__tooltip !bg-[var(--wms-app-panel)] !text-[var(--wms-app-text)] border-[color-mix(in_oklab,var(--wms-ops-accent)_40%,var(--wms-app-border))]"
                      >
                        {t("createFlow.orderNoTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="wms-ops-order-lookup__row">
                  <div className="wms-ops-order-lookup__field min-w-0 flex-1">
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
                      placeholder={t("createFlow.orderNoPlaceholder")}
                      maxLength={50}
                    />
                  </div>
                  <OpsActionButton
                    type="button"
                    variant="primary"
                    loading={busyAction === "orderByNumber"}
                    disabled={busy || !orderNumberSearch.trim()}
                    onClick={() => loadOrderByNumber()}
                    className="wms-ops-order-lookup__action shrink-0"
                  >
                    {t("createFlow.fetchOrder")}
                  </OpsActionButton>
                </div>
              </div>
            </div>

            {direct && (
              <section className="mb-5 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] px-4 py-3 dark:bg-white/[.025]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-tight">
                      {t("createFlow.waybill.sectionTitle")}
                    </h3>
                    <p className="text-[11px] leading-snug text-slate-500">
                      {t("createFlow.waybill.sectionHint")}
                    </p>
                  </div>
                  {waybillEReceiptToggle}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field
                    label={
                      isElectronicReceipt
                        ? t("createFlow.waybill.eReceiptNumber")
                        : t("createFlow.waybill.receiptNumber")
                    }
                    errorTarget="receiptNo"
                    errorKeys="e-irsaliye / gib|gib numarası|15 alfanümerik|e-dispatch|gib number|15 alphanumeric|alphanumeric characters|dispatch number|irsaliye numarası|e-irsaliye numarası|mal kabul no"
                  >
                    <AppInput
                      className="font-mono tracking-wider"
                      inputMode="text"
                      maxLength={15}
                      placeholder={
                        isElectronicReceipt
                          ? "GIB2026AB000000"
                          : "IRS202600000001"
                      }
                      value={receiptNo}
                      invalid={receiptNoInvalid}
                      onChange={(event) => {
                        setReceiptNo(
                          normalizeGoodsReceiptDocumentNo(event.target.value),
                        );
                        setError(null);
                      }}
                      onBlur={(event) => {
                        setReceiptNo(
                          completeGoodsReceiptDocumentNo(event.target.value),
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        setReceiptNo(
                          completeGoodsReceiptDocumentNo(
                            (event.target as HTMLInputElement).value,
                          ),
                        );
                        (event.target as HTMLInputElement).blur();
                      }}
                      trailingContent={
                        <span className="pr-1 text-xs font-bold text-[var(--wms-ops-field-placeholder-fg)]">
                          {receiptNo.length}/15
                        </span>
                      }
                    />
                    {receiptNoInvalid ? (
                      <p className="mt-1.5 text-xs font-medium text-red-500">
                        {t(
                          isElectronicReceipt
                            ? "createFlow.validation.eReceiptNo"
                            : "createFlow.validation.receiptNo",
                        )}
                      </p>
                    ) : null}
                  </Field>
                  <Field
                    label={t("createFlow.waybill.waybillDate")}
                    errorTarget="waybillDate"
                    errorKeys="irsaliye tarihi|dispatch date|waybill date"
                  >
                    <AppDateInput
                      value={waybillDate}
                      onChange={(event) => setWaybillDate(event.target.value)}
                    />
                  </Field>
                  {waybillLabelStrategyField}
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
                      label={t("createFlow.documentSeries")}
                      errorTarget="documentSeries"
                      errorKeys="belge serisi|mal kabul belge serisi|document series|goods receipt document series"
                    >
                      <AppDropdown
                        value={seriesValue}
                        onValueChange={setSeriesValue}
                        options={series.map((x) => ({
                          value: String(x.id),
                          label: `${x.code} · ${x.name}`,
                          description: x.previewDocumentNumber,
                        }))}
                        placeholder={t("createFlow.selectDocumentSeries")}
                        searchable
                      />
                    </Field>
                  </div>
                </div>
              </section>
            )}

            <div className="wms-ops-order-fetch space-y-4">
              {direct && directOrderLines.length > 0 ? (
                <div className="wms-ops-order-line-filters">
                  <div className="wms-ops-order-line-filters__toolbar">
                    <div className="wms-ops-order-line-filters__search">
                      <label
                        className="wms-ops-entry-label mb-1.5 block"
                        htmlFor="goods-receipt-direct-line-search"
                      >
                        {t("createFlow.lineSearch.label")}
                      </label>
                      <AppInput
                        id="goods-receipt-direct-line-search"
                        type="search"
                        leadingIcon={<Search className="size-4" aria-hidden />}
                        className="font-mono"
                        value={searchDraft}
                        onChange={(event) => setSearchDraft(event.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder={t("createFlow.lineSearch.placeholder")}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {searchTokens.length > 0 ? (
                        <div
                          className="wms-ops-order-line-filters__chips"
                          aria-label={t("createFlow.lineSearch.activeTokens")}
                        >
                          {searchTokens.map((token) => (
                            <span
                              key={token}
                              className="wms-ops-order-line-filters__chip"
                            >
                              <span className="wms-ops-order-line-filters__chip-text">
                                {token}
                              </span>
                              <button
                                type="button"
                                className="wms-ops-order-line-filters__chip-remove"
                                onClick={() => removeSearchToken(token)}
                                aria-label={t("createFlow.lineSearch.removeToken", {
                                  token,
                                })}
                              >
                                <X className="size-3" aria-hidden />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            className="wms-ops-order-line-filters__clear"
                            onClick={() => {
                              setSearchTokens([]);
                              setSearchDraft("");
                            }}
                          >
                            {t("createFlow.lineSearch.clearTokens")}
                          </button>
                        </div>
                      ) : (
                        <p className="wms-ops-order-line-filters__hint">
                          {t("createFlow.lineSearch.hint")}
                        </p>
                      )}
                    </div>

                    <div className="wms-ops-order-line-filters__facets">
                      <div className="wms-ops-order-line-filters__facet">
                        <label className="wms-ops-entry-label mb-1.5 block">
                          {t("createFlow.projectFilter")}
                        </label>
                        <OpsFieldShell>
                          <AppDropdown
                            value={projectCodeFilter}
                            onValueChange={setProjectCodeFilter}
                            options={projectFilterOptions}
                            ariaLabel={t("createFlow.projectFilter")}
                            searchable={directProjectCodes.length > 8}
                            className={cn(
                              OPS_FIELD_CLASS,
                              !projectCodeFilter && "wms-ops-field--placeholder",
                            )}
                          />
                        </OpsFieldShell>
                      </div>
                      <div className="wms-ops-order-line-filters__facet">
                        <label className="wms-ops-entry-label mb-1.5 block">
                          {t("createFlow.warehouseFilter")}
                        </label>
                        <OpsFieldShell>
                          <AppDropdown
                            value={warehouseCodeFilter}
                            onValueChange={setWarehouseCodeFilter}
                            options={warehouseFilterOptions}
                            ariaLabel={t("createFlow.warehouseFilter")}
                            searchable={directWarehouseOptions.length > 8}
                            className={cn(
                              OPS_FIELD_CLASS,
                              !warehouseCodeFilter && "wms-ops-field--placeholder",
                            )}
                          />
                        </OpsFieldShell>
                      </div>
                    </div>
                  </div>

                  <div className="wms-ops-order-line-filters__meta">
                    <span>
                      {t("createFlow.lineSearch.visibleCount", {
                        visible: hasActiveLineFilters
                          ? visibleDirectOrderLines.length
                          : selectedDirectLineKeys.length,
                        total: directOrderLines.length,
                      })}
                    </span>
                    {hasActiveLineFilters ? (
                      <button
                        type="button"
                        className="wms-ops-order-line-filters__reset"
                        onClick={clearLineFilters}
                      >
                        {t("createFlow.lineSearch.resetAll")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {direct && directOrderLines.length > 0 && (
                <div className="wms-ops-order-fetch__table-wrap">
                  <table className="wms-ops-order-fetch__table w-full min-w-[960px] text-left text-xs">
                    <thead>
                      <tr>
                        <th className="w-14 text-center">
                          <OpsSkinCheckbox
                            checked={allDirectLinesSelected}
                            disabled={directSelectAllKeys.length === 0}
                            onCheckedChange={() => toggleAllDirectLines()}
                            aria-label={t("createFlow.table.selectAll")}
                            title={t("createFlow.table.selectAll")}
                          />
                        </th>
                        <th>{t("createFlow.table.orderNo")}</th>
                        <th>{t("createFlow.table.projectCode")}</th>
                        <th>{t("createFlow.table.stockCode")}</th>
                        <th>{t("createFlow.table.stockName")}</th>
                        <th className="wms-ops-order-fetch__qty">
                          {t("createFlow.table.orderQty")}
                        </th>
                        <th className="wms-ops-order-fetch__qty">
                          {t("createFlow.table.remaining")}
                        </th>
                        <th>{t("createFlow.table.targetWarehouse")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDirectOrderLines.length === 0 ? (
                        <tr className="wms-ops-order-fetch__row--empty">
                          <td colSpan={8} className="py-8 text-center">
                            <p className="text-sm text-[var(--wms-app-text-muted)]">
                              {t("createFlow.lineSearch.noMatches")}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        visibleDirectOrderLines.map((line) => {
                        const key = lineKey(line);
                        const checked = selectedDirectLineKeys.includes(key);
                        const unavailable = (line.availableQuantity ?? 0) <= 0;
                        const warehouseDenied = !canUseOrderWarehouse(
                          line.targetWarehouseCode,
                        );
                        const warehouseName =
                          line.targetWarehouseCode != null
                            ? warehouseNameByCode.get(line.targetWarehouseCode)
                            : undefined;
                        const toggle = (): void => {
                          if (unavailable) {
                            toast.error(
                              t("createFlow.validation.lineAvailableQuantityReserved"),
                            );
                            return;
                          }
                          if (warehouseDenied) {
                            toast.error(
                              t("createFlow.validation.lineWarehouseNotAssigned"),
                            );
                            return;
                          }
                          if (
                            !checked &&
                            selectedDirectWarehouseCode != null &&
                            line.targetWarehouseCode !== selectedDirectWarehouseCode
                          ) {
                            toast.warning(
                              t("createFlow.validation.directLinesMixedWarehousesRemoveFirst"),
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
                                aria-label={t("createFlow.selectLineAria", {
                                  orderNumber: line.siparisNo,
                                  stockCode: line.stockCode ?? "",
                                })}
                                title={
                                  unavailable
                                    ? t("createFlow.validation.reservedForActiveOrder")
                                    : warehouseDenied
                                      ? t("createFlow.validation.warehouseNotAssignedToUser")
                                      : undefined
                                }
                              />
                            </td>
                            <td className="font-mono font-semibold">
                              <CopyableDataCellValue
                                label={t("createFlow.table.orderNo")}
                                value={line.siparisNo}
                              />
                            </td>
                            <td className="font-mono">
                              <CopyableDataCellValue
                                label={t("createFlow.table.projectCode")}
                                value={line.projectCode}
                              >
                                {line.projectCode || "—"}
                              </CopyableDataCellValue>
                            </td>
                            <td
                              className="font-mono font-semibold"
                              onClick={(event) => event.stopPropagation()}
                              onContextMenu={(event) => event.stopPropagation()}
                            >
                              <StockIdentityCell
                                stockCode={line.stockCode}
                                stockName={line.stockName}
                                branchCode={customer?.branch ?? branchCode}
                                layout="code"
                              />
                            </td>
                            <td
                              onClick={(event) => event.stopPropagation()}
                              onContextMenu={(event) => event.stopPropagation()}
                            >
                              <StockIdentityCell
                                stockCode={line.stockCode}
                                stockName={line.stockName}
                                branchCode={customer?.branch ?? branchCode}
                                layout="name"
                              />
                            </td>
                            <td className="wms-ops-order-fetch__qty font-mono">
                              <CopyableDataCellValue
                                label={t("createFlow.table.orderQty")}
                                value={formatProjectNumber(line.orderedQuantity ?? 0)}
                              />
                            </td>
                            <td className="wms-ops-order-fetch__qty font-mono">
                              <CopyableDataCellValue
                                label={t("createFlow.table.remaining")}
                                value={formatProjectNumber(
                                  line.availableQuantity ?? line.remainingQuantity ?? 0,
                                )}
                              >
                                {formatProjectNumber(
                                  line.availableQuantity ?? line.remainingQuantity ?? 0,
                                )}
                                {unavailable ? (
                                  <span className="ml-2 whitespace-nowrap text-[10px] text-amber-600">
                                    {t("createFlow.reservedBadge")}
                                  </span>
                                ) : null}
                              </CopyableDataCellValue>
                            </td>
                            <td>
                              <CopyableDataCellValue
                                label={t("createFlow.table.targetWarehouse")}
                                value={
                                  line.targetWarehouseCode
                                    ? `${line.targetWarehouseCode}${warehouseName ? ` · ${warehouseName}` : ""}`
                                    : null
                                }
                              >
                                <span className="font-mono font-semibold">
                                  {line.targetWarehouseCode ?? "—"}
                                </span>
                                {warehouseName ? (
                                  <span className="wms-ops-order-fetch__warehouse-name">
                                    {" "}
                                    · {warehouseName}
                                  </span>
                                ) : null}
                              </CopyableDataCellValue>
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {(direct ? directOrderLines.length === 0 : orders.length === 0) ? (
                <div className="wms-ops-panel-empty py-10 text-center">
                  <PackageOpen className="mx-auto size-8 opacity-50" aria-hidden />
                  <p className="mt-3 text-sm text-[var(--wms-app-text-muted)]">
                    {t(ordersLoaded ? "noOrders" : "ordersIdle")}
                  </p>
                </div>
              ) : !direct ? (
                <div className="wms-ops-order-fetch__table-wrap">
                  <table className="wms-ops-order-fetch__table w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr>
                        <th className="w-14 text-center" />
                        <th>{t("createFlow.table.orderNo")}</th>
                        <th>{t("createFlow.table.projectCode")}</th>
                        <th>{t("createFlow.date")}</th>
                        <th className="wms-ops-order-fetch__qty">{t("createFlow.table.orderQty")}</th>
                        <th className="wms-ops-order-fetch__qty">{t("createFlow.table.remaining")}</th>
                        <th className="wms-ops-order-fetch__qty">{t("available")}</th>
                        <th>{t("createFlow.table.warehouseCode")}</th>
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
                                aria-label={t("createFlow.selectOrderAria", {
                                  orderNumber: order.siparisNo,
                                })}
                                title={
                                  warehouseDenied
                                    ? t("createFlow.validation.warehouseNotAssignedToUser")
                                    : undefined
                                }
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

              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pt-1">
                <p className="text-xs text-[var(--wms-app-text-muted)]">
                  {direct
                    ? t("createFlow.selectedDirectLinesCount", {
                        count: selectedDirectLineKeys.length,
                      })
                    : t("createFlow.selectedOrdersCount", {
                        count: selectedOrders.length,
                      })}
                </p>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  loading={busyAction === "lines"}
                  disabled={
                    (direct
                      ? selectedDirectLineKeys.length === 0
                      : selectedOrders.length === 0) || busy
                  }
                  onClick={() => loadLines()}
                >
                  {direct ? t("createFlow.prepareSelectedLines") : t("loadLines")}
                </OpsActionButton>
              </div>
            </div>
          </Panel>

          {lines.length > 0 && (
            <>
            <section
              id="goods-receipt-selected-lines"
              className="wms-ops-receipt-selected-lines scroll-mt-5 overflow-visible rounded-2xl"
              data-wms-error-target="selectedLines"
              data-wms-error-scope="container"
              data-wms-error-keys="tek depo|seçilen depo|single warehouse|selected warehouse|kalem hazır|hazır olarak işaretlen|en az bir kalem|onay ile seç|mark at least one line|as ready before|confirm at least one line|with onay"
            >
                  <header className="wms-ops-receipt-selected-lines__header px-5 py-4">
                    <div className="wms-ops-receipt-selected-lines__title-row">
                      <h2 className="wms-ops-receipt-selected-lines__title text-xl font-black">
                        {t("createFlow.selectedLines.title")}
                      </h2>
                      <div className="wms-ops-receipt-selected-lines__stats" aria-label={t("createFlow.selectedLines.title")}>
                        <span className="wms-ops-receipt-selected-lines__stat wms-ops-receipt-selected-lines__stat--accent">
                          <span className="wms-ops-receipt-selected-lines__stat-label">
                            {t("createFlow.selectedLines.lineCount", { count: lines.length })}
                          </span>
                        </span>
                        <span className="wms-ops-receipt-selected-lines__stat wms-ops-receipt-selected-lines__stat--qty">
                          <span className="wms-ops-receipt-selected-lines__stat-value font-mono">
                            {formatProjectNumber(selectedQuantity)}
                          </span>
                        </span>
                        {confirmedLineOrder.length > 0 ? (
                          <span className="wms-ops-receipt-selected-lines__stat wms-ops-receipt-selected-lines__stat--confirmed">
                            <span className="wms-ops-receipt-selected-lines__stat-label">
                              {t("createFlow.selectedLines.selectedCount", {
                                count: confirmedLineOrder.length,
                              })}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
                      {t("createFlow.selectedLines.description")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={toggleAllLinesConfirmed}
                        disabled={confirmableLineKeys.length === 0}
                        className={cn(
                          "wms-ops-receipt-selected-lines__select-all inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                          allLinesConfirmed && "wms-ops-receipt-selected-lines__select-all--active",
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
                        {allLinesConfirmed
                          ? t("createFlow.selectedLines.clearSelection")
                          : t("createFlow.selectedLines.selectAll")}
                      </button>
                    </div>
                  </header>

                  <div className="wms-ops-receipt-selected-lines__body px-4 py-4 sm:px-5">
                    <div className="wms-ops-selected-order-items space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="wms-ops-receipt-selected-lines__hint text-xs">
                  {t("createFlow.selectedLines.detailsHint")}
                </p>
              </div>
              <div ref={linesListRef} className="wms-ops-receipt-lines-list">
                {lines.map((line) => {
                  const key = lineKey(line);
                  return (
                  <ReceiptEntryRow
                    key={key}
                    allowAnyActiveLocation={
                      allowAnyActiveLocation || !line.requireQualityControl
                    }
                    dataLineKey={key}
                    sortOrder={lineSortOrder.get(key) ?? 0}
                    line={line}
                    branchCode={customer?.branch ?? branchCode}
                    canAddStockImage={canAddStockImage}
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

              {direct ? (
                <p className="text-xs text-slate-500">
                  {t("createFlow.warehouseHint")}
                </p>
              ) : (
              <Panel
                title={t("createFlow.taskSettings")}
                icon={<PackageCheck className="size-5" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("documentDate")}>
                    <AppDateInput
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.target.value)}
                    />
                  </Field>
                  <div className="md:col-span-2 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] px-4 py-3 dark:bg-white/[.025]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold leading-tight">
                          {isElectronicReceipt
                            ? t("createFlow.waybill.eReceiptInfo")
                            : t("createFlow.waybill.normalReceiptInfo")}
                          <span className="text-red-500"> *</span>
                        </h3>
                        <p className="text-[11px] leading-snug text-slate-500">
                          {isElectronicReceipt
                            ? t("createFlow.waybill.eReceiptHint")
                            : t("createFlow.waybill.normalReceiptHint")}
                        </p>
                      </div>
                      {waybillEReceiptToggle}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field
                        label={
                          isElectronicReceipt
                            ? t("createFlow.waybill.eReceiptNumber")
                            : t("createFlow.waybill.receiptNumber")
                        }
                        errorTarget="receiptNo"
                        errorKeys="e-irsaliye / gib|gib numarası|15 alfanümerik|e-dispatch|gib number|15 alphanumeric|alphanumeric characters|dispatch number|irsaliye numarası|e-irsaliye numarası|mal kabul no"
                      >
                        <AppInput
                          className="font-mono tracking-wider"
                          inputMode="text"
                          maxLength={15}
                          placeholder={
                            isElectronicReceipt
                              ? "GIB2026AB000000"
                              : "IRS202600000001"
                          }
                          value={receiptNo}
                          invalid={receiptNoInvalid}
                          onChange={(event) => {
                            setReceiptNo(
                              normalizeGoodsReceiptDocumentNo(event.target.value),
                            );
                            setError(null);
                          }}
                          onBlur={() =>
                            setReceiptNo(completeGoodsReceiptDocumentNo(receiptNo))
                          }
                          trailingContent={
                            <span className="pr-1 text-xs font-bold text-[var(--wms-ops-field-placeholder-fg)]">
                              {receiptNo.length}/15
                            </span>
                          }
                        />
                        {receiptNoInvalid ? (
                          <p className="mt-1.5 text-xs font-medium text-red-500">
                            {t(
                              isElectronicReceipt
                                ? "createFlow.validation.eReceiptNo"
                                : "createFlow.validation.receiptNo",
                            )}
                          </p>
                        ) : null}
                      </Field>
                      <Field
                        label={t("createFlow.waybill.waybillDate")}
                        errorTarget="waybillDate"
                        errorKeys="irsaliye tarihi|dispatch date|waybill date"
                      >
                        <AppDateInput
                          value={waybillDate}
                          onChange={(event) =>
                            setWaybillDate(event.target.value)
                          }
                        />
                      </Field>
                      {waybillLabelStrategyField}
                      <Field
                        label={t("createFlow.documentSeries")}
                        errorTarget="documentSeries"
                        errorKeys="belge serisi|mal kabul belge serisi|document series|goods receipt document series"
                      >
                        <AppDropdown
                          value={seriesValue}
                          onValueChange={setSeriesValue}
                          options={series.map((x) => ({
                            value: String(x.id),
                            label: `${x.code} · ${x.name}`,
                            description: x.previewDocumentNumber,
                          }))}
                          placeholder={t("createFlow.selectDocumentSeries")}
                          searchable
                        />
                      </Field>
                    </div>
                  </div>
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
                </div>
                <section
                  className="mt-4 rounded-xl border border-[var(--wms-app-border)] p-4"
                  data-wms-error-target="assignees"
                  data-wms-error-keys="operasyon kullanıcısı|emir sorumluları|kullanıcı atan|operation user|task assignees|assignees required|at least one operation user"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <UserRoundCog className="mt-0.5 size-5 text-cyan-500" />
                    <div>
                      <h3 className="font-bold">
                        {t("createFlow.assignees.title")}{" "}
                        <span className="text-red-500">*</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("createFlow.assignees.hint")}
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
                    placeholder={t("createFlow.assignees.addPlaceholder")}
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
                          aria-label={t("createFlow.assignees.removeAria", {
                            name: userLabel(user),
                          })}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    {assignees.length === 0 && (
                      <span className="text-xs text-amber-500">
                        {t("createFlow.assignees.empty")}
                      </span>
                    )}
                  </div>
                </section>
                <p className="mt-4 text-xs text-slate-500">
                  {t("createFlow.warehouseHint")}
                </p>
              </Panel>
              )}
                    </div>
                  </div>
            </section>
            </>
          )}

            {(direct
              ? selectedDirectLineKeys.length > 0
              : selectedOrders.length > 0) ? (
              <Footer
                back={() => {
                  setError(null);
                  setLines([]);
                }}
                next={() => goToConfirmation()}
                disabled={busy}
                loading={busyAction === "confirm"}
                t={t}
              />
            ) : null}
        </>
      )}

      {step === 1 && (
        <Panel
          title={t("createFlow.steps.1")}
          icon={<CheckCircle2 className="size-5" />}
        >
          {result ? (
            direct && "quantity" in result ? (
              <DirectCreateSuccessPanel
                result={result}
                supplierName={selectedCustomer?.customerName}
                supplierCode={customer?.code}
                receiptNo={receiptNo}
                isElectronicReceipt={isElectronicReceipt}
                receiptLines={receiptLines}
                qualityLines={qualityLines}
                onNew={() => {
                  setResult(null);
                  setStep(0);
                  setLines([]);
                  setSelectedOrders([]);
                  setOrders([]);
                  setDirectOrderLines([]);
                  setOrdersLoaded(false);
                  setReceiptNo("");
                  setWaybillDate(today());
                  setError(null);
                }}
              />
            ) : (
            <CreateSuccessPanel
              result={result as CreateGoodsReceiptResult}
              supplierCode={supplierSummary}
              assigneeCount={assignees.length}
              receiptNo={receiptNo}
              isElectronicReceipt={isElectronicReceipt}
              receiptLines={receiptLines}
              qualityLines={qualityLines}
              onNew={() => {
                setResult(null);
                setStep(0);
                setLines([]);
                setSelectedOrders([]);
                setOrders([]);
                setDirectOrderLines([]);
                setOrdersLoaded(false);
                setAssignees([]);
                setReceiptNo("");
                setWaybillDate(today());
                setError(null);
              }}
            />)
          ) : submitOverlay ? (
            <CreateSubmitScreen
              mode={submitOverlay.mode}
              phase={submitOverlay.phase}
              errorMessage={submitOverlay.message}
              lineCount={plannedLines.length}
              supplierName={selectedCustomer?.customerName}
              receiptNo={receiptNo}
            />
          ) : (
            <div className="wms-ops-gr-review">
              <div className="wms-ops-gr-review__list">
                <div className="wms-ops-gr-review__hero">
                  <section className="wms-ops-gr-review__hero-card wms-ops-gr-review__hero-card--supplier">
                    <div className="wms-ops-gr-review__hero-supplier-body">
                      <div className="wms-ops-gr-review__hero-title">
                        {selectedCustomer?.customerName || "—"}
                      </div>
                      <div className="wms-ops-gr-review__hero-meta">
                        {t("createFlow.review.customerCode")}:{" "}
                        <strong className="wms-ops-gr-review__hero-meta-code">
                          {selectedCustomer?.customerCode || customer?.code || "—"}
                        </strong>
                      </div>
                      <div className="wms-ops-gr-review__supplier-details">
                        <div className="wms-ops-gr-review__supplier-band">
                          <div className="wms-ops-gr-review__supplier-field">
                            <span className="wms-ops-gr-review__supplier-label">
                              <MapPin className="size-3.5" aria-hidden />
                              {t("createFlow.review.city")}
                            </span>
                            <strong className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip">
                              {selectedCustomer?.city?.trim() || "—"}
                            </strong>
                          </div>
                          <div className="wms-ops-gr-review__supplier-field">
                            <span className="wms-ops-gr-review__supplier-label">
                              <MapPin className="size-3.5" aria-hidden />
                              {t("createFlow.review.district")}
                            </span>
                            <strong className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip">
                              {selectedCustomer?.district?.trim() || "—"}
                            </strong>
                          </div>
                        </div>
                        <div className="wms-ops-gr-review__supplier-band wms-ops-gr-review__supplier-band--solo">
                          <div className="wms-ops-gr-review__supplier-field wms-ops-gr-review__supplier-field--full">
                            <span className="wms-ops-gr-review__supplier-label">
                              <MapPin className="size-3.5" aria-hidden />
                              {t("createFlow.review.address")}
                            </span>
                            {selectedCustomer?.address?.trim() ? (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <strong
                                      className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip"
                                      tabIndex={0}
                                    >
                                      {selectedCustomer.address.trim()}
                                    </strong>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-[min(28rem,90vw)] text-left"
                                  >
                                    {selectedCustomer.address.trim()}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <strong className="wms-ops-gr-review__supplier-value">—</strong>
                            )}
                          </div>
                        </div>
                        <div className="wms-ops-gr-review__supplier-band wms-ops-gr-review__supplier-band--triple wms-ops-gr-review__supplier-band--last">
                          <div className="wms-ops-gr-review__supplier-field">
                            <span className="wms-ops-gr-review__supplier-label">
                              <Phone className="size-3.5" aria-hidden />
                              {t("createFlow.review.phone")}
                            </span>
                            <strong className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip">
                              {selectedCustomer?.phone1?.trim() || "—"}
                            </strong>
                          </div>
                          <div className="wms-ops-gr-review__supplier-field">
                            <span className="wms-ops-gr-review__supplier-label">
                              <Mail className="size-3.5" aria-hidden />
                              {t("createFlow.review.email")}
                            </span>
                            <strong className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip">
                              {selectedCustomer?.email?.trim() ? (
                                <a
                                  className="wms-ops-gr-review__supplier-link"
                                  href={`mailto:${selectedCustomer.email.trim()}`}
                                  title={selectedCustomer.email.trim()}
                                >
                                  {selectedCustomer.email.trim()}
                                </a>
                              ) : (
                                "—"
                              )}
                            </strong>
                          </div>
                          <div className="wms-ops-gr-review__supplier-field">
                            <span className="wms-ops-gr-review__supplier-label">
                              <Globe className="size-3.5" aria-hidden />
                              {t("createFlow.review.website")}
                            </span>
                            <strong className="wms-ops-gr-review__supplier-value wms-ops-gr-review__supplier-value--clip">
                              {selectedCustomer?.website?.trim() ? (
                                <a
                                  className="wms-ops-gr-review__supplier-link"
                                  href={
                                    /^https?:\/\//i.test(selectedCustomer.website.trim())
                                      ? selectedCustomer.website.trim()
                                      : `https://${selectedCustomer.website.trim()}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  title={selectedCustomer.website.trim()}
                                >
                                  {selectedCustomer.website.trim()}
                                </a>
                              ) : (
                                "—"
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="wms-ops-gr-review__hero-card wms-ops-gr-review__hero-card--meta">
                    <div className="wms-ops-gr-review__hero-head">
                      <span className="wms-ops-gr-review__hero-icon">
                        <ClipboardList className="size-4" />
                      </span>
                      <span className="wms-ops-gr-review__hero-label">{t("createFlow.review.orderInfoCard")}</span>
                    </div>
                    <div className="wms-ops-gr-review__meta-list">
                      <div className="wms-ops-gr-review__meta-item">
                        <span className="wms-ops-gr-review__meta-label">
                          <ClipboardList className="size-3.5" />{" "}
                          {isElectronicReceipt
                            ? t("createFlow.waybill.eReceipt")
                            : t("createFlow.review.waybill")}
                        </span>
                        <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--receipt">
                          {receiptNo || "—"}
                        </strong>
                      </div>
                      <div className="wms-ops-gr-review__meta-item">
                        <span className="wms-ops-gr-review__meta-label">
                          <CalendarDays className="size-3.5" /> {t("createFlow.waybill.waybillDate")}
                        </span>
                        <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--date">
                          {waybillDate || "—"}
                        </strong>
                      </div>
                      <div className="wms-ops-gr-review__meta-item">
                        <span className="wms-ops-gr-review__meta-label">
                          <PackageOpen className="size-3.5" /> {t("createFlow.table.orderNo")}
                        </span>
                        <ReviewMultiListValue
                          values={reviewOrderNumbers}
                          t={t}
                          valueClassName="wms-ops-gr-review__meta-value--order"
                          multipleLabelKey="createFlow.review.multipleOrders"
                          multipleCountKey="createFlow.review.multipleOrdersCount"
                          tooltipHintKey="createFlow.review.ordersTooltipHint"
                        />
                      </div>
                      {direct ? (
                        <>
                          <div className="wms-ops-gr-review__meta-item">
                            <span className="wms-ops-gr-review__meta-label">
                              <Building2 className="size-3.5" /> {t("createFlow.entryRow.project")}
                            </span>
                            <ReviewMultiListValue
                              values={reviewProjectCodes}
                              t={t}
                              valueClassName="wms-ops-gr-review__meta-value--project"
                              multipleLabelKey="createFlow.review.multipleProjects"
                              multipleCountKey="createFlow.review.multipleProjectsCount"
                              tooltipHintKey="createFlow.review.projectsTooltipHint"
                            />
                          </div>
                          <div className="wms-ops-gr-review__meta-item">
                            <span className="wms-ops-gr-review__meta-label">
                              <CalendarDays className="size-3.5" /> {t("createFlow.review.orderDate")}
                            </span>
                            <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--date">
                              {selectedOrderDatesForReview || "—"}
                            </strong>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="wms-ops-gr-review__metrics">
                  <div className="wms-ops-gr-review__section-title">{t("createFlow.review.summaryTitle")}</div>
                  <div className="wms-ops-gr-review__metric-grid">
                    <ReviewMetricCard
                      variant="lines"
                      icon={<PackageOpen className="size-4" />}
                      label={t("createFlow.review.linesAndQuantity")}
                      value={
                        <span className="wms-ops-gr-review__metric-card-inline">
                          <span className="wms-ops-gr-review__metric-card-inline-item">
                            <span className="wms-ops-gr-review__metric-card-stack-num">
                              {plannedLines.length}
                            </span>
                            <span className="wms-ops-gr-review__metric-card-stack-unit">
                              {t("createFlow.review.metricLineUnit")}
                            </span>
                          </span>
                          <span className="wms-ops-gr-review__metric-card-inline-sep" aria-hidden>
                            ·
                          </span>
                          <span className="wms-ops-gr-review__metric-card-inline-item">
                            <span className="wms-ops-gr-review__metric-card-stack-num">
                              {formatProjectNumber(selectedQuantity, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 6,
                              })}
                            </span>
                            <span className="wms-ops-gr-review__metric-card-stack-unit">
                              {reviewSingleUnit
                                ? reviewSingleUnit.unit
                                : t("createFlow.review.metricQuantityUnit")}
                            </span>
                          </span>
                          {!reviewSingleUnit && reviewQuantityByUnit.length > 1 ? (
                            <ReviewUnitBreakdownBadge
                              count={reviewQuantityByUnit.length}
                              entries={reviewQuantityByUnit}
                              countLabel={t("createFlow.review.metricUnitCount", {
                                count: reviewQuantityByUnit.length,
                              })}
                            />
                          ) : null}
                        </span>
                      }
                      hint={t("createFlow.review.metricLinesHint")}
                      note={
                        allowManualQualityRouting
                          ? t("createFlow.review.metricLinesQualityNote")
                          : undefined
                      }
                      onClick={() => setReviewLinesDialog("receipt")}
                    />
                    {direct ? (
                      <ReviewMetricCard
                        variant="available"
                        icon={<Hash className="size-4" />}
                        label={t("createFlow.review.orderAvailableQuantity")}
                        value={
                          <span className="wms-ops-gr-review__metric-card-inline">
                            <span className="wms-ops-gr-review__metric-card-inline-item">
                              <span className="wms-ops-gr-review__metric-card-stack-num">
                                {formatProjectNumber(selectedAvailableQuantity, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 6,
                                })}
                              </span>
                              <span className="wms-ops-gr-review__metric-card-stack-unit">
                                {reviewAvailableSingleUnit
                                  ? reviewAvailableSingleUnit.unit
                                  : t("createFlow.review.metricQuantityUnit")}
                              </span>
                            </span>
                            {!reviewAvailableSingleUnit &&
                            reviewAvailableByUnit.length > 1 ? (
                              <ReviewUnitBreakdownBadge
                                count={reviewAvailableByUnit.length}
                                entries={reviewAvailableByUnit}
                                countLabel={t("createFlow.review.metricUnitCount", {
                                  count: reviewAvailableByUnit.length,
                                })}
                              />
                            ) : null}
                          </span>
                        }
                        hint={
                          Math.abs(selectedQuantity - selectedAvailableQuantity) > 1e-6
                            ? t("createFlow.review.metricAvailableHint", {
                                accepted: `${formatProjectNumber(selectedQuantity, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 6,
                                })}${reviewSingleUnit ? ` ${reviewSingleUnit.unit}` : ""}`,
                              })
                            : undefined
                        }
                      />
                    ) : (
                      <ReviewMetricCard
                        variant="available"
                        icon={<ClipboardList className="size-4" />}
                        label={t("createFlow.assignees.title")}
                        value={
                          assignees.length > 0
                            ? String(assignees.length)
                            : "—"
                        }
                        hint={
                          assignees.length > 0
                            ? assignees.map(userLabel).join(", ")
                            : undefined
                        }
                      />
                    )}
                    <ReviewMetricCard
                      variant={hasQualityLines ? "quality" : "quality-none"}
                      icon={<ShieldCheck className="size-4" />}
                      label={t("createFlow.review.metricQualityLabel")}
                      value={
                        <span className="wms-ops-gr-review__metric-card-inline">
                          <span className="wms-ops-gr-review__metric-card-inline-item">
                            <span className="wms-ops-gr-review__metric-card-stack-num">
                              {qualityLines.length}
                            </span>
                            <span className="wms-ops-gr-review__metric-card-stack-unit">
                              {t("createFlow.review.metricLineUnit")}
                            </span>
                          </span>
                        </span>
                      }
                      hint={
                        hasQualityLines
                          ? t("createFlow.review.metricQualityHint")
                          : t("createFlow.review.metricQualityHintEmpty")
                      }
                      onClick={() =>
                        setReviewLinesDialog(hasQualityLines ? "quality" : "receipt")
                      }
                    />
                  </div>
                </div>
              </div>

              <QualityLinesDialog
                lines={receiptLines}
                open={reviewLinesDialog === "receipt"}
                onClose={() => setReviewLinesDialog(null)}
                tone="receipt"
                title={t("createFlow.qualityDialog.receiptLinesTitle")}
                description={allowManualQualityRouting
                  ? t("createFlow.qualityDialog.receiptLinesDescription")
                  : t("createFlow.qualityDialog.manualQualityDisabledDescription")}
                searchAriaLabel={t("createFlow.qualityDialog.receiptLinesSearchAria")}
                onConfirmForceQuality={allowManualQualityRouting ? (selectedKeys) => {
                  const selected = new Set(selectedKeys);
                  setLines((current) =>
                    current.map((line) => {
                      if (line.qualityRequiredByRule) {
                        return {
                          ...line,
                          forceQualityControl: false,
                          requireQualityControl: true,
                        };
                      }
                      if (selected.has(lineKey(line))) {
                        return {
                          ...line,
                          forceQualityControl: true,
                          requireQualityControl: true,
                        };
                      }
                      return line;
                    }),
                  );
                  setReviewLinesDialog(null);
                } : undefined}
                onRemoveForcedQuality={allowManualQualityRouting ? (key) => {
                  setLines((current) =>
                    current.map((line) => {
                      if (lineKey(line) !== key) return line;
                      if (line.qualityRequiredByRule) return line;
                      return {
                        ...line,
                        forceQualityControl: false,
                        requireQualityControl: false,
                      };
                    }),
                  );
                } : undefined}
              />
              <QualityLinesDialog
                lines={qualityLines}
                open={reviewLinesDialog === "quality"}
                onClose={() => setReviewLinesDialog(null)}
                tone="quality"
                title={t("createFlow.qualityDialog.title")}
                description={t("createFlow.qualityDialog.description")}
                onRemoveForcedQuality={allowManualQualityRouting ? (key) => {
                  setLines((current) =>
                    current.map((line) => {
                      if (lineKey(line) !== key) return line;
                      if (line.qualityRequiredByRule) return line;
                      return {
                        ...line,
                        forceQualityControl: false,
                        requireQualityControl: false,
                      };
                    }),
                  );
                } : undefined}
              />
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
                  loading={busyAction === "create"}
                  disabled={busy}
                  onClick={() => create()}
                >
                  {direct
                    ? hasQualityLines
                      ? t("createFlow.sendToQuality")
                      : t("createFlow.createDirect")
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

function isPieceUnit(unitCode?: string | null): boolean {
  const normalized = (unitCode ?? "").trim().toLocaleUpperCase("tr-TR");
  return (
    normalized === "AD" ||
    normalized === "ADET" ||
    normalized === "ADETİ" ||
    normalized === "PCS" ||
    normalized === "PC" ||
    normalized === "EA"
  );
}

/** Count significant fractional digits from a numeric value (e.g. 4.499 → 3). */
function countFractionDigits(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const fixed = Math.abs(value).toFixed(6).replace(/0+$/, "");
  const dot = fixed.indexOf(".");
  return dot < 0 ? 0 : fixed.length - dot - 1;
}

/**
 * Step for qty spinner:
 * - AD/adet → 1
 * - GR/KG/etc → always decimal (default 0.001), never +1 even if kalan looks whole
 *   (tr-TR "4.499" is thousands for 4499 — still step by project/unit precision)
 */
function receiptQuantityStep(
  unitCode: string | null | undefined,
  ...values: Array<number | null | undefined>
): { step: number; places: number } {
  if (isPieceUnit(unitCode)) return { step: 1, places: 0 };

  let places = 0;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    places = Math.max(places, countFractionDigits(value));
  }

  const settingsPlaces =
    useProjectSettingsStore.getState().settings?.decimalPlaces ?? 2;
  const normalized = (unitCode ?? "").trim().toLocaleUpperCase("tr-TR");
  const weightLike =
    normalized === "GR" ||
    normalized === "G" ||
    normalized === "KG" ||
    normalized === "MG" ||
    normalized === "TON" ||
    normalized === "TN" ||
    normalized === "LT" ||
    normalized === "L" ||
    normalized === "ML";
  // GR etc. always at least 3 decimals (0.001); other non-piece use project settings.
  const fallback = weightLike ? Math.max(3, settingsPlaces) : Math.max(1, settingsPlaces);
  places = Math.min(6, Math.max(places, fallback));

  return { step: 10 ** -places, places };
}

function roundReceiptQuantity(value: number, places: number): number {
  if (places <= 0) return Math.round(value);
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatReceiptQuantity(
  value: number,
  unitCode?: string | null,
  fractionDigits?: number,
): string {
  if (isPieceUnit(unitCode)) {
    return formatProjectNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (fractionDigits != null) {
    const places = Math.min(6, Math.max(0, fractionDigits));
    return formatProjectNumber(value, {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    });
  }
  return formatProjectNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function ReceiptEntryRow({
  line,
  allowAnyActiveLocation,
  dataLineKey,
  sortOrder,
  branchCode,
  canAddStockImage,
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
  allowAnyActiveLocation: boolean;
  dataLineKey: string;
  sortOrder: number;
  branchCode: string;
  canAddStockImage: boolean;
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
  const { t } = useTranslation("goods-receipt-v2");
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
      warehouseId?: number | null;
    }>
  >([]);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  const updateLineRef = useRef(updateLine);
  updateLineRef.current = updateLine;
  const putawayLocationIdRef = useRef(line.putawayLocationId);
  putawayLocationIdRef.current = line.putawayLocationId;
  const putawayFetchGenerationRef = useRef(0);
  const canShowPutawaySuggestions =
    line.targetWarehouseId != null &&
    Boolean(line.stockCode?.trim()) &&
    line.quantity > 0;
  const [serialOpen, setSerialOpen] = useState(false);
  const [locationLookupOpen, setLocationLookupOpen] = useState(false);
  const [stockImageDialogOpen, setStockImageDialogOpen] = useState(false);
  const pieceUnit = isPieceUnit(line.unitCode);
  const { step: qtyStep, places: qtyPlaces } = receiptQuantityStep(
    line.unitCode,
    line.availableQuantity,
    line.remainingQuantity,
    line.quantity,
  );
  const [quantityText, setQuantityText] = useState(() =>
    formatReceiptQuantity(line.quantity, line.unitCode, qtyPlaces),
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
          ? t("createFlow.entryRow.warehouseFallback", { code: warehouseCode })
          : "";
  const receivingLabel = line.receivingLocationCode || "";
  const filledSerials = useMemo(
    () =>
      line.trackings
        .map((x) => x.serialNo?.trim())
        .filter((value): value is string => Boolean(value)),
    [line.trackings],
  );
  const serialSummary = needsTracking
    ? (() => {
        if (line.trackings.length === 0) return t("createFlow.entryRow.planSerial");
        if (!serialMode) {
          return t("createFlow.entryRow.lotRowCount", {
            count: line.trackings.length,
          });
        }
        const total = Math.max(
          maxSerialRowCount(line.quantity),
          line.trackings.length,
        );
        // Sadece dolu seri numaralarını say; boş satırlar “2 seri” olmaz.
        return t("createFlow.entryRow.serialFilledCount", {
          filled: filledSerials.length,
          total,
        });
      })()
    : "—";
  const serialReady = !serialMode || line.quantity > 0;

  const commitQuantity = (finalQty: number): void => {
    const serialTracked =
      line.trackingType === "Serial" || line.trackingType === "LotAndSerial";
    const maxRows = maxSerialRowCount(finalQty);
    const shouldTrim =
      serialTracked && line.trackings.length > maxRows;
    updateLine(key, {
      quantity: finalQty,
      ...(shouldTrim
        ? {
            trackings: line.trackings.slice(0, maxRows),
            serialGenerationKey: undefined,
          }
        : {}),
    });
    if (shouldTrim && line.serialGenerationKey) {
      void stockTrackingApi
        .voidGeneratedSerials({
          branchCode,
          stockId: line.stockId,
          idempotencyKey: line.serialGenerationKey,
          reason: t("createFlow.audit.quantityOrSerialPlanChanged"),
        })
        .catch(() => undefined);
    }
    if (serialTracked && finalQty <= 0) {
      setSerialOpen(false);
    }
  };

  useEffect(() => {
    setQuantityText(
      formatReceiptQuantity(line.quantity, line.unitCode, qtyPlaces),
    );
  }, [line.quantity, line.unitCode, qtyPlaces]);

  useEffect(() => {
    if (!line.targetWarehouseId) return;
    let cancelled = false;
    const locationQuery = allowAnyActiveLocation
      ? goodsReceiptV2Api.locations
      : goodsReceiptV2Api.receivingLocations;
    const applyPutaway = (location: { id: number; code: string }) =>
      allowAnyActiveLocation &&
      (sameLocationId(location.id, line.warehouseDefaultLocationId) ||
        sameLocationId(location.id, line.putawayLocationId))
        ? {
            putawayLocationId: location.id,
            putawayLocationCode: location.code,
          }
        : {};

    void locationQuery(
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
      .then(async (page) => {
        if (cancelled) return;
        const configuredDefault = page.items.find((item) =>
          sameLocationId(item.id, line.warehouseDefaultLocationId),
        );
        const preferred = configuredDefault ??
          (allowAnyActiveLocation
            ? page.items.find((item) =>
                sameLocationId(item.id, line.putawayLocationId),
              )
            : page.items.find((item) => item.locationType === "Receiving") ??
              page.items[0]);
        if (
          preferred &&
          preferred.warehouseId != null &&
          preferred.warehouseId !== line.targetWarehouseId
        ) {
          return;
        }

        if (line.receivingLocationId == null) {
          if (!preferred) return;
          updateLine(key, {
            receivingLocationId: preferred.id,
            receivingLocationValue: String(preferred.id),
            receivingLocationCode: preferred.code,
            ...applyPutaway(preferred),
          });
          return;
        }

        let selected = page.items.find((item) =>
          sameLocationId(item.id, line.receivingLocationId),
        );
        if (!selected) {
          try {
            const byId = await goodsReceiptV2Api.locationById(
              Number(line.receivingLocationId),
            );
            if (cancelled) return;
            if (
              byId.warehouseId == null ||
              byId.warehouseId === line.targetWarehouseId
            ) {
              selected = byId;
            }
          } catch {
            selected = undefined;
          }
        }
        if (selected) {
          if (!line.receivingLocationCode) {
            updateLine(key, {
              receivingLocationCode: selected.code,
              receivingLocationValue: String(selected.id),
              ...applyPutaway(selected),
            });
          }
          return;
        }

        if (
          line.putawayLocationId != null &&
          sameLocationId(line.receivingLocationId, line.putawayLocationId)
        ) {
          if (!line.receivingLocationCode && line.putawayLocationCode) {
            updateLine(key, {
              receivingLocationCode: line.putawayLocationCode,
            });
          }
          return;
        }

        if (!preferred) return;
        updateLine(key, {
          receivingLocationId: preferred.id,
          receivingLocationValue: String(preferred.id),
          receivingLocationCode: preferred.code,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    key,
    allowAnyActiveLocation,
    line.putawayLocationCode,
    line.putawayLocationId,
    line.receivingLocationCode,
    line.receivingLocationId,
    line.targetWarehouseId,
    line.warehouseDefaultLocationId,
    updateLine,
  ]);

  useEffect(() => {
    if (!canShowPutawaySuggestions) {
      setSuggestions([]);
      setSuggestionsBusy(false);
      return;
    }

    const fetchGeneration = ++putawayFetchGenerationRef.current;
    if (suggestionsRef.current.length === 0) {
      setSuggestionsBusy(true);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void goodsReceiptV2Api
        .putawaySuggestions(line.targetWarehouseId!, {
          stockId: line.stockId,
          stockCode: line.stockCode,
          yapCodeId: line.yapCodeId,
          quantity: line.quantity,
        })
        .then((items) => {
          if (
            cancelled ||
            fetchGeneration !== putawayFetchGenerationRef.current
          ) {
            return;
          }
          const warehouseId = line.targetWarehouseId!;
          const scoped = items.filter(
            (item) =>
              item.warehouseId == null ||
              item.warehouseId === warehouseId,
          );
          setSuggestions(scoped);
          if (line.warehouseDefaultLocationId != null) return;
          const top = scoped[0];
          if (!top) return;
          if (
            top.warehouseId != null &&
            top.warehouseId !== warehouseId
          ) {
            return;
          }
          const stillValid = scoped.some(
            (item) => item.id === putawayLocationIdRef.current,
          );
          if (!stillValid) {
            updateLineRef.current(key, putawayLocationPatch(top));
          }
        })
        .catch(() => {
          if (
            cancelled ||
            fetchGeneration !== putawayFetchGenerationRef.current ||
            suggestionsRef.current.length > 0
          ) {
            return;
          }
          setSuggestions([]);
        })
        .finally(() => {
          if (
            !cancelled &&
            fetchGeneration === putawayFetchGenerationRef.current
          ) {
            setSuggestionsBusy(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // putawayLocationId intentionally omitted — preserve manual rack pick without refetch
  }, [
    canShowPutawaySuggestions,
    key,
    line.quantity,
    line.stockCode,
    line.stockId,
    line.targetWarehouseId,
    line.warehouseDefaultLocationId,
    line.yapCodeId,
  ]);

  return (
    <div
      data-receipt-line-key={dataLineKey}
      data-wms-error-line-ref={`${line.siparisNo} / ${line.stockCode ?? line.orderId}`}
      style={{ order: sortOrder }}
      className={cn(
        "wms-ops-receipt-entry-row rounded-xl",
        confirmed && "wms-ops-receipt-entry-row--confirmed",
      )}
    >
      <div className="wms-ops-receipt-entry-row__shell">
        <div className="wms-ops-receipt-entry-row__main min-w-0">
          <div className="wms-ops-receipt-entry-row__header min-w-0">
            <StockIdentityCell
              stockId={line.stockId}
              stockCode={line.stockCode}
              stockName={line.stockName}
              branchCode={branchCode}
              layout="name"
              className="wms-ops-receipt-entry-row__title"
            />
            <span className="wms-ops-code-badge wms-ops-code-badge--stock wms-ops-receipt-entry-row__stock-code inline-flex items-center gap-1">
              <Hash className="wms-ops-meta-badge__icon" aria-hidden />
              <StockIdentityCell
                stockId={line.stockId}
                stockCode={line.stockCode}
                stockName={line.stockName}
                branchCode={branchCode}
                layout="code"
              />
            </span>
          </div>

          <div className="wms-ops-receipt-entry-row__toolbar">
            <div className="wms-ops-receipt-meta-badges flex min-w-0 flex-nowrap items-center gap-1.5 text-xs text-muted-foreground">
              {warehouseBadge ? (
                <span className="wms-ops-warehouse-badge shrink-0">
                  <Building2 className="wms-ops-meta-badge__icon" aria-hidden />
                  {warehouseBadge}
                </span>
              ) : null}
              {warehouseBadge ? (
                <span className="wms-ops-meta-badge-divider" aria-hidden />
              ) : null}
              <span className="font-mono">{line.siparisNo}</span>
              {line.projectCode ? (
                <>
                  <span>•</span>
                  <span className="font-mono">{t("createFlow.entryRow.project")}: {line.projectCode}</span>
                </>
              ) : null}
              <span>•</span>
              <span>
                {t("createFlow.entryRow.remaining")}:{" "}
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
                  {t("createFlow.entryRow.quality")}
                </span>
              ) : null}
            </div>

            <div className="wms-ops-receipt-entry-row__fields">
              <div
                className="wms-ops-receipt-entry-row__field wms-ops-receipt-entry-row__field--qty"
                data-wms-error-target="quantity"
                data-wms-error-keys="miktar kullanılabilir|miktar aralığında|quantity range|available quantity"
              >
                <label className="wms-ops-entry-label">{t("createFlow.entryRow.quantity")}</label>
                <OpsFieldShell>
                  <div className="wms-ops-qty-stepper relative">
                    <input
                      className={cn(
                        OPS_FIELD_CLASS,
                        "h-7 w-full pr-9 text-right font-mono text-sm",
                      )}
                      inputMode={pieceUnit ? "numeric" : "decimal"}
                      value={quantityText}
                      onChange={(event) => setQuantityText(event.target.value)}
                      onFocus={(event) => {
                        event.currentTarget.select();
                      }}
                      onClick={(event) => {
                        event.currentTarget.select();
                      }}
                      onBlur={() => {
                        const parsed = parseLocalizedNumber(quantityText);
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                          setQuantityText(
                            formatReceiptQuantity(
                              line.quantity,
                              line.unitCode,
                              qtyPlaces,
                            ),
                          );
                          return;
                        }
                        const normalized = pieceUnit
                          ? Math.round(parsed)
                          : roundReceiptQuantity(parsed, qtyPlaces);
                        if (pieceUnit && normalized < 1) {
                          setQuantityText(
                            formatReceiptQuantity(
                              line.quantity,
                              line.unitCode,
                              qtyPlaces,
                            ),
                          );
                          return;
                        }
                        const capped = Math.min(
                          normalized,
                          line.availableQuantity ?? normalized,
                        );
                        const finalQty = pieceUnit
                          ? Math.max(1, Math.round(capped))
                          : roundReceiptQuantity(capped, qtyPlaces);
                        commitQuantity(finalQty);
                        setQuantityText(
                          formatReceiptQuantity(
                            finalQty,
                            line.unitCode,
                            qtyPlaces,
                          ),
                        );
                      }}
                    />
                    <div className="wms-ops-qty-stepper__controls absolute inset-y-0 right-0 flex flex-col justify-center pr-0.5">
                      <button
                        type="button"
                        className="wms-ops-qty-stepper__btn"
                        aria-label={t("createFlow.entryRow.increaseQty")}
                        onClick={() => {
                          const base =
                            parseLocalizedNumber(quantityText) || line.quantity;
                          const stepped = roundReceiptQuantity(
                            (pieceUnit ? Math.round(base) : base) + qtyStep,
                            qtyPlaces,
                          );
                          const next = Math.min(
                            stepped,
                            line.availableQuantity ?? stepped,
                          );
                          const finalQty = pieceUnit
                            ? Math.max(1, Math.round(next))
                            : roundReceiptQuantity(next, qtyPlaces);
                          commitQuantity(finalQty);
                          setQuantityText(
                            formatReceiptQuantity(
                              finalQty,
                              line.unitCode,
                              qtyPlaces,
                            ),
                          );
                        }}
                      >
                        <ChevronUp className="size-3" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="wms-ops-qty-stepper__btn"
                        aria-label={t("createFlow.entryRow.decreaseQty")}
                        onClick={() => {
                          const base =
                            parseLocalizedNumber(quantityText) || line.quantity;
                          const stepped = roundReceiptQuantity(
                            (pieceUnit ? Math.round(base) : base) - qtyStep,
                            qtyPlaces,
                          );
                          const minQty = pieceUnit ? 1 : qtyStep;
                          if (stepped < minQty) return;
                          const finalQty = pieceUnit
                            ? Math.round(stepped)
                            : stepped;
                          commitQuantity(finalQty);
                          setQuantityText(
                            formatReceiptQuantity(
                              finalQty,
                              line.unitCode,
                              qtyPlaces,
                            ),
                          );
                        }}
                      >
                        <ChevronDown className="size-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                </OpsFieldShell>
              </div>

              <div
                className="wms-ops-receipt-entry-row__field wms-ops-receipt-entry-row__field--serial"
                data-wms-error-target="serial"
                data-wms-error-keys="lot/seri planı|lot/seri toplamı|seri satırı|benzersiz seri|aynı seri|miktar kadar benzersiz seri|takipsiz kalemde lot|lot zorunludur|üretim tarihi|son kullanma|lot/serial plan|serial row|duplicate serial|manufacturing date|expiration date|maske|mask"
              >
                <label className="wms-ops-entry-label">
                  {serialMode
                    ? t("createFlow.entryRow.serialNo")
                    : needsTracking
                      ? t("createFlow.entryRow.lotSerial")
                      : t("createFlow.entryRow.serialNo")}
                </label>
                {needsTracking ? (
                  <TooltipProvider delayDuration={180}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block w-full min-w-0">
                          <OpsFieldShell>
                            <button
                              type="button"
                              disabled={!serialReady}
                              title={
                                serialReady
                                  ? undefined
                                  : t("createFlow.validation.enterQuantityFirst")
                              }
                              className={cn(
                                "wms-ops-lookup-trigger wms-ops-field h-7",
                                !line.trackings.length && "wms-ops-field--placeholder",
                                !serialReady && "opacity-50",
                              )}
                              onClick={() => {
                                if (!serialReady) {
                                  toast.error(
                                    t("createFlow.validation.enterQuantityFirst"),
                                  );
                                  return;
                                }
                                setSerialOpen(true);
                              }}
                            >
                              <span className="truncate font-mono text-xs leading-none">
                                {serialSummary}
                              </span>
                              <ScanBarcode
                                className="size-3 shrink-0 opacity-60"
                                aria-hidden
                              />
                            </button>
                          </OpsFieldShell>
                        </span>
                      </TooltipTrigger>
                      {filledSerials.length > 0 ? (
                        <TooltipContent
                          side="top"
                          align="start"
                          sideOffset={8}
                          className={cn(
                            "wms-ops-serial-hover-popover p-0 text-left",
                            filledSerials.length > 80 &&
                              "wms-ops-serial-hover-popover--wide",
                            filledSerials.length > 40 &&
                              filledSerials.length <= 80 &&
                              "wms-ops-serial-hover-popover--dense",
                          )}
                        >
                          <div className="wms-ops-serial-hover-popover__header">
                            {t("createFlow.entryRow.serialHoverTitle", {
                              count: filledSerials.length,
                            })}
                          </div>
                          <ul
                            className={cn(
                              "wms-ops-serial-hover-popover__list",
                              filledSerials.length > 40 &&
                                "wms-ops-serial-hover-popover__list--dense",
                              filledSerials.length > 80 &&
                                "wms-ops-serial-hover-popover__list--wide",
                            )}
                          >
                            {filledSerials.map((serial, index) => (
                              <li
                                key={`${serial}-${index}`}
                                className="wms-ops-serial-hover-popover__item"
                              >
                                <span className="wms-ops-serial-hover-popover__index">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="wms-ops-serial-hover-popover__value">
                                  {serial}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <OpsFieldShell>
                    <input
                      className={cn(
                        OPS_FIELD_CLASS,
                        "wms-ops-receipt-entry-row__field-passive h-7 w-full",
                      )}
                      disabled
                      readOnly
                      value=""
                      aria-label={t("createFlow.entryRow.serialNo")}
                    />
                  </OpsFieldShell>
                )}
              </div>

              <div
                className="wms-ops-receipt-entry-row__field wms-ops-receipt-entry-row__field--location"
                data-wms-error-target="location"
                data-wms-error-keys="hedef depo|kabul rafı|target warehouse|receiving shelf"
              >
                <label className="wms-ops-entry-label">{t("createFlow.entryRow.locationCode")}</label>
                <PagedLookupDialog<LocationOption>
                  variant="ops"
                  triggerMode="combobox"
                  autoSearchMinLength={1}
                  open={locationLookupOpen}
                  onOpenChange={setLocationLookupOpen}
                  title={t(
                    allowAnyActiveLocation
                      ? "createFlow.entryRow.activeLocationLookupTitle"
                      : "createFlow.entryRow.receivingLookupTitle",
                  )}
                  value={receivingLabel}
                  placeholder={t(
                    allowAnyActiveLocation
                      ? "createFlow.entryRow.activeLocationPlaceholder"
                      : "createFlow.entryRow.receivingPlaceholder",
                  )}
                  searchPlaceholder={t("createFlow.entryRow.receivingSearchPlaceholder")}
                  emptyText={t("createFlow.entryRow.receivingEmpty")}
                  disabled={!line.targetWarehouseId}
                  triggerClassName="h-7 truncate"
                  queryKey={[
                    "gr-line-location-lookup",
                    allowAnyActiveLocation ? "all-active" : "receiving",
                    key,
                    line.targetWarehouseId,
                  ]}
                  fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                    toPagedResponse(
                      await (allowAnyActiveLocation
                        ? goodsReceiptV2Api.locations
                        : goodsReceiptV2Api.receivingLocations)(
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
                    if (
                      location.warehouseId != null &&
                      line.targetWarehouseId != null &&
                      location.warehouseId !== line.targetWarehouseId
                    ) {
                      return;
                    }
                    updateLine(key, {
                      receivingLocationValue: String(location.id),
                      receivingLocationId: location.id,
                      receivingLocationCode: location.code,
                      putawayLocationId: location.id,
                      putawayLocationCode: location.code,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <StockTrackingPolicyField policy={line.trackingPolicy} compact />
        </div>

        <div className="wms-ops-receipt-entry-row__ready">
          <div className="wms-ops-receipt-entry-row__ready-actions">
            <StockImagePeekButton
              stockId={line.stockId}
              stockName={line.stockName}
              canUpload={canAddStockImage}
              onOpen={() => setStockImageDialogOpen(true)}
            />
            <OpsSkinCheckbox
              checked={confirmed}
              onCheckedChange={onConfirmedChange}
              aria-label={t("createFlow.entryRow.confirmLine", {
                label: line.stockCode ?? line.siparisNo,
              })}
              title={
                confirmed
                  ? t("createFlow.entryRow.removeConfirm")
                  : t("createFlow.entryRow.confirmHint")
              }
            />
          </div>
          <span className="wms-ops-receipt-entry-row__status text-[0.58rem] font-semibold uppercase tracking-wider text-[var(--wms-app-text-muted)]">
            {confirmed ? t("createFlow.entryRow.confirm") : t("createFlow.entryRow.ready")}
          </span>
        </div>

        <GoodsReceiptStockImageDialog
          open={stockImageDialogOpen}
          stockId={line.stockId}
          stockCode={line.stockCode ?? ""}
          stockName={line.stockName}
          canUpload={canAddStockImage}
          onClose={() => setStockImageDialogOpen(false)}
        />

        {canShowPutawaySuggestions && (
          <div className="wms-ops-putaway-suggestions">
            <div className="wms-ops-putaway-suggestions__header">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="wms-ops-putaway-suggestions__title">
                  {suggestionsBusy && suggestions.length === 0 ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <span className="wms-ops-putaway-suggestions__title-dot" aria-hidden />
                  )}
                  {t("createFlow.entryRow.suggestedRack")}
                </span>
              </div>
              {line.putawayLocationCode ? (
                <span className="wms-ops-putaway-suggestions__selected-pill">
                  <CheckCircle2 className="size-2.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">{line.putawayLocationCode}</span>
                </span>
              ) : null}
            </div>

            {suggestions.length > 0 ? (
              <div className="wms-ops-putaway-suggestions__grid">
                {suggestions.map((item, index) => {
                  const selected = line.putawayLocationId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (
                          item.warehouseId != null &&
                          line.targetWarehouseId != null &&
                          item.warehouseId !== line.targetWarehouseId
                        ) {
                          return;
                        }
                        updateLine(key, putawayLocationPatch(item));
                      }}
                      className={cn(
                        "wms-ops-putaway-suggestions__card",
                        selected && "wms-ops-putaway-suggestions__card--selected",
                      )}
                      title={item.reason}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "wms-ops-putaway-suggestions__card-index font-mono text-[0.55rem] tabular-nums",
                            selected && "wms-ops-putaway-suggestions__card-index--selected",
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={cn(
                            "wms-ops-putaway-suggestions__card-code min-w-0 flex-1 truncate font-mono text-[0.62rem] font-semibold tracking-tight",
                            selected && "wms-ops-putaway-suggestions__card-code--selected",
                          )}
                        >
                          {item.code}
                        </span>
                        {selected ? (
                          <CheckCircle2
                            className="wms-ops-putaway-suggestions__card-check size-2.5 shrink-0"
                            aria-label={t("createFlow.entryRow.selected")}
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : suggestionsBusy ? (
              <div
                className="wms-ops-putaway-suggestions__grid wms-ops-putaway-suggestions__grid--loading"
                aria-hidden
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="wms-ops-putaway-suggestions__card wms-ops-putaway-suggestions__card--skeleton"
                  />
                ))}
              </div>
            ) : (
              <p className="px-2.5 py-1.5 text-[0.62rem] text-[var(--wms-app-text-muted)]">
                {t("createFlow.entryRow.suggestedRackEmpty")}
              </p>
            )}
          </div>
        )}
      </div>

      {serialMode && line.serialGenerationKey && line.trackings.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            {t("createFlow.entryRow.autoSerialReserved")}
          </span>
          <button
            type="button"
            onClick={() => void cancelGeneratedSerials(key)}
            className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
          >
            {t("createFlow.entryRow.cancelAutoSerials")}
          </button>
        </div>
      )}

      {serialOpen && (
        <SerialTrackingDialog
          line={line}
          branchCode={branchCode}
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
  branchCode,
  onClose,
  updateLine,
  updateTracking,
  addTracking,
  removeTracking,
  createSerialRows,
  cancelGeneratedSerials,
}: {
  line: SelectedReceiptLine;
  branchCode: string;
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
  const { t } = useModuleTranslation("goods-receipt-v2");
  const { skin } = useTheme();
  const isPremium = skin === "premium";
  const key = lineKey(line);
  const serialMode =
    line.trackingType === "Serial" || line.trackingType === "LotAndSerial";
  const lotMode =
    line.trackingType === "Lot" || line.trackingType === "LotAndSerial";
  const maxRows = maxSerialRowCount(line.quantity);
  const atSerialLimit = serialMode && line.trackings.length >= maxRows;
  const [bulkText, setBulkText] = useState("");
  const [maskTemplate, setMaskTemplate] = useState<string | null>(
    line.serialMaskTemplate ?? null,
  );
  const [serialFieldErrors, setSerialFieldErrors] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      (line.invalidSerialTrackingIds ?? []).map((id) => [id, true]),
    ),
  );

  useEffect(() => {
    setMaskTemplate(line.serialMaskTemplate ?? null);
  }, [line.serialMaskTemplate]);

  useEffect(() => {
    if (!serialMode || line.serialMaskTemplate) return;
    let cancelled = false;
    void stockTrackingApi
      .getStockSettings(line.stockId, branchCode)
      .then((settings) => {
        if (cancelled) return;
        const next = settings.serialMaskTemplate ?? null;
        setMaskTemplate(next);
        if (next !== line.serialMaskTemplate) {
          updateLine(key, { serialMaskTemplate: next });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    branchCode,
    key,
    line.serialMaskTemplate,
    line.stockId,
    serialMode,
    updateLine,
  ]);

  const persistInvalidIds = (errors: Record<string, boolean>): void => {
    const ids = Object.keys(errors).filter((id) => errors[id]);
    const current = line.invalidSerialTrackingIds ?? [];
    const same =
      ids.length === current.length && ids.every((id) => current.includes(id));
    if (!same) updateLine(key, { invalidSerialTrackingIds: ids });
  };

  const validateSerialValue = (trackingId: string, value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      // Boş: daha önce hatalıysa kırmızı kalsın, odak engellenmesin.
      return;
    }
    if (
      maskTemplate &&
      !matchesSerialMask(trimmed, maskTemplate, { stockCode: line.stockCode })
    ) {
      setSerialFieldErrors((current) => ({ ...current, [trackingId]: true }));
      toastError(
        t("createFlow.validation.serialMaskMismatch", { mask: maskTemplate }),
        { skipErrorNavigation: true },
      );
      return;
    }
    setSerialFieldErrors((current) => {
      const next = { ...current };
      delete next[trackingId];
      return next;
    });
  };

  const validateAllSerialsForConfirm = (): boolean => {
    if (!serialMode || !maskTemplate) return true;
    const errors: Record<string, boolean> = {};
    const message = t("createFlow.validation.serialMaskMismatch", {
      mask: maskTemplate,
    });
    for (const tracking of line.trackings) {
      const value = tracking.serialNo?.trim() ?? "";
      if (!value) {
        if (serialFieldErrors[tracking.localId]) {
          errors[tracking.localId] = true;
        }
        continue;
      }
      if (
        !matchesSerialMask(value, maskTemplate, { stockCode: line.stockCode })
      ) {
        errors[tracking.localId] = true;
      }
    }
    if (Object.keys(errors).length === 0) {
      persistInvalidIds({});
      return true;
    }
    setSerialFieldErrors(errors);
    persistInvalidIds(errors);
    toastError(message, { skipErrorNavigation: true });
    return false;
  };

  const discardAndClose = (): void => {
    if (!serialMode || !maskTemplate) {
      onClose();
      return;
    }
    const invalidIds: string[] = [];
    const nextTrackings = line.trackings.map((tracking) => {
      const value = tracking.serialNo?.trim() ?? "";
      if (!value) {
        if (
          serialFieldErrors[tracking.localId] ||
          (line.invalidSerialTrackingIds ?? []).includes(tracking.localId)
        ) {
          invalidIds.push(tracking.localId);
        }
        return tracking;
      }
      if (
        matchesSerialMask(value, maskTemplate, { stockCode: line.stockCode })
      ) {
        return tracking;
      }
      invalidIds.push(tracking.localId);
      return { ...tracking, serialNo: "" };
    });
    updateLine(key, {
      trackings: nextTrackings,
      invalidSerialTrackingIds: invalidIds,
    });
    onClose();
  };

  const confirmAndClose = (): void => {
    if (!validateAllSerialsForConfirm()) return;
    updateLine(key, { invalidSerialTrackingIds: [] });
    onClose();
  };

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
      toast.error(t("createFlow.validation.enterAtLeastOneSerial"));
      return;
    }
    if (serials.length > maxRows) {
      toast.error(t("createFlow.validation.serialCountExceedsQuantity"));
      return;
    }
    if (maskTemplate) {
      const invalid = serials.find(
        (serial) =>
          !matchesSerialMask(serial, maskTemplate, {
            stockCode: line.stockCode,
          }),
      );
      if (invalid) {
        toastError(
          t("createFlow.validation.serialMaskMismatch", { mask: maskTemplate }),
          { skipErrorNavigation: true },
        );
        return;
      }
    }
    updateLine(key, {
      serialGenerationKey: undefined,
      trackings: serials.map((serialNo) => ({
        localId: crypto.randomUUID(),
        quantity: 1,
        serialNo,
      })),
    });
    setSerialFieldErrors({});
    setBulkText("");
    toast.success(t("createFlow.toast.serialsSplitIntoRows", { count: serials.length }));
  };

  const tryAddTracking = () => {
    if (serialMode && maxRows <= 0) {
      toast.error(t("createFlow.validation.enterQuantityFirst"));
      return;
    }
    if (atSerialLimit) {
      toast.error(t("createFlow.validation.serialCountExceedsQuantity"));
      return;
    }
    addTracking(key);
  };

  return (
    <ResponsiveDialog
      onClose={discardAndClose}
      title={t("createFlow.serialLotDialog.title")}
      description={`${line.stockCode}${line.stockName ? ` · ${line.stockName}` : ""} · ${formatProjectNumber(line.quantity)} ${line.unitCode}`}
      className="wms-ops-serial-dialog !max-w-5xl"
    >
      <div className="wms-ops-serial-dialog__intro mb-4">
        <p className="wms-ops-serial-dialog__eyebrow">{t("createFlow.serialLotDialog.traceability")}</p>
        <p className="wms-ops-serial-dialog__hint">
          {t("createFlow.serialLotDialog.subtitle")}
        </p>
        {serialMode ? (
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
            {t("createFlow.serialLotDialog.rowLimitHint", {
              count: maxRows,
              used: line.trackings.length,
            })}
            {maskTemplate
              ? ` · ${t("createFlow.serialLotDialog.maskHint", { mask: maskTemplate })}`
              : ""}
          </p>
        ) : null}
      </div>

      <div className="wms-ops-serial-dialog__tiles mb-4">
        {serialMode ? (
          <button
            type="button"
            onClick={() => void createSerialRows(key)}
            disabled={maxRows <= 0}
            className="wms-ops-serial-dialog__tile wms-ops-serial-dialog__tile--accent disabled:opacity-50"
          >
            <span className="wms-ops-serial-dialog__tile-title">
              {t("createFlow.serialLotDialog.autoSuggestSerial")}
            </span>
            <span className="wms-ops-serial-dialog__tile-hint">
              {t("createFlow.serialLotDialog.autoSuggestSerialHint")}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={tryAddTracking}
          disabled={serialMode && (maxRows <= 0 || atSerialLimit)}
          className="wms-ops-serial-dialog__tile disabled:opacity-50"
        >
          <span className="wms-ops-serial-dialog__tile-title">
            {t("createFlow.serialLotDialog.addSingleRow")}
          </span>
          <span className="wms-ops-serial-dialog__tile-hint">
            {serialMode && atSerialLimit
              ? t("createFlow.serialLotDialog.addSingleRowLimitHint", {
                  count: maxRows,
                })
              : t("createFlow.serialLotDialog.addSingleRowHint")}
          </span>
        </button>
        {serialMode && line.serialGenerationKey && line.trackings.length > 0 ? (
          <button
            type="button"
            onClick={() => void cancelGeneratedSerials(key)}
            className="wms-ops-serial-dialog__tile wms-ops-serial-dialog__tile--warn"
          >
            <span className="wms-ops-serial-dialog__tile-title">
              {t("createFlow.serialLotDialog.cancelAutoSerials")}
            </span>
            <span className="wms-ops-serial-dialog__tile-hint">
              {t("createFlow.serialLotDialog.cancelAutoSerialsHint")}
            </span>
          </button>
        ) : null}
      </div>

      {serialMode ? (
        <div className="wms-ops-serial-dialog__bulk mb-4">
          <label className="wms-ops-entry-label mb-1.5 block">
            {t("createFlow.serialLotDialog.bulkPasteLabel")}
          </label>
          <OpsFieldShell className="wms-ops-serial-dialog__bulk-shell">
            <textarea
              className={cn(
                OPS_FIELD_CLASS,
                "wms-ops-serial-dialog__bulk-input w-full resize-y font-mono text-sm",
              )}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"SN-0001\nSN-0002\nSN-0003"}
              rows={4}
            />
          </OpsFieldShell>
          <OpsActionButton
            type="button"
            variant="secondary"
            onClick={applyBulk}
            className="mt-2.5"
          >
            {t("createFlow.serialLotDialog.applyBulkSerials")}
          </OpsActionButton>
        </div>
      ) : null}

      <div className="wms-ops-serial-dialog__rows space-y-2">
        {line.trackings.map((tracking, index) => (
          <div
            key={tracking.localId}
            className="wms-ops-serial-dialog__row grid gap-2 md:grid-cols-[3.5rem_7.5rem_1fr_1fr_9rem_9rem_auto]"
          >
              <span className="wms-ops-serial-dialog__row-index self-center text-center text-xs font-semibold">
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
                <AppInput
                  aria-label={t("createFlow.serialLotDialog.lotAria")}
                  placeholder={t("createFlow.serialLotDialog.lotPlaceholder")}
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
                <AppInput
                  aria-label={t("createFlow.serialLotDialog.serialAria")}
                  placeholder={
                    maskTemplate ||
                    t("createFlow.serialLotDialog.serialPlaceholder")
                  }
                  className="font-mono"
                  value={tracking.serialNo ?? ""}
                  invalid={Boolean(serialFieldErrors[tracking.localId])}
                  onChange={(event) => {
                    updateTracking(key, tracking.localId, {
                      serialNo: event.target.value,
                    });
                  }}
                  onBlur={(event) => {
                    const trackingId = tracking.localId;
                    const value = event.target.value;
                    // Odak bir sonraki alana geçsin; toast navigasyonu odak çalmasın.
                    window.setTimeout(() => {
                      validateSerialValue(trackingId, value);
                    }, 0);
                  }}
                />
              ) : (
                <span />
              )}
              <AppDateInput
                aria-label={t("createFlow.serialLotDialog.manufacturingDateAria")}
                value={tracking.manufacturingDate ?? ""}
                onChange={(event) =>
                  updateTracking(key, tracking.localId, {
                    manufacturingDate: event.target.value,
                  })
                }
              />
              <AppDateInput
                aria-label={t("createFlow.serialLotDialog.expirationDateAria")}
                value={tracking.expirationDate ?? ""}
                onChange={(event) =>
                  updateTracking(key, tracking.localId, {
                    expirationDate: event.target.value,
                  })
                }
              />
              <button
                type="button"
                aria-label={t("createFlow.serialLotDialog.removeTrackingRow")}
                onClick={() => {
                  removeTracking(key, tracking.localId);
                  setSerialFieldErrors((current) => {
                    const next = { ...current };
                    delete next[tracking.localId];
                    return next;
                  });
                }}
                className="wms-ops-serial-dialog__row-delete grid size-10 place-items-center"
              >
                <Trash2 className="size-4" />
              </button>
          </div>
        ))}
        {line.trackings.length === 0 ? (
          <p className="wms-ops-serial-dialog__empty">
            {t("createFlow.serialLotDialog.empty")}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-4 flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-4",
          isPremium ? "pt-4" : "pt-3",
        )}
      >
        <OpsActionButton type="button" variant="secondary" onClick={discardAndClose}>
          {t("createFlow.serialLotDialog.close")}
        </OpsActionButton>
        <OpsActionButton type="button" variant="primary" onClick={confirmAndClose}>
          {t("createFlow.serialLotDialog.done")}
        </OpsActionButton>
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
  const { t } = useModuleTranslation("goods-receipt-v2");
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
    <AppInput
      className="font-mono"
      aria-label={t("createFlow.serialLotDialog.quantityAria")}
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

function ReviewUnitBreakdownBadge({
  count,
  entries,
  countLabel,
}: {
  count: number;
  entries: Array<{ unit: string; quantity: number }>;
  countLabel: string;
}): ReactElement {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="wms-ops-gr-review__metric-card-unit-badge"
            tabIndex={0}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {countLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="wms-ops-gr-review__metric-card-unit-tooltip"
        >
          <div className="wms-ops-gr-review__metric-card-unit-list">
            {entries.map((entry) => (
              <div key={`${entry.unit}-${count}`} className="wms-ops-gr-review__metric-card-unit-row">
                <span>
                  {formatProjectNumber(entry.quantity, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}
                </span>
                <span>{entry.unit}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReviewMetricCard({
  variant,
  icon,
  label,
  value,
  hint,
  note,
  onClick,
  footer,
}: {
  variant: "lines" | "available" | "quality" | "quality-none";
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  note?: string;
  onClick?: () => void;
  footer?: ReactNode;
}): ReactElement {
  const interactive = typeof onClick === "function" && !footer;
  const className = cn(
    "wms-ops-gr-review__metric-card",
    `wms-ops-gr-review__metric-card--${variant}`,
    interactive && "wms-ops-gr-review__metric-card--interactive",
  );

  const body = (
    <>
      <span className="wms-ops-gr-review__metric-card-icon" aria-hidden>
        {icon}
      </span>
      <span className="wms-ops-gr-review__metric-card-label">{label}</span>
      <div className="wms-ops-gr-review__metric-card-value">{value}</div>
      {hint || note ? (
        <div className="wms-ops-gr-review__metric-card-foot">
          {note ? (
            <span className="wms-ops-gr-review__metric-card-note">{note}</span>
          ) : null}
          {hint ? (
            onClick && footer ? (
              <button
                type="button"
                className="wms-ops-gr-review__metric-card-hint wms-ops-gr-review__metric-card-hint--action"
                onClick={onClick}
              >
                {hint}
              </button>
            ) : (
              <span className="wms-ops-gr-review__metric-card-hint">{hint}</span>
            )
          ) : null}
        </div>
      ) : null}
      {footer}
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

function qualityIncludedKeys(
  lines: Array<{
    lineKey?: string;
    qualityRequiredByRule?: boolean;
    forcedQuality?: boolean;
  }>,
): string[] {
  return lines
    .filter((line) => line.lineKey && (line.qualityRequiredByRule || line.forcedQuality))
    .map((line) => line.lineKey as string);
}

function qualityLineLocationLabel(line: {
  receivingLocationCode?: string | null;
  putawayLocationCode?: string | null;
}): { receiving: string; putaway: string; same: boolean } {
  const receiving = line.receivingLocationCode?.trim() || "";
  const putaway = line.putawayLocationCode?.trim() || "";
  return {
    receiving,
    putaway,
    same: !receiving || !putaway || receiving === putaway,
  };
}

function QualityLinesDialog({
  lines,
  open,
  onClose,
  title,
  description,
  searchAriaLabel,
  tone = "quality",
  onConfirmForceQuality,
  onRemoveForcedQuality,
}: {
  lines: Array<{
    lineKey?: string;
    stockId?: number;
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
    requireQualityControl?: boolean;
    qualityRequiredByRule?: boolean;
    forcedQuality?: boolean;
    receivingLocationCode?: string | null;
    putawayLocationCode?: string | null;
  }>;
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  searchAriaLabel?: string;
  tone?: "receipt" | "quality";
  onConfirmForceQuality?: (selectedLineKeys: string[]) => void;
  onRemoveForcedQuality?: (lineKey: string) => void;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const [search, setSearch] = useState("");
  const [draftSelectedKeys, setDraftSelectedKeys] = useState<string[]>([]);
  const [baselineSelectedKeys, setBaselineSelectedKeys] = useState<string[]>([]);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const canForce = tone === "receipt" && typeof onConfirmForceQuality === "function";
  const canRemoveForced = typeof onRemoveForcedQuality === "function";
  const hasNewAdds = canForce && draftSelectedKeys.some((key) => !baselineSelectedKeys.includes(key));
  const populatedWhileOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const included = qualityIncludedKeys(linesRef.current);
    setSearch("");
    setDraftSelectedKeys(included);
    setBaselineSelectedKeys(included);
  }, [open]);

  useEffect(() => {
    if (!open) {
      populatedWhileOpenRef.current = false;
      return;
    }
    if (lines.length > 0) populatedWhileOpenRef.current = true;
    else if (tone === "quality" && canRemoveForced && populatedWhileOpenRef.current) onClose();
  }, [open, tone, canRemoveForced, lines.length, onClose]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return lines;
    return lines.filter((line) => {
      const haystack = [
        line.stockCode,
        line.stockName || "",
        line.receivingLocationCode || "",
        line.putawayLocationCode || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return haystack.includes(query);
    });
  }, [lines, search]);

  const closeDialog = (): void => {
    onClose();
    setSearch("");
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={closeDialog}
      title={title ?? t("createFlow.qualityDialog.title")}
      description={description ?? t("createFlow.qualityDialog.description")}
      variant="lookup"
      className="!max-w-3xl"
    >
      <div
        className={cn(
          "wms-ops-gr-review__quality-dialog-body",
          tone === "receipt"
            ? "wms-ops-gr-review__quality-dialog-body--receipt"
            : "wms-ops-gr-review__quality-dialog-body--quality",
        )}
      >
        {lines.length > 8 ? (
          <div className="wms-ops-gr-review__quality-dialog-search">
            <Search aria-hidden />
            <AppInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("createFlow.qualityDialog.searchPlaceholder")}
              aria-label={searchAriaLabel ?? t("createFlow.qualityDialog.searchAria")}
            />
          </div>
        ) : null}
        {lines.length > 0 ? (
          <div className="wms-ops-gr-review__quality-dialog-meta">
            <span>
              {t("createFlow.qualityDialog.showing")}: <strong>{filtered.length}</strong> / {lines.length}
            </span>
            <span>{t("createFlow.qualityDialog.scrollHint")}</span>
          </div>
        ) : null}
        {lines.length === 0 ? (
          <div className="wms-ops-gr-review__quality-dialog-empty">
            {t("createFlow.qualityDialog.qualityEmptyList")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="wms-ops-gr-review__quality-dialog-empty">
            {t("createFlow.qualityDialog.empty")}
          </div>
        ) : (
          <ul className="wms-ops-gr-review__quality-dialog-list">
            {filtered.map((line, index) => {
              const lockedByRule = Boolean(line.qualityRequiredByRule);
              const alreadyForced = Boolean(line.forcedQuality) && !lockedByRule;
              const lockedInReceipt = canForce && (lockedByRule || alreadyForced);
              const checked = Boolean(
                lockedInReceipt
                || (line.lineKey && draftSelectedKeys.includes(line.lineKey)),
              );
              const showForcedRemove =
                canRemoveForced
                && Boolean(line.forcedQuality)
                && !lockedByRule
                && Boolean(line.lineKey);
              const location = qualityLineLocationLabel(line);
              const locationText = location.receiving || location.putaway;
              return (
                <li
                  key={line.lineKey ?? `${line.stockCode}-${line.quantity}-${index}`}
                  data-included={checked ? "true" : "false"}
                  data-locked={lockedInReceipt || lockedByRule ? "true" : "false"}
                  data-removable={showForcedRemove ? "true" : "false"}
                  title={
                    lockedByRule
                      ? t("createFlow.qualityDialog.ruleLockedHint")
                      : undefined
                  }
                >
                  {canForce && line.lineKey ? (
                    <OpsSkinCheckbox
                      checked={checked}
                      disabled={lockedInReceipt}
                      className="self-start mt-0.5"
                      title={
                        lockedByRule
                          ? t("createFlow.qualityDialog.ruleLockedHint")
                          : undefined
                      }
                      onCheckedChange={(next) => {
                        if (lockedInReceipt || !line.lineKey) return;
                        const key = line.lineKey;
                        setDraftSelectedKeys((current) => {
                          if (next === true) {
                            return current.includes(key) ? current : [...current, key];
                          }
                          return current.filter((item) => item !== key);
                        });
                      }}
                      aria-label={t("createFlow.qualityDialog.selectLineAria", {
                        code: line.stockCode,
                      })}
                    />
                  ) : null}
                  <span className="wms-ops-gr-review__quality-dialog-identity">
                    <span className="wms-ops-gr-review__quality-dialog-identity-head">
                      <StockIdentityCell
                        stockId={line.stockId}
                        stockCode={line.stockCode}
                        stockName={line.stockName}
                        layout="code"
                        className="wms-ops-gr-review__quality-dialog-code"
                      />
                      {locationText ? (
                        <span
                          className="wms-ops-gr-review__quality-dialog-loc"
                          title={
                            location.same
                              ? `${t("createFlow.entryRow.locationCode")} ${locationText}`
                              : t("createFlow.qualityDialog.locationBoth", {
                                  receiving: location.receiving,
                                  putaway: location.putaway,
                                })
                          }
                        >
                          <span className="wms-ops-gr-review__quality-dialog-loc-label">
                            {t("createFlow.qualityDialog.locationLabel")}
                          </span>
                          <span className="wms-ops-gr-review__quality-dialog-loc-value">
                            {location.same
                              ? locationText
                              : `${location.receiving} · ${location.putaway}`}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="wms-ops-gr-review__quality-dialog-name"
                      title={line.stockName || undefined}
                    >
                      {line.stockName || "—"}
                    </span>
                  </span>
                  {lockedByRule || checked ? (
                    <span
                      className={cn(
                        "wms-ops-gr-review__quality-dialog-badge",
                        !lockedByRule && "wms-ops-gr-review__quality-dialog-badge--forced",
                      )}
                    >
                      {lockedByRule
                        ? t("createFlow.qualityDialog.qualityBadge")
                        : t("createFlow.qualityDialog.forcedQualityBadge")}
                    </span>
                  ) : null}
                  <span className="wms-ops-gr-review__quality-dialog-qty">
                    {formatProjectNumber(line.quantity, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 6,
                    })}{" "}
                    {line.unitCode || ""}
                  </span>
                  {showForcedRemove ? (
                    <button
                      type="button"
                      className="wms-ops-gr-review__quality-dialog-remove"
                      title={t("createFlow.qualityDialog.removeForcedTitle")}
                      aria-label={t("createFlow.qualityDialog.removeForcedAria", {
                        code: line.stockCode,
                      })}
                      onClick={() => {
                        if (!line.lineKey) return;
                        const key = line.lineKey;
                        setDraftSelectedKeys((current) => current.filter((item) => item !== key));
                        setBaselineSelectedKeys((current) => current.filter((item) => item !== key));
                        onRemoveForcedQuality?.(key);
                      }}
                    >
                      <X className="size-3.5" aria-hidden />
                      <span>{t("createFlow.qualityDialog.removeForcedLabel")}</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {canForce ? (
          <div className="wms-ops-gr-review__quality-dialog-actions">
            <OpsActionButton type="button" variant="secondary" onClick={closeDialog}>
              {t("createFlow.qualityDialog.forceQualityCancel")}
            </OpsActionButton>
            <TooltipProvider delayDuration={180}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <OpsActionButton
                      type="button"
                      variant="primary"
                      disabled={!hasNewAdds}
                      onClick={() => {
                        onConfirmForceQuality?.(
                          draftSelectedKeys.filter((key) => !baselineSelectedKeys.includes(key)),
                        );
                      }}
                    >
                      {t("createFlow.qualityDialog.forceQualitySubmit")}
                    </OpsActionButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                  {t("createFlow.qualityDialog.forceQualitySubmitTitle")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

function CreateSubmitScreen({
  mode,
  phase,
  errorMessage,
  lineCount,
  supplierName,
  receiptNo,
}: {
  mode: "receipt" | "quality";
  phase: "running" | "error";
  errorMessage?: string;
  lineCount: number;
  supplierName?: string;
  receiptNo?: string;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const { skin } = useTheme();
  const isPremium = skin === "premium";
  const isQuality = mode === "quality";
  const isError = phase === "error";
  const logKeys = isQuality
    ? [
        "createFlow.submit.qualityLog0",
        "createFlow.submit.qualityLog1",
        "createFlow.submit.qualityLog2",
        "createFlow.submit.qualityLog3",
        "createFlow.submit.qualityLog4",
      ]
    : [
        "createFlow.submit.receiptLog0",
        "createFlow.submit.receiptLog1",
        "createFlow.submit.receiptLog2",
        "createFlow.submit.receiptLog3",
        "createFlow.submit.receiptLog4",
      ];
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (isError) return;
    const timer = window.setInterval(() => {
      setLogIndex((current) => (current + 1) % logKeys.length);
    }, isPremium ? 1100 : 850);
    return () => window.clearInterval(timer);
  }, [isError, isPremium, logKeys.length]);

  const eyebrow = isError
    ? t("createFlow.submit.errorEyebrow")
    : isQuality
      ? t("createFlow.submit.qualityEyebrow")
      : t("createFlow.submit.receiptEyebrow");
  const title = isError
    ? t("createFlow.submit.errorTitle")
    : isQuality
      ? t("createFlow.submit.qualityTitle")
      : t("createFlow.submit.receiptTitle");
  const subtitle = isError
    ? t("createFlow.submit.errorReturning")
    : isQuality
      ? t("createFlow.submit.qualitySubtitle", {
          count: lineCount,
          name: supplierName || "—",
        })
      : t("createFlow.submit.receiptSubtitle", {
          count: lineCount,
          name: supplierName || "—",
        });

  return (
    <div
      className={cn(
        "wms-ops-gr-submit",
        isQuality ? "wms-ops-gr-submit--quality" : "wms-ops-gr-submit--receipt",
        isError && "wms-ops-gr-submit--error",
        isPremium ? "wms-ops-gr-submit--premium" : "wms-ops-gr-submit--terminal",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="wms-ops-gr-submit__glow" aria-hidden />
      <div className="wms-ops-gr-submit__grid" aria-hidden />
      <div className="wms-ops-gr-submit__scanline" aria-hidden />

      <header className="wms-ops-gr-submit__chrome">
        <span className="wms-ops-gr-submit__chrome-traffic" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="wms-ops-gr-submit__chrome-path">
          {isError
            ? "wms://submit/error"
            : isQuality
              ? "wms://submit/quality"
              : "wms://submit/receipt"}
        </span>
        <span className="wms-ops-gr-submit__chrome-status">
          {isError ? "FAIL" : "RUN"}
        </span>
      </header>

      <div className="wms-ops-gr-submit__inner">
        <div className="wms-ops-gr-submit__icon" aria-hidden>
          {isError ? (
            <ShieldAlert className="size-7" />
          ) : isQuality ? (
            <ShieldCheck className="size-7" />
          ) : (
            <PackageCheck className="size-7" />
          )}
          {!isError ? (
            <span className="wms-ops-gr-submit__spinner">
              <Loader2 className="size-4 animate-spin" />
            </span>
          ) : null}
        </div>

        <p className="wms-ops-gr-submit__eyebrow">
          <span className="wms-ops-gr-submit__eyebrow-prompt" aria-hidden>
            {isError ? "!" : ">"}
          </span>
          {eyebrow}
        </p>
        <h2 className="wms-ops-gr-submit__title">{title}</h2>
        <p className="wms-ops-gr-submit__subtitle">{subtitle}</p>

        {receiptNo ? (
          <div className="wms-ops-gr-submit__doc">
            <span>{t("createFlow.submit.documentLabel")}</span>
            <strong>{receiptNo}</strong>
          </div>
        ) : null}

        {isError ? (
          <div className="wms-ops-gr-submit__error" role="alert">
            <span className="wms-ops-gr-submit__error-tag">ERR</span>
            <span>{errorMessage || t("createFlow.submit.errorFallback")}</span>
          </div>
        ) : (
          <>
            <div className="wms-ops-gr-submit__progress" aria-hidden>
              <span className="wms-ops-gr-submit__progress-bar" />
            </div>
            <ul className="wms-ops-gr-submit__log">
              {logKeys.map((key, index) => (
                <li
                  key={key}
                  className={cn(
                    index === logIndex && "wms-ops-gr-submit__log-item--active",
                    index < logIndex && "wms-ops-gr-submit__log-item--done",
                  )}
                >
                  <span className="wms-ops-gr-submit__log-index" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="wms-ops-gr-submit__log-prompt" aria-hidden>
                    {index === logIndex ? ">" : index < logIndex ? "ok" : "·"}
                  </span>
                  <span className="wms-ops-gr-submit__log-text">{t(key)}</span>
                  {index === logIndex && !isError ? (
                    <span className="wms-ops-gr-submit__cursor" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessDocumentChip({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("createFlow.success.documentCopied"));
    } catch {
      toast.error(t("createFlow.success.documentCopyFailed"));
    }
  };

  return (
    <button
      type="button"
      className="wms-ops-gr-success__doc wms-ops-gr-success__doc--copyable"
      onClick={() => void copyValue()}
      title={t("createFlow.success.copyDocument")}
      aria-label={t("createFlow.success.copyDocument")}
    >
      <span className="wms-ops-gr-success__doc-label">{label}</span>
      <span className="wms-ops-gr-success__doc-row">
        <strong className="wms-ops-gr-success__doc-value">{value}</strong>
        <Copy className="wms-ops-gr-success__doc-copy-icon size-3.5" aria-hidden />
      </span>
    </button>
  );
}

function DirectCreateSuccessPanel({
  result,
  supplierName,
  supplierCode,
  receiptNo,
  isElectronicReceipt,
  receiptLines,
  qualityLines,
  onNew,
  hideRoutingActions = false,
}: {
  result: ManualGoodsReceiptResult;
  supplierName?: string;
  supplierCode?: string;
  receiptNo: string;
  isElectronicReceipt: boolean;
  receiptLines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
    requireQualityControl?: boolean;
  }>;
  qualityLines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
  }>;
  onNew: () => void;
  hideRoutingActions?: boolean;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const navigate = useNavigate();
  const [linesOpen, setLinesOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const hasQuality = qualityLines.length > 0;
  const titleLabel = hasQuality
    ? t("createFlow.success.sentToQuality")
    : t("createFlow.success.receiptCreated");
  const statusValue = hasQuality
    ? t("createFlow.success.statusAwaitingQuality")
    : t("createFlow.success.statusCompleted");
  const documentValue = receiptNo.trim();

  return (
    <div
      className={
        hasQuality
          ? "wms-ops-gr-success wms-ops-gr-success--quality"
          : "wms-ops-gr-success wms-ops-gr-success--done"
      }
    >
      <div className="wms-ops-gr-success__glow" aria-hidden />
      <header className="wms-ops-gr-success__header">
        <div className="wms-ops-gr-success__icon" aria-hidden>
          <CheckCircle2 className="size-9" />
        </div>
        <p className="wms-ops-gr-success__eyebrow">{t("createFlow.success.directEyebrow")}</p>
        <h2 className="wms-ops-gr-success__title">{titleLabel}</h2>
        <p className="wms-ops-gr-success__subtitle">
          {supplierName || supplierCode
            ? t("createFlow.success.subtitleForSupplier", {
                name: supplierName ?? supplierCode ?? "",
              })
            : ""}
          {hasQuality
            ? t("createFlow.success.qualityPendingSubtitle")
            : t("createFlow.success.receiptDoneSubtitle")}
        </p>
        {documentValue ? (
          <SuccessDocumentChip
            label={t(isElectronicReceipt
              ? "createFlow.waybill.eReceiptNumber"
              : "createFlow.waybill.receiptNumber")}
            value={documentValue}
          />
        ) : null}
      </header>

      <div className="wms-ops-gr-success__stats">
        {receiptLines.length > 0 ? (
          <button
            type="button"
            className="wms-ops-gr-success__stat wms-ops-gr-success__stat--action"
            onClick={() => setLinesOpen(true)}
            title={t("createFlow.success.openAllLines")}
          >
            <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.line")}</span>
            <strong className="wms-ops-gr-success__stat-value">{result.lineCount}</strong>
            <span className="wms-ops-gr-success__stat-hint">{t("createFlow.success.viewList")}</span>
          </button>
        ) : (
          <div className="wms-ops-gr-success__stat">
            <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.line")}</span>
            <strong className="wms-ops-gr-success__stat-value">{result.lineCount}</strong>
          </div>
        )}
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.quantity")}</span>
          <strong className="wms-ops-gr-success__stat-value">
            {formatProjectNumber(result.quantity)}
          </strong>
        </div>
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.status")}</span>
          <strong className="wms-ops-gr-success__stat-value wms-ops-gr-success__stat-value--status">
            {statusValue}
          </strong>
        </div>
      </div>

      {hasQuality && qualityLines.length > 0 ? (
        <div className="wms-ops-gr-success__quality">
          <div className="wms-ops-gr-success__quality-copy">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            <div>
              <strong>{t("createFlow.success.qualityLinesCount", { count: qualityLines.length })}</strong>
              <span>{t("createFlow.success.qualityReceiptAfterApproval")}</span>
            </div>
          </div>
          <button
            type="button"
            className="wms-ops-gr-success__quality-btn"
            onClick={() => setQualityOpen(true)}
          >
            {t("createFlow.success.viewList")}
          </button>
        </div>
      ) : null}

      <footer className="wms-ops-gr-success__actions">
        <OpsActionButton type="button" variant="primary" onClick={onNew}>
          {t("createFlow.success.newRecord")}
        </OpsActionButton>
        {hasQuality ? (
          <OpsActionButton
            type="button"
            variant="secondary"
            onClick={() => navigate("/warehouse/quality/inspections")}
          >
            {t("createFlow.success.qualityList")}
          </OpsActionButton>
        ) : (
          <>
            <OpsActionButton type="button" variant="secondary" asChild>
              <Link to="/warehouse/goods-receipts/list">
                {t("createFlow.success.receiptList")}
              </Link>
            </OpsActionButton>
            {!hideRoutingActions ? (
              <GoodsReceiptPostCreateRoutingActions
                goodsReceiptId={result.id}
                transferLabel={t("createFlow.success.routeTransfer")}
                outboundLabel={t("createFlow.success.routeOutbound")}
              />
            ) : null}
          </>
        )}
      </footer>

      <QualityLinesDialog
        lines={receiptLines}
        open={linesOpen}
        onClose={() => setLinesOpen(false)}
        title={t("createFlow.qualityDialog.receiptLinesTitle")}
        description={t("createFlow.qualityDialog.orderLinesDescription")}
        searchAriaLabel={t("createFlow.qualityDialog.receiptLinesSearchAria")}
      />
      <QualityLinesDialog
        lines={qualityLines}
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
      />
    </div>
  );
}

function CreateSuccessPanel({
  result,
  supplierCode,
  assigneeCount,
  receiptNo,
  isElectronicReceipt,
  receiptLines,
  qualityLines,
  onNew,
}: {
  result: CreateGoodsReceiptResult;
  supplierCode?: string;
  assigneeCount: number;
  receiptNo: string;
  isElectronicReceipt: boolean;
  receiptLines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
    requireQualityControl?: boolean;
  }>;
  qualityLines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
  }>;
  onNew: () => void;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const navigate = useNavigate();
  const [linesOpen, setLinesOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const qualityCount = qualityLines.length;
  const hasQuality = qualityCount > 0;

  return (
    <div className="wms-ops-gr-success wms-ops-gr-success--wide wms-ops-gr-success--done">
      <div className="wms-ops-gr-success__glow" aria-hidden />
      <header className="wms-ops-gr-success__header">
        <div className="wms-ops-gr-success__icon" aria-hidden>
          <CheckCircle2 className="size-9" />
        </div>
        <p className="wms-ops-gr-success__eyebrow">{t("createFlow.success.orderEyebrow")}</p>
        <h2 className="wms-ops-gr-success__title">{t("createFlow.success.orderCreatedTitle")}</h2>
        <p className="wms-ops-gr-success__subtitle">
          {supplierCode
            ? t("createFlow.success.orderSubtitleWithSupplier", { code: supplierCode })
            : t("createFlow.success.orderSubtitleGeneric")}{" "}
          {t("createFlow.success.orderSubtitleTail")}
        </p>
        {receiptNo.trim() ? (
          <SuccessDocumentChip
            label={t(isElectronicReceipt
              ? "createFlow.waybill.eReceiptNumber"
              : "createFlow.waybill.receiptNumber")}
            value={receiptNo.trim()}
          />
        ) : null}
      </header>

      <div className="wms-ops-gr-success__stats">
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.task")}</span>
          <strong className="wms-ops-gr-success__stat-value">{result.tasks.length}</strong>
        </div>
        {receiptLines.length > 0 ? (
          <button
            type="button"
            className="wms-ops-gr-success__stat wms-ops-gr-success__stat--action"
            onClick={() => setLinesOpen(true)}
            title={t("createFlow.success.openAllLines")}
          >
            <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.linesAndQuantityStat")}</span>
            <strong className="wms-ops-gr-success__stat-value">
              {result.lineCount} · {formatProjectNumber(result.reservedQuantity)}
            </strong>
            <span className="wms-ops-gr-success__stat-hint">{t("createFlow.success.viewList")}</span>
          </button>
        ) : (
          <div className="wms-ops-gr-success__stat">
            <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.linesAndQuantityStat")}</span>
            <strong className="wms-ops-gr-success__stat-value">
              {result.lineCount} · {formatProjectNumber(result.reservedQuantity)}
            </strong>
          </div>
        )}
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">{t("createFlow.success.assignee")}</span>
          <strong className="wms-ops-gr-success__stat-value">{assigneeCount}</strong>
        </div>
      </div>

      {hasQuality ? (
        <div className="wms-ops-gr-success__quality">
          <div className="wms-ops-gr-success__quality-copy">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            <div>
              <strong>{t("createFlow.success.qualityLinesCount", { count: qualityCount })}</strong>
              <span>{t("createFlow.success.qualityAfterReceipt")}</span>
            </div>
          </div>
          <button
            type="button"
            className="wms-ops-gr-success__quality-btn"
            onClick={() => setQualityOpen(true)}
          >
            {t("createFlow.success.viewList")}
          </button>
        </div>
      ) : (
        <div className="wms-ops-gr-success__quality wms-ops-gr-success__quality--muted">
          {t("createFlow.success.noQualityLines")}
        </div>
      )}

      {result.tasks.length > 0 ? (
        <div className="wms-ops-gr-success__tasks">
          <div className="wms-ops-gr-success__tasks-title">{t("createFlow.success.createdTasks")}</div>
          <ul className="wms-ops-gr-success__tasks-list">
            {result.tasks.map((task) => (
              <li key={task.id}>
                <span className="wms-ops-gr-success__task-no">{task.taskNo}</span>
                <span className="wms-ops-gr-success__task-meta">
                  {t("createFlow.success.taskMeta", {
                    warehouseId: task.warehouseId,
                    lineCount: task.lineCount,
                    quantity: formatProjectNumber(task.plannedQuantity),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="wms-ops-gr-success__actions">
        <OpsActionButton type="button" variant="primary" onClick={onNew}>
          {t("createFlow.success.newRecord")}
        </OpsActionButton>
        <OpsActionButton
          type="button"
          variant="secondary"
          onClick={() => navigate("/warehouse/goods-receipts/tasks")}
        >
          {t("createFlow.success.goToTaskManagement")}
        </OpsActionButton>
        <OpsActionButton type="button" variant="secondary" asChild>
          <Link to="/warehouse/goods-receipts/list">{t("createFlow.success.receiptList")}</Link>
        </OpsActionButton>
      </footer>

      <QualityLinesDialog
        lines={receiptLines}
        open={linesOpen}
        onClose={() => setLinesOpen(false)}
        title={t("createFlow.qualityDialog.receiptLinesTitle")}
        description={t("createFlow.qualityDialog.orderLinesDescription")}
        searchAriaLabel={t("createFlow.qualityDialog.receiptLinesSearchAria")}
      />
      <QualityLinesDialog
        lines={qualityLines}
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
      />
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
function ReviewMultiListValue({
  values,
  t,
  valueClassName,
  multipleLabelKey,
  multipleCountKey,
  tooltipHintKey,
}: {
  values: string[];
  t: (key: string, options?: Record<string, unknown>) => string;
  valueClassName: string;
  multipleLabelKey: string;
  multipleCountKey: string;
  tooltipHintKey: string;
}): ReactElement {
  if (values.length === 0) {
    return (
      <strong className={cn("wms-ops-gr-review__meta-value", valueClassName)}>
        —
      </strong>
    );
  }

  if (values.length === 1) {
    return (
      <strong className={cn("wms-ops-gr-review__meta-value", valueClassName)}>
        {values[0]}
      </strong>
    );
  }

  return (
    <TooltipProvider delayDuration={160} disableHoverableContent={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "wms-ops-gr-review__meta-value cursor-help border-b border-dotted border-[color-mix(in_oklab,var(--wms-ops-accent)_45%,transparent)] bg-transparent p-0 text-left font-bold",
              valueClassName,
            )}
          >
            {t(multipleLabelKey)}
            <span className="ml-1 text-xs font-semibold text-[var(--wms-app-text-muted)]">
              ({values.length})
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className={cn(
            "wms-ops-page-hint-tooltip wms-ops-gr-review__multi-tooltip max-h-64 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border p-0 text-left shadow-[0_12px_40px_color-mix(in_oklab,black_45%,transparent)]",
            "!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]",
            "border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))]",
            "!text-[var(--wms-app-text)]",
          )}
        >
          <div className="sticky top-0 z-10 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-3 py-2">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-ops-accent)]">
              {t(multipleCountKey, {
                count: values.length,
              })}
            </div>
            {values.length > 12 ? (
              <p className="mt-0.5 text-[0.68rem] text-[var(--wms-app-text-muted)]">
                {t(tooltipHintKey)}
              </p>
            ) : null}
          </div>
          <ul className="max-h-48 overflow-y-auto overscroll-contain px-2 py-1.5 font-mono text-[0.75rem] leading-5">
            {values.map((value) => (
              <li
                key={value}
                className="rounded-md px-1.5 py-0.5 text-[var(--wms-app-text)] hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)]"
              >
                {value}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  loading = false,
  t,
}: {
  back: () => void;
  next: () => void | Promise<void>;
  disabled: boolean;
  loading?: boolean;
  t: (key: string) => string;
}): ReactElement {
  return (
    <footer className="mt-5 flex items-center justify-between rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3">
      <OpsActionButton type="button" variant="secondary" onClick={back}>
        {t("back")}
      </OpsActionButton>
      <OpsActionButton
        type="button"
        variant="primary"
        disabled={disabled}
        loading={loading}
        onClick={next}
      >
        {t("continue")}
      </OpsActionButton>
    </footer>
  );
}

type SuccessPreviewView =
  | "submit-receipt"
  | "submit-quality"
  | "success-receipt"
  | "success-quality";

const PREVIEW_RESULT: ManualGoodsReceiptResult = {
  id: 0,
  documentNo: "MK202600000099",
  initiationMode: "Direct",
  status: "Completed",
  lineCount: 2,
  quantity: 20,
  replayed: false,
};

const PREVIEW_RECEIPT_LINES = [
  {
    stockCode: "01/004",
    stockName: "CORSAIR Vengeance 32GB (2x16GB) DDR4 3600MHz CL18 RAM",
    quantity: 19,
    unitCode: "AD",
    requireQualityControl: false,
  },
  {
    stockCode: "Y008",
    stockName: "8 Yem",
    quantity: 1,
    unitCode: "AD",
    requireQualityControl: true,
  },
];

const PREVIEW_QUALITY_LINES = [
  {
    stockCode: "Y008",
    stockName: "8 Yem",
    quantity: 1,
    unitCode: "AD",
  },
];

/** Kayıt atmadan success / submit ekranlarını tasarım için önizler. */
export function GoodsReceiptSuccessPreviewPage(): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [view, setView] = useState<SuccessPreviewView>("success-receipt");

  const tabs: Array<{ id: SuccessPreviewView; label: string }> = [
    { id: "submit-receipt", label: "Submit · İrsaliye" },
    { id: "submit-quality", label: "Submit · G.K.K" },
    { id: "success-receipt", label: "Success · İrsaliye" },
    { id: "success-quality", label: "Success · G.K.K" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="rounded-xl border border-amber-600/35 bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100">
        <strong className="font-semibold">Tasarım önizlemesi</strong>
        {" — "}
        Kayıt atılmaz. Gerçek success / submit bileşenleri mock veri ile gösterilir.
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-semibold transition",
              view === tab.id
                ? "border-[var(--wms-ops-accent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_16%,transparent)] text-[var(--wms-ops-accent)]"
                : "border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)] hover:text-[var(--wms-app-text)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Panel
        title={t("createFlow.steps.1")}
        icon={<CheckCircle2 className="size-5" />}
      >
        {view === "submit-receipt" ? (
          <CreateSubmitScreen
            mode="receipt"
            phase="running"
            lineCount={2}
            supplierName="Digi-Key Electronics"
            receiptNo="SADSAD000002132"
          />
        ) : null}
        {view === "submit-quality" ? (
          <CreateSubmitScreen
            mode="quality"
            phase="running"
            lineCount={1}
            supplierName="Digi-Key Electronics"
            receiptNo="SADSAD000002132"
          />
        ) : null}
        {view === "success-receipt" ? (
          <DirectCreateSuccessPanel
            result={PREVIEW_RESULT}
            supplierName="Digi-Key Electronics"
            supplierCode="320.002"
            receiptNo="SADSAD000002132"
            isElectronicReceipt
            receiptLines={PREVIEW_RECEIPT_LINES.map((line) => ({
              ...line,
              requireQualityControl: false,
            }))}
            qualityLines={[]}
            hideRoutingActions
            onNew={() => setView("success-receipt")}
          />
        ) : null}
        {view === "success-quality" ? (
          <DirectCreateSuccessPanel
            result={{
              ...PREVIEW_RESULT,
              status: "AwaitingQuality",
              qualityInspectionId: 1,
            }}
            supplierName="Digi-Key Electronics"
            supplierCode="320.002"
            receiptNo="SADSAD000002132"
            isElectronicReceipt
            receiptLines={PREVIEW_RECEIPT_LINES}
            qualityLines={PREVIEW_QUALITY_LINES}
            hideRoutingActions
            onNew={() => setView("success-quality")}
          />
        ) : null}
      </Panel>
    </div>
  );
}
