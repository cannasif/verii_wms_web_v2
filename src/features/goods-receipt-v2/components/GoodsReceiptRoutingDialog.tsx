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
      return toast.error("Mal kabul tamamlanmadan DAT veya ambar çıkış oluşturulamaz.");
    if (!qualityReady)
      return toast.error("Kalite/GKK kararı tamamlanmadan yönlendirme yapılamaz.");
    if (!approvalReady)
      return toast.error("Mal kabul onayı tamamlanmadan yönlendirme yapılamaz.");
    if (detail.header.erpIntegrationStatus !== "Succeeded")
      return toast.error("ERP irsaliyesi başarıyla oluşmadan DAT veya ambar çıkış oluşturulamaz.");
    if (transferTotal <= 0 && outboundTotal <= 0)
      return toast.error("En az bir kaleme transfer veya ambar çıkış miktarı girin.");
    if (transferTotal > 0 && (!transferSeriesId || !targetWarehouseId))
      return toast.error("Transfer belge serisi ve hedef deposu zorunludur.");
    if (transferTotal > 0 && targetWarehouseId === detail.header.targetWarehouseId)
      return toast.error("Kaynak ve hedef depo aynı olamaz.");
    if (outboundTotal > 0 && (!outboundSeriesId || !customerId))
      return toast.error("Ambar çıkış belge serisi ve carisi zorunludur.");
    for (const draft of lines) {
      const source = detail.lines.find((line) => line.id === draft.lineId)!;
      if (draft.transferQuantity < 0 || draft.outboundQuantity < 0)
        return toast.error(`${source.stockCode} için miktarlar negatif olamaz.`);
      if (draft.transferQuantity + draft.outboundQuantity > source.routableQuantity)
        return toast.error(
          `${source.stockCode} için toplam en fazla ${formatProjectNumber(source.routableQuantity)} yönlendirilebilir.`,
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
        `${result.routes.map((route) => route.targetDocumentNo).join(" ve ")} oluşturuldu; toplam ${formatProjectNumber(result.routedQuantity)} yönlendirildi.`,
      );
      await onCompleted(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Yönlendirme oluşturulamadı.",
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

  return (
    <ResponsiveDialog
      onClose={onClose}
      title="Mal kabul sonrası dağıtım"
      description={`${detail.header.documentNo} · Kondisyonlar ayrı sekmelerde yönetilir`}
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
        Kalite/GKK:{" "}
        <strong>
          {goodsReceiptEnumLabel(t, "qualityStatus", detail.header.qualityStatus)}
        </strong>
        {" · "}
        Mal kabul onayı:{" "}
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
              <span className="wms-ops-gr-route-dialog__tab-kicker">Kondisyon 1</span>
              <span className="wms-ops-gr-route-dialog__tab-title">Depo Transferi</span>
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
              <span className="wms-ops-gr-route-dialog__tab-kicker">Kondisyon 2</span>
              <span className="wms-ops-gr-route-dialog__tab-title">Ambar Çıkış</span>
            </span>
            <span className="wms-ops-gr-route-dialog__tab-badge">
              {formatProjectNumber(outboundTotal)}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="wms-ops-gr-route-dialog__panel mt-0">
          <p className="wms-ops-gr-route-dialog__panel-hint">
            Depolar arası transfer için belge serisi, hedef depo ve raf seçin; kalem
            miktarlarını aşağıdaki listeden girin.
          </p>
          <div className="wms-ops-gr-route-dialog__fields">
            <RouteField label="Belge serisi">
              <AppDropdown
                value={transferSeriesId}
                onValueChange={setTransferSeriesId}
                placeholder="Seri seçin"
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
            <RouteField label="Hedef depo">
              <PagedAppDropdown<WarehouseOption>
                queryKey={["gr-route-target-warehouse", detail.header.branchCode]}
                fetchPage={(request) =>
                  goodsReceiptV2Api.warehouses(request, detail.header.branchCode)
                }
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
            <RouteField label="Hedef raf">
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
            Ambar çıkış için belge serisi ve çıkış carisini seçin; kalem miktarlarını
            aşağıdaki listeden girin.
          </p>
          <div className="wms-ops-gr-route-dialog__fields">
            <RouteField label="Belge serisi">
              <AppDropdown
                value={outboundSeriesId}
                onValueChange={setOutboundSeriesId}
                placeholder="Seri seçin"
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
            <RouteField label="Çıkış carisi">
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
          <strong>Kalem dağıtım listesi</strong>
          <span>
            {routableLines.length} kalem · aktif sekme:{" "}
            {activeTab === "transfer" ? "Transfer" : "Ambar çıkış"}
          </span>
        </header>
        <div className="wms-ops-gr-route-dialog__lines-scroll">
          <table className="wms-ops-gr-route-dialog__table">
            <thead>
              <tr>
                <th>Stok</th>
                <th className="text-right">Kabul</th>
                <th className="text-right">Önceki</th>
                <th className="text-right">Kalan</th>
                <th
                  className={cn(
                    activeTab === "transfer"
                      ? "wms-ops-gr-route-dialog__col--transfer"
                      : "wms-ops-gr-route-dialog__col--outbound",
                  )}
                >
                  {activeTab === "transfer" ? "Transfer" : "Ambar çıkış"}
                </th>
                <th>Kaynak raf</th>
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
                              aria-label="Miktarı artır"
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
                              aria-label="Miktarı azalt"
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
                        <PagedAppDropdown<LocationOption>
                          queryKey={[
                            "gr-route-source-location",
                            line.id,
                            line.targetWarehouseId,
                          ]}
                          fetchPage={(request) =>
                            goodsReceiptV2Api.locations(
                              request,
                              line.targetWarehouseId,
                            )
                          }
                          toOption={(item) => ({
                            value: String(item.id),
                            label: `${item.code} · ${item.name}`,
                          })}
                          selectedOption={
                            draft.sourceLocationValue
                              ? {
                                  value: draft.sourceLocationValue,
                                  label: `Raf #${draft.sourceLocationValue}`,
                                }
                              : undefined
                          }
                          value={draft.sourceLocationValue}
                          onValueChange={(value) =>
                            patchLine(line.id, {
                              sourceLocationValue: value,
                              sourceLocationId: Number(value),
                            })
                          }
                          portalContainer={null}
                          searchable
                          className={cn(
                            OPS_FIELD_CLASS,
                            "h-9",
                            !draft.sourceLocationValue && "wms-ops-field--placeholder",
                          )}
                        />
                      </OpsFieldShell>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <RouteField label="Operasyon notu" className="wms-ops-gr-route-dialog__note-field mt-4">
        <textarea
          className={cn(
            OPS_FIELD_CLASS,
            "wms-ops-gr-route-dialog__note min-h-[4.5rem] w-full resize-y",
            !description && "wms-ops-field--placeholder",
          )}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          placeholder="İsteğe bağlı not…"
        />
      </RouteField>

      <footer className="wms-ops-gr-route-dialog__footer">
        <div className="wms-ops-gr-route-dialog__totals">
          <span className="wms-ops-gr-route-dialog__total wms-ops-gr-route-dialog__total--transfer">
            Transfer: {formatProjectNumber(transferTotal)}
          </span>
          <span className="wms-ops-gr-route-dialog__total wms-ops-gr-route-dialog__total--outbound">
            Ambar çıkış: {formatProjectNumber(outboundTotal)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </OpsActionButton>
          <OpsActionButton
            type="button"
            variant="primary"
            disabled={!canSubmit}
            loading={saving}
            onClick={() => void submit()}
          >
            <ArrowRightLeft className="size-3.5" aria-hidden />
            Dağıtımı Oluştur
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
