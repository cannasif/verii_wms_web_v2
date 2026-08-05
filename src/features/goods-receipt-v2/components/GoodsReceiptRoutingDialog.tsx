import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { ArrowRightLeft, ChevronDown, ChevronUp, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { StockIdentityCell } from "@/components/shared/StockIdentityCell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { formatProjectNumber } from "@/lib/project-format";
import { cn } from "@/lib/utils";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import { goodsReceiptEnumLabel } from "../localization/enum-labels";
import { resolveGoodsReceiptWaybillNo } from "../utils/goods-receipt-waybill";
import type {
  CustomerOption,
  GoodsReceiptDetail,
  GoodsReceiptSplitRoutingResult,
  LocationOption,
  SeriesOption,
  WarehouseOption,
} from "../types/goods-receipt.types";

type RouteKind = "transfer" | "outbound";

interface LineDraft {
  lineId: number;
  transferQuantity: number;
  outboundQuantity: number;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
}

export function GoodsReceiptRoutingDialog({
  detail,
  initialKind,
  onClose,
  onCompleted,
}: {
  detail: GoodsReceiptDetail;
  initialKind: RouteKind;
  onClose: () => void;
  onCompleted: (result: GoodsReceiptSplitRoutingResult) => Promise<void>;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [activeTab, setActiveTab] = useState<RouteKind>(initialKind);
  const [transferSeries, setTransferSeries] = useState<SeriesOption[]>([]);
  const [outboundSeries, setOutboundSeries] = useState<SeriesOption[]>([]);
  const [transferSeriesId, setTransferSeriesId] = useState("");
  const [outboundSeriesId, setOutboundSeriesId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>();
  const [targetWarehouseValue, setTargetWarehouseValue] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<number>();
  const [targetLocationValue, setTargetLocationValue] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number>();
  const [customerValue, setCustomerValue] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    detail.lines.map((line) => ({
      lineId: line.id,
      transferQuantity: initialKind === "transfer" ? line.routableQuantity : 0,
      outboundQuantity: initialKind === "outbound" ? line.routableQuantity : 0,
      sourceLocationId: line.defaultPutawayLocationId ?? line.defaultReceivingLocationId,
      sourceLocationValue:
        line.defaultPutawayLocationId || line.defaultReceivingLocationId
          ? String(line.defaultPutawayLocationId ?? line.defaultReceivingLocationId)
          : null,
    })),
  );

  const qualityReady =
    detail.header.qualityStatus === "NotRequired" ||
    detail.header.qualityStatus === "Passed" ||
    detail.header.qualityStatus === "Failed";
  const approvalReady =
    detail.header.approvalStatus === "NotRequired" ||
    detail.header.approvalStatus === "Approved";
  const routableLines = useMemo(
    () => detail.lines.filter((line) => line.routableQuantity > 0),
    [detail.lines],
  );
  const transferTotal = lines.reduce(
    (sum, line) => sum + Math.max(0, line.transferQuantity),
    0,
  );
  const outboundTotal = lines.reduce(
    (sum, line) => sum + Math.max(0, line.outboundQuantity),
    0,
  );

  useEffect(() => {
    setActiveTab(initialKind);
  }, [initialKind]);

  useEffect(() => {
    void Promise.all([
      goodsReceiptV2Api.transferSeries(),
      goodsReceiptV2Api.outboundSeries(),
    ])
      .then(([transferItems, outboundItems]) => {
        setTransferSeries(transferItems);
        setOutboundSeries(outboundItems);
        setTransferSeriesId(
          String(
            (transferItems.find((item) => item.isDefault) ?? transferItems[0])?.id ??
              "",
          ),
        );
        setOutboundSeriesId(
          String(
            (outboundItems.find((item) => item.isDefault) ?? outboundItems[0])?.id ??
              "",
          ),
        );
      })
      .catch((error: Error) => toast.error(error.message));
  }, [detail.header.targetWarehouseId]);

  const patchLine = (lineId: number, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)),
    );

  const submit = async () => {
    if (detail.header.status !== "Completed")
      return toast.error(t("list.routingDialog.errors.receiptNotCompleted"));
    if (!qualityReady)
      return toast.error(t("list.routingDialog.errors.qualityNotReady"));
    if (!approvalReady)
      return toast.error(t("list.routingDialog.errors.approvalNotReady"));
    if (detail.header.erpIntegrationStatus !== "Succeeded")
      return toast.error(t("list.routingDialog.errors.erpNotSucceeded"));
    if (transferTotal <= 0 && outboundTotal <= 0)
      return toast.error(t("list.routingDialog.errors.noQuantityEntered"));
    if (transferTotal > 0 && (!transferSeriesId || !targetWarehouseId))
      return toast.error(t("list.routingDialog.errors.transferSeriesAndWarehouseRequired"));
    if (transferTotal > 0 && targetWarehouseId === detail.header.targetWarehouseId)
      return toast.error(t("list.routingDialog.errors.sourceTargetSame"));
    if (outboundTotal > 0 && (!outboundSeriesId || !customerId))
      return toast.error(t("list.routingDialog.errors.outboundSeriesAndCustomerRequired"));
    for (const draft of lines) {
      const source = detail.lines.find((line) => line.id === draft.lineId)!;
      if (draft.transferQuantity < 0 || draft.outboundQuantity < 0)
        return toast.error(t("list.routingDialog.errors.negativeQuantity", { code: source.stockCode }));
      if (draft.transferQuantity + draft.outboundQuantity > source.routableQuantity)
        return toast.error(
          t("list.routingDialog.errors.exceedsRoutable", {
            code: source.stockCode,
            max: formatProjectNumber(source.routableQuantity),
          }),
        );
    }

    const mapLines = (selector: (line: LineDraft) => number) =>
      lines
        .filter((line) => selector(line) > 0)
        .map((line) => ({
          goodsReceiptLineId: line.lineId,
          quantity: selector(line),
          sourceLocationId: line.sourceLocationId ?? null,
        }));
    setSaving(true);
    try {
      const result = await goodsReceiptV2Api.routeSplit(detail.header.id, {
        transfer:
          transferTotal > 0
            ? {
                idempotencyKey: crypto.randomUUID(),
                documentSeriesId: Number(transferSeriesId),
                targetWarehouseId,
                targetReceivingLocationId: targetLocationId ?? null,
                targetPutawayLocationId: targetLocationId ?? null,
                priority: detail.header.priority || 3,
                description: description.trim() || null,
                lines: mapLines((line) => line.transferQuantity),
              }
            : null,
        outbound:
          outboundTotal > 0
            ? {
                idempotencyKey: crypto.randomUUID(),
                documentSeriesId: Number(outboundSeriesId),
                customerId,
                stagingLocationId: null,
                loadingLocationId: null,
                priority: detail.header.priority || 3,
                description: description.trim() || null,
                lines: mapLines((line) => line.outboundQuantity),
              }
            : null,
      });
      toast.success(
        t("list.routingDialog.successToast", {
          documents: result.routes
            .map((route) => route.targetDocumentNo)
            .join(` ${t("list.routingDialog.and")} `),
          quantity: formatProjectNumber(result.routedQuantity),
        }),
      );
      await onCompleted(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("list.routingDialog.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !saving &&
    detail.header.status === "Completed" &&
    qualityReady &&
    approvalReady &&
    detail.header.erpIntegrationStatus === "Succeeded" &&
    routableLines.length > 0 &&
    transferTotal + outboundTotal > 0;

  const waybillNo = resolveGoodsReceiptWaybillNo(detail.header);
  const activeTabLabel =
    activeTab === "transfer" ? t("list.routingDialog.transfer") : t("list.routingDialog.outbound");

  return (
    <ResponsiveDialog
      onClose={onClose}
      title={t("list.routingDialog.dialogTitle")}
      description={`${waybillNo || "—"} · ${t("list.routingDialog.tabsHint")}`}
      className="wms-ops-gr-route-dialog !max-w-[min(96vw,72rem)]"
    >
      <div
        className={cn(
          "wms-ops-gr-route-dialog__status",
          qualityReady && approvalReady
            ? "wms-ops-gr-route-dialog__status--ok"
            : "wms-ops-gr-route-dialog__status--warn",
        )}
      >
        {t("list.routingDialog.qualityGkk")}:{" "}
        <strong>
          {goodsReceiptEnumLabel(t, "qualityStatus", detail.header.qualityStatus)}
        </strong>
        {" · "}
        {t("list.routingDialog.receiptApproval")}:{" "}
        <strong>
          {goodsReceiptEnumLabel(t, "approvalStatus", detail.header.approvalStatus)}
        </strong>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as RouteKind)}
        className="wms-ops-gr-route-dialog__tabs mt-4"
      >
        <TabsList className="wms-ops-gr-route-dialog__tab-list">
          <TabsTrigger
            value="transfer"
            className="wms-ops-gr-route-dialog__tab wms-ops-gr-route-dialog__tab--transfer"
          >
            <ArrowRightLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="wms-ops-gr-route-dialog__tab-copy">
              <span className="wms-ops-gr-route-dialog__tab-kicker">{t("list.routingDialog.tabKickerTransfer")}</span>
              <span className="wms-ops-gr-route-dialog__tab-title">{t("list.routingDialog.tabTitleTransfer")}</span>
            </span>
            <span className="wms-ops-gr-route-dialog__tab-badge">
              {formatProjectNumber(transferTotal)}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="outbound"
            className="wms-ops-gr-route-dialog__tab wms-ops-gr-route-dialog__tab--outbound"
          >
            <PackageMinus className="size-3.5 shrink-0" aria-hidden />
            <span className="wms-ops-gr-route-dialog__tab-copy">
              <span className="wms-ops-gr-route-dialog__tab-kicker">{t("list.routingDialog.tabKickerOutbound")}</span>
              <span className="wms-ops-gr-route-dialog__tab-title">{t("list.routingDialog.tabTitleOutbound")}</span>
            </span>
            <span className="wms-ops-gr-route-dialog__tab-badge">
              {formatProjectNumber(outboundTotal)}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="wms-ops-gr-route-dialog__panel mt-0">
          <p className="wms-ops-gr-route-dialog__panel-hint">
            {t("list.routingDialog.transferPanelHint")}
          </p>
          <div className="wms-ops-gr-route-dialog__fields">
            <RouteField label={t("list.routingDialog.documentSeries")}>
              <AppDropdown
                value={transferSeriesId}
                onValueChange={setTransferSeriesId}
                placeholder={t("list.routingDialog.selectSeriesPlaceholder")}
                portalContainer={null}
                className={cn(
                  OPS_FIELD_CLASS,
                  !transferSeriesId && "wms-ops-field--placeholder",
                )}
                options={transferSeries.map((item) => ({
                  value: String(item.id),
                  label: `${item.code} · ${item.previewDocumentNumber}`,
                }))}
              />
            </RouteField>
            <RouteField label={t("list.routingDialog.targetWarehouse")}>
              <PagedAppDropdown<WarehouseOption>
                queryKey={[
                  "gr-route-target-warehouse",
                  detail.header.branchCode,
                  detail.header.targetWarehouseId,
                ]}
                fetchPage={async (request) => {
                  const page = await goodsReceiptV2Api.warehouses(
                    request,
                    detail.header.branchCode,
                  );
                  const items = page.items.filter(
                    (item) => item.id !== detail.header.targetWarehouseId,
                  );
                  return {
                    ...page,
                    items,
                    totalCount: items.length,
                    totalPages: 1,
                    pageNumber: 1,
                    hasNextPage: false,
                  };
                }}
                toOption={(item) => ({
                  value: String(item.id),
                  label: `${item.warehouseCode} · ${item.warehouseName}`,
                })}
                value={targetWarehouseValue}
                onValueChange={(value) => {
                  setTargetWarehouseValue(value);
                  setTargetWarehouseId(Number(value));
                  setTargetLocationValue(null);
                  setTargetLocationId(undefined);
                }}
                portalContainer={null}
                searchable
                className={cn(
                  OPS_FIELD_CLASS,
                  !targetWarehouseValue && "wms-ops-field--placeholder",
                )}
              />
            </RouteField>
            <RouteField label={t("list.routingDialog.targetShelf")}>
              <PagedAppDropdown<LocationOption>
                queryKey={["gr-route-target-location", targetWarehouseId]}
                enabled={Boolean(targetWarehouseId)}
                fetchPage={(request) =>
                  goodsReceiptV2Api.locations(request, targetWarehouseId!)
                }
                toOption={(item) => ({
                  value: String(item.id),
                  label: `${item.code} · ${item.name}`,
                })}
                value={targetLocationValue}
                onValueChange={(value) => {
                  setTargetLocationValue(value);
                  setTargetLocationId(Number(value));
                }}
                portalContainer={null}
                searchable
                className={cn(
                  OPS_FIELD_CLASS,
                  !targetLocationValue && "wms-ops-field--placeholder",
                )}
              />
            </RouteField>
          </div>
        </TabsContent>

        <TabsContent value="outbound" className="wms-ops-gr-route-dialog__panel mt-0">
          <p className="wms-ops-gr-route-dialog__panel-hint">
            {t("list.routingDialog.outboundPanelHint")}
          </p>
          <div className="wms-ops-gr-route-dialog__fields">
            <RouteField label={t("list.routingDialog.documentSeries")}>
              <AppDropdown
                value={outboundSeriesId}
                onValueChange={setOutboundSeriesId}
                placeholder={t("list.routingDialog.selectSeriesPlaceholder")}
                portalContainer={null}
                className={cn(
                  OPS_FIELD_CLASS,
                  !outboundSeriesId && "wms-ops-field--placeholder",
                )}
                options={outboundSeries.map((item) => ({
                  value: String(item.id),
                  label: `${item.code} · ${item.previewDocumentNumber}`,
                }))}
              />
            </RouteField>
            <RouteField label={t("list.routingDialog.outboundCustomer")}>
              <PagedAppDropdown<CustomerOption>
                queryKey={["gr-route-customer", detail.header.branchCode]}
                fetchPage={(request) =>
                  goodsReceiptV2Api.customers(request, detail.header.branchCode)
                }
                toOption={(item) => ({
                  value: String(item.id),
                  label: `${item.customerCode} · ${item.customerName}`,
                })}
                value={customerValue}
                onValueChange={(value) => {
                  setCustomerValue(value);
                  setCustomerId(Number(value));
                }}
                portalContainer={null}
                searchable
                className={cn(
                  OPS_FIELD_CLASS,
                  !customerValue && "wms-ops-field--placeholder",
                )}
              />
            </RouteField>
          </div>
        </TabsContent>
      </Tabs>

      <section className="wms-ops-gr-route-dialog__lines mt-4">
        <header className="wms-ops-gr-route-dialog__lines-head">
          <strong>{t("list.routingDialog.lineDistributionList")}</strong>
          <span>
            {t("list.routingDialog.linesHeadSummary", { count: routableLines.length, tab: activeTabLabel })}
          </span>
        </header>
        <div className="wms-ops-gr-route-dialog__lines-scroll">
          <table className="wms-ops-gr-route-dialog__table">
            <thead>
              <tr>
                <th>{t("list.stock")}</th>
                <th className="text-right">{t("list.routingDialog.accepted")}</th>
                <th className="text-right">{t("list.routingDialog.previous")}</th>
                <th className="text-right">{t("list.remaining")}</th>
                <th
                  className={cn(
                    activeTab === "transfer"
                      ? "wms-ops-gr-route-dialog__col--transfer"
                      : "wms-ops-gr-route-dialog__col--outbound",
                  )}
                >
                  {activeTabLabel}
                </th>
                <th>{t("list.routingDialog.sourceShelf")}</th>
              </tr>
            </thead>
            <tbody>
              {routableLines.map((line) => {
                const draft = lines.find((item) => item.lineId === line.id)!;
                const remaining =
                  line.routableQuantity -
                  draft.transferQuantity -
                  draft.outboundQuantity;
                const activeQty =
                  activeTab === "transfer"
                    ? draft.transferQuantity
                    : draft.outboundQuantity;
                return (
                  <tr key={line.id}>
                    <td>
                      <StockIdentityCell
                        stockId={line.stockId}
                        stockCode={line.stockCode}
                        stockName={line.stockName}
                        branchCode={detail.header.branchCode}
                      />
                    </td>
                    <td className="text-right font-mono">
                      {formatProjectNumber(line.acceptedQuantity)}
                    </td>
                    <td className="text-right font-mono">
                      {formatProjectNumber(line.routedQuantity)}
                    </td>
                    <td
                      className={cn(
                        "text-right font-mono font-bold",
                        remaining < 0
                          ? "text-rose-500"
                          : "text-[color-mix(in_oklab,var(--wms-ops-accent)_70%,currentColor)]",
                      )}
                    >
                      {formatProjectNumber(remaining)}
                    </td>
                    <td
                      className={cn(
                        activeTab === "transfer"
                          ? "wms-ops-gr-route-dialog__col--transfer"
                          : "wms-ops-gr-route-dialog__col--outbound",
                      )}
                    >
                      <OpsFieldShell className="wms-ops-gr-route-dialog__cell-shell">
                        <div className="wms-ops-qty-stepper relative">
                          <input
                            className={cn(
                              OPS_FIELD_CLASS,
                              "h-9 w-full pr-8 text-right font-mono text-sm",
                            )}
                            inputMode="decimal"
                            value={String(activeQty)}
                            onChange={(event) => {
                              const next = Number(
                                event.target.value.replace(",", "."),
                              );
                              patchLine(
                                line.id,
                                activeTab === "transfer"
                                  ? {
                                      transferQuantity: Number.isFinite(next)
                                        ? Math.max(0, next)
                                        : 0,
                                    }
                                  : {
                                      outboundQuantity: Number.isFinite(next)
                                        ? Math.max(0, next)
                                        : 0,
                                    },
                              );
                            }}
                            onFocus={(event) => {
                              event.currentTarget.select();
                            }}
                            onClick={(event) => {
                              event.currentTarget.select();
                            }}
                          />
                          <div className="wms-ops-qty-stepper__controls absolute inset-y-0 right-0 flex flex-col justify-center pr-0.5">
                            <button
                              type="button"
                              className="wms-ops-qty-stepper__btn"
                              aria-label={t("list.routingDialog.increaseQuantity")}
                              onClick={() => {
                                const next = Math.min(
                                  line.routableQuantity,
                                  Math.round((activeQty + 1) * 1e6) / 1e6,
                                );
                                patchLine(
                                  line.id,
                                  activeTab === "transfer"
                                    ? { transferQuantity: next }
                                    : { outboundQuantity: next },
                                );
                              }}
                            >
                              <ChevronUp className="size-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="wms-ops-qty-stepper__btn"
                              aria-label={t("list.routingDialog.decreaseQuantity")}
                              onClick={() => {
                                const next = Math.max(
                                  0,
                                  Math.round((activeQty - 1) * 1e6) / 1e6,
                                );
                                patchLine(
                                  line.id,
                                  activeTab === "transfer"
                                    ? { transferQuantity: next }
                                    : { outboundQuantity: next },
                                );
                              }}
                            >
                              <ChevronDown className="size-3" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </OpsFieldShell>
                    </td>
                    <td>
                      <OpsFieldShell className="wms-ops-gr-route-dialog__cell-shell">
                        <div
                          className={cn(
                            OPS_FIELD_CLASS,
                            "h-9 flex items-center px-3 text-sm",
                            !draft.sourceLocationValue && "wms-ops-field--placeholder",
                          )}
                          title={t("list.routingDialog.sourceShelfFixedHint")}
                          aria-label={t("list.routingDialog.sourceShelf")}
                        >
                          {draft.sourceLocationValue
                            ? t("list.routingDialog.shelfNumber", {
                                id: draft.sourceLocationValue,
                              })
                            : "—"}
                        </div>
                      </OpsFieldShell>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <RouteField label={t("list.routingDialog.operationNote")} className="wms-ops-gr-route-dialog__note-field mt-4">
        <textarea
          className={cn(
            OPS_FIELD_CLASS,
            "wms-ops-gr-route-dialog__note min-h-[4.5rem] w-full resize-y",
            !description && "wms-ops-field--placeholder",
          )}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          placeholder={t("list.routingDialog.notePlaceholder")}
        />
      </RouteField>

      <footer className="wms-ops-gr-route-dialog__footer">
        <div className="wms-ops-gr-route-dialog__totals">
          <span className="wms-ops-gr-route-dialog__total wms-ops-gr-route-dialog__total--transfer">
            {t("list.routingDialog.transferTotalLabel", { value: formatProjectNumber(transferTotal) })}
          </span>
          <span className="wms-ops-gr-route-dialog__total wms-ops-gr-route-dialog__total--outbound">
            {t("list.routingDialog.outboundTotalLabel", { value: formatProjectNumber(outboundTotal) })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            {t("list.erpRetryDialog.cancel")}
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            disabled={!canSubmit}
            loading={saving}
            onClick={() => void submit()}
          >
            <ArrowRightLeft className="size-3.5" aria-hidden />
            {t("list.routingDialog.createDistribution")}
          </OpsActionButton>
        </div>
      </footer>
    </ResponsiveDialog>
  );
}

function RouteField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={cn("wms-ops-gr-route-dialog__field", className)}>
      <span className="wms-ops-entry-label mb-1.5 block">{label}</span>
      <OpsFieldShell>{children}</OpsFieldShell>
    </div>
  );
}
