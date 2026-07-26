import { useCallback, useMemo, useState, type ReactElement } from "react";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Printer,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  requiredActionColumn,
  systemColumns,
} from "@/components/shared/GridSystemColumns";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { warehouseInboundV2Api } from "../api/warehouse-inbound.api";
import type {
  WarehouseInboundDetail,
  WarehouseInboundGridRow,
  WarehouseInboundLifecycleResult,
} from "../types/warehouse-inbound.types";
import {
  previewReceiptLabelsPdf,
  printableLabels,
  printReceiptLabels,
} from "../utils/warehouse-inbound-label-output";
import {
  WarehouseInboundLifecycleDialog,
  type WarehouseInboundLifecycleAction,
} from "./WarehouseInboundLifecycleDialog";

type OutputMode = "print" | "pdf";
export function WarehouseInboundListPage(): ReactElement {
  const [detail, setDetail] = useState<WarehouseInboundDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [outputBusy, setOutputBusy] = useState("");
  const [gridVersion, setGridVersion] = useState(0);
  const openDetail = useCallback(async (id: number) => {
    setLoadingId(id);
    try {
      setDetail(await warehouseInboundV2Api.detail(id));
    } catch (error) {
      toast.error(message(error, "Mal kabul detayı açılamadı."));
    } finally {
      setLoadingId(null);
    }
  }, []);
  const output = useCallback(
    async (
      receiptId: number,
      lineId: number | undefined,
      mode: OutputMode,
      title: string,
    ) => {
      const key = `${receiptId}:${lineId ?? "all"}:${mode}`;
      setOutputBusy(key);
      try {
        const labels = printableLabels(
          await warehouseInboundV2Api.receiptLabels(receiptId, lineId),
        );
        if (!labels.length)
          throw new Error(
            lineId
              ? "Bu kalem için oluşturulmuş, kullanılabilir etiket bulunamadı."
              : "Bu mal kabul için oluşturulmuş, kullanılabilir etiket bulunamadı.",
          );
        if (mode === "pdf") {
          await previewReceiptLabelsPdf(labels, `${title}.pdf`);
          toast.success(`${labels.length} etiket PDF önizlemesine hazırlandı.`);
          return;
        }
        printReceiptLabels(labels, title);
        await warehouseInboundV2Api.markLabelsPrinted(labels.map((x) => x.id));
        toast.success(
          `${labels.length} etiket yazdırma penceresine gönderildi.`,
        );
      } catch (error) {
        toast.error(message(error, "Etiket çıktısı oluşturulamadı."));
      } finally {
        setOutputBusy("");
      }
    },
    [],
  );
  const columns = useMemo<GridColumn<WarehouseInboundGridRow>[]>(
    () => [
      ...systemColumns<WarehouseInboundGridRow>(),
      {
        key: "documentNo",
        label: "Belge No",
        sortable: true,
        filterable: true,
        render: (r) => (
          <span className="font-mono font-semibold">{r.documentNo}</span>
        ),
      },
      {
        key: "documentDate",
        label: "Belge Tarihi",
        sortable: true,
        filterable: true,
        render: (r) => formatProjectDate(r.documentDate),
      },
      {
        key: "supplierCode",
        label: "Cari",
        sortable: true,
        filterable: true,
        render: (r) => (
          <>
            <strong>{r.supplierCode || "—"}</strong>
            <div className="text-xs text-slate-500">{r.supplierName}</div>
          </>
        ),
      },
      {
        key: "warehouseCode",
        label: "Depo",
        sortable: true,
        filterable: true,
        render: (r) => `${r.warehouseCode} · ${r.warehouseName}`,
      },
      {
        key: "processType",
        label: "İşlem Tipi",
        sortable: true,
        filterable: true,
        render: (r) => processTypeLabel(r.processType),
      },
      {
        key: "status",
        label: "Durum",
        sortable: true,
        filterable: true,
        render: (r) => r.status,
      },
      {
        key: "qualityStatus",
        label: "Kalite",
        sortable: true,
        filterable: true,
        render: (r) => r.qualityStatus,
      },
      {
        key: "waybillNo",
        label: "İrsaliye",
        sortable: true,
        filterable: true,
        render: (r) => r.waybillNo || "—",
      },
      {
        key: "lineCount",
        label: "Satır",
        sortable: true,
        filterable: true,
        render: (r) => r.lineCount,
      },
      {
        key: "expectedQuantity",
        label: "Beklenen",
        sortable: true,
        filterable: true,
        render: (r) => formatProjectNumber(r.expectedQuantity),
      },
      {
        key: "receivedQuantity",
        label: "Alınan",
        sortable: true,
        filterable: true,
        render: (r) => formatProjectNumber(r.receivedQuantity),
      },
      {
        key: "actions",
        label: "İşlemler",
        ...requiredActionColumn,
        render: (r) => (
          <div className="flex items-center gap-1">
            <ActionButton
              title="Detayı göster"
              busy={loadingId === r.id}
              onClick={() => void openDetail(r.id)}
              icon={<Eye className="size-4" />}
            />
            <ActionButton
              title="Tüm etiketleri yazdır"
              busy={outputBusy === `${r.id}:all:print`}
              onClick={() =>
                void output(r.id, undefined, "print", r.documentNo)
              }
              icon={<Printer className="size-4" />}
            />
            <ActionButton
              title="Tüm etiketleri PDF göster"
              busy={outputBusy === `${r.id}:all:pdf`}
              onClick={() => void output(r.id, undefined, "pdf", r.documentNo)}
              icon={<FileText className="size-4" />}
            />
          </div>
        ),
      },
    ],
    [loadingId, openDetail, output, outputBusy],
  );
  const lifecycleCompleted = useCallback(
    async (result: WarehouseInboundLifecycleResult | null) => {
      toast.success(
        result?.replayed
          ? "İşlemin önceki sonucu güvenle döndürüldü."
          : "Mal kabul işlemi başarıyla tamamlandı.",
      );
      const id = result?.id ?? detail?.header.id;
      if (id) setDetail(await warehouseInboundV2Api.detail(id));
      setGridVersion((value) => value + 1);
    },
    [detail?.header.id],
  );
  return (
    <>
      <AdvancedDataGrid<WarehouseInboundGridRow>
        key={gridVersion}
        pageKey="warehouse-inbounds"
        title="Mal Kabul Kayıtları"
        description="Mal kabulü görüntüleyin; belge veya kalem bazında etiket yazdırın ve PDF önizleyin."
        columns={columns}
        fetchPage={warehouseInboundV2Api.paged}
      />
      {detail && (
        <DetailModal
          detail={detail}
          close={() => setDetail(null)}
          output={output}
          busyKey={outputBusy}
          onLifecycleCompleted={lifecycleCompleted}
        />
      )}
    </>
  );
}

