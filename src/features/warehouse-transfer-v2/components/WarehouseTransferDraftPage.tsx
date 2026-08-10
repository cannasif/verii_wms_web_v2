import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UserRoundCog,
  X,
} from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { PRODUCTION_WORK_ORDERS_PAGE_PATH } from "@/features/production/components/ProductionWorkOrderTransferTabPanel";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { autoSelectInputCaptureHandlers } from "@/lib/select-input-contents";
import { OperationFlowTabs } from "@/components/shared/OperationFlowTabs";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from "@/components/shared/OpsDialogShell";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OpsPageHeader } from "@/components/shared/OpsPageHeader";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { StockSelectDialog } from "@/components/shared/StockSelectDialog";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useDropdownInfiniteSearch, type DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import { StockIdentityCell } from "@/components/shared/StockIdentityCell";
import { TrackingPlanEditor } from "@/components/shared/TrackingPlanEditor";
import { StockTrackingPolicyField } from "@/features/stock-tracking/effective-stock-tracking";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import type { PagedResponse } from "@/types/api";
import { OperationDraftRestoreDialog } from "@/features/operation-drafts/OperationDraftRestoreDialog";
import { useOperationDraft } from "@/features/operation-drafts/useOperationDraft";
import type {
  ActiveUserOption,
  CustomerOption,
  LocationOption,
  SeriesOption,
  StockOption,
  WarehouseOption,
  YapCodeOption,
} from "@/features/goods-receipt-v2/types/goods-receipt.types";
import { warehouseTransferApi } from "../api/warehouse-transfer.api";
import { productionTransferApi } from "@/features/production-transfer/api";
import type {
  CreateTransferDraftResult,
  TransferDraftLine,
  TransferExecutionKind,
  TransferOrderHeader,
  TransferSourceKind,
  WarehouseTransferPolicy,
} from "../types/warehouse-transfer.types";

const today = () => new Date().toLocaleDateString("en-CA");
const D = "transferDraft";
const assigneeDisplayName = (user: ActiveUserOption) =>
  `${user.firstName} ${user.lastName}`.trim() || user.username;
const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});
const warehouseOption = (x: WarehouseOption) => ({
  value: `${x.id}|${x.warehouseCode}`,
  label: `${x.warehouseCode} · ${x.warehouseName}`,
});
const locationOption = (x: LocationOption) => ({
  value: String(x.id),
  label: `${x.code} · ${x.name}`,
  description: x.locationType,
});
type SourceLocationRow = { id: number; code: string; name: string; locationType?: string; availableQuantity?: number };
const sourceLocationOption = (x: SourceLocationRow) => ({
  value: String(x.id),
  label: `${x.code} · ${x.name}`,
  description: x.availableQuantity !== undefined ? `Kullanılabilir: ${x.availableQuantity}` : x.locationType,
});
const customerOption = (x: CustomerOption) => ({
  value: `${x.id}|${x.customerCode}`,
  label: `${x.customerCode} · ${x.customerName}`,
});
const stockValue = (
  x: Pick<StockOption, "id" | "erpStockCode" | "stockName" | "unitCode">,
) => encodeURIComponent(JSON.stringify(x));
const stockOption = (x: StockOption) => ({
  value: stockValue(x),
  label: `${x.erpStockCode} · ${x.stockName ?? ""}`,
  description: x.unitCode,
});
const yapValue = (
  x: Pick<YapCodeOption, "id" | "configurationCode" | "description">,
) => encodeURIComponent(JSON.stringify(x));
const yapOption = (x: YapCodeOption) => ({
  value: yapValue(x),
  label: `${x.configurationCode} · ${x.description ?? ""}`,
});
const blankLine = (): TransferDraftLine => ({
  localId: crypto.randomUUID(),
  quantity: 1,
  unitCode: "",
  trackingType: "None",
  requireHandlingUnit: false,
  trackings: [],
});

type WarehouseTransferDirectDraft = {
  sourceKind: TransferSourceKind;
  customerValue: string | null;
  orders: TransferOrderHeader[];
  selectedOrders: string[];
  sourceValue: string | null;
  targetValue: string | null;
  sourceStaging: string | null;
  targetReceiving: string | null;
  seriesId: string | null;
  documentDate: string;
  dispatchAt: string;
  arrivalAt: string;
  priority: string;
  projectCode?: string;
  externalReference: string;
  description: string;
  lines: TransferDraftLine[];
};

const hasWarehouseTransferDirectDraft = (draft: WarehouseTransferDirectDraft) =>
  Boolean(
    draft.sourceValue ||
    draft.targetValue ||
    draft.selectedOrders.length ||
    draft.externalReference.trim() ||
    draft.projectCode?.trim() ||
    draft.description.trim() ||
    draft.lines.some((line) => line.stockId || line.source),
  );

type TransferSourceSnapshot = {
  lines: TransferDraftLine[];
  sourceValue: string | null;
  targetValue: string | null;
  sourceStaging: string | null;
  targetReceiving: string | null;
  projectCode: string;
  externalReference: string;
  description: string;
  productionHeaderId: number | null;
  productionOrderId: number | null;
  productionPlanNo: string;
  productionOrderNo: string;
  productionPurpose: "MaterialSupply" | "WorkInProgressMove" | "OutputMove";
  productionOperationCode: string;
  sourceWorkCenterCode: string;
  targetWorkCenterCode: string;
  supplierValue: string | null;
  subcontractOrderNo: string;
};

const cloneTransferDraftLines = (items: TransferDraftLine[]): TransferDraftLine[] =>
  items.map((line) => ({
    ...line,
    trackingPolicy: line.trackingPolicy ? { ...line.trackingPolicy } : undefined,
    source: line.source ? { ...line.source } : undefined,
    trackings: line.trackings.map((tracking) => ({ ...tracking })),
  }));

export type TransferDraftVariant = "warehouse" | "production" | "subcontracting";
export interface ProductionTransferInitialSource {
  sourceSystemCode: string;
  workOrderNumber: string;
  projectCode?: string;
  existingProductionHeaderId?: number;
  existingProductionOrderId?: number;
  sourceWarehouse: { id: number; code: number };
  targetWarehouse: { id: number; code: number };
  materials: Array<{ stockId: number; stockCode: string; stockName?: string; unitCode: string; yapCodeId?: number; configurationCode?: string; quantity: number }>;
}
export type SubcontractingTransferDirection =
  | "IssueToSupplier"
  | "ReceiptFromSupplier"
  | "SupplierToSupplier";

