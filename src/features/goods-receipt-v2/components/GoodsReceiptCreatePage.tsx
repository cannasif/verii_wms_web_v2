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
import { createPortal } from "react-dom";
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
  Hash,
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
import { StockIdentityCell } from "@/components/shared/StockIdentityCell";
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
import { getWorkspacePortalRoot } from "@/lib/workspace-portal";
import { navigateToErrorTarget } from "@/lib/toast-error-navigation";
import { useAuthStore } from "@/stores/auth-store";
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
import { GoodsReceiptPostCreateRoutingActions } from "./GoodsReceiptPostCreateRoutingActions";

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

async function resolveWarehouseNamesByCode(
  lines: OpenOrderLine[],
  branch: string,
): Promise<Map<number, string>> {
  const codes = [
    ...new Set(
      lines
        .map((line) => line.targetWarehouseCode)
        .filter((code): code is number => code != null),
    ),
  ];
  const entries = await Promise.all(
    codes.map(async (code) => {
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
        const warehouse = page.items.find((item) => item.warehouseCode === code);
        return [code, warehouse?.warehouseName?.trim() || ""] as const;
      } catch {
        return [code, ""] as const;
      }
    }),
  );
  return new Map(entries.filter(([, name]) => Boolean(name)));
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
  const createEyebrow = `${t("list.eyebrowParent")} / ${t("list.eyebrowModule")}`;
  const [step, setStep] = useState(0);
  const [busyAction, setBusyAction] = useState<
    "orders" | "orderByNumber" | "lines" | "confirm" | "create" | null
  >(null);
  const busy = busyAction != null;
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [projectCodeFilter, setProjectCodeFilter] = useState("");
  const [warehouseCodeFilter, setWarehouseCodeFilter] = useState("");
  const [searchTokens, setSearchTokens] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [warehouseNameByCode, setWarehouseNameByCode] = useState<Map<number, string>>(
    () => new Map(),
  );
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  const [orders, setOrders] = useState<OpenOrderHeader[]>([]);
  const [directOrderLines, setDirectOrderLines] = useState<OpenOrderLine[]>([]);
  const [selectedDirectLineKeys, setSelectedDirectLineKeys] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [warehouseAccess, setWarehouseAccess] = useState<UserWarehouseAccess | null>(null);
  const [showAllocatedOpenOrderLines, setShowAllocatedOpenOrderLines] = useState(false);
  const [allowAnyActiveLocation, setAllowAnyActiveLocation] = useState(false);
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
  const hasQualityLines = plannedLines.some((line) => line.requireQualityControl);
  const receiptLines = plannedLines.flatMap((line) =>
    line.stockCode
      ? [
          {
            stockCode: line.stockCode,
            stockName: line.stockName,
            quantity: line.quantity,
            unitCode: line.unitCode,
            requireQualityControl: Boolean(line.requireQualityControl),
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
  const selectedProjectCodesForReview = [
    ...new Set(plannedLines.map((line) => line.projectCode?.trim()).filter(Boolean)),
  ].join(", ");
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
    void resolveWarehouseNamesByCode(directOrderLines, branch).then((names) => {
      if (!active || names.size === 0) return;
      setWarehouseNameByCode((current) => {
        let changed = names.size !== current.size;
        if (!changed) {
          for (const [code, name] of names) {
            if (current.get(code) !== name) {
              changed = true;
              break;
            }
          }
        }
        return changed ? names : current;
      });
    });
    return () => {
      active = false;
    };
  }, [branchCode, customer?.branch, direct, directOrderLines]);

  useEffect(() => {
    let active = true;
    void goodsReceiptV2Api.warehouseAccess()
      .then((access) => { if (active) setWarehouseAccess(access); })
      .catch((cause: Error) => { if (active) report(cause, "Depo yetkileri alınamadı."); });
    void goodsReceiptV2Api.policy(customer?.branch ?? branchCode)
      .then((policy) => {
        if (active) {
          setShowAllocatedOpenOrderLines(policy.showAllocatedOpenOrderLines);
          setAllowAnyActiveLocation(!policy.blockPutawayUntilQualityDecision);
        }
      })
      .catch(() => {
        if (active) {
          setShowAllocatedOpenOrderLines(false);
          setAllowAnyActiveLocation(false);
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
    setWarehouseNameByCode(new Map());
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
      setWarehouseCodeFilter("");
      setSearchTokens([]);
      setSearchDraft("");
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
      if (direct) {
        const names = await resolveWarehouseNamesByCode(
          rows,
          resolvedCustomer.branchCode,
        );
        setWarehouseNameByCode(names);
      } else {
        setWarehouseNameByCode(new Map());
      }
      toast.success(
        `${orderNumber} siparişi ve ${resolvedCustomer.customerCode} tedarikçisi getirildi.`,
      );
    } catch (cause) {
      report(cause, "Sipariş numarasıyla arama başarısız.");
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
        const names = await resolveWarehouseNamesByCode(
          filteredLines,
          customer.branch,
        );
        setWarehouseNameByCode(names);
        if (
          directOrders.length === 1 &&
          canUseOrderWarehouse(directOrders[0].targetWarehouseCode)
        )
          setSelectedOrders([directOrders[0].siparisNo]);
        return;
      }
      setWarehouseNameByCode(new Map());
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
      setBusyAction(null);
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
              warehouseDefaultLocationId: warehouse?.defaultGoodsReceiptLocationId,
              receivingLocationId: warehouse?.defaultGoodsReceiptLocationId,
              receivingLocationValue: warehouse?.defaultGoodsReceiptLocationId
                ? String(warehouse.defaultGoodsReceiptLocationId)
                : null,
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
    if (!isValidGoodsReceiptDocumentNo(receiptNo))
      return t(
        isElectronicReceipt
          ? "createFlow.validation.eReceiptNo"
          : "createFlow.validation.receiptNo",
      );
    if (!waybillDate) return t("createFlow.validation.waybillDate");
    if (lines.length === 0) return t("createFlow.validation.linesRequired");
    if (plannedLines.length === 0)
      return t("createFlow.validation.confirmLinesRequired");
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
          return {
            ...line,
            requireQualityControl: qualityByStockId.get(line.stockId) === true,
          };
        }),
      );
      setStep(1);
    } catch (cause) {
      report(cause, "Kalite kontrol kuralları doğrulanamadı.");
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
    setBusyAction("create");
    setError(null);
    setShowFieldErrors(false);
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
        requireQualityControl: plannedLines.some((line) => line.requireQualityControl),
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
      await operationDraft.clearDraft();
      toast.success(`${t("created")}: ${created.documentNo}`);
    } catch (cause) {
      report(cause, direct ? "Doğrudan mal kabul tamamlanamadı." : "Mal kabul emri oluşturulamadı.");
    } finally {
      setBusyAction(null);
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
        operationName="doğrudan mal kabul"
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
                    loading={busyAction === "orders"}
                    disabled={busy || !customer}
                    onClick={() => void loadOrders()}
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
                    onClick={() => void loadOrderByNumber()}
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
                        visible: visibleDirectOrderLines.length,
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
                              {formatProjectNumber(line.orderedQuantity ?? 0)}
                            </td>
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
                            <td>
                              <span className="font-mono font-semibold">
                                {line.targetWarehouseCode ?? "—"}
                              </span>
                              {warehouseName ? (
                                <span className="wms-ops-order-fetch__warehouse-name">
                                  {" "}
                                  · {warehouseName}
                                </span>
                              ) : null}
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
                    {t("noOrders")}
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
                  onClick={() => void loadLines()}
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
              data-wms-error-keys="tek depo|seçilen depo|single warehouse|selected warehouse"
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
                          aria-label={`${userLabel(user)} atamasını kaldır`}
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

            {/* Docked Geri/Devam ile "Seçili kalemleri hazırla" çakışmasın */}
            <div className="h-24 shrink-0 sm:h-28" aria-hidden />

            <Footer
              docked
              back={() => {
                setError(null);
                setLines([]);
              }}
              next={() => void goToConfirmation()}
              disabled={busy}
              loading={busyAction === "confirm"}
              t={t}
            />
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
                setAssignees([]);
                setReceiptNo("");
                setWaybillDate(today());
                setError(null);
              }}
            />)
          ) : (
            <div className="wms-ops-gr-review">
              <div className="wms-ops-gr-review__list">
                <div className="wms-ops-gr-review__hero">
                  <section className="wms-ops-gr-review__hero-card wms-ops-gr-review__hero-card--supplier">
                    <div className="wms-ops-gr-review__hero-head">
                      <span className="wms-ops-gr-review__hero-icon">
                        <Building2 className="size-4" />
                      </span>
                      <span className="wms-ops-gr-review__hero-label">{t("createFlow.review.supplierCard")}</span>
                    </div>
                    <div className="wms-ops-gr-review__hero-title">
                      {selectedCustomer?.customerName || "—"}
                    </div>
                    <div className="wms-ops-gr-review__hero-meta">
                      {t("createFlow.review.customerCode")}:{" "}
                      <strong className="wms-ops-gr-review__hero-meta-code">
                        {selectedCustomer?.customerCode || customer?.code || "—"}
                      </strong>
                    </div>
                    <div className="wms-ops-gr-review__hero-meta wms-ops-gr-review__hero-meta--muted">
                      {t("createFlow.review.branch")}: {selectedCustomer?.branchCode ?? branchCode}
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
                          <ClipboardList className="size-3.5" /> {isElectronicReceipt ? t("createFlow.waybill.eReceipt") : t("createFlow.review.waybill")}
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
                        <ReviewOrderNumbersValue
                          orderNumbers={reviewOrderNumbers}
                          t={t}
                        />
                      </div>
                      {direct ? (
                        <div className="wms-ops-gr-review__meta-item">
                          <span className="wms-ops-gr-review__meta-label">
                            <Building2 className="size-3.5" /> {t("createFlow.review.projectAndOrderDate")}
                          </span>
                          <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--project">
                            {`${selectedProjectCodesForReview || "—"} · ${selectedOrderDatesForReview || "—"}`}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="wms-ops-gr-review__section-title">{t("createFlow.review.summaryTitle")}</div>
                <ReviewRow
                  label={t("createFlow.review.linesAndQuantity")}
                  value={`${plannedLines.length} / ${formatProjectNumber(selectedQuantity, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}`}
                  emphasis
                />
                {direct ? (
                  <ReviewRow
                    label={t("createFlow.review.orderAvailableQuantity")}
                    value={formatProjectNumber(selectedAvailableQuantity, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 6,
                    })}
                  />
                ) : null}
                <ReviewRow
                  label={t("createFlow.review.warehouseCount")}
                  value={String(new Set(plannedLines.map((x) => x.targetWarehouseId)).size)}
                />
                {!direct && (
                  <ReviewRow
                    label={t("createFlow.assignees.title")}
                    value={assignees.map(userLabel).join(", ") || "—"}
                  />
                )}
                <ReviewRow
                  label={t("createFlow.review.trackingLineCount")}
                  value={String(
                    plannedLines.reduce((sum, x) => sum + x.trackings.length, 0),
                  )}
                />
              </div>

              <div
                className={cn(
                  "wms-ops-gr-review__quality",
                  hasQualityLines
                    ? "wms-ops-gr-review__quality--active"
                    : "wms-ops-gr-review__quality--none",
                )}
              >
                <span className="wms-ops-gr-review__quality-icon">
                  <ShieldCheck className="size-5" />
                </span>
                <span className="wms-ops-gr-review__quality-text">
                  <strong>{t("createFlow.review.qualityRoutingTitle")}</strong>
                  <small>
                    {hasQualityLines
                      ? t("createFlow.review.qualityRoutingActiveHint")
                      : t("createFlow.review.qualityRoutingNoneHint")}
                  </small>
                </span>
                {hasQualityLines ? (
                  <QualityLinesReviewTrigger lines={qualityLines} />
                ) : (
                  <span className="wms-ops-gr-review__quality-pill wms-ops-gr-review__quality-pill--muted">
                    {t("createFlow.review.qualityNone")}
                  </span>
                )}
              </div>
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
                  onClick={() => void create()}
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

function formatReceiptQuantity(
  value: number,
  unitCode?: string | null,
): string {
  return formatProjectNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: isPieceUnit(unitCode) ? 0 : 6,
  });
}

