import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { code128 } from "bwip-js/browser";
import { Ban, Eye, Loader2, Printer, Scissors, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { AppInput } from "@/components/shared/AppInput";
import {
  requiredActionColumn,
  systemColumns,
} from "@/components/shared/GridSystemColumns";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import {
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import { goodsReceiptEnumLabel } from "../localization/enum-labels";
import type {
  GoodsReceiptLabelBatchDetail,
  GoodsReceiptLabelBatchRow,
  GoodsReceiptLabelRow,
} from "../types/goods-receipt.types";
import { resolveGoodsReceiptWaybillNo } from "../utils/goods-receipt-waybill";

const G = "dataGrid.goodsReceiptPreLabels";

function isPrintableLabel(label: GoodsReceiptLabelRow): boolean {
  return !["Void", "Split"].includes(label.status)
    && (label.status !== "Consumed" || label.parentLabelId != null);
}

export function GoodsReceiptLabelsPage(): ReactElement {
  const { t: tGrid } = useTranslation("common");
  const { t } = useModuleTranslation("goods-receipt-v2");
  const cache = useQueryClient();
  const [detail, setDetail] = useState<GoodsReceiptLabelBatchDetail | null>(
    null,
  );
  const [busy, setBusy] = useState<number | null>(null);
  const open = useCallback(async (id: number) => {
    setBusy(id);
    try {
      setDetail(await goodsReceiptV2Api.labelBatch(id));
    } catch (error) {
      toast.error(message(error, "Etiket paketi açılamadı."));
    } finally {
      setBusy(null);
    }
  }, []);
  const columns = useMemo<GridColumn<GoodsReceiptLabelBatchRow>[]>(
    () => [
      ...systemColumns<GoodsReceiptLabelBatchRow>(),
      {
        key: "batchNo",
        label: tGrid(`${G}.batchNo`),
        sortable: true,
        filterable: true,
        render: (r) => (
          <span className="font-mono font-semibold">{r.batchNo}</span>
        ),
      },
      {
        key: "waybillNo",
        label: t("list.waybillReference"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => resolveGoodsReceiptWaybillNo(r) || "—",
      },
      {
        key: "taskNo",
        label: tGrid(`${G}.taskNo`),
        sortable: true,
        filterable: true,
        render: (r) => r.taskNo || "—",
      },
      {
        key: "status",
        label: tGrid(`${G}.status`),
        sortable: true,
        filterable: true,
        render: (r) => goodsReceiptEnumLabel(t, "labelBatchStatus", r.status),
      },
      {
        key: "totalLabelCount",
        label: tGrid(`${G}.total`),
        sortable: true,
        filterable: true,
        render: (r) => r.totalLabelCount,
      },
      {
        key: "printedLabelCount",
        label: tGrid(`${G}.printed`),
        sortable: true,
        filterable: true,
        render: (r) => r.printedLabelCount,
      },
      {
        key: "consumedLabelCount",
        label: tGrid(`${G}.consumed`),
        sortable: true,
        filterable: true,
        render: (r) => r.consumedLabelCount,
      },
      {
        key: "lastPrintedAtUtc",
        label: tGrid(`${G}.lastPrint`),
        sortable: true,
        filterable: true,
        render: (r) =>
          r.lastPrintedAtUtc ? formatProjectDateTime(r.lastPrintedAtUtc) : "—",
      },
      {
        key: "actions",
        label: tGrid(`${G}.actions`),
        ...requiredActionColumn,
        render: (r) => (
          <button
            type="button"
            onClick={() => void open(r.id)}
            className="rounded-lg p-2 text-cyan-500"
            aria-label={tGrid(`${G}.openBatch`)}
          >
            {busy === r.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ),
      },
    ],
    [busy, open, t, tGrid],
  );
  const reload = async () => {
    if (detail) setDetail(await goodsReceiptV2Api.labelBatch(detail.batch.id));
    await cache.invalidateQueries({
      queryKey: ["advanced-grid", "goods-receipt-labels"],
    });
  };
  return (
    <div data-no-auto-localize="true">
      <AdvancedDataGrid
        pageKey="goods-receipt-labels"
        title={tGrid(`${G}.title`)}
        description={tGrid(`${G}.description`)}
        columns={columns}
        fetchPage={goodsReceiptV2Api.labelBatchesPaged}
      />
      {detail && (
        <LabelDialog
          detail={detail}
          close={() => setDetail(null)}
          reload={() => void reload()}
        />
      )}
    </div>
  );
}

function LabelDialog({
  detail,
  close,
  reload,
}: {
  detail: GoodsReceiptLabelBatchDetail;
  close: () => void;
  reload: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [selected, setSelected] = useState<number[]>(
    detail.labels
      .filter(isPrintableLabel)
      .map((x) => x.id),
  );
  const [splitTarget, setSplitTarget] = useState<GoodsReceiptLabelRow | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelected(detail.labels
      .filter(isPrintableLabel)
      .map((x) => x.id));
  }, [detail.labels]);
  const printable = detail.labels.filter(
    (x) => selected.includes(x.id) && isPrintableLabel(x),
  );
  const print = async () => {
    if (printable.length === 0) {
      toast.error("Yazdırılabilir etiket seçin.");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Yazdırma penceresine tarayıcı izin vermedi.");
      return;
    }
    setBusy(true);
    try {
      const cards = printable.map((label) => labelHtml(label)).join("");
      win.document.write(
        `<html><head><title>${escapeHtml(detail.batch.batchNo)}</title><style>@page{size:100mm 70mm;margin:0}*{box-sizing:border-box}body{margin:0;font:12px Arial;color:#111}.label{width:100mm;height:70mm;padding:5mm;page-break-after:always;border:1px solid #ddd}.title{font-size:16px;font-weight:700}.row{display:flex;justify-content:space-between;margin-top:2mm}.barcode{width:90mm;height:24mm;object-fit:contain;margin-top:3mm}.code{font:11px monospace;text-align:center;word-break:break-all}</style></head><body>${cards}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`,
      );
      win.document.close();
      await goodsReceiptV2Api.markLabelsPrinted(printable.map((x) => x.id));
      toast.success(`${printable.length} etiket yazdırma kuyruğuna alındı.`);
      reload();
    } catch (error) {
      win.close();
      toast.error(message(error, "Etiketler yazdırılamadı."));
    } finally {
      setBusy(false);
    }
  };
  const voidLabel = async (label: GoodsReceiptLabelRow) => {
    const reason = window.prompt("Etiket iptal nedenini yazın:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await goodsReceiptV2Api.voidLabel(
        label.id,
        reason.trim(),
        label.rowVersion,
      );
      toast.success("Etiket iptal edildi.");
      reload();
    } catch (error) {
      toast.error(message(error, "Etiket iptal edilemedi."));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: number) =>
    setSelected((value) =>
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );
  return (
    <ResponsiveDialog
      onClose={close}
      title={`Ön etiket paketi ${detail.batch.batchNo}`}
      description="Üretilen etiketleri seçin, yazdırın veya iptal edin."
      className="!max-w-6xl"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
            Ön Etiket Paketi
          </p>
          <h2 className="text-xl font-bold">{detail.batch.batchNo}</h2>
          <p className="text-sm text-slate-500">
            {resolveGoodsReceiptWaybillNo(detail.batch) || t("list.noWaybillShort")} · {detail.batch.taskNo}
          </p>
        </div>
        <button
          onClick={close}
          aria-label="Pencereyi kapat"
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--wms-app-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <strong>{selected.length}</strong> etiket seçili · Yazdırılan{" "}
          {detail.batch.printedLabelCount}/{detail.batch.totalLabelCount} ·
          Kullanılan {detail.batch.consumedLabelCount}
        </p>
        <button
          type="button"
          disabled={busy || printable.length === 0}
          onClick={() => void print()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          Seçilenleri Yazdır
        </button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr>
              <th className="p-3"></th>
              <th className="p-3 text-left">Stok</th>
              <th className="p-3 text-left">Seri / Lot</th>
              <th className="p-3 text-right">Miktar</th>
              <th className="p-3 text-left">Barkod</th>
              <th className="p-3">Durum</th>
              <th className="p-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {detail.labels.map((label) => (
              <tr
                key={label.id}
                className="border-t border-[var(--wms-app-border)]"
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    disabled={!isPrintableLabel(label)}
                    checked={selected.includes(label.id)}
                    onChange={() => toggle(label.id)}
                  />
                </td>
                <td className="p-3">
                  <strong>{label.stockCode}</strong>
                  <div className="text-xs text-slate-500">
                    {label.stockName} {label.yapCode && `· ${label.yapCode}`}
                  </div>
                </td>
                <td className="p-3">
                  {label.serialNo || "—"} / {label.lotNo || "—"}
                </td>
                <td className="p-3 text-right">
                  {formatProjectNumber(label.quantity)} {label.unitCode}
                </td>
                <td className="max-w-72 break-all p-3 font-mono text-xs">
                  {label.barcodeValue}
                </td>
                  <td className="p-3 text-center">
                    {goodsReceiptEnumLabel(t, 'labelStatus', label.status)}
                  </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={busy || !label.canSplit}
                      onClick={() => setSplitTarget(label)}
                      className="grid size-11 place-items-center rounded-lg text-cyan-600 disabled:cursor-not-allowed disabled:opacity-35"
                      title={label.canSplit ? t("labelSplit.action") : label.splitBlockReason}
                    >
                      <Scissors className="size-4" />
                    </button>
                  <button
                    type="button"
                    disabled={
                      busy || ["Consumed", "Void", "Split"].includes(label.status)
                    }
                    onClick={() => void voidLabel(label)}
                    className="grid size-11 place-items-center rounded-lg text-red-500"
                    title="Etiketi iptal et"
                  >
                    <Ban className="size-4" />
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {splitTarget && (
        <SplitLabelDialog
          label={splitTarget}
          close={() => setSplitTarget(null)}
          completed={() => {
            setSplitTarget(null);
            reload();
          }}
        />
      )}
    </ResponsiveDialog>
  );
}

function SplitLabelDialog({
  label,
  close,
  completed,
}: {
  label: GoodsReceiptLabelRow;
  close: () => void;
  completed: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [quantityText, setQuantityText] = useState(String(label.quantity / 2));
  const [reason, setReason] = useState(String(t("labelSplit.defaultReason")));
  const [busy, setBusy] = useState(false);
  const splitQuantity = parseQuantity(quantityText);
  const remaining = splitQuantity == null ? null : label.quantity - splitQuantity;
  const quantityValid = splitQuantity != null && splitQuantity > 0 && remaining != null && remaining > 0;
  const valid = quantityValid && reason.trim().length >= 3;

  const submit = async () => {
    if (!valid || splitQuantity == null) {
      toast.error(String(t("labelSplit.invalid")));
      return;
    }
    setBusy(true);
    try {
      await goodsReceiptV2Api.splitLabel(label.id, {
        idempotencyKey: crypto.randomUUID(),
        splitQuantity,
        reason: reason.trim(),
        rowVersion: label.rowVersion,
      });
      toast.success(String(t("labelSplit.success")));
      completed();
    } catch (error) {
      toast.error(message(error, String(t("labelSplit.failed"))));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      onClose={close}
      title={String(t("labelSplit.title"))}
      description={String(t("labelSplit.description"))}
      className="!max-w-2xl"
    >
      <div className="space-y-5 p-5">
        <section className="grid gap-3 rounded-2xl border border-[var(--wms-app-border)] p-4 sm:grid-cols-2">
          <Info label={String(t("labelSplit.stock"))} value={`${label.stockCode} · ${label.stockName ?? "—"}`} />
          <Info label={String(t("labelSplit.tracking"))} value={`${label.serialNo || "—"} / ${label.lotNo || "—"}`} />
          <Info label={String(t("labelSplit.sourceQuantity"))} value={`${formatProjectNumber(label.quantity)} ${label.unitCode}`} />
          <Info label={String(t("labelSplit.sourceBarcode"))} value={label.barcodeValue} />
        </section>

        <label className="block space-y-2">
          <span className="text-sm font-bold">{t("labelSplit.splitQuantity")}</span>
          <AppInput
            inputMode="decimal"
            value={quantityText}
            onChange={(event) => setQuantityText(event.target.value)}
            invalid={quantityText.length > 0 && !quantityValid}
            disabled={busy}
          />
          <span className="block text-xs text-slate-500">{t("labelSplit.quantityHelp")}</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <SplitPreview title={String(t("labelSplit.firstChild"))} quantity={splitQuantity} unitCode={label.unitCode} />
          <SplitPreview title={String(t("labelSplit.remainderChild"))} quantity={remaining} unitCode={label.unitCode} />
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-bold">{t("labelSplit.reason")}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            disabled={busy}
            className="input min-h-24 w-full resize-y"
          />
        </label>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          {t("labelSplit.stockNote")}
        </div>

        <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-xl border px-5 font-semibold">
            {t("labelSplit.cancel")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy || !valid} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />}
            {t("labelSplit.confirm")}
          </button>
        </footer>
      </div>
    </ResponsiveDialog>
  );
}

function SplitPreview({ title, quantity, unitCode }: { title:string; quantity:number|null; unitCode:string }): ReactElement {
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-600">{title}</div>
      <div className="mt-2 text-xl font-black">{quantity != null && quantity > 0 ? formatProjectNumber(quantity) : "—"} {unitCode}</div>
    </div>
  );
}

function Info({ label, value }: { label:string; value:string }): ReactElement {
  return <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="break-all font-semibold">{value}</div></div>;
}

function parseQuantity(value: string): number | null {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function labelHtml(label: GoodsReceiptLabelRow): string {
  const canvas = document.createElement("canvas");
  code128(canvas, {
    bcid: "code128",
    text: label.barcodeValue,
    scale: 3,
    height: 14,
    includetext: false,
  });
  return `<section class="label"><div class="title">${escapeHtml(label.stockCode)} · ${escapeHtml(label.stockName || "")}</div><div class="row"><span>Yapı: ${escapeHtml(label.yapCode || "—")}</span><strong>${escapeHtml(String(label.quantity))} ${escapeHtml(label.unitCode)}</strong></div><div class="row"><span>Lot: ${escapeHtml(label.lotNo || "—")}</span><span>Seri: ${escapeHtml(label.serialNo || "—")}</span></div><img class="barcode" src="${canvas.toDataURL("image/png")}"/><div class="code">${escapeHtml(label.barcodeValue)}</div></section>`;
}
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        x
      ]!,
  );
}
function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