function DetailModal({
  detail,
  close,
  output,
  busyKey,
  onLifecycleCompleted,
}: {
  detail: WarehouseInboundDetail;
  close: () => void;
  output: (
    receiptId: number,
    lineId: number | undefined,
    mode: OutputMode,
    title: string,
  ) => Promise<void>;
  busyKey: string;
  onLifecycleCompleted: (
    result: WarehouseInboundLifecycleResult | null,
  ) => Promise<void>;
}): ReactElement {
  const [action, setAction] = useState<WarehouseInboundLifecycleAction | null>(
    null,
  );
  const shortCloseAvailable = detail.lines.some(
    (line) =>
      line.expectedQuantity - line.receivedQuantity - line.shortClosedQuantity >
      0,
  );
  const cancelled = detail.header.status === "Cancelled";
  return (
    <ResponsiveDialog
      onClose={close}
      title={`Ambar giriş ${detail.header.documentNo}`}
      description="Ambar giriş bilgileri, kalemleri ve yaşam döngüsü işlemleri."
      className="!max-w-6xl"
    >
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h2 className="text-xl font-bold">{detail.header.documentNo}</h2>
          <p className="text-sm text-slate-500">
            {detail.header.supplierCode} · {detail.header.supplierName} ·{" "}
            {detail.header.warehouseCode} {detail.header.warehouseName}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <button
            onClick={() =>
              void output(
                detail.header.id,
                undefined,
                "print",
                detail.header.documentNo,
              )
            }
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold sm:flex-none"
          >
            <Printer className="size-4" />
            Etiketleri Bas
          </button>
          <button
            onClick={() =>
              void output(
                detail.header.id,
                undefined,
                "pdf",
                detail.header.documentNo,
              )
            }
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold sm:flex-none"
          >
            <FileText className="size-4" />
            PDF Göster
          </button>
          <button
            onClick={close}
            aria-label="Pencereyi kapat"
            className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>
      <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-[var(--wms-app-border)] p-3">
        {detail.header.approvalStatus === "Pending" && !cancelled && (
          <LifecycleButton
            label="Onayla"
            icon={<CheckCircle2 className="size-4" />}
            onClick={() => setAction("approve")}
          />
        )}
        {shortCloseAvailable && !cancelled && (
          <LifecycleButton
            label="Kısa Kapat"
            icon={<PackageCheck className="size-4" />}
            onClick={() => setAction("shortClose")}
          />
        )}
        {detail.putawayCandidates.length > 0 && !cancelled && (
          <LifecycleButton
            label={`Rafa Yerleştir (${detail.putawayCandidates.length})`}
            icon={<Warehouse className="size-4" />}
            onClick={() => setAction("putaway")}
          />
        )}
        {!cancelled && (
          <LifecycleButton
            label="İptal Et"
            danger
            icon={<Ban className="size-4" />}
            onClick={() => setAction("cancel")}
          />
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Info
          label="İşlem tipi"
          value={localizeEnumValue(detail.header.processType)}
        />
        <Info label="Durum" value={localizeEnumValue(detail.header.status)} />
        <Info
          label="Kalite"
          value={localizeEnumValue(detail.header.qualityStatus)}
        />
        <Info
          label="Raflama"
          value={localizeEnumValue(detail.header.putawayStatus)}
        />
        <Info label="Görev" value={detail.taskNumbers.join(", ") || "—"} />
        <Info label="Fiziksel kabul" value={String(detail.executionCount)} />
        <Info label="İrsaliye" value={detail.header.waybillNo || "—"} />
        <Info
          label="Belge tarihi"
          value={formatProjectDate(detail.header.documentDate)}
        />
        <Info
          label="Alınma zamanı"
          value={
            detail.header.receivedAtUtc
              ? formatProjectDateTime(detail.header.receivedAtUtc)
              : "—"
          }
        />
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Stok</th>
              <th className="p-3">YAP</th>
              <th className="p-3 text-right">Beklenen</th>
              <th className="p-3 text-right">Alınan</th>
              <th className="p-3">Durum</th>
              <th className="p-3 text-center">Etiket</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr
                key={line.id}
                className="border-t border-[var(--wms-app-border)]"
              >
                <td className="p-3">{line.lineNo}</td>
                <td className="p-3">
                  <strong>{line.stockCode}</strong>
                  <div className="text-xs text-slate-500">{line.stockName}</div>
                </td>
                <td className="p-3">{line.yapCode || "—"}</td>
                <td className="p-3 text-right">
                  {formatProjectNumber(line.expectedQuantity)}
                </td>
                <td className="p-3 text-right">
                  {formatProjectNumber(line.receivedQuantity)}
                </td>
                <td className="p-3">{localizeEnumValue(line.status)}</td>
                <td className="p-3">
                  <div className="flex justify-center gap-1">
                    <ActionButton
                      title="Kalem etiketini yazdır"
                      busy={busyKey === `${detail.header.id}:${line.id}:print`}
                      onClick={() =>
                        void output(
                          detail.header.id,
                          line.id,
                          "print",
                          `${detail.header.documentNo}-${line.lineNo}`,
                        )
                      }
                      icon={<Printer className="size-4" />}
                    />
                    <ActionButton
                      title="Kalem etiketini PDF göster"
                      busy={busyKey === `${detail.header.id}:${line.id}:pdf`}
                      onClick={() =>
                        void output(
                          detail.header.id,
                          line.id,
                          "pdf",
                          `${detail.header.documentNo}-${line.lineNo}`,
                        )
                      }
                      icon={<FileText className="size-4" />}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {action && (
        <WarehouseInboundLifecycleDialog
          action={action}
          detail={detail}
          onClose={() => setAction(null)}
          onCompleted={async (result) => {
            setAction(null);
            await onLifecycleCompleted(result);
          }}
        />
      )}
    </ResponsiveDialog>
  );
}
function LifecycleButton({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-500/10"
          : "inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-3 py-2 text-sm font-semibold text-cyan-500 hover:bg-cyan-500/10"
      }
    >
      {icon}
      {label}
    </button>
  );
}
function ActionButton({
  title,
  busy,
  onClick,
  icon,
}: {
  title: string;
  busy: boolean;
  onClick: () => void;
  icon: ReactElement;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={busy}
      onClick={onClick}
      className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-40"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
    </button>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}
function processTypeLabel(value: string) {
  return localizeEnumValue(value);
}
function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