function ReceiptEntryRow({
  line,
  allowAnyActiveLocation,
  dataLineKey,
  sortOrder,
  branchCode,
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
  const [quantityText, setQuantityText] = useState(() =>
    formatReceiptQuantity(line.quantity, line.unitCode),
  );
  const pieceUnit = isPieceUnit(line.unitCode);

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
  const receivingLabel =
    line.receivingLocationCode ||
    (line.receivingLocationValue
      ? `Raf #${line.receivingLocationValue}`
      : "");
  const serialSummary = needsTracking
    ? line.trackings.length > 0
      ? serialMode
        ? t("createFlow.entryRow.serialCount", {
            count: line.trackings.filter((x) => x.serialNo).length,
          })
        : t("createFlow.entryRow.lotRowCount", { count: line.trackings.length })
      : t("createFlow.entryRow.planSerial")
    : "—";

  useEffect(() => {
    setQuantityText(formatReceiptQuantity(line.quantity, line.unitCode));
  }, [line.quantity, line.unitCode]);

  useEffect(() => {
    if (!line.targetWarehouseId) return;
    let cancelled = false;
    const locationQuery = allowAnyActiveLocation
      ? goodsReceiptV2Api.locations
      : goodsReceiptV2Api.receivingLocations;
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
      .then((page) => {
        if (cancelled) return;
        const configuredDefault = page.items.find(
          (item) => item.id === line.warehouseDefaultLocationId,
        );
        const preferred = configuredDefault ??
          (allowAnyActiveLocation
            ? page.items.find((item) => item.id === line.putawayLocationId)
            : page.items.find((item) => item.locationType === "Receiving") ??
              page.items[0]);
        if (!preferred) return;

        if (line.receivingLocationId == null) {
          updateLine(key, {
            receivingLocationId: preferred.id,
            receivingLocationValue: String(preferred.id),
            receivingLocationCode: preferred.code,
            ...(configuredDefault && allowAnyActiveLocation
              ? {
                  putawayLocationId: preferred.id,
                  putawayLocationCode: preferred.code,
                }
              : {}),
          });
          return;
        }

        const selectedIsValid = page.items.some(
          (item) => item.id === line.receivingLocationId,
        );
        if (selectedIsValid) {
          if (!line.receivingLocationCode) {
            const current = page.items.find(
              (item) => item.id === line.receivingLocationId,
            );
            if (current) {
              updateLine(key, {
                receivingLocationCode: current.code,
                ...(configuredDefault && allowAnyActiveLocation
                  ? {
                      putawayLocationId: current.id,
                      putawayLocationCode: current.code,
                    }
                  : {}),
              });
            }
          }
          return;
        }

        if (
          line.putawayLocationId != null &&
          line.receivingLocationId === line.putawayLocationId
        ) {
          if (!line.receivingLocationCode && line.putawayLocationCode) {
            updateLine(key, {
              receivingLocationCode: line.putawayLocationCode,
            });
          }
          return;
        }

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
          setSuggestions(items);
          if (line.warehouseDefaultLocationId != null) return;
          const top = items[0];
          if (!top) return;
          const stillValid = items.some(
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
          </div>

          <div className="wms-ops-receipt-entry-row__toolbar">
            <div className="wms-ops-receipt-meta-badges flex min-w-0 flex-nowrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="wms-ops-code-badge wms-ops-code-badge--stock inline-flex items-center gap-1">
                <Hash className="wms-ops-meta-badge__icon" aria-hidden />
                <StockIdentityCell
                  stockId={line.stockId}
                  stockCode={line.stockCode}
                  stockName={line.stockName}
                  branchCode={branchCode}
                  layout="code"
                />
              </span>
              {warehouseBadge ? (
                <span className="wms-ops-meta-badge-divider" aria-hidden />
              ) : null}
              {warehouseBadge ? (
                <span className="wms-ops-warehouse-badge">
                  <Building2 className="wms-ops-meta-badge__icon" aria-hidden />
                  {warehouseBadge}
                </span>
              ) : null}
              <span className="wms-ops-meta-badge-divider" aria-hidden />
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
                            formatReceiptQuantity(line.quantity, line.unitCode),
                          );
                          return;
                        }
                        const normalized = pieceUnit
                          ? Math.round(parsed)
                          : parsed;
                        if (pieceUnit && normalized < 1) {
                          setQuantityText(
                            formatReceiptQuantity(line.quantity, line.unitCode),
                          );
                          return;
                        }
                        const capped = Math.min(
                          normalized,
                          line.availableQuantity ?? normalized,
                        );
                        const finalQty = pieceUnit
                          ? Math.max(1, Math.round(capped))
                          : capped;
                        updateLine(key, { quantity: finalQty });
                        setQuantityText(
                          formatReceiptQuantity(finalQty, line.unitCode),
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
                          const stepped = pieceUnit
                            ? Math.round(base) + 1
                            : base + 1;
                          const next = Math.min(
                            stepped,
                            line.availableQuantity ?? stepped,
                          );
                          const finalQty = pieceUnit
                            ? Math.max(1, Math.round(next))
                            : next;
                          updateLine(key, { quantity: finalQty });
                          setQuantityText(
                            formatReceiptQuantity(finalQty, line.unitCode),
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
                          const stepped = pieceUnit
                            ? Math.round(base) - 1
                            : base - 1;
                          if (stepped < 1) return;
                          const finalQty = pieceUnit
                            ? Math.round(stepped)
                            : stepped;
                          updateLine(key, { quantity: finalQty });
                          setQuantityText(
                            formatReceiptQuantity(finalQty, line.unitCode),
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
                data-wms-error-keys="lot/seri planı|lot/seri toplamı|seri satırı|benzersiz seri|aynı seri|miktar kadar benzersiz seri|takipsiz kalemde lot|lot zorunludur|üretim tarihi|son kullanma|lot/serial plan|serial row|duplicate serial|manufacturing date|expiration date"
              >
                <label className="wms-ops-entry-label">{t("createFlow.entryRow.serialNo")}</label>
                {needsTracking ? (
                  <OpsFieldShell>
                    <button
                      type="button"
                      className={cn(
                        "wms-ops-lookup-trigger wms-ops-field h-7",
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
                    <input
                      className={cn(OPS_FIELD_CLASS, "h-7 w-full cursor-not-allowed opacity-55")}
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
                    updateLine(key, {
                      receivingLocationValue: String(location.id),
                      receivingLocationId: location.id,
                      receivingLocationCode: location.code,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <StockTrackingPolicyField policy={line.trackingPolicy} compact />
        </div>

        <div className="wms-ops-receipt-entry-row__ready">
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
          <span className="wms-ops-receipt-entry-row__status text-[0.58rem] font-semibold uppercase tracking-wider text-[var(--wms-app-text-muted)]">
            {confirmed ? t("createFlow.entryRow.confirm") : t("createFlow.entryRow.ready")}
          </span>
        </div>

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
                      onClick={() => updateLine(key, putawayLocationPatch(item))}
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

      {serialMode && line.serialGenerationKey && (
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
  const { t } = useModuleTranslation("goods-receipt-v2");
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
      toast.error(t("createFlow.validation.enterAtLeastOneSerial"));
      return;
    }
    if (serials.length > Math.floor(line.quantity)) {
      toast.error(t("createFlow.validation.serialCountExceedsQuantity"));
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

function QualityLinesDialog({
  lines,
  open,
  onClose,
  title,
  description,
  searchAriaLabel,
}: {
  lines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
    requireQualityControl?: boolean;
  }>;
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  searchAriaLabel?: string;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return lines;
    return lines.filter((line) => {
      const code = line.stockCode.toLocaleLowerCase("tr-TR");
      const name = (line.stockName || "").toLocaleLowerCase("tr-TR");
      return code.includes(query) || name.includes(query);
    });
  }, [lines, search]);

  return (
    <ResponsiveDialog
      open={open}
      onClose={() => {
        onClose();
        setSearch("");
      }}
      title={title ?? t("createFlow.qualityDialog.title")}
      description={description ?? t("createFlow.qualityDialog.description")}
      variant="lookup"
      className="!max-w-2xl"
    >
      <div className="wms-ops-gr-review__quality-dialog-body">
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
        <div className="wms-ops-gr-review__quality-dialog-meta">
          <span>
            {t("createFlow.qualityDialog.showing")}: <strong>{filtered.length}</strong> / {lines.length}
          </span>
          <span>{t("createFlow.qualityDialog.scrollHint")}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="wms-ops-gr-review__quality-dialog-empty">
            {t("createFlow.qualityDialog.empty")}
          </div>
        ) : (
          <ul className="wms-ops-gr-review__quality-dialog-list">
            {filtered.map((line, index) => (
              <li key={`${line.stockCode}-${line.quantity}-${index}`}>
                <span className="wms-ops-gr-review__quality-dialog-code">
                  {line.stockCode}
                </span>
                <span
                  className="wms-ops-gr-review__quality-dialog-name"
                  title={line.stockName || undefined}
                >
                  {line.stockName || "—"}
                </span>
                {line.requireQualityControl ? (
                  <span className="wms-ops-gr-review__quality-dialog-badge">{t("createFlow.qualityDialog.qualityBadge")}</span>
                ) : null}
                <span className="wms-ops-gr-review__quality-dialog-qty">
                  {formatProjectNumber(line.quantity, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {line.unitCode || ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ResponsiveDialog>
  );
}

function QualityLinesReviewTrigger({
  lines,
  label,
  className,
}: {
  lines: Array<{
    stockCode: string;
    stockName?: string;
    quantity: number;
    unitCode?: string;
  }>;
  label?: string;
  className?: string;
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn("wms-ops-gr-review__quality-pill", className)}
        onClick={() => setOpen(true)}
      >
        {label ?? t("createFlow.review.viewQualityList", { count: lines.length })}
      </button>
      <QualityLinesDialog lines={lines} open={open} onClose={() => setOpen(false)} />
    </>
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
}): ReactElement {
  const { t } = useTranslation("goods-receipt-v2");
  const navigate = useNavigate();
  const [linesOpen, setLinesOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const hasQuality = qualityLines.length > 0;
  const statusLabel = hasQuality
    ? t("createFlow.success.sentToQuality")
    : t("createFlow.success.receiptCreated");

  return (
    <div className="wms-ops-gr-success wms-ops-gr-success--done">
      <div className="wms-ops-gr-success__glow" aria-hidden />
      <header className="wms-ops-gr-success__header">
        <div className="wms-ops-gr-success__icon" aria-hidden>
          <CheckCircle2 className="size-9" />
        </div>
        <p className="wms-ops-gr-success__eyebrow">{t("createFlow.success.directEyebrow")}</p>
        <h2 className="wms-ops-gr-success__title">{statusLabel}</h2>
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
{(receiptNo || result?.documentNo) ? (
          <div className="wms-ops-gr-success__doc">
            <span className="wms-ops-gr-success__doc-label">
              {isElectronicReceipt ? t("createFlow.waybill.eReceipt") : t("createFlow.success.documentNo")}
            </span>
            <strong className="wms-ops-gr-success__doc-value">{receiptNo ?? result?.documentNo}</strong>
          </div>
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
            {statusLabel}
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
        {!hasQuality ? (
          <GoodsReceiptPostCreateRoutingActions
            goodsReceiptId={result.id}
            transferLabel={t("createFlow.success.routeTransfer")}
            outboundLabel={t("createFlow.success.routeOutbound")}
          />
        ) : null}
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
        ) : null}
      </footer>

      <QualityLinesDialog
        lines={receiptLines}
        open={linesOpen}
        onClose={() => setLinesOpen(false)}
        title={t("createFlow.qualityDialog.receiptLinesTitle")}
        description={t("createFlow.qualityDialog.receiptLinesDescription")}
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
{(receiptNo || result?.documentNo) ? (
          <div className="wms-ops-gr-success__doc">
            <span className="wms-ops-gr-success__doc-label">
              {isElectronicReceipt ? t("createFlow.waybill.eReceipt") : t("createFlow.success.documentNo")}
            </span>
            <strong className="wms-ops-gr-success__doc-value">{receiptNo ?? result?.documentNo}</strong>
          </div>
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
function ReviewOrderNumbersValue({
  orderNumbers,
  t,
}: {
  orderNumbers: string[];
  t: (key: string, options?: Record<string, unknown>) => string;
}): ReactElement {
  if (orderNumbers.length === 0) {
    return (
      <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--order">
        —
      </strong>
    );
  }

  if (orderNumbers.length === 1) {
    return (
      <strong className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--order">
        {orderNumbers[0]}
      </strong>
    );
  }

  return (
    <TooltipProvider delayDuration={160} disableHoverableContent={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="wms-ops-gr-review__meta-value wms-ops-gr-review__meta-value--order cursor-help border-b border-dotted border-[color-mix(in_oklab,var(--wms-ops-accent)_45%,transparent)] bg-transparent p-0 text-left font-bold"
          >
            {t("createFlow.review.multipleOrders")}
            <span className="ml-1 text-xs font-semibold text-[var(--wms-app-text-muted)]">
              ({orderNumbers.length})
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className={cn(
            "wms-ops-page-hint-tooltip max-h-64 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border p-0 text-left shadow-[0_12px_40px_color-mix(in_oklab,black_45%,transparent)]",
            "!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]",
            "border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))]",
            "!text-[var(--wms-app-text)]",
          )}
        >
          <div className="sticky top-0 z-10 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-3 py-2">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-ops-accent)]">
              {t("createFlow.review.multipleOrdersCount", {
                count: orderNumbers.length,
              })}
            </div>
            {orderNumbers.length > 12 ? (
              <p className="mt-0.5 text-[0.68rem] text-[var(--wms-app-text-muted)]">
                {t("createFlow.review.ordersTooltipHint")}
              </p>
            ) : null}
          </div>
          <ul className="max-h-48 overflow-y-auto overscroll-contain px-2 py-1.5 font-mono text-[0.75rem] leading-5">
            {orderNumbers.map((orderNo) => (
              <li
                key={orderNo}
                className="rounded-md px-1.5 py-0.5 text-[var(--wms-app-text)] hover:bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)]"
              >
                {orderNo}
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
  sticky = false,
  docked = false,
}: {
  back: () => void;
  next: () => void;
  disabled: boolean;
  loading?: boolean;
  t: (key: string) => string;
  sticky?: boolean;
  docked?: boolean;
}): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === "premium";

  const bar = (
    <footer className="flex items-center justify-between rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur">
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

  if (docked) {
    const workspaceRoot = getWorkspacePortalRoot();
    if (workspaceRoot) {
      return createPortal(
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-30",
            isPremium ? "px-4 pb-5 sm:px-6 lg:px-8" : "px-3 pb-3 sm:px-4",
          )}
        >
          <div
            className={cn(
              "pointer-events-auto mx-auto w-full",
              isPremium && "max-w-[1560px]",
            )}
          >
            {bar}
          </div>
        </div>,
        workspaceRoot,
      );
    }
  }

  return (
    <footer
      className={cn(
        sticky
          ? "sticky bottom-3 z-20 flex items-center justify-between rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur"
          : "mt-5 flex justify-between border-t border-[var(--wms-app-border)] pt-4",
      )}
    >
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
    </footer>
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