export function WarehouseTransferDraftPage({
  variant = "warehouse",
  fixedSubcontractingDirection,
  initialProductionSource,
  initialAssignees,
}: {
  variant?: TransferDraftVariant;
  fixedSubcontractingDirection?: SubcontractingTransferDirection;
  initialProductionSource?: ProductionTransferInitialSource;
  initialAssignees?: ActiveUserOption[];
}): ReactElement {
  const { t } = useTranslation("common");
  const branchCode = useAuthStore((x) => x.branch?.code ?? "0");
  const userId = useAuthStore((x) => x.user?.id);
  const [policy, setPolicy] = useState<WarehouseTransferPolicy | null>(null);
  const [sourceKind, setSourceKind] =
    useState<TransferSourceKind>("StockBased");
  const [executionKind, setExecutionKind] =
    useState<TransferExecutionKind>("TaskBased");
  const [customerValue, setCustomerValue] = useState<string | null>(null);
  const [orders, setOrders] = useState<TransferOrderHeader[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [sourceValue, setSourceValue] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState<string | null>(null);
  const sourceId = Number(sourceValue?.split("|")[0] ?? 0),
    targetId = Number(targetValue?.split("|")[0] ?? 0);
  const [sourceStaging, setSourceStaging] = useState<string | null>(null);
  const [targetReceiving, setTargetReceiving] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState(today);
  const [dispatchAt, setDispatchAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [priority, setPriority] = useState("3");
  const [projectCode, setProjectCode] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [description, setDescription] = useState("");
  const [productionPurpose, setProductionPurpose] = useState<"MaterialSupply" | "WorkInProgressMove" | "OutputMove">("MaterialSupply");
  const [showProductionAdvanced, setShowProductionAdvanced] = useState(false);
  const [showDocumentAdvanced, setShowDocumentAdvanced] = useState(false);
  const [productionHeaderId, setProductionHeaderId] = useState<number | null>(null);
  const [productionOrderId, setProductionOrderId] = useState<number | null>(null);
  const [productionPlanNo, setProductionPlanNo] = useState("");
  const [productionOrderNo, setProductionOrderNo] = useState("");
  const [productionOperationCode, setProductionOperationCode] = useState("");
  const [sourceWorkCenterCode, setSourceWorkCenterCode] = useState("");
  const [targetWorkCenterCode, setTargetWorkCenterCode] = useState("");
  const [subcontractDirection, setSubcontractDirection] =
    useState<SubcontractingTransferDirection>(
      fixedSubcontractingDirection ?? "IssueToSupplier",
    );
  const [supplierValue, setSupplierValue] = useState<string | null>(null);
  const [subcontractOrderNo, setSubcontractOrderNo] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [parentIssueTransferId, setParentIssueTransferId] = useState("");
  const [qualityInspectionRequired, setQualityInspectionRequired] = useState(true);
  const [supplierDispatchNo, setSupplierDispatchNo] = useState("");
  const [lines, setLines] = useState<TransferDraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateTransferDraftResult | null>(null);
  const productionSourceApplied = useRef(false);
  const sourceSnapshotsRef = useRef<Partial<Record<TransferSourceKind, TransferSourceSnapshot>>>({});
  const [sourceWarehouseProductionLocationId, setSourceWarehouseProductionLocationId] = useState<number | null>(null);
  const [targetWarehouseProductionLocationId, setTargetWarehouseProductionLocationId] = useState<number | null>(null);

  useEffect(() => {
    if (variant !== "production" || !sourceId) {
      setSourceWarehouseProductionLocationId(null);
      return;
    }
    void productionTransferApi.returnSetting(sourceId)
      .then((setting) => setSourceWarehouseProductionLocationId(setting.defaultProductionTransferLocationId ?? null))
      .catch(() => setSourceWarehouseProductionLocationId(null));
  }, [branchCode, sourceId, variant]);

  useEffect(() => {
    if (variant !== "production" || !targetId) {
      setTargetWarehouseProductionLocationId(null);
      return;
    }
    void productionTransferApi.defaultTargetLocation(targetId, branchCode)
      .then((location) => setTargetWarehouseProductionLocationId(location.locationId ?? null))
      .catch(() => setTargetWarehouseProductionLocationId(null));
  }, [branchCode, targetId, variant]);

  const productionExcludedSourceLocationIds = useMemo(() => {
    if (variant !== "production") return undefined;
    const ids = new Set<number>();
    if (sourceStaging) ids.add(Number(sourceStaging));
    if (sourceWarehouseProductionLocationId) ids.add(sourceWarehouseProductionLocationId);
    if (targetWarehouseProductionLocationId) ids.add(targetWarehouseProductionLocationId);
    lines.forEach((line) => {
      if (line.targetLocationId) ids.add(line.targetLocationId);
      else if (line.targetLocationValue) ids.add(Number(line.targetLocationValue));
    });
    return ids.size > 0 ? [...ids] : undefined;
  }, [lines, sourceStaging, sourceWarehouseProductionLocationId, targetWarehouseProductionLocationId, variant]);
  useEffect(() => {
    if (variant !== "production" || !initialProductionSource || productionSourceApplied.current) return;
    productionSourceApplied.current = true;
    setSourceKind("OrderBased");
    setExecutionKind("TaskBased");
    setProductionPurpose("MaterialSupply");
    if (initialAssignees?.length) setAssignees(initialAssignees);
    setProductionHeaderId(initialProductionSource.existingProductionHeaderId ?? null);
    setProductionOrderId(initialProductionSource.existingProductionOrderId ?? null);
    setProductionOrderNo(initialProductionSource.workOrderNumber);
    setProjectCode(initialProductionSource.projectCode ?? "");
    setExternalReference(initialProductionSource.workOrderNumber);
    setDescription(`${initialProductionSource.sourceSystemCode} ${initialProductionSource.workOrderNumber} iş emri reçetesinden hazırlandı.`);
    setSourceValue(`${initialProductionSource.sourceWarehouse.id}|${initialProductionSource.sourceWarehouse.code}`);
    setTargetValue(`${initialProductionSource.targetWarehouse.id}|${initialProductionSource.targetWarehouse.code}`);
    void Promise.all(initialProductionSource.materials.map(async material => {
      const trackingPolicy = await warehouseTransferApi.trackingPolicy(branchCode, material.stockId);
      return {
        localId: crypto.randomUUID(), stockId: material.stockId, stockCode: material.stockCode,
        stockName: material.stockName, yapCodeId: material.yapCodeId, yapCode: material.configurationCode,
        quantity: material.quantity, unitCode: material.unitCode, trackingType: trackingPolicy.trackingType,
        trackingPolicy, requireHandlingUnit: false, trackings: [],
      } satisfies TransferDraftLine;
    })).then(async preparedLines => {
      try {
        const defaultTarget = await productionTransferApi.defaultTargetLocation(initialProductionSource.sourceWarehouse.id, branchCode);
        if (defaultTarget.locationId) {
          preparedLines = preparedLines.map((line) => ({
            ...line,
            targetLocationId: defaultTarget.locationId,
            targetLocationValue: String(defaultTarget.locationId),
            targetLocationCode: defaultTarget.locationCode,
            targetLocationName: defaultTarget.locationName,
          }));
        }
      } catch {
        // Varsayılan raf çekilemezse satırlar boş hedef rafla devam eder — kullanıcı elle seçebilir.
      }
      setLines(preparedLines);
      toast.success(`${initialProductionSource.workOrderNumber} reçetesi üretim transferine aktarıldı.`);
    }).catch((error: Error) => toast.error(error.message || "Stok takip ayarları yüklenemedi."));
  }, [branchCode, initialAssignees, initialProductionSource, variant]);
  useEffect(() => {
    if (sourceKind !== "OrderBased" || selectedOrders.length === 0) return;
    const projects = [...new Set(orders
      .filter((order) => selectedOrders.includes(order.orderNumber))
      .map((order) => order.projectCode?.trim())
      .filter((value): value is string => Boolean(value)))];
    if (projects.length === 1) setProjectCode(projects[0]);
  }, [orders, selectedOrders, sourceKind]);
  const operationDraftPayload = useMemo<WarehouseTransferDirectDraft>(() => ({
    sourceKind,
    customerValue,
    orders,
    selectedOrders,
    sourceValue,
    targetValue,
    sourceStaging,
    targetReceiving,
    seriesId,
    documentDate,
    dispatchAt,
    arrivalAt,
    priority,
    projectCode,
    externalReference,
    description,
    lines,
  }), [
    arrivalAt, customerValue, description, dispatchAt, documentDate, externalReference,
    lines, orders, priority, projectCode, selectedOrders, seriesId, sourceKind, sourceStaging,
    sourceValue, targetReceiving, targetValue,
  ]);
  const restoreOperationDraft = useCallback((draft: WarehouseTransferDirectDraft) => {
    setSourceKind(draft.sourceKind);
    setCustomerValue(draft.customerValue);
    setOrders(draft.orders);
    setSelectedOrders(draft.selectedOrders);
    setSourceValue(draft.sourceValue);
    setTargetValue(draft.targetValue);
    setSourceStaging(draft.sourceStaging);
    setTargetReceiving(draft.targetReceiving);
    setSeriesId(draft.seriesId);
    setDocumentDate(draft.documentDate);
    setDispatchAt(draft.dispatchAt);
    setArrivalAt(draft.arrivalAt);
    setPriority(draft.priority);
    setProjectCode(draft.projectCode ?? "");
    setExternalReference(draft.externalReference);
    setDescription(draft.description);
    setLines(draft.lines);
  }, []);
  const operationDraft = useOperationDraft({
    operationType: "warehouse-transfer-direct",
    userId,
    branchCode,
    payload: operationDraftPayload,
    isMeaningful: hasWarehouseTransferDirectDraft,
    onRestore: restoreOperationDraft,
    enabled: variant === "warehouse" && executionKind === "Direct" && !busy && !result,
  });

  useEffect(() => {
    if (fixedSubcontractingDirection) {
      setSubcontractDirection(fixedSubcontractingDirection);
    }
  }, [fixedSubcontractingDirection]);

  useEffect(() => {
    void warehouseTransferApi
      .policy(branchCode)
      .then(setPolicy)
      .catch((error: Error) => toast.error(error.message));
  }, [branchCode]);
  useEffect(() => {
    setSeries([]);
    if (!sourceId) return;
    const documentType = variant === "production"
      ? "ProductionTransfer"
      : variant === "subcontracting"
        ? subcontractDirection === "ReceiptFromSupplier" ? "SubcontractingReceipt" : "SubcontractingIssue"
        : "InterWarehouseTransfer";
    void warehouseTransferApi
      .series(documentType)
      .then((rows) => {
        setSeries(rows);
        const preferred = rows.find((x) => x.isDefault) ?? rows[0];
        setSeriesId((current) =>
          current && rows.some((row) => String(row.id) === current)
            ? current
            : preferred ? String(preferred.id) : null);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [sourceId, subcontractDirection, variant]);
  const total = useMemo(
    () => lines.reduce((sum, x) => sum + Number(x.quantity || 0), 0),
    [lines],
  );
  const patch = (id: string, value: Partial<TransferDraftLine>) =>
    setLines((current) =>
      current.map((x) => (x.localId === id ? { ...x, ...value } : x)),
    );

  const setSource = (value: TransferSourceKind) => {
    if (value === sourceKind) return;

    if (variant !== "warehouse") {
      sourceSnapshotsRef.current[sourceKind] = {
        lines: cloneTransferDraftLines(lines),
        sourceValue,
        targetValue,
        sourceStaging,
        targetReceiving,
        projectCode,
        externalReference,
        description,
        productionHeaderId,
        productionOrderId,
        productionPlanNo,
        productionOrderNo,
        productionPurpose,
        productionOperationCode,
        sourceWorkCenterCode,
        targetWorkCenterCode,
        supplierValue,
        subcontractOrderNo,
      };
      setSourceKind(value);
      const snapshot = sourceSnapshotsRef.current[value];
      if (snapshot) {
        setLines(cloneTransferDraftLines(snapshot.lines));
        setSourceValue(snapshot.sourceValue);
        setTargetValue(snapshot.targetValue);
        setSourceStaging(snapshot.sourceStaging);
        setTargetReceiving(snapshot.targetReceiving);
        setProjectCode(snapshot.projectCode);
        setExternalReference(snapshot.externalReference);
        setDescription(snapshot.description);
        setProductionHeaderId(snapshot.productionHeaderId);
        setProductionOrderId(snapshot.productionOrderId);
        setProductionPlanNo(snapshot.productionPlanNo);
        setProductionOrderNo(snapshot.productionOrderNo);
        setProductionPurpose(snapshot.productionPurpose);
        setProductionOperationCode(snapshot.productionOperationCode);
        setSourceWorkCenterCode(snapshot.sourceWorkCenterCode);
        setTargetWorkCenterCode(snapshot.targetWorkCenterCode);
        setSupplierValue(snapshot.supplierValue);
        setSubcontractOrderNo(snapshot.subcontractOrderNo);
        return;
      }
      setLines([blankLine()]);
      return;
    }

    setSourceKind(value);
    setLines(value === "StockBased" ? [blankLine()] : []);
    setOrders([]);
    setSelectedOrders([]);
    setCustomerValue(null);
  };
  const setExecution = (value: TransferExecutionKind) => {
    setExecutionKind(value);
    if (value === "Direct") setAssignees([]);
  };
  const loadOrders = async () => {
    const customerCode = customerValue?.split("|")[1];
    if (!customerCode) return;
    setBusy(true);
    try {
      setOrders(
        await warehouseTransferApi.orderHeaders(customerCode, branchCode),
      );
      setSelectedOrders([]);
      setLines([]);
    } catch (error) {
      toast.error(message(error, t(`${D}.toast.ordersLoadFailed`)));
    } finally {
      setBusy(false);
    }
  };
  const loadOrderLines = async () => {
    if (!selectedOrders.length) return;
    setBusy(true);
    try {
      const rows = await warehouseTransferApi.orderLines(
        selectedOrders,
        branchCode,
      );
      const mapped = await Promise.all(
        rows.map(async (row): Promise<TransferDraftLine> => {
          if (!row.stockCode)
            throw new Error(
              t(`${D}.validation.orderLineStockMissing`, {
                order: `${row.orderNumber}/${row.orderId}`,
              }),
            );
          const stockPage = await warehouseTransferApi.stocks(
            {
              pageNumber: 1,
              pageSize: 20,
              search: row.stockCode,
              sortBy: "erpStockCode",
              sortDirection: "asc",
              signal: new AbortController().signal,
            },
            branchCode,
          );
          const stock = stockPage.items.find(
            (x) =>
              x.erpStockCode.toUpperCase() === row.stockCode!.toUpperCase(),
          );
          if (!stock)
            throw new Error(
              t(`${D}.validation.orderLineStockNotInMirror`, { stock: row.stockCode }),
            );
          let yap: YapCodeOption | undefined;
          if (row.yapCode) {
            const page = await warehouseTransferApi.yapCodes(
              {
                pageNumber: 1,
                pageSize: 20,
                search: row.yapCode,
                sortBy: "configurationCode",
                sortDirection: "asc",
                signal: new AbortController().signal,
              },
              branchCode,
            );
            yap = page.items.find(
              (x) =>
                x.configurationCode.toUpperCase() ===
                row.yapCode!.toUpperCase(),
            );
          }
          const trackingPolicy = await warehouseTransferApi.trackingPolicy(
            branchCode,
            stock.id,
          );
          return {
            localId: crypto.randomUUID(),
            stockId: stock.id,
            stockCode: stock.erpStockCode,
            stockName: stock.stockName,
            yapCodeId: yap?.id,
            yapCode: yap?.configurationCode,
            quantity: row.availableQuantity ?? 0,
            unitCode: stock.unitCode || "",
            trackingType: trackingPolicy.trackingType,
            trackingPolicy,
            requireHandlingUnit: false,
            trackings: [],
            source: {
              orderNumber: row.orderNumber,
              externalLineId: String(row.orderId),
              externalLineNo: row.orderId,
              externalStockCode: row.stockCode,
              externalYapCode: row.yapCode,
              orderDate: row.orderDate?.slice(0, 10),
              orderedQuantity: row.orderedQuantity ?? 0,
              previouslyTransferredQuantity: row.deliveredQuantity ?? 0,
              availableQuantity: row.availableQuantity ?? 0,
              externalStatus: "Open",
            },
          };
        }),
      );
      setLines(mapped);
    } catch (error) {
      toast.error(message(error, t(`${D}.toast.orderLinesFailed`)));
    } finally {
      setBusy(false);
    }
  };

  const validate = (): string | null => {
    if (!policy) return t(`${D}.validation.policyLoadFailed`);
    const allowed =
      sourceKind === "OrderBased"
        ? executionKind === "TaskBased"
          ? policy.allowOrderBasedTask
          : policy.allowOrderBasedDirect
        : executionKind === "TaskBased"
          ? policy.allowStockBasedTask
          : policy.allowStockBasedDirect;
    if (!allowed) return t(`${D}.validation.combinationDisabled`);
    if (!sourceId || !targetId) return t(`${D}.validation.warehousesRequired`);
    if (variant === "warehouse" && sourceId === targetId) return t(`${D}.validation.sameWarehouse`);
    if (!seriesId) return t(`${D}.validation.seriesRequired`);
    if (dispatchAt && arrivalAt && new Date(arrivalAt) < new Date(dispatchAt))
      return t(`${D}.validation.arrivalBeforeDispatch`);
    if (!lines.length) return t(`${D}.validation.linesRequired`);
    if (variant === "warehouse" && sourceKind === "OrderBased" && lines.some((x) => !x.source))
      return t(`${D}.validation.orderLinesRequired`);
    if (variant === "production" && sourceKind === "OrderBased" && !productionOrderNo.trim())
      return t(`${D}.validation.productionOrderRequired`);
    if (variant === "subcontracting" && !supplierValue)
      return t(`${D}.validation.supplierRequired`);
    if (variant === "subcontracting" && sourceKind === "OrderBased" && !subcontractOrderNo.trim())
      return t(`${D}.validation.subcontractOrderRequired`);
    if (variant === "subcontracting" && subcontractDirection === "ReceiptFromSupplier" && !parentIssueTransferId.trim())
      return t(`${D}.validation.parentIssueRequired`);
    if (
      executionKind === "TaskBased" &&
      policy.requireAssigneeForTask &&
      !assignees.length
    )
      return t(`${D}.validation.assigneeRequired`);
    if (!policy.allowMultipleAssignees && assignees.length > 1)
      return t(`${D}.validation.singleAssigneeOnly`);
    const intraWarehouseOp = variant !== "warehouse" && sourceId === targetId;
    for (const [index, line] of lines.entries()) {
      const lineNo = index + 1;
      if (!line.stockId) return t(`${D}.validation.lineStockRequired`, { index: lineNo });
      if (!line.trackingPolicy)
        return t(`${D}.validation.linePolicyLoadFailed`, { index: lineNo });
      if (!(line.quantity > 0))
        return t(`${D}.validation.lineQuantityRequired`, { index: lineNo });
      if (line.source && line.quantity > line.source.availableQuantity)
        return t(`${D}.validation.lineQuantityExceeded`, { index: lineNo });
      if (
        variant !== "production" &&
        (policy.requireSourceLocation || intraWarehouseOp) &&
        !line.sourceLocationId
      )
        return t(`${D}.validation.lineSourceLocationRequired`, { index: lineNo });
      if ((policy.requireTargetLocation || intraWarehouseOp) && !line.targetLocationId)
        return t(`${D}.validation.lineTargetLocationRequired`, { index: lineNo });
      if (
        intraWarehouseOp &&
        line.sourceLocationId &&
        line.targetLocationId &&
        line.sourceLocationId === line.targetLocationId
      )
        return t(`${D}.validation.lineSameLocationInWarehouse`, { index: lineNo });
      if (variant !== "production" && line.trackingType !== "None") {
        if (!line.trackings.length)
          return t(`${D}.validation.lineTrackingRequired`, { index: lineNo });
        const tracked = line.trackings.reduce(
          (sum, x) => sum + Number(x.quantity || 0),
          0,
        );
        if (Math.abs(tracked - line.quantity) > 0.000001)
          return t(`${D}.validation.lineTrackingTotalMismatch`, { index: lineNo });
        if (
          (line.trackingType === "Serial" ||
            line.trackingType === "LotAndSerial") &&
          line.trackings.some((x) => !x.serialNo?.trim() || x.quantity !== 1)
        )
          return t(`${D}.validation.lineSerialInvalid`, { index: lineNo });
        if (
          (line.trackingType === "Lot" ||
            line.trackingType === "LotAndSerial") &&
          line.trackings.some((x) => !x.lotNo?.trim())
        )
          return t(`${D}.validation.lineLotRequired`, { index: lineNo });
        if (
          line.requireHandlingUnit &&
          line.trackings.some((x) => !x.handlingUnitNo?.trim())
        )
          return t(`${D}.validation.lineHandlingUnitRequired`, { index: lineNo });
        const serials = line.trackings
          .map((x) => x.serialNo?.trim().toLocaleUpperCase("tr-TR"))
          .filter(Boolean);
        if (new Set(serials).size !== serials.length)
          return t(`${D}.validation.lineSerialDuplicate`, { index: lineNo });
      }
      if (variant !== "production") {
        if (
          line.trackingPolicy?.requireManufacturingDate &&
          line.trackings.some((x) => !x.manufacturingDate)
        )
          return t(`${D}.validation.lineManufacturingDateRequired`, { index: lineNo });
        if (
          line.trackingPolicy?.requireExpirationDate &&
          line.trackings.some((x) => !x.expirationDate)
        )
          return t(`${D}.validation.lineExpirationDateRequired`, { index: lineNo });
        if (
          line.trackingPolicy?.serialQuantityRule === "OneSerialPerBaseUnit" &&
          (!Number.isInteger(line.quantity) ||
            line.trackings.length !== line.quantity ||
            line.trackings.some((x) => x.quantity !== 1))
        )
          return t(`${D}.validation.lineSerialCountMismatch`, { index: lineNo });
      }
    }
    return null;
  };
  const create = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }
    setBusy(true);
    try {
      const transfer = {
        idempotencyKey: crypto.randomUUID(),
        branchCode,
        documentSeriesId: Number(seriesId),
        documentDate,
        initiationMode:
          variant === "warehouse" && sourceKind === "OrderBased"
            ? executionKind === "TaskBased"
              ? "OrderBasedTask"
              : "OrderBasedDirectTransfer"
            : executionKind === "TaskBased"
              ? "StockBasedTask"
              : "DirectTransfer",
        processType:
          variant === "warehouse" && sourceKind === "OrderBased" ? "ErpOrderBased" : "InternalRequest",
        sourceWarehouseId: sourceId,
        targetWarehouseId: targetId,
        sourceStagingLocationId: sourceStaging ? Number(sourceStaging) : null,
        targetReceivingLocationId: targetReceiving
          ? Number(targetReceiving)
          : null,
        targetPutawayLocationId: null,
        plannedDispatchAtUtc: dispatchAt
          ? new Date(dispatchAt).toISOString()
          : null,
        plannedArrivalAtUtc: arrivalAt
          ? new Date(arrivalAt).toISOString()
          : null,
        priority: Number(priority),
        projectCode: projectCode.trim() || null,
        externalReferenceNo: externalReference.trim() || null,
        description: description.trim() || null,
        lines: lines.map((x) => ({
          stockId: x.stockId,
          yapCodeId: x.yapCodeId ?? null,
          quantity: x.quantity,
          unitCode: x.unitCode.trim(),
          trackingType: x.trackingType,
          requireHandlingUnit: x.requireHandlingUnit,
          defaultSourceLocationId: x.sourceLocationId ?? null,
          defaultTargetLocationId: x.targetLocationId ?? null,
          description: null,
          trackings: x.trackings.map((t) => ({
            quantity: t.quantity,
            handlingUnitNo: t.handlingUnitNo?.trim() || null,
            lotNo: t.lotNo?.trim() || null,
            serialNo: t.serialNo?.trim() || null,
            manufacturingDate: t.manufacturingDate || null,
            expirationDate: t.expirationDate || null,
            sourceLocationId: x.sourceLocationId ?? null,
            targetLocationId: x.targetLocationId ?? null,
          })),
          source: x.source ?? null,
        })),
        assignedUserIds:
          executionKind === "TaskBased" ? assignees.map((x) => x.id) : [],
      };
      const created = variant === "production"
        ? await warehouseTransferApi.createProductionDraft({
            autoAssignSources: true,
            transfer: { ...transfer, autoAssignSources: true },
            purpose: productionPurpose,
            productionHeaderId,
            productionOrderId,
            productionOperationId: null,
            productionPlanNo: productionPlanNo.trim() || null,
            productionOrderNo: productionOrderNo.trim() || null,
            productionOperationCode: productionOperationCode.trim() || null,
            sourceWorkCenterCode: sourceWorkCenterCode.trim() || null,
            targetWorkCenterCode: targetWorkCenterCode.trim() || null,
            triggeredByProduction: sourceKind === "OrderBased",
            autoGenerated: false,
            requiredForOrderStart: productionPurpose === "MaterialSupply",
            requiredForOrderCompletion: productionPurpose === "OutputMove",
            lineContexts: lines.map((line, lineIndex) => ({
              lineIndex,
              lineRole: productionPurpose === "MaterialSupply" ? "ConsumptionSupply"
                : productionPurpose === "WorkInProgressMove" ? "WorkInProgress" : "ProductionOutput",
              productionConsumptionId: null,
              productionOutputId: null,
              requirementReference: productionOrderNo.trim() || null,
              requiredQuantity: line.quantity,
            })),
          })
        : variant === "subcontracting"
          ? await warehouseTransferApi.createSubcontractingDraft({
              transfer,
              direction: subcontractDirection,
              supplierId: Number(supplierValue?.split("|")[0]),
              subcontractOrderNo: subcontractOrderNo.trim() || null,
              subcontractOrderDate: documentDate,
              parentIssueTransferId: parentIssueTransferId.trim() ? Number(parentIssueTransferId) : null,
              expectedReturnAtUtc: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : null,
              ownershipType: "CompanyOwned",
              qualityInspectionRequired,
              operationCode: productionOperationCode.trim() || null,
              supplierDispatchNo: supplierDispatchNo.trim() || null,
              lineContexts: lines.map((line, lineIndex) => ({
                lineIndex,
                lineRole: subcontractDirection === "ReceiptFromSupplier" ? "FinishedProduct" : "Component",
                sourceIssueLineId: null,
                expectedQuantity: line.quantity,
                scrapQuantity: 0,
                requirementReference: subcontractOrderNo.trim() || null,
              })),
            })
          : await warehouseTransferApi.createDraft(transfer);
      await operationDraft.clearDraft();
      setResult(created);
      toast.success(t(`${D}.toast.created`, { documentNo: created.documentNo }));
    } catch (error) {
      toast.error(message(error, t(`${D}.toast.createFailed`)));
    } finally {
      setBusy(false);
    }
  };
  const title = variant === "production"
    ? t(`${D}.titles.production`)
    : variant === "subcontracting"
      ? subcontractDirection === "ReceiptFromSupplier"
        ? t(`${D}.titles.subcontractingReceipt`)
        : subcontractDirection === "IssueToSupplier"
          ? t(`${D}.titles.subcontractingIssue`)
          : t(`${D}.titles.subcontractingGeneral`)
      : t(`${D}.titles.warehouse`);
  const listUrl = variant === "production" ? PRODUCTION_WORK_ORDERS_PAGE_PATH
    : variant === "subcontracting" ? "/warehouse/subcontracting-transfers/list"
      : "/warehouse/transfers/list";
  const orderLabel = variant === "production" ? t(`${D}.sourceLabels.productionOrder`)
    : variant === "subcontracting" ? t(`${D}.sourceLabels.subcontractingOrder`) : t(`${D}.sourceLabels.warehouseOrder`);
  const stockLabel = variant === "production" ? t(`${D}.sourceLabels.productionStock`)
    : variant === "subcontracting" ? t(`${D}.sourceLabels.subcontractingStock`) : t(`${D}.sourceLabels.warehouseStock`);
  const subcontractDirectionOptions = useMemo(
    () => ([
      { value: "IssueToSupplier", label: t(`${D}.subcontracting.directionIssue`) },
      { value: "ReceiptFromSupplier", label: t(`${D}.subcontracting.directionReceipt`) },
      { value: "SupplierToSupplier", label: t(`${D}.subcontracting.directionSupplierToSupplier`) },
    ] as const),
    [t],
  );
  const productionPurposeOptions = useMemo(
    () => ([
      { value: "MaterialSupply", label: t(`${D}.production.purposeMaterial`) },
      { value: "WorkInProgressMove", label: t(`${D}.production.purposeWip`) },
      { value: "OutputMove", label: t(`${D}.production.purposeOutput`) },
    ] as const),
    [t],
  );

  if (result)
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-[color-mix(in_oklab,var(--wms-brand-secondary)_30%,transparent)] bg-[color-mix(in_oklab,var(--wms-brand-secondary)_10%,transparent)] p-8 text-center" data-no-auto-localize="true">
        <CheckCircle2 className="mx-auto size-12 text-[var(--wms-brand-secondary)]" />
        <h1 className="mt-3 text-2xl font-black">{t(`${D}.success.title`)}</h1>
        <p className="mt-2 font-mono text-xl">{result.documentNo}</p>
        <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
          {t(`${D}.success.linesAndQty`, { count: result.lineCount, total: result.requestedQuantity })}
        </p>
        {result.taskNo && (
          <p className="mt-1 font-mono text-sm text-[var(--wms-brand-primary)]">
            {t(`${D}.success.taskNo`, { taskNo: result.taskNo })}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link
            to={listUrl}
            className="rounded-xl bg-[var(--wms-brand-secondary)] px-5 py-2.5 font-semibold text-[var(--wms-brand-on-primary)]"
          >
            {variant === "production" ? "İş emirlerine git" : t(`${D}.success.goToRecords`)}
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setLines(sourceKind === "StockBased" || variant !== "warehouse" ? [blankLine()] : []);
            }}
            className="rounded-xl border border-[var(--wms-app-border)] px-5 py-2.5"
          >
            {t(`${D}.success.newTransfer`)}
          </button>
        </div>
      </section>
    );

  // Üretim varyantında bağlam paneli dar, belge paneli geniş olacak şekilde tek satırda durur.
  const pairedContextPanel = variant === "production";

  return (
    <section className="space-y-5" data-no-auto-localize="true" {...autoSelectInputCaptureHandlers}>
      <OperationDraftRestoreDialog
        open={operationDraft.restoreDialogOpen}
        operationName={t('operationNames.warehouseTransferDirect')}
        updatedAt={operationDraft.pendingDraft?.updatedAt}
        onRestore={operationDraft.restoreDraft}
        onDiscard={operationDraft.discardDraft}
      />
      <OpsPageHeader
        title={`${title} ${t(`${D}.createSuffix`)}`}
        description={t(`${D}.headerDescription`)}
        hintLabel={t(`${D}.howItWorks`)}
        subRow={
          executionKind === "TaskBased" ? (
            <Assignees
              assignees={assignees}
              setAssignees={setAssignees}
              allowMultiple={variant === "production" ? false : (policy?.allowMultipleAssignees ?? true)}
              pickerMode={variant === "production" ? "lookup" : "dialog"}
            />
          ) : null
        }
      />
      {variant !== "production" ? (
        <OperationFlowTabs
          source={sourceKind === "OrderBased" ? "order" : "stock"}
          execution={executionKind === "TaskBased" ? "task" : "direct"}
          onSourceChange={(value) =>
            setSource(value === "order" ? "OrderBased" : "StockBased")
          }
          onExecutionChange={(value) =>
            setExecution(value === "task" ? "TaskBased" : "Direct")
          }
          accent="violet"
          orderLabel={orderLabel}
          stockLabel={stockLabel}
          isAllowed={(source, execution) => {
            if (!policy) return false;
            return source === "order"
              ? execution === "task"
                ? policy.allowOrderBasedTask
                : policy.allowOrderBasedDirect
              : execution === "task"
                ? policy.allowStockBasedTask
                : policy.allowStockBasedDirect;
          }}
        >
          {sourceKind === "OrderBased"
            ? variant === "warehouse" ? t(`${D}.flowHint.orderWarehouse`)
              : t(`${D}.flowHint.orderOther`)
            : t(`${D}.flowHint.stock`)}{" "}
          {executionKind === "TaskBased"
            ? t(`${D}.flowHint.task`)
            : t(`${D}.flowHint.direct`)}
        </OperationFlowTabs>
      ) : null}
      <div
        className={cn(
          pairedContextPanel
            ? "grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            : "space-y-5",
        )}
      >
      {variant === "production" && (
        <Panel title={t(`${D}.production.panel`)} icon={<ClipboardList className="size-5" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(`${D}.production.purpose`)}>
              <div className="wms-ops-field-shell">
                <AppDropdown value={productionPurpose} onValueChange={(value) => setProductionPurpose(value as typeof productionPurpose)} options={[...productionPurposeOptions]}/>
              </div>
            </Field>
            <Field label={`${t(`${D}.production.orderNo`)}${sourceKind === "OrderBased" ? " *" : ""}`}><AppInput maxLength={100} value={productionOrderNo} onChange={(e)=>setProductionOrderNo(e.target.value)}/></Field>
          </div>
          <p className="wms-ops-inline-note mt-4">
            <Info className="wms-ops-inline-note__icon size-3.5" aria-hidden />
            <span className="min-w-0">{t(`${D}.production.note`)}</span>
          </p>
          <button
            type="button"
            aria-expanded={showProductionAdvanced}
            onClick={() => setShowProductionAdvanced((value) => !value)}
            className="wms-ops-inline-toggle mt-4"
          >
            {showProductionAdvanced
              ? <ChevronDown className="wms-ops-inline-toggle__icon size-4" aria-hidden />
              : <ChevronRight className="wms-ops-inline-toggle__icon size-4" aria-hidden />}
            {t(`${D}.production.advanced`)}
          </button>
          {showProductionAdvanced && (
            <div className={cn("mt-4 grid gap-4 border-t border-[var(--wms-app-border)] pt-4 sm:grid-cols-2", !pairedContextPanel && "xl:grid-cols-4")}>
              <Field label={t(`${D}.production.planNo`)}><AppInput maxLength={100} value={productionPlanNo} onChange={(e)=>setProductionPlanNo(e.target.value)}/></Field>
              <Field label={t(`${D}.production.operationCode`)}><AppInput maxLength={100} value={productionOperationCode} onChange={(e)=>setProductionOperationCode(e.target.value)}/></Field>
              <Field label={t(`${D}.production.sourceWorkCenter`)}><AppInput maxLength={100} value={sourceWorkCenterCode} onChange={(e)=>setSourceWorkCenterCode(e.target.value)}/></Field>
              <Field label={t(`${D}.production.targetWorkCenter`)}><AppInput maxLength={100} value={targetWorkCenterCode} onChange={(e)=>setTargetWorkCenterCode(e.target.value)}/></Field>
            </div>
          )}
        </Panel>
      )}
      {variant === "subcontracting" && (
        <Panel title={t(`${D}.subcontracting.supplierPanel`)} icon={<ClipboardList className="size-5" />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t(`${D}.subcontracting.direction`)}><OpsFieldShell><AppDropdown value={subcontractDirection} disabled={Boolean(fixedSubcontractingDirection)} onValueChange={(value)=>setSubcontractDirection(value as typeof subcontractDirection)} options={[...subcontractDirectionOptions]}/></OpsFieldShell></Field>
            <Field label={t(`${D}.subcontracting.supplier`)}><OpsFieldShell><PagedAppDropdown queryKey={["subcontract-supplier",branchCode]} fetchPage={(r)=>warehouseTransferApi.customers(r,branchCode)} toOption={customerOption} value={supplierValue} onValueChange={setSupplierValue} searchable minSearchLength={2} placeholder={t(`${D}.subcontracting.supplierSearch`)}/></OpsFieldShell></Field>
            <Field label={`${t(`${D}.subcontracting.orderNo`)}${sourceKind === "OrderBased" ? " *" : ""}`}><AppInput maxLength={100} value={subcontractOrderNo} onChange={(e)=>setSubcontractOrderNo(e.target.value)}/></Field>
            <Field label={t(`${D}.subcontracting.expectedReturn`)}><AppDateInput type="datetime-local" value={expectedReturnAt} onChange={(e)=>setExpectedReturnAt(e.target.value)}/></Field>
            {subcontractDirection === "ReceiptFromSupplier" && <Field label={t(`${D}.subcontracting.parentIssueId`)}><AppInput type="number" min={1} value={parentIssueTransferId} onChange={(e)=>setParentIssueTransferId(e.target.value)}/></Field>}
            <Field label={t(`${D}.subcontracting.supplierDispatchNo`)}><AppInput maxLength={100} value={supplierDispatchNo} onChange={(e)=>setSupplierDispatchNo(e.target.value)}/></Field>
            {subcontractDirection === "ReceiptFromSupplier" && <label className="flex h-11 items-center gap-2 self-end rounded-xl border border-[var(--wms-app-border)] px-3 text-sm"><input type="checkbox" checked={qualityInspectionRequired} onChange={(e)=>setQualityInspectionRequired(e.target.checked)}/>{t(`${D}.subcontracting.qualityRequired`)}</label>}
          </div>
        </Panel>
      )}
      {variant === "warehouse" && sourceKind === "OrderBased" && (
        <OrderSelection
          branchCode={branchCode}
          customerValue={customerValue}
          setCustomerValue={setCustomerValue}
          orders={orders}
          selectedOrders={selectedOrders}
          setSelectedOrders={setSelectedOrders}
          busy={busy}
          loadOrders={loadOrders}
          loadLines={loadOrderLines}
        />
      )}
      <Panel title={t(`${D}.document.panel`)} icon={<ArrowLeftRight className="size-5" />}>
        <div className={cn("grid gap-4 md:grid-cols-2", !pairedContextPanel && "xl:grid-cols-4")}>
          <Field label={t(`${D}.document.sourceWarehouse`)}>
            <OpsFieldShell>
            <PagedAppDropdown
              queryKey={["wt-source", branchCode]}
              fetchPage={(request) =>
                warehouseTransferApi.warehouses(request, branchCode)
              }
              toOption={warehouseOption}
              value={sourceValue}
              onValueChange={(value) => {
                setSourceValue(value);
                setSourceStaging(null);
                setSeriesId(null);
                setLines((current) => current.map((line) => ({
                  ...line,
                  sourceLocationId: undefined,
                  sourceLocationValue: null,
                  ...(variant === "production" ? {
                    targetLocationId: undefined,
                    targetLocationValue: null,
                    targetLocationCode: undefined,
                    targetLocationName: undefined,
                  } : {}),
                })));
                if (variant === "production" && value) {
                  const warehouseId = Number(value.split("|")[0]);
                  void productionTransferApi.defaultTargetLocation(warehouseId, branchCode)
                    .then((defaultTarget) => {
                      if (!defaultTarget.locationId) return;
                      setLines((current) => current.map((line) => ({
                        ...line,
                        targetLocationId: defaultTarget.locationId,
                        targetLocationValue: String(defaultTarget.locationId),
                        targetLocationCode: defaultTarget.locationCode,
                        targetLocationName: defaultTarget.locationName,
                      })));
                    })
                    .catch(() => {});
                }
              }}
              searchable
              placeholder={t(`${D}.document.sourceWarehousePlaceholder`)}
            />
            </OpsFieldShell>
          </Field>
          <Field label={t(`${D}.document.targetWarehouse`)}>
            <OpsFieldShell>
            <PagedAppDropdown
              queryKey={["wt-target", branchCode]}
              fetchPage={(request) =>
                warehouseTransferApi.warehouses(request, branchCode)
              }
              toOption={(warehouse) => ({
                ...warehouseOption(warehouse),
                disabled: variant === "warehouse" && warehouse.id === sourceId,
              })}
              value={targetValue}
              onValueChange={(value) => {
                setTargetValue(value);
                setTargetReceiving(null);
                if (variant !== "production") {
                  setLines((current) => current.map((line) => ({
                    ...line,
                    targetLocationId: undefined,
                    targetLocationValue: null,
                    targetLocationCode: undefined,
                    targetLocationName: undefined,
                  })));
                }
              }}
              searchable
              placeholder={t(`${D}.document.targetWarehousePlaceholder`)}
            />
            </OpsFieldShell>
          </Field>
          <Field label={t(`${D}.document.series`)}>
            <OpsFieldShell>
              <AppDropdown
                value={seriesId}
                onValueChange={setSeriesId}
                options={series.map((x) => ({
                  value: String(x.id),
                  label: `${x.code} · ${x.previewDocumentNumber}`,
                }))}
              />
            </OpsFieldShell>
          </Field>
          <Field label={t(`${D}.document.documentDate`)}>
            <AppDateInput
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          aria-expanded={showDocumentAdvanced}
          onClick={() => setShowDocumentAdvanced((value) => !value)}
          className="wms-ops-inline-toggle mt-4"
        >
          {showDocumentAdvanced
            ? <ChevronDown className="wms-ops-inline-toggle__icon size-4" aria-hidden />
            : <ChevronRight className="wms-ops-inline-toggle__icon size-4" aria-hidden />}
          {t(`${D}.document.advanced`)}
        </button>
        {showDocumentAdvanced && (
          <div className={cn("mt-3 grid gap-4 border-t border-[var(--wms-app-border)] pt-4 md:grid-cols-2", !pairedContextPanel && "xl:grid-cols-4")}>
            <Field label={t(`${D}.document.sourceStaging`)}>
              <OpsFieldShell>
              <PagedAppDropdown
                queryKey={["wt-source-area", sourceId]}
                fetchPage={(request) =>
                  warehouseTransferApi.locations(request, sourceId)
                }
                toOption={locationOption}
                enabled={Boolean(sourceId)}
                value={sourceStaging}
                onValueChange={setSourceStaging}
                searchable
                placeholder={t(`${D}.document.optional`)}
              />
              </OpsFieldShell>
            </Field>
            <Field label={t(`${D}.document.targetReceiving`)}>
              <OpsFieldShell>
              <PagedAppDropdown
                queryKey={["wt-target-area", targetId]}
                fetchPage={(request) =>
                  warehouseTransferApi.locations(request, targetId)
                }
                toOption={locationOption}
                enabled={Boolean(targetId)}
                value={targetReceiving}
                onValueChange={setTargetReceiving}
                searchable
                placeholder={t(`${D}.document.optional`)}
              />
              </OpsFieldShell>
            </Field>
            <Field label={t(`${D}.document.plannedDispatch`)}>
              <AppDateInput
                type="datetime-local"
                value={dispatchAt}
                onChange={(e) => setDispatchAt(e.target.value)}
              />
            </Field>
            <Field label={t(`${D}.document.plannedArrival`)}>
              <AppDateInput
                type="datetime-local"
                value={arrivalAt}
                onChange={(e) => setArrivalAt(e.target.value)}
              />
            </Field>
            <Field label={t(`${D}.document.priority`)}>
              <OpsFieldShell>
                <AppDropdown
                  value={priority}
                  onValueChange={setPriority}
                  options={[1, 2, 3, 4, 5].map((x) => ({
                    value: String(x),
                    label: String(x),
                  }))}
                />
              </OpsFieldShell>
            </Field>
            <Field label={t(`${D}.document.externalReference`)}>
              <AppInput
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
              />
            </Field>
            <Field label="Proje kodu">
              <AppInput
                value={projectCode}
                maxLength={50}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="Netsis proje kodu (boşsa 0)"
              />
            </Field>
            <Field label={t(`${D}.document.description`)}>
              <AppInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Panel>
      </div>
      <Panel
        title={t(`${D}.lines.panel`, { count: lines.length, total })}
        icon={<ArrowLeftRight className="size-5" />}
      >
        <div className="space-y-2.5">
          {lines.map((line, index) => (
            <LineCard
              key={line.localId}
              line={line}
              index={index}
              variant={variant}
              branchCode={branchCode}
              sourceId={sourceId}
              targetId={targetId}
              excludeSourceLocationIds={productionExcludedSourceLocationIds}
              patch={patch}
              remove={() =>
                setLines((current) =>
                  current.filter((x) => x.localId !== line.localId),
                )
              }
            />
          ))}
        </div>
        {(sourceKind === "StockBased" || variant !== "warehouse") && (
          <button
            type="button"
            onClick={() =>
              setLines((current) => {
                const newLine = blankLine();
                if (variant === "production") {
                  const template = current.find((x) => x.targetLocationId);
                  if (template) {
                    return [
                      ...current,
                      {
                        ...newLine,
                        targetLocationId: template.targetLocationId,
                        targetLocationValue: template.targetLocationValue,
                        targetLocationCode: template.targetLocationCode,
                        targetLocationName: template.targetLocationName,
                      },
                    ];
                  }
                }
                return [...current, newLine];
              })
            }
            className="wms-ops-line-add mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--wms-brand-ring)] px-3.5 py-2 text-sm font-semibold text-[var(--wms-brand-primary)]"
          >
            <Plus className="size-4" />
            {t(`${D}.lines.addLine`)}
          </button>
        )}
      </Panel>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-3 font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}{t(`${D}.createButton`, { title })}
        </button>
      </div>
    </section>
  );
}

function OrderSelection(p: {
  branchCode: string;
  customerValue: string | null;
  setCustomerValue: (x: string) => void;
  orders: TransferOrderHeader[];
  selectedOrders: string[];
  setSelectedOrders: React.Dispatch<React.SetStateAction<string[]>>;
  busy: boolean;
  loadOrders: () => Promise<void>;
  loadLines: () => Promise<void>;
}): ReactElement {
  const { t } = useTranslation("common");
  return (
    <Panel
      title={t(`${D}.orderSelection.panel`)}
      icon={<ClipboardList className="size-5" />}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <OpsFieldShell>
        <PagedAppDropdown
          queryKey={["wt-customer", p.branchCode]}
          fetchPage={(r) => warehouseTransferApi.customers(r, p.branchCode)}
          toOption={customerOption}
          value={p.customerValue}
          onValueChange={p.setCustomerValue}
          searchable
          minSearchLength={2}
          placeholder={t(`${D}.orderSelection.customerSearch`)}
        />
        </OpsFieldShell>
        <button
          type="button"
          disabled={!p.customerValue || p.busy}
          onClick={() => void p.loadOrders()}
          className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-[var(--wms-brand-on-primary)] disabled:opacity-40"
        >
          {t(`${D}.orderSelection.loadOrders`)}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {p.orders.map((order) => (
          <label
            key={order.orderNumber}
            className="flex items-center gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"
          >
            <input
              type="checkbox"
              checked={p.selectedOrders.includes(order.orderNumber)}
              onChange={(e) =>
                p.setSelectedOrders((current) =>
                  e.target.checked
                    ? [...current, order.orderNumber]
                    : current.filter((x) => x !== order.orderNumber),
                )
              }
            />
            <span className="flex-1">
              <strong className="font-mono">{order.orderNumber}</strong>
              <small className="ml-2 text-[var(--wms-app-text-muted)]">
                {order.projectCode} · {t(`${D}.orderSelection.warehouseLabel`)} {order.targetWarehouseCode ?? "—"}
              </small>
            </span>
            <span>{order.availableQuantity ?? 0}</span>
          </label>
        ))}
      </div>
      {p.orders.length > 0 && (
        <button
          type="button"
          disabled={!p.selectedOrders.length || p.busy}
          onClick={() => void p.loadLines()}
          className="mt-3 rounded-xl border border-[var(--wms-brand-ring)] px-4 py-2.5 font-semibold text-[var(--wms-brand-primary)]"
        >
          {t(`${D}.orderSelection.loadLines`)}
        </button>
      )}
    </Panel>
  );
}
function Assignees({
  assignees,
  setAssignees,
  allowMultiple = true,
  pickerMode = "dialog",
}: {
  assignees: ActiveUserOption[];
  setAssignees: React.Dispatch<React.SetStateAction<ActiveUserOption[]>>;
  allowMultiple?: boolean;
  pickerMode?: "dialog" | "lookup";
}): ReactElement {
  const { t } = useTranslation("common");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ActiveUserOption[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const userDisplayName = assigneeDisplayName;

  useEffect(() => {
    if (pickerMode !== "dialog" || assignees.length < 2) setSummaryOpen(false);
  }, [assignees.length, pickerMode]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const cancelClose = () => {
    if (!closeTimer.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setSummaryOpen(false), 180);
  };

  const openDialog = () => {
    setDraft(assignees);
    setDialogOpen(true);
  };

  const confirmSelection = () => {
    setAssignees(draft);
    setDialogOpen(false);
  };

  const removeAssignee = (id: ActiveUserOption["id"]) =>
    setAssignees((current) => current.filter((x) => x.id !== id));

  const removeLabel = (user: ActiveUserOption) =>
    t(`${D}.assignees.removeAria`, { name: userDisplayName(user) });

  if (pickerMode === "lookup") {
    const selectedUser = assignees[0];
    return (
      <div className="flex w-full min-w-0 justify-end">
        <div className="w-full min-w-[min(100%,18rem)] sm:max-w-md">
          <PagedLookupDialog<ActiveUserOption>
            variant="ops"
            triggerMode="combobox"
            autoSearchMinLength={1}
            popoverPortalContainer={null}
            openDialogOnTouchTap
            open={lookupOpen}
            onOpenChange={setLookupOpen}
            title="Depo çalışanı seçin"
            value={selectedUser ? userDisplayName(selectedUser) : null}
            placeholder="Depo çalışanı seçin"
            searchPlaceholder="Ad, kullanıcı adı veya e-posta ile arayın"
            emptyText="Eşleşen depo çalışanı bulunamadı."
            triggerClassName="!h-11 !py-2 !pl-9 !pr-3"
            queryKey={["production-transfer-draft-assignee"]}
            fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
              toPagedResponse(await warehouseTransferApi.activeUsers({
                pageNumber,
                pageSize,
                search,
                sortBy: "username",
                sortDirection: "asc",
                signal: signal ?? new AbortController().signal,
              }))
            }
            getKey={(user) => String(user.id)}
            getLabel={(user) => userDisplayName(user)}
            onSelect={(user) => setAssignees([user])}
            onComboboxTextChange={(text) => {
              if (!text.trim()) setAssignees([]);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2.5" title={t(`${D}.assignees.hint`)}>
        {assignees.length === 0 ? (
          <span className="wms-ops-assignee-chip wms-ops-assignee-chip--empty">
            {t(`${D}.assignees.empty`)}
          </span>
        ) : assignees.length === 1 ? (
          <span className="wms-ops-assignee-chip">
            {userDisplayName(assignees[0])}
            <button
              type="button"
              aria-label={removeLabel(assignees[0])}
              onClick={() => removeAssignee(assignees[0].id)}
              className="wms-ops-assignee-chip__remove"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <PopoverPrimitive.Root open={summaryOpen} onOpenChange={setSummaryOpen}>
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                className="wms-ops-assignee-chip wms-ops-assignee-chip--summary"
                onMouseEnter={() => {
                  cancelClose();
                  setSummaryOpen(true);
                }}
                onMouseLeave={scheduleClose}
              >
                <UserRoundCog className="size-3.5" aria-hidden />
                {t(`${D}.assignees.selectedCount`, { count: assignees.length })}
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="end"
                sideOffset={8}
                onOpenAutoFocus={(event) => event.preventDefault()}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
                className="wms-floating-surface wms-ops-assignee-popover z-[2000] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl p-1.5"
              >
                <div className="wms-ops-scrollbar max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                  {assignees.map((user) => (
                    <div key={user.id} className="wms-ops-assignee-popover__row">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {userDisplayName(user)}
                        </span>
                        <span className="block truncate text-xs text-[var(--wms-app-text-muted)]">
                          {user.username}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={removeLabel(user)}
                        onClick={() => removeAssignee(user.id)}
                        className="wms-ops-assignee-chip__remove"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        )}
        <OpsActionButton
          type="button"
          variant="secondary"
          onClick={openDialog}
          className="inline-flex items-center gap-2"
        >
          <UserPlus className="size-4" />
          {t(`${D}.assignees.openDialog`)}
        </OpsActionButton>
      </div>

      {dialogOpen && (
        <AssigneePickerDialog
          draft={draft}
          setDraft={setDraft}
          allowMultiple={allowMultiple}
          onClose={() => setDialogOpen(false)}
          onConfirm={confirmSelection}
        />
      )}
    </>
  );
}

function AssigneePickerDialog({
  draft,
  setDraft,
  allowMultiple,
  onClose,
  onConfirm,
}: {
  draft: ActiveUserOption[];
  setDraft: React.Dispatch<React.SetStateAction<ActiveUserOption[]>>;
  allowMultiple: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): ReactElement {
  const { t } = useTranslation("common");
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const query = useDropdownInfiniteSearch({
    queryKey: ["wt-assignees-picker"],
    searchTerm: search,
    fetchPage: warehouseTransferApi.activeUsers,
    enabled: true,
    minSearchLength: 0,
    pageSize: 25,
    searchFields: ["username", "email", "firstName", "lastName"],
    sortBy: "username",
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      if (list.scrollHeight - list.scrollTop - list.clientHeight > 80) return;
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    };
    list.addEventListener("scroll", onScroll);
    return () => list.removeEventListener("scroll", onScroll);
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  const userDisplayName = (user: ActiveUserOption) =>
    `${user.firstName} ${user.lastName}`.trim() || user.username;

  const toggleUser = (user: ActiveUserOption) => {
    setDraft((current) => {
      if (current.some((x) => x.id === user.id)) {
        return current.filter((x) => x.id !== user.id);
      }
      return allowMultiple ? [...current, user] : [user];
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <OpsDialogContent size="lg" className="data-no-auto-localize">
        <OpsDialogHeader>
          <div>
            <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">
              {t(`${D}.assignees.dialogTitle`)}
            </DialogTitle>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              {t(`${D}.assignees.dialogDescription`)}
            </p>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="space-y-4" {...autoSelectInputCaptureHandlers}>
          <AppInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(`${D}.assignees.search`)}
            aria-label={t(`${D}.assignees.search`)}
            leadingIcon={<Search className="size-4" aria-hidden />}
          />
          <div
            ref={listRef}
            className="wms-ops-scrollbar flex max-h-[min(420px,50dvh)] flex-col gap-2 overflow-y-auto overscroll-contain"
          >
            {query.isLoading && query.items.length === 0 ? (
              <div className="grid min-h-40 place-items-center">
                <Loader2 className="size-6 animate-spin text-[var(--wms-brand-primary)]" />
              </div>
            ) : query.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--wms-app-text-muted)]">
                {t(`${D}.assignees.noResults`)}
              </p>
            ) : (
              query.items.map((user) => {
                const selected = draft.some((x) => x.id === user.id);
                return (
                  <div
                    key={user.id}
                    role="checkbox"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => toggleUser(user)}
                    onKeyDown={(event) => {
                      if (event.key !== " " && event.key !== "Enter") return;
                      event.preventDefault();
                      toggleUser(user);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                      selected
                        ? "border-[var(--wms-brand-primary)] bg-[var(--wms-brand-soft)]"
                        : "border-[var(--wms-app-border)] hover:border-[var(--wms-brand-primary)]/50",
                    )}
                  >
                    <OpsSkinCheckbox
                      checked={selected}
                      onCheckedChange={() => toggleUser(user)}
                      aria-label={userDisplayName(user)}
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      <strong className="shrink-0 text-sm">{userDisplayName(user)}</strong>
                      <small className="truncate text-[var(--wms-app-text-muted)]">
                        {user.username} · {user.email}
                      </small>
                    </span>
                  </div>
                );
              })
            )}
            {query.isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="size-5 animate-spin text-[var(--wms-brand-primary)]" />
              </div>
            )}
          </div>
          {draft.length > 0 && (
            <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                {t(`${D}.assignees.selectedCount`, { count: draft.length })}
              </p>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                {draft.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] px-3 py-1 text-sm"
                  >
                    {userDisplayName(user)}
                    <button
                      type="button"
                      aria-label={t(`${D}.assignees.removeAria`, { name: userDisplayName(user) })}
                      onClick={() => toggleUser(user)}
                      className="rounded-full p-0.5 text-[var(--wms-app-text-muted)] hover:text-red-500"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            {t(`${D}.assignees.cancel`)}
          </OpsActionButton>
          <OpsActionButton type="button" variant="primary" onClick={onConfirm}>
            {t(`${D}.assignees.confirm`)}
          </OpsActionButton>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}
function LineCard({
  line,
  index,
  variant,
  branchCode,
  sourceId,
  targetId,
  excludeSourceLocationIds,
  patch,
  remove,
}: {
  line: TransferDraftLine;
  index: number;
  variant: TransferDraftVariant;
  branchCode: string;
  sourceId: number;
  targetId: number;
  excludeSourceLocationIds?: number[];
  patch: (id: string, value: Partial<TransferDraftLine>) => void;
  remove: () => void;
}): ReactElement {
  const { t } = useTranslation("common");
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const excludedSourceLocationKey = (excludeSourceLocationIds ?? []).join(",");
  const stock = line.stockId
    ? {
        id: line.stockId,
        erpStockCode: line.stockCode ?? "",
        stockName: line.stockName,
        unitCode: line.unitCode,
      }
    : undefined;
  const yap = line.yapCodeId
    ? {
        id: line.yapCodeId,
        configurationCode: line.yapCode ?? "",
        description: undefined,
      }
    : undefined;

  const applyStock = (x: StockOption) =>
    warehouseTransferApi.trackingPolicy(branchCode, x.id).then((trackingPolicy) => {
      patch(line.localId, {
        stockId: x.id,
        stockCode: x.erpStockCode,
        stockName: x.stockName,
        unitCode: x.unitCode || "",
        trackingType: trackingPolicy.trackingType,
        trackingPolicy,
        trackings: [],
      });
    }).catch((error: unknown) => {
      toast.error(message(error, t(`${D}.toast.trackingPolicyFailed`)));
      throw error;
    });

  const sourceAutoFillKey = useRef<string>("");
  const applySourceLocation = (locationId: number, locationCode?: string, locationName?: string) =>
    patch(line.localId, {
      sourceLocationId: locationId,
      sourceLocationValue: String(locationId),
      sourceLocationCode: locationCode,
      sourceLocationName: locationName,
    });

  useEffect(() => {
    if (!line.sourceLocationId || !excludeSourceLocationIds?.includes(line.sourceLocationId)) return;
    patch(line.localId, {
      sourceLocationId: undefined,
      sourceLocationValue: null,
      sourceLocationCode: undefined,
      sourceLocationName: undefined,
    });
    sourceAutoFillKey.current = "";
  }, [excludeSourceLocationIds, line.localId, line.sourceLocationId, patch]);

  // Serili/LotAndSerial: tüm seriler girilip planlanan miktar tamamlanınca, o serilerin
  // gerçekte bulunduğu rafı (hepsi aynı raftaysa) kaynak rafına otomatik yazar.
  useEffect(() => {
    if (line.trackingType !== "Serial" && line.trackingType !== "LotAndSerial") return;
    const stockId = line.stockId;
    if (!stockId || !sourceId || line.sourceLocationId) return;
    const serials = line.trackings.map((x) => x.serialNo?.trim() || "");
    if (serials.length === 0 || serials.some((x) => !x)) return;
    const totalEntered = line.trackings.reduce((sum, x) => sum + (x.quantity || 0), 0);
    if (totalEntered < line.quantity) return;
    const key = [...serials].sort().join("|");
    if (sourceAutoFillKey.current === key) return;
    // Kullanıcı hâlâ yazıyor olabilir; yazma durduktan sonra sorgula.
    const timer = setTimeout(() => {
      void warehouseTransferApi.resolveSerialLocations(branchCode, sourceId, stockId, line.yapCodeId, serials)
        .then((matches) => {
          const missing = matches.filter((m) => !m.locationId).map((m) => m.serialNo);
          if (missing.length > 0) {
            // Eksik/yanlış seri yazılırken otomatik doldurma sessizce bekler; toast gösterme.
            return;
          }
          const distinctLocationIds = [...new Set(matches.map((m) => m.locationId))];
          if (distinctLocationIds.length > 1) {
            toast.error(`${index + 1}. kalem · ${line.stockCode ?? ""}: girilen seriler ${distinctLocationIds.length} farklı rafta bulundu — kaynak rafı otomatik seçilemedi, lütfen elle seçin.`);
            return;
          }
          const match = matches[0];
          if (match?.locationId) {
            sourceAutoFillKey.current = key;
            applySourceLocation(match.locationId, match.locationCode, match.locationName);
          }
        })
        .catch((error: Error) =>
          toast.error(`${index + 1}. kalem · ${line.stockCode ?? ""}: ${message(error, "Seri raf bilgisi sorgulanamadı.")}`),
        );
    }, 700);
    return () => clearTimeout(timer);
  }, [branchCode, index, line.localId, line.quantity, line.sourceLocationId, line.stockId, line.stockCode, line.trackingType, line.trackings, line.yapCodeId, sourceId]);

  // Takipsiz (None) stoklar: stok+depo tek bir rafta bakiye buluyorsa kaynak rafına otomatik yazar.
  useEffect(() => {
    if (line.trackingType !== "None") return;
    if (!line.stockId || !sourceId || line.sourceLocationId) return;
    const key = `${sourceId}|${line.stockId}|${line.yapCodeId ?? ""}`;
    if (sourceAutoFillKey.current === key) return;
    sourceAutoFillKey.current = key;
    void warehouseTransferApi.resolveStockLocations(branchCode, sourceId, line.stockId, line.yapCodeId, excludeSourceLocationIds)
      .then((locations) => {
        if (locations.length === 0) return; // bakiye yok, otomatik doldurma için bir şey yok
        if (locations.length > 1) return; // birden fazla rafta bulundu, otomatik seçilemez — kullanıcı elle seçer
        applySourceLocation(locations[0].locationId, locations[0].locationCode, locations[0].locationName);
      })
      .catch((error: Error) => toast.error(message(error, "Stok raf bilgisi sorgulanamadı.")));
  }, [branchCode, excludeSourceLocationIds, line.localId, line.sourceLocationId, line.stockId, line.stockCode, line.trackingType, line.yapCodeId, sourceId]);

  return (
    <div
      className="wms-ops-line-card"
      data-wms-error-line-ref={`${index + 1}. kalem|Line ${index + 1}${line.stockCode ? `|${line.stockCode}` : ""}`}
    >
      <div className="wms-ops-line-card__head">
        <div className="wms-ops-line-card__identity">
          <span className="wms-ops-line-card__index">#{index + 1}</span>
          {line.source && (
            <span className="wms-ops-line-card__order">{line.source.orderNumber}</span>
          )}
          {line.stockId && line.stockCode ? (
            <StockIdentityCell
              layout="inline"
              stockId={line.stockId}
              stockCode={line.stockCode}
              stockName={line.stockName}
              branchCode={branchCode}
            />
          ) : (
            <span className="text-sm font-semibold">{t(`${D}.lines.newLine`)}</span>
          )}
          {line.stockId && line.trackingPolicy && (
            <StockTrackingPolicyField policy={line.trackingPolicy} badge />
          )}
        </div>
        <button
          type="button"
          onClick={remove}
          aria-label={t(`${D}.lines.removeLine`)}
          className="wms-ops-line-card__remove"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="wms-ops-line-card__body">
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t(`${D}.lines.stock`)}>
          <div className="flex items-stretch gap-2">
            <OpsFieldShell className="min-w-0 flex-1">
            <PagedAppDropdown
              queryKey={["wt-stock", line.localId, branchCode]}
              fetchPage={(r) => warehouseTransferApi.stocks(r, branchCode)}
              toOption={stockOption}
              selectedOption={
                stock
                  ? {
                      value: stockValue(stock),
                      label: `${stock.erpStockCode} · ${stock.stockName ?? ""}`,
                    }
                  : undefined
              }
              value={stock ? stockValue(stock) : null}
              onValueChange={(value) => {
                void (async () => {
                  try {
                    const x = JSON.parse(
                      decodeURIComponent(value),
                    ) as StockOption;
                    await applyStock(x);
                  } catch (error) {
                    if (error instanceof SyntaxError) return;
                    toast.error(
                      message(error, t(`${D}.toast.trackingPolicyFailed`)),
                    );
                  }
                })();
              }}
              searchable
              minSearchLength={2}
            />
            </OpsFieldShell>
            <button
              type="button"
              onClick={() => setStockDialogOpen(true)}
              aria-label={t(`${D}.stockSelect.openPanel`)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--wms-brand-ring)] bg-[var(--wms-app-panel)] text-[var(--wms-brand-primary)] transition hover:bg-[var(--wms-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
            >
              <Search className="size-4" strokeWidth={2.25} />
            </button>
          </div>
          <StockSelectDialog
            open={stockDialogOpen}
            onOpenChange={setStockDialogOpen}
            branchCode={branchCode}
            selectedStockId={line.stockId}
            onSelect={applyStock}
          />
        </Field>
        <Field label={t(`${D}.lines.yapCode`)}>
          <OpsFieldShell>
          <PagedAppDropdown
            queryKey={["wt-yap", line.localId, branchCode]}
            fetchPage={(r) => warehouseTransferApi.yapCodes(r, branchCode)}
            toOption={yapOption}
            selectedOption={
              yap
                ? { value: yapValue(yap), label: yap.configurationCode }
                : undefined
            }
            value={yap ? yapValue(yap) : null}
            onValueChange={(value) => {
              const x = JSON.parse(decodeURIComponent(value)) as YapCodeOption;
              patch(line.localId, {
                yapCodeId: x.id,
                yapCode: x.configurationCode,
              });
            }}
            searchable
          />
          </OpsFieldShell>
        </Field>
        <Field label={t(`${D}.lines.quantity`)}>
          <AppInput
            type="number"
            min="0.000001"
            step="0.000001"
            max={line.source?.availableQuantity}
            value={line.quantity}
            onChange={(e) =>
              patch(line.localId, { quantity: Number(e.target.value) })
            }
          />
        </Field>
        <Field label={t(`${D}.lines.unit`)}>
          <span className="app-input-shell wms-ops-field-shell">
            <span className={`input app-input-control wms-ops-field flex items-center font-bold ${line.unitCode ? "text-[var(--wms-brand-primary)]" : "text-[var(--wms-brand-accent)]"}`}>
              {line.unitCode || t(`${D}.lines.selectStockFirst`)}
            </span>
          </span>
        </Field>
        {variant !== "production" && (
          <>
            <Field label={t(`${D}.lines.sourceLocation`)}>
              <OpsFieldShell
                data-wms-error-target="sourceLocation"
                data-wms-error-keys="kaynak raf|source location"
              >
              <PagedAppDropdown
                queryKey={["wt-line-source", line.localId, sourceId, line.stockId, line.yapCodeId, excludedSourceLocationKey]}
                fetchPage={(r) =>
                  line.stockId
                    ? warehouseTransferApi
                        .stockLocationsPage(r, branchCode, sourceId, line.stockId, line.yapCodeId, excludeSourceLocationIds)
                        .then((p) => ({
                          ...p,
                          items: p.items
                            .filter((x) => !excludeSourceLocationIds?.includes(x.locationId))
                            .map((x) => ({
                            id: x.locationId,
                            code: x.locationCode,
                            name: x.locationName,
                            availableQuantity: x.availableQuantity,
                          })),
                        }))
                    : warehouseTransferApi.locations(r, sourceId).then((p) => ({
                        ...p,
                        items: p.items
                          .filter((x) => !excludeSourceLocationIds?.includes(x.id))
                          .map((x) => ({
                          id: x.id,
                          code: x.code,
                          name: x.name,
                          locationType: x.locationType,
                        })),
                      }))
                }
                toOption={sourceLocationOption}
                enabled={Boolean(sourceId)}
                selectedOption={line.sourceLocationCode && line.sourceLocationId && !excludeSourceLocationIds?.includes(line.sourceLocationId)
                  ? { value: String(line.sourceLocationId), label: `${line.sourceLocationCode} · ${line.sourceLocationName}` }
                  : undefined}
                value={line.sourceLocationValue}
                onValueChange={(value) =>
                  patch(line.localId, {
                    sourceLocationValue: value,
                    sourceLocationId: Number(value),
                    sourceLocationCode: undefined,
                    sourceLocationName: undefined,
                  })
                }
                searchable
              />
              </OpsFieldShell>
            </Field>
            <Field label={t(`${D}.lines.targetLocation`)}>
              <OpsFieldShell
                data-wms-error-target="targetLocation"
                data-wms-error-keys="hedef raf|target location"
              >
              <PagedAppDropdown
                queryKey={["wt-line-target", line.localId, targetId]}
                fetchPage={(r) => warehouseTransferApi.locations(r, targetId)}
                toOption={locationOption}
                enabled={Boolean(targetId)}
                selectedOption={line.targetLocationCode
                  ? { value: String(line.targetLocationId), label: `${line.targetLocationCode} · ${line.targetLocationName}` }
                  : undefined}
                value={line.targetLocationValue}
                onValueChange={(value) =>
                  patch(line.localId, {
                    targetLocationValue: value,
                    targetLocationId: Number(value),
                    targetLocationCode: undefined,
                    targetLocationName: undefined,
                  })
                }
                searchable
              />
              </OpsFieldShell>
            </Field>
            <div className="wms-ops-line-card__toggle">
              <OpsSkinCheckbox
                checked={line.requireHandlingUnit}
                onCheckedChange={(checked) =>
                  patch(line.localId, { requireHandlingUnit: checked })
                }
                aria-label={t(`${D}.lines.handlingUnitRequired`)}
              />
              <span
                className="min-w-0 cursor-pointer select-none truncate"
                onClick={() =>
                  patch(line.localId, { requireHandlingUnit: !line.requireHandlingUnit })
                }
              >
                {t(`${D}.lines.handlingUnitRequired`)}
              </span>
            </div>
          </>
        )}
      </div>
      <div
        data-wms-error-target="serial"
        data-wms-error-keys="seri|serial|serisi icin|kaynak rafi otomatik|farkli rafta bulundu"
      >
      <TrackingPlanEditor
        mode={line.trackingType}
        quantity={line.quantity}
        value={line.trackings}
        onChange={(trackings) => patch(line.localId, { trackings })}
        requireHandlingUnit={line.requireHandlingUnit}
        showDates={Boolean(
          line.trackingPolicy?.requireManufacturingDate ||
          line.trackingPolicy?.requireExpirationDate,
        )}
        accent="violet"
        compact
      />
      </div>
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
}) {
  return (
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[var(--wms-brand-primary)]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      className="space-y-1.5 text-sm"
      onClick={(event) => {
        // Etikete tıklamak dropdown tetikleyicisine click iletir; açık bir liste
        // dışarı tıklamayla kapanırken bu iletim onu anında yeniden açıyordu.
        const target = event.target as HTMLElement;
        if (target.closest("button, input, select, textarea")) return;
        if (event.currentTarget.querySelector("button.wms-ops-lookup-trigger")) {
          event.preventDefault();
        }
      }}
    >
      <span className="font-semibold text-[var(--wms-app-text)]">{label}</span>
      {children}
    </label>
  );
}
function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
