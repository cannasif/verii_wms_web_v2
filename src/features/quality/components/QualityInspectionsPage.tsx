import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { requiredActionColumn } from "@/components/shared/GridSystemColumns";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { OpsStatusBadge, inferOpsStatusTone } from "@/components/shared/OpsStatusBadge";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import {
  qualityApi,
  type QualityInspection,
  type QualityInspectionDetail,
} from "../api/quality.api";

export function QualityInspectionsPage({
  quarantineOnly = false,
}: {
  quarantineOnly?: boolean;
}): ReactElement {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<QualityInspectionDetail | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const pageKey = quarantineOnly ? "quality-quarantine" : "quality-inspections";
  const fetchPage = useCallback(
    (request: GridRequest) =>
      qualityApi.inspectionsPaged(
        quarantineOnly
          ? {
              ...request,
              filters: [
                ...request.filters,
                { column: "status", operator: "equals", value: "Quarantined" },
              ],
            }
          : request,
      ),
    [quarantineOnly],
  );
  const toggle = useCallback(
    async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
        return;
      }
      setLoading(id);
      try {
        setDetail(await qualityApi.inspection(id));
        setExpandedId(id);
      } catch (error) {
        toast.error(message(error, "Kalite detayı alınamadı."));
      } finally {
        setLoading(null);
      }
    },
    [expandedId],
  );
  const columns = useMemo<GridColumn<QualityInspection>[]>(
    () => [
      {
        key: "inspectionNo",
        label: "Kontrol No",
        sortable: true,
        filterable: true,
        render: (r) => (
          <button
            type="button"
            onClick={() => void toggle(r.id)}
            className="inline-flex items-center gap-1.5 font-mono font-semibold text-cyan-600 hover:underline dark:text-cyan-300"
            aria-expanded={expandedId === r.id}
          >
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${
                expandedId === r.id ? "rotate-180" : ""
              }`}
            />
            {r.inspectionNo}
          </button>
        ),
      },
      {
        key: "sourceWaybillNo",
        label: "İrsaliye No",
        sortable: true,
        filterable: true,
        render: (r) => r.sourceWaybillNo || "—",
      },
      {
        key: "sourceDocumentNo",
        label: "Kaynak Belge",
        sortable: true,
        filterable: true,
        render: (r) => (
          <span className="font-mono text-xs">{r.sourceDocumentNo || "—"}</span>
        ),
      },
      {
        key: "sourceDocumentType",
        label: "Evrak Tipi",
        sortable: true,
        filterable: true,
        render: (r) =>
          localizeEnumValue(
            r.sourceDocumentType === "GR" ? "GoodsReceipt" : r.sourceDocumentType,
          ),
      },
      {
        key: "createdByName",
        label: "İşlemi Yapan",
        sortable: true,
        filterable: true,
        render: (r) => r.createdByName || `Kullanıcı #${r.createdBy ?? "—"}`,
      },
      {
        key: "lineCount",
        label: "Kalem",
        sortable: true,
        filterable: true,
        render: (r) => (
          <span className="font-mono text-xs">
            {r.lineCount} · {formatProjectNumber(r.totalQuantity)}
          </span>
        ),
      },
      {
        key: "status",
        label: "Durum",
        sortable: true,
        filterable: true,
        render: (r) => (
          <OpsStatusBadge tone={inferOpsStatusTone(r.status)}>
            {localizeEnumValue(r.status)}
          </OpsStatusBadge>
        ),
      },
      {
        key: "createdAtUtc",
        label: "Oluşturma",
        sortable: true,
        filterable: true,
        render: (r) => formatProjectDateTime(r.createdAtUtc),
      },
      {
        key: "decidedAtUtc",
        label: "Kalite Onay",
        sortable: true,
        filterable: true,
        render: (r) =>
          r.decidedAtUtc ? formatProjectDateTime(r.decidedAtUtc) : "—",
      },
      {
        key: "actions",
        label: "Detay",
        ...requiredActionColumn,
        render: (r) => (
          <button
            type="button"
            onClick={() => void toggle(r.id)}
            disabled={loading === r.id}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-cyan-500 hover:bg-cyan-500/10"
            aria-label="Kalite satır detayını aç"
            aria-expanded={expandedId === r.id}
          >
            {loading === r.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronDown
                className={`size-4 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
              />
            )}
            <span className="text-xs font-semibold">
              {expandedId === r.id ? "Gizle" : "Aç"}
            </span>
          </button>
        ),
      },
    ],
    [expandedId, loading, toggle],
  );
  const decided = async () => {
    setExpandedId(null);
    setDetail(null);
    await queryClient.invalidateQueries({
      queryKey: ["advanced-grid", pageKey],
    });
  };
  return (
    <AdvancedDataGrid<QualityInspection>
      pageKey={pageKey}
      title={
        quarantineOnly ? "Karantina Karar Kuyruğu" : "Kalite İnceleme Listesi"
      }
      description={
        quarantineOnly
          ? "Karantinadaki ürünleri yetkili biçimde serbest bırakın, reddedin veya iade edin."
          : "Özet satırda irsaliye ve işlemi yapan görünür; satırı açınca stok / lot / seri ve karar detayı accordion içinde gelir."
      }
      emptyMessage={
        quarantineOnly
          ? "Karantinada kayıt yok."
          : "Henüz kuyrukta kalite kaydı yok. Siparişli emir oluşturmak yetmez — Emir Yönetimi veya Bana Atanan Emirler’den fiziksel kabulü bitirince bu listeye düşer."
      }
      columns={columns}
      fetchPage={fetchPage}
      expandedRowId={expandedId}
      onRowDoubleClick={(row) => void toggle(row.id)}
      renderExpandedRow={(row) =>
        detail && detail.header.id === row.id ? (
          <InspectionDetailPanel
            detail={detail}
            close={() => {
              setExpandedId(null);
              setDetail(null);
            }}
            decided={() => void decided()}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Detay yükleniyor...
          </div>
        )
      }
    />
  );
}

function InspectionDetailPanel({
  detail,
  close,
  decided,
}: {
  detail: QualityInspectionDetail;
  close: () => void;
  decided: () => void;
}): ReactElement {
  const eligible = detail.lines.filter((x) =>
    ["Pending", "Hold", "Quarantined"].includes(x.decision),
  );
  const [selected, setSelected] = useState<number[]>(eligible.map((x) => x.id));
  const [decision, setDecision] = useState(
    detail.header.status === "Quarantined" ? "Accepted" : "",
  );
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState(detail.note ?? "");
  const [saving, setSaving] = useState(false);
  const final =
    ["Passed", "Failed", "Released", "Cancelled"].includes(
      detail.header.status,
    ) && eligible.length === 0;
  const options =
    detail.header.status === "Quarantined"
      ? [
          { value: "Accepted", label: "Serbest Bırak / Kabul" },
          { value: "Rejected", label: "Reddet" },
          { value: "Returned", label: "Tedarikçiye İade" },
        ]
      : [
          { value: "Accepted", label: "Kabul" },
          { value: "Quarantined", label: "Karantinaya Al" },
          { value: "Rejected", label: "Reddet" },
          { value: "Returned", label: "Tedarikçiye İade" },
        ];
  const toggle = (id: number) =>
    setSelected((value) =>
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );
  const save = async () => {
    if (!decision || selected.length === 0) {
      toast.error("Karar ve en az bir kalite satırı seçin.");
      return;
    }
    if (!detail.allowPartialDecision && selected.length !== eligible.length) {
      toast.error("Bu şubede kısmi kalite kararı kapalıdır.");
      return;
    }
    if (decision !== "Accepted" && !reasonCode.trim()) {
      toast.error("Ret, karantina ve iade kararlarında neden kodu zorunludur.");
      return;
    }
    setSaving(true);
    try {
      await qualityApi.decide(detail.header.id, {
        idempotencyKey: crypto.randomUUID(),
        decision,
        note: note.trim() || undefined,
        reasonCode: reasonCode.trim() || undefined,
        lineIds: selected,
        rowVersion: detail.rowVersion,
      });
      toast.success("Kalite kararı ve stok hareketi kaydedildi.");
      decided();
    } catch (error) {
      toast.error(message(error, "Kalite kararı kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4 rounded-2xl border-l-4 border-l-cyan-500 border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
            Accordion · satır detayı
          </p>
          <h3 className="text-lg font-bold">{detail.header.inspectionNo}</h3>
          <p className="text-sm text-slate-500">
            {detail.header.sourceDocumentNo} · {detail.header.warehouseCode}{" "}
            {detail.header.warehouseName}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-[var(--wms-app-border)] px-3 py-1.5 text-xs font-semibold"
        >
          Kapat
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Durum" value={localizeEnumValue(detail.header.status)} />
        <Info
          label="Evrak Tipi"
          value={localizeEnumValue(
            detail.header.sourceDocumentType === "GR"
              ? "GoodsReceipt"
              : detail.header.sourceDocumentType,
          )}
        />
        <Info
          label="İrsaliye"
          value={detail.header.sourceWaybillNo || "—"}
        />
        <Info
          label="İşlemi Yapan"
          value={
            detail.header.createdByName ||
            `Kullanıcı #${detail.header.createdBy ?? "—"}`
          }
        />
        <Info
          label="Oluşturma"
          value={formatProjectDateTime(detail.header.createdAtUtc)}
        />
        <Info
          label="Kaliteye Gönderilme"
          value={formatProjectDateTime(
            detail.header.queuedAtUtc ?? detail.header.createdAtUtc,
          )}
        />
        <Info
          label="Kalite Onay Tarihi"
          value={
            detail.header.decidedAtUtc
              ? formatProjectDateTime(detail.header.decidedAtUtc)
              : "—"
          }
        />
        <Info
          label="Toplam"
          value={formatProjectNumber(detail.header.totalQuantity)}
        />
      </div>
      {detail.requireManagerApprovalForRelease &&
        detail.header.status === "Quarantined" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
            Karantinadan serbest bırakma işlemi ayrı yönetici yetkisi
            gerektirir.
          </div>
        )}
      <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="p-3">Seç</th>
              <th className="p-3">Stok</th>
              <th className="p-3">Lot / Seri</th>
              <th className="p-3">SKT</th>
              <th className="p-3 text-right">Miktar</th>
              <th className="p-3 text-right">Numune</th>
              <th className="p-3">Karar</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr
                key={line.id}
                className="border-t border-[var(--wms-app-border)]"
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    disabled={!eligible.some((x) => x.id === line.id)}
                    checked={selected.includes(line.id)}
                    onChange={() => toggle(line.id)}
                  />
                </td>
                <td className="p-3">
                  <strong>{line.stockCode}</strong>
                  <div className="text-xs text-slate-500">{line.stockName}</div>
                </td>
                <td className="p-3 font-mono text-xs">
                  {line.lotNo || "—"} / {line.serialNo || "—"}
                </td>
                <td className="p-3">
                  {line.expiryDate ? formatProjectDate(line.expiryDate) : "—"}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatProjectNumber(line.quantity)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatProjectNumber(line.sampleQuantity)}
                </td>
                <td className="p-3">{localizeEnumValue(line.decision)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!final && (
        <section className="grid gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-semibold">Karar</span>
            <AppDropdown
              value={decision || null}
              onValueChange={setDecision}
              options={options}
              placeholder="Karar seçin"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-semibold">Neden kodu</span>
            <input
              className="input"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder="Ret / karantina / iade için"
            />
          </label>
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-semibold">Not</span>
            <textarea
              className="input min-h-20"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between gap-3 md:col-span-2">
            <span className="text-xs text-slate-500">
              {selected.length}/{eligible.length} bekleyen satır seçili{" "}
              {detail.allowPartialDecision
                ? "· Kısmi karar açık"
                : "· Tüm satırlar zorunlu"}
            </span>
            <button
              type="button"
              disabled={saving || !decision || selected.length === 0}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Kararı Uygula
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}
function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
export const QualityQuarantinePage = (): ReactElement => (
  <QualityInspectionsPage quarantineOnly />
);
