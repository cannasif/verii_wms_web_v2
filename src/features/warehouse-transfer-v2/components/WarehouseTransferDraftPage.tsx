import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput } from "@/components/shared/AppInput";
import { OperationFlowTabs } from "@/components/shared/OperationFlowTabs";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { TrackingPlanEditor } from "@/components/shared/TrackingPlanEditor";
import { StockTrackingPolicyField } from "@/features/stock-tracking/effective-stock-tracking";
import { useAuthStore } from "@/stores/auth-store";
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
const warehouseOption = (x: WarehouseOption) => ({
  value: `${x.id}|${x.warehouseCode}`,
  label: `${x.warehouseCode} · ${x.warehouseName}`,
});
const locationOption = (x: LocationOption) => ({
  value: String(x.id),
  label: `${x.code} · ${x.name}`,
  description: x.locationType,
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
const userValue = (x: ActiveUserOption) =>
  encodeURIComponent(JSON.stringify(x));
const userOption = (x: ActiveUserOption) => ({
  value: userValue(x),
  label: `${x.firstName} ${x.lastName}`.trim() || x.username,
  description: `${x.username} · ${x.email}`,
});
const blankLine = (): TransferDraftLine => ({
  localId: crypto.randomUUID(),
  quantity: 1,
  unitCode: "",
  trackingType: "None",
  requireHandlingUnit: false,
  trackings: [],
});

export type TransferDraftVariant = "warehouse" | "production" | "subcontracting";
export type SubcontractingTransferDirection =
  | "IssueToSupplier"
  | "ReceiptFromSupplier"
  | "SupplierToSupplier";

export function WarehouseTransferDraftPage({
  variant = "warehouse",
  fixedSubcontractingDirection,
}: {
  variant?: TransferDraftVariant;
  fixedSubcontractingDirection?: SubcontractingTransferDirection;
}): ReactElement {
  const { t } = useTranslation("common");
  const branchCode = useAuthStore((x) => x.branch?.code ?? "0");
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
  const [externalReference, setExternalReference] = useState("");
  const [description, setDescription] = useState("");
  const [productionPurpose, setProductionPurpose] = useState<"MaterialSupply" | "WorkInProgressMove" | "OutputMove">("MaterialSupply");
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
    setSeriesId(null);
    if (!sourceId) return;
    const documentType = variant === "production"
      ? "ProductionTransfer"
      : variant === "subcontracting"
        ? subcontractDirection === "ReceiptFromSupplier" ? "SubcontractingReceipt" : "SubcontractingIssue"
        : "InterWarehouseTransfer";
    void warehouseTransferApi
      .series(sourceId, documentType)
      .then((rows) => {
        setSeries(rows);
        const preferred = rows.find((x) => x.isDefault) ?? rows[0];
        setSeriesId(preferred ? String(preferred.id) : null);
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
    setSourceKind(value);
    setLines(value === "StockBased" || variant !== "warehouse" ? [blankLine()] : []);
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
    if (variant !== "warehouse" && sourceId === targetId && lines.some((x) =>
      !x.sourceLocationId || !x.targetLocationId || x.sourceLocationId === x.targetLocationId))
      return t(`${D}.validation.sameLocationInWarehouse`);
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
    for (const [index, line] of lines.entries()) {
      const lineNo = index + 1;
      if (!line.stockId) return t(`${D}.validation.lineStockRequired`, { index: lineNo });
      if (!line.trackingPolicy)
        return t(`${D}.validation.linePolicyLoadFailed`, { index: lineNo });
      if (!(line.quantity > 0))
        return t(`${D}.validation.lineQuantityRequired`, { index: lineNo });
      if (line.source && line.quantity > line.source.availableQuantity)
        return t(`${D}.validation.lineQuantityExceeded`, { index: lineNo });
      if (policy.requireSourceLocation && !line.sourceLocationId)
        return t(`${D}.validation.lineSourceLocationRequired`, { index: lineNo });
      if (policy.requireTargetLocation && !line.targetLocationId)
        return t(`${D}.validation.lineTargetLocationRequired`, { index: lineNo });
      if (line.trackingType !== "None") {
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
            transfer,
            purpose: productionPurpose,
            productionHeaderId: null,
            productionOrderId: null,
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
  const listUrl = variant === "production" ? "/warehouse/production-transfers/list"
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
      <section className="mx-auto max-w-3xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center" data-no-auto-localize="true">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-black">{t(`${D}.success.title`)}</h1>
        <p className="mt-2 font-mono text-xl">{result.documentNo}</p>
        <p className="mt-1 text-sm text-slate-500">
          {t(`${D}.success.linesAndQty`, { count: result.lineCount, total: result.requestedQuantity })}
        </p>
        {result.taskNo && (
          <p className="mt-1 font-mono text-sm text-violet-500">
            {t(`${D}.success.taskNo`, { taskNo: result.taskNo })}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link
            to={listUrl}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white"
          >
            {t(`${D}.success.goToRecords`)}
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setLines(sourceKind === "StockBased" || variant !== "warehouse" ? [blankLine()] : []);
            }}
            className="rounded-xl border px-5 py-2.5"
          >
            {t(`${D}.success.newTransfer`)}
          </button>
        </div>
      </section>
    );

  return (
    <section className="space-y-5" data-no-auto-localize="true">
      <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-violet-500/10 via-[var(--wms-app-panel)] to-cyan-500/10 p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-500">
          {title}
        </p>
        <h1 className="mt-1 text-2xl font-black">{title} {t(`${D}.createSuffix`)}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t(`${D}.headerDescription`)}
        </p>
      </header>
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
      {variant === "production" && (
        <Panel title={t(`${D}.production.panel`)} icon={<ClipboardList className="size-5" />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t(`${D}.production.purpose`)}><AppDropdown value={productionPurpose} onValueChange={(value) => setProductionPurpose(value as typeof productionPurpose)} options={[...productionPurposeOptions]}/></Field>
            <Field label={t(`${D}.production.planNo`)}><input className="input" maxLength={100} value={productionPlanNo} onChange={(e)=>setProductionPlanNo(e.target.value)}/></Field>
            <Field label={`${t(`${D}.production.orderNo`)}${sourceKind === "OrderBased" ? " *" : ""}`}><input className="input" maxLength={100} value={productionOrderNo} onChange={(e)=>setProductionOrderNo(e.target.value)}/></Field>
            <Field label={t(`${D}.production.operationCode`)}><input className="input" maxLength={100} value={productionOperationCode} onChange={(e)=>setProductionOperationCode(e.target.value)}/></Field>
            <Field label={t(`${D}.production.sourceWorkCenter`)}><input className="input" maxLength={100} value={sourceWorkCenterCode} onChange={(e)=>setSourceWorkCenterCode(e.target.value)}/></Field>
            <Field label={t(`${D}.production.targetWorkCenter`)}><input className="input" maxLength={100} value={targetWorkCenterCode} onChange={(e)=>setTargetWorkCenterCode(e.target.value)}/></Field>
          </div>
          <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-sm">
            {t(`${D}.production.note`)}
          </p>
        </Panel>
      )}
      {variant === "subcontracting" && (
        <Panel title={t(`${D}.subcontracting.supplierPanel`)} icon={<ClipboardList className="size-5" />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t(`${D}.subcontracting.direction`)}><AppDropdown value={subcontractDirection} disabled={Boolean(fixedSubcontractingDirection)} onValueChange={(value)=>setSubcontractDirection(value as typeof subcontractDirection)} options={[...subcontractDirectionOptions]}/></Field>
            <Field label={t(`${D}.subcontracting.supplier`)}><PagedAppDropdown queryKey={["subcontract-supplier",branchCode]} fetchPage={(r)=>warehouseTransferApi.customers(r,branchCode)} toOption={customerOption} value={supplierValue} onValueChange={setSupplierValue} searchable minSearchLength={2} placeholder={t(`${D}.subcontracting.supplierSearch`)}/></Field>
            <Field label={`${t(`${D}.subcontracting.orderNo`)}${sourceKind === "OrderBased" ? " *" : ""}`}><input className="input" maxLength={100} value={subcontractOrderNo} onChange={(e)=>setSubcontractOrderNo(e.target.value)}/></Field>
            <Field label={t(`${D}.subcontracting.expectedReturn`)}><AppDateInput type="datetime-local" value={expectedReturnAt} onChange={(e)=>setExpectedReturnAt(e.target.value)}/></Field>
            {subcontractDirection === "ReceiptFromSupplier" && <Field label={t(`${D}.subcontracting.parentIssueId`)}><input className="input" type="number" min={1} value={parentIssueTransferId} onChange={(e)=>setParentIssueTransferId(e.target.value)}/></Field>}
            <Field label={t(`${D}.subcontracting.supplierDispatchNo`)}><input className="input" maxLength={100} value={supplierDispatchNo} onChange={(e)=>setSupplierDispatchNo(e.target.value)}/></Field>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t(`${D}.document.sourceWarehouse`)}>
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
              }}
              searchable
              placeholder={t(`${D}.document.sourceWarehousePlaceholder`)}
            />
          </Field>
          <Field label={t(`${D}.document.targetWarehouse`)}>
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
              }}
              searchable
              placeholder={t(`${D}.document.targetWarehousePlaceholder`)}
            />
          </Field>
          <Field label={t(`${D}.document.sourceStaging`)}>
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
          </Field>
          <Field label={t(`${D}.document.targetReceiving`)}>
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
          </Field>
          <Field label={t(`${D}.document.series`)}>
            <AppDropdown
              value={seriesId}
              onValueChange={setSeriesId}
              options={series.map((x) => ({
                value: String(x.id),
                label: `${x.code} · ${x.previewDocumentNumber}`,
              }))}
            />
          </Field>
          <Field label={t(`${D}.document.documentDate`)}>
            <AppDateInput
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
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
            <AppDropdown
              value={priority}
              onValueChange={setPriority}
              options={[1, 2, 3, 4, 5].map((x) => ({
                value: String(x),
                label: String(x),
              }))}
            />
          </Field>
          <Field label={t(`${D}.document.externalReference`)}>
            <input
              className="input"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
            />
          </Field>
          <Field label={t(`${D}.document.description`)}>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </Panel>
      {executionKind === "TaskBased" && (
        <Assignees assignees={assignees} setAssignees={setAssignees} />
      )}
      <Panel
        title={t(`${D}.lines.panel`, { count: lines.length, total })}
        icon={<ArrowLeftRight className="size-5" />}
      >
        <div className="space-y-3">
          {lines.map((line, index) => (
            <LineCard
              key={line.localId}
              line={line}
              index={index}
              branchCode={branchCode}
              sourceId={sourceId}
              targetId={targetId}
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
            onClick={() => setLines((current) => [...current, blankLine()])}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2.5 text-sm font-semibold text-violet-500"
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
          className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50"
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
        <button
          type="button"
          disabled={!p.customerValue || p.busy}
          onClick={() => void p.loadOrders()}
          className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
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
              <small className="ml-2 text-slate-500">
                {order.projectCode} · depo {order.targetWarehouseCode ?? "—"}
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
          className="mt-3 rounded-xl border border-violet-500/40 px-4 py-2.5 font-semibold text-violet-500"
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
}: {
  assignees: ActiveUserOption[];
  setAssignees: React.Dispatch<React.SetStateAction<ActiveUserOption[]>>;
}): ReactElement {
  const { t } = useTranslation("common");
  return (
    <Panel title={t(`${D}.assignees.panel`)} icon={<UserRoundCog className="size-5" />}>
      <PagedAppDropdown
        queryKey={["wt-assignees"]}
        fetchPage={warehouseTransferApi.activeUsers}
        toOption={(user) => ({
          ...userOption(user),
          disabled: assignees.some((x) => x.id === user.id),
        })}
        value={null}
        onValueChange={(value) => {
          const user = JSON.parse(
            decodeURIComponent(value),
          ) as ActiveUserOption;
          setAssignees((current) =>
            current.some((x) => x.id === user.id)
              ? current
              : [...current, user],
          );
        }}
        searchable
        minSearchLength={2}
        placeholder={t(`${D}.assignees.search`)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {assignees.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm"
          >
            {`${user.firstName} ${user.lastName}`.trim() || user.username}
            <button
              type="button"
              onClick={() =>
                setAssignees((current) =>
                  current.filter((x) => x.id !== user.id),
                )
              }
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
    </Panel>
  );
}
function LineCard({
  line,
  index,
  branchCode,
  sourceId,
  targetId,
  patch,
  remove,
}: {
  line: TransferDraftLine;
  index: number;
  branchCode: string;
  sourceId: number;
  targetId: number;
  patch: (id: string, value: Partial<TransferDraftLine>) => void;
  remove: () => void;
}): ReactElement {
  const { t } = useTranslation("common");
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
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] p-4">
      <div className="mb-3 flex justify-between">
        <strong>
          #{index + 1}{" "}
          {line.source && (
            <span className="mr-2 font-mono text-violet-500">
              {line.source.orderNumber}
            </span>
          )}
          {line.stockCode ?? t(`${D}.lines.newLine`)}
        </strong>
        <button type="button" onClick={remove} className="text-red-500">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t(`${D}.lines.stock`)}>
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
                  const trackingPolicy =
                    await warehouseTransferApi.trackingPolicy(branchCode, x.id);
                  patch(line.localId, {
                    stockId: x.id,
                    stockCode: x.erpStockCode,
                    stockName: x.stockName,
                    unitCode: x.unitCode || "",
                    trackingType: trackingPolicy.trackingType,
                    trackingPolicy,
                    trackings: [],
                  });
                } catch (error) {
                  toast.error(
                    message(error, t(`${D}.toast.trackingPolicyFailed`)),
                  );
                }
              })();
            }}
            searchable
            minSearchLength={2}
          />
        </Field>
        <Field label={t(`${D}.lines.yapCode`)}>
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
        </Field>
        <Field label={t(`${D}.lines.quantity`)}>
          <input
            className="input"
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
          <div className={`input flex items-center font-bold ${line.unitCode ? "text-cyan-600" : "text-amber-600"}`}>
            {line.unitCode || t(`${D}.lines.selectStockFirst`)}
          </div>
        </Field>
        <Field label={t(`${D}.lines.sourceLocation`)}>
          <PagedAppDropdown
            queryKey={["wt-line-source", line.localId, sourceId]}
            fetchPage={(r) => warehouseTransferApi.locations(r, sourceId)}
            toOption={locationOption}
            enabled={Boolean(sourceId)}
            value={line.sourceLocationValue}
            onValueChange={(value) =>
              patch(line.localId, {
                sourceLocationValue: value,
                sourceLocationId: Number(value),
              })
            }
            searchable
          />
        </Field>
        <Field label={t(`${D}.lines.targetLocation`)}>
          <PagedAppDropdown
            queryKey={["wt-line-target", line.localId, targetId]}
            fetchPage={(r) => warehouseTransferApi.locations(r, targetId)}
            toOption={locationOption}
            enabled={Boolean(targetId)}
            value={line.targetLocationValue}
            onValueChange={(value) =>
              patch(line.localId, {
                targetLocationValue: value,
                targetLocationId: Number(value),
              })
            }
            searchable
          />
        </Field>
        <Field label={t(`${D}.lines.trackingPolicy`)}>
          <StockTrackingPolicyField policy={line.trackingPolicy} />
        </Field>
        <label className="flex h-11 items-center gap-2 self-end rounded-xl border border-[var(--wms-app-border)] px-3 text-sm">
          <input
            type="checkbox"
            checked={line.requireHandlingUnit}
            onChange={(e) =>
              patch(line.localId, { requireHandlingUnit: e.target.checked })
            }
          />
          {t(`${D}.lines.handlingUnitRequired`)}
        </label>
      </div>
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
}) {
  return (
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-violet-500">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
