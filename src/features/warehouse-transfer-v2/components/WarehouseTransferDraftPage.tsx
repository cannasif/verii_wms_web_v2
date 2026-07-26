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
  unitCode: "ADET",
  trackingType: "None",
  requireHandlingUnit: false,
  trackings: [],
});

export function WarehouseTransferDraftPage(): ReactElement {
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
  const [lines, setLines] = useState<TransferDraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateTransferDraftResult | null>(null);

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
    void warehouseTransferApi
      .series(sourceId)
      .then((rows) => {
        setSeries(rows);
        const preferred = rows.find((x) => x.isDefault) ?? rows[0];
        setSeriesId(preferred ? String(preferred.id) : null);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [sourceId]);
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
      toast.error(message(error, "Netsis transfer emirleri alınamadı."));
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
              `${row.orderNumber}/${row.orderId}: stok kodu bulunamadı.`,
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
              `${row.stockCode} ERP mirror tablosunda bulunamadı.`,
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
            unitCode: stock.unitCode || "ADET",
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
      toast.error(message(error, "Transfer emir kalemleri hazırlanamadı."));
    } finally {
      setBusy(false);
    }
  };

  const validate = (): string | null => {
    if (!policy) return "Transfer politikası yüklenemedi.";
    const allowed =
      sourceKind === "OrderBased"
        ? executionKind === "TaskBased"
          ? policy.allowOrderBasedTask
          : policy.allowOrderBasedDirect
        : executionKind === "TaskBased"
          ? policy.allowStockBasedTask
          : policy.allowStockBasedDirect;
    if (!allowed) return "Seçilen transfer kombinasyonu politikada kapalıdır.";
    if (!sourceId || !targetId) return "Kaynak ve hedef depo seçilmelidir.";
    if (sourceId === targetId) return "Kaynak ve hedef depo aynı olamaz.";
    if (!seriesId) return "Transfer belge serisi seçilmelidir.";
    if (dispatchAt && arrivalAt && new Date(arrivalAt) < new Date(dispatchAt))
      return "Planlanan varış sevk zamanından önce olamaz.";
    if (!lines.length) return "En az bir transfer kalemi olmalıdır.";
    if (sourceKind === "OrderBased" && lines.some((x) => !x.source))
      return "Siparişli transferde Netsis emir kalemleri seçilmelidir.";
    if (
      executionKind === "TaskBased" &&
      policy.requireAssigneeForTask &&
      !assignees.length
    )
      return "Emirli transferde en az bir kullanıcı atanmalıdır.";
    if (!policy.allowMultipleAssignees && assignees.length > 1)
      return "Politika birden fazla kullanıcı atamasına izin vermiyor.";
    for (const [index, line] of lines.entries()) {
      if (!line.stockId) return `${index + 1}. kalemde stok seçilmelidir.`;
      if (!line.trackingPolicy)
        return `${index + 1}. kalemin merkezî stok takip politikası yüklenemedi.`;
      if (!(line.quantity > 0))
        return `${index + 1}. kalemde miktar sıfırdan büyük olmalıdır.`;
      if (line.source && line.quantity > line.source.availableQuantity)
        return `${index + 1}. kalem açık emir miktarını aşıyor.`;
      if (policy.requireSourceLocation && !line.sourceLocationId)
        return `${index + 1}. kalemde kaynak raf zorunludur.`;
      if (policy.requireTargetLocation && !line.targetLocationId)
        return `${index + 1}. kalemde hedef raf zorunludur.`;
      if (line.trackingType !== "None") {
        if (!line.trackings.length)
          return `${index + 1}. kalemde seri/lot planı zorunludur.`;
        const tracked = line.trackings.reduce(
          (sum, x) => sum + Number(x.quantity || 0),
          0,
        );
        if (Math.abs(tracked - line.quantity) > 0.000001)
          return `${index + 1}. kalemde seri/lot toplamı transfer miktarına eşit olmalıdır.`;
        if (
          (line.trackingType === "Serial" ||
            line.trackingType === "LotAndSerial") &&
          line.trackings.some((x) => !x.serialNo?.trim() || x.quantity !== 1)
        )
          return `${index + 1}. kalemde her seri benzersiz ve 1 miktarlı olmalıdır.`;
        if (
          (line.trackingType === "Lot" ||
            line.trackingType === "LotAndSerial") &&
          line.trackings.some((x) => !x.lotNo?.trim())
        )
          return `${index + 1}. kalemde lot zorunludur.`;
        if (
          line.requireHandlingUnit &&
          line.trackings.some((x) => !x.handlingUnitNo?.trim())
        )
          return `${index + 1}. kalemde palet/kasa zorunludur.`;
        const serials = line.trackings
          .map((x) => x.serialNo?.trim().toLocaleUpperCase("tr-TR"))
          .filter(Boolean);
        if (new Set(serials).size !== serials.length)
          return `${index + 1}. kalemde aynı seri tekrar edemez.`;
      }
      if (
        line.trackingPolicy?.requireManufacturingDate &&
        line.trackings.some((x) => !x.manufacturingDate)
      )
        return `${index + 1}. kalemde üretim tarihi zorunludur.`;
      if (
        line.trackingPolicy?.requireExpirationDate &&
        line.trackings.some((x) => !x.expirationDate)
      )
        return `${index + 1}. kalemde son kullanma tarihi zorunludur.`;
      if (
        line.trackingPolicy?.serialQuantityRule === "OneSerialPerBaseUnit" &&
        (!Number.isInteger(line.quantity) ||
          line.trackings.length !== line.quantity ||
          line.trackings.some((x) => x.quantity !== 1))
      )
        return `${index + 1}. kalemde miktar kadar benzersiz seri girilmelidir.`;
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
      const created = await warehouseTransferApi.createDraft({
        idempotencyKey: crypto.randomUUID(),
        branchCode,
        documentSeriesId: Number(seriesId),
        documentDate,
        initiationMode:
          sourceKind === "OrderBased"
            ? executionKind === "TaskBased"
              ? "OrderBasedTask"
              : "OrderBasedDirectTransfer"
            : executionKind === "TaskBased"
              ? "StockBasedTask"
              : "DirectTransfer",
        processType:
          sourceKind === "OrderBased" ? "ErpOrderBased" : "InternalRequest",
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
      });
      setResult(created);
      toast.success(`${created.documentNo} transferi oluşturuldu.`);
    } catch (error) {
      toast.error(message(error, "Transfer oluşturulamadı."));
    } finally {
      setBusy(false);
    }
  };

  if (result)
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-black">Transfer oluşturuldu</h1>
        <p className="mt-2 font-mono text-xl">{result.documentNo}</p>
        <p className="mt-1 text-sm text-slate-500">
          {result.lineCount} kalem · {result.requestedQuantity} miktar
        </p>
        {result.taskNo && (
          <p className="mt-1 font-mono text-sm text-violet-500">
            Toplama emri: {result.taskNo}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link
            to="/warehouse/transfers/list"
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white"
          >
            Kayıtlara Git
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setLines(sourceKind === "StockBased" ? [blankLine()] : []);
            }}
            className="rounded-xl border px-5 py-2.5"
          >
            Yeni Transfer
          </button>
        </div>
      </section>
    );

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-violet-500/10 via-[var(--wms-app-panel)] to-cyan-500/10 p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-500">
          Depolar Arası Transfer
        </p>
        <h1 className="mt-1 text-2xl font-black">Esnek Transfer Oluşturma</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sipariş kaynağı ile emir yürütmesini bağımsız seçin; bütün varyantlar
          aynı transfer başlık, kalem, takip ve hareket yapısını kullanır.
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
        orderLabel="Netsis transfer emrine istinaden"
        stockLabel="Siparişsiz / serbest stoktan"
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
          ? "Netsis emir ve kalem bağlantıları kaynak tablolarda saklanır."
          : "Kalemler ERP stok mirror üzerinden seçilir."}{" "}
        {executionKind === "TaskBased"
          ? "Toplama emri, rezervasyon ve kullanıcı ataması oluşur."
          : "Görev oluşturulmaz; yetki ve doğrudan transfer politikası uygulanır."}
      </OperationFlowTabs>
      {sourceKind === "OrderBased" && (
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
      <Panel title="Belge ve rota" icon={<ArrowLeftRight className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Kaynak depo *">
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
              placeholder="Kaynak depo"
            />
          </Field>
          <Field label="Hedef depo *">
            <PagedAppDropdown
              queryKey={["wt-target", branchCode]}
              fetchPage={(request) =>
                warehouseTransferApi.warehouses(request, branchCode)
              }
              toOption={(warehouse) => ({
                ...warehouseOption(warehouse),
                disabled: warehouse.id === sourceId,
              })}
              value={targetValue}
              onValueChange={(value) => {
                setTargetValue(value);
                setTargetReceiving(null);
              }}
              searchable
              placeholder="Hedef depo"
            />
          </Field>
          <Field label="Kaynak hazırlama alanı">
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
              placeholder="İsteğe bağlı"
            />
          </Field>
          <Field label="Hedef kabul alanı">
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
              placeholder="İsteğe bağlı"
            />
          </Field>
          <Field label="Belge serisi *">
            <AppDropdown
              value={seriesId}
              onValueChange={setSeriesId}
              options={series.map((x) => ({
                value: String(x.id),
                label: `${x.code} · ${x.previewDocumentNumber}`,
              }))}
            />
          </Field>
          <Field label="Belge tarihi">
            <AppDateInput
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </Field>
          <Field label="Planlanan sevk">
            <AppDateInput
              type="datetime-local"
              value={dispatchAt}
              onChange={(e) => setDispatchAt(e.target.value)}
            />
          </Field>
          <Field label="Planlanan varış">
            <AppDateInput
              type="datetime-local"
              value={arrivalAt}
              onChange={(e) => setArrivalAt(e.target.value)}
            />
          </Field>
          <Field label="Öncelik">
            <AppDropdown
              value={priority}
              onValueChange={setPriority}
              options={[1, 2, 3, 4, 5].map((x) => ({
                value: String(x),
                label: String(x),
              }))}
            />
          </Field>
          <Field label="Harici referans">
            <input
              className="input"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
            />
          </Field>
          <Field label="Açıklama">
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
        title={`Transfer kalemleri · ${lines.length} kalem · ${total} miktar`}
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
        {sourceKind === "StockBased" && (
          <button
            type="button"
            onClick={() => setLines((current) => [...current, blankLine()])}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2.5 text-sm font-semibold text-violet-500"
          >
            <Plus className="size-4" />
            Kalem ekle
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
          {busy && <Loader2 className="size-4 animate-spin" />}Transferi Oluştur
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
  return (
    <Panel
      title="Netsis transfer emri seçimi"
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
          placeholder="Cari ara"
        />
        <button
          type="button"
          disabled={!p.customerValue || p.busy}
          onClick={() => void p.loadOrders()}
          className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          Emirleri Getir
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
          Seçili Emir Kalemlerini Al
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
  return (
    <Panel title="Emir sorumluları" icon={<UserRoundCog className="size-5" />}>
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
        placeholder="Aktif kullanıcı ara"
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
          {line.stockCode ?? "Yeni kalem"}
        </strong>
        <button type="button" onClick={remove} className="text-red-500">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Stok *">
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
                    unitCode: x.unitCode || line.unitCode,
                    trackingType: trackingPolicy.trackingType,
                    trackingPolicy,
                    trackings: [],
                  });
                } catch (error) {
                  toast.error(
                    message(error, "Stok takip politikası alınamadı."),
                  );
                }
              })();
            }}
            searchable
            minSearchLength={2}
          />
        </Field>
        <Field label="Yapılandırma kodu">
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
        <Field label="Miktar *">
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
        <Field label="Birim">
          <input
            className="input"
            value={line.unitCode}
            onChange={(e) => patch(line.localId, { unitCode: e.target.value })}
          />
        </Field>
        <Field label="Kaynak raf">
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
        <Field label="Hedef raf">
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
        <Field label="Stok takip politikası">
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
          Palet zorunlu
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
