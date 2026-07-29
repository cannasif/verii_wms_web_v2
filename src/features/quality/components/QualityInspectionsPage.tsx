import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ClipboardPen, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { requiredActionColumn } from "@/components/shared/GridSystemColumns";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppInput } from "@/components/shared/AppInput";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import {
  OpsStatusBadge,
  inferDocumentTypeTone,
  inferOpsStatusTone,
} from "@/components/shared/OpsStatusBadge";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { cn } from "@/lib/utils";
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
  type QualityInspectionLine,
} from "../api/quality.api";

const ACTIONABLE_DECISIONS = new Set(["Pending", "Hold", "Quarantined"]);

type LineDraft = {
  decision: string;
  reasonCode: string;
  reasonNote: string;
};

function isActionableLine(line: QualityInspectionLine): boolean {
  return ACTIONABLE_DECISIONS.has(line.decision);
}

function emptyDraft(defaultDecision = ""): LineDraft {
  return { decision: defaultDecision, reasonCode: "", reasonNote: "" };
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

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
        render: (r) => {
          const typeKey =
            r.sourceDocumentType === "GR" ? "GoodsReceipt" : r.sourceDocumentType;
          return (
            <div className="flex justify-center">
              <OpsStatusBadge tone={inferDocumentTypeTone(typeKey)}>
                {localizeEnumValue(typeKey)}
              </OpsStatusBadge>
            </div>
          );
        },
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
          <div className="flex justify-center">
            <OpsStatusBadge tone={inferOpsStatusTone(r.status)}>
              {localizeEnumValue(r.status)}
            </OpsStatusBadge>
          </div>
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
  const actionable = useMemo(
    () => detail.lines.filter(isActionableLine),
    [detail.lines],
  );
  const passive = useMemo(
    () => detail.lines.filter((line) => !isActionableLine(line)),
    [detail.lines],
  );
  const orderedLines = useMemo(
    () => [...actionable, ...passive],
    [actionable, passive],
  );

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

  const defaultDecision = "Accepted";

  const [selected, setSelected] = useState<number[]>(() =>
    actionable.map((line) => line.id),
  );
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      actionable.map((line) => [line.id, emptyDraft(defaultDecision)]),
    ),
  );
  const [bulkDecision, setBulkDecision] = useState(defaultDecision);
  const [bulkReasonCode, setBulkReasonCode] = useState("");
  const [bulkReasonNote, setBulkReasonNote] = useState("");
  const [headerNote, setHeaderNote] = useState(detail.note ?? "");
  const [saving, setSaving] = useState(false);
  const [openLineId, setOpenLineId] = useState<number | null>(null);

  const final =
    ["Passed", "Failed", "Released", "Cancelled"].includes(
      detail.header.status,
    ) && actionable.length === 0;

  const decidedCount = actionable.filter((line) =>
    Boolean(drafts[line.id]?.decision),
  ).length;
  const allSelected =
    actionable.length > 0 && selected.length === actionable.length;
  const someSelected = selected.length > 0 && !allSelected;

  const toggle = (id: number) =>
    setSelected((value) =>
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );

  const selectAll = () => setSelected(actionable.map((line) => line.id));
  const clearSelection = () => setSelected([]);

  const patchDraft = (id: number, patch: Partial<LineDraft>) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyDraft(defaultDecision)), ...patch },
    }));

  const applyBulkToSelected = () => {
    if (!bulkDecision) {
      toast.error("Toplu karar seçin.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Önce en az bir kontrole tabi satır seçin.");
      return;
    }
    if (bulkDecision !== "Accepted" && !bulkReasonCode.trim()) {
      toast.error("Ret, karantina ve iade için karar kodu zorunludur.");
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      for (const id of selected) {
        next[id] = {
          decision: bulkDecision,
          reasonCode: bulkDecision === "Accepted" ? "" : bulkReasonCode.trim(),
          reasonNote: bulkReasonNote.trim(),
        };
      }
      return next;
    });
    toast.success(
      `${selected.length} satıra “${options.find((o) => o.value === bulkDecision)?.label ?? bulkDecision}” uygulandı.`,
    );
  };

  const save = async () => {
    const pending = actionable
      .map((line) => {
        const draft = drafts[line.id] ?? emptyDraft();
        return { id: line.id, ...draft };
      })
      .filter((row) => row.decision);

    if (pending.length === 0) {
      toast.error("En az bir satır için karar seçin.");
      return;
    }
    if (!detail.allowPartialDecision && pending.length !== actionable.length) {
      toast.error(
        "Bu şubede kısmi kalite kararı kapalıdır. Tüm kontrole tabi satırlara karar verin.",
      );
      return;
    }
    for (const row of pending) {
      if (row.decision !== "Accepted" && !row.reasonCode.trim()) {
        toast.error(
          "Ret, karantina ve iade kararlarında her satır için karar kodu zorunludur.",
        );
        return;
      }
    }

    const groups = new Map<
      string,
      { decision: string; reasonCode: string; lineIds: number[] }
    >();
    for (const row of pending) {
      const key = `${row.decision}::${row.reasonCode.trim()}`;
      const existing = groups.get(key);
      if (existing) existing.lineIds.push(row.id);
      else {
        groups.set(key, {
          decision: row.decision,
          reasonCode: row.reasonCode.trim(),
          lineIds: [row.id],
        });
      }
    }

    setSaving(true);
    try {
      let rowVersion = detail.rowVersion;
      const entries = [...groups.values()];
      for (const group of entries) {
        const notes = pending
          .filter(
            (row) => group.lineIds.includes(row.id) && row.reasonNote.trim(),
          )
          .map((row) => row.reasonNote.trim());
        const combinedNote = [headerNote.trim(), ...notes]
          .filter(Boolean)
          .join(" · ");
        await qualityApi.decide(detail.header.id, {
          idempotencyKey: crypto.randomUUID(),
          decision: group.decision,
          note: combinedNote || undefined,
          reasonCode:
            group.decision === "Accepted"
              ? undefined
              : group.reasonCode || undefined,
          lineIds: group.lineIds,
          rowVersion,
        });
        if (entries.length > 1) {
          const fresh = await qualityApi.inspection(detail.header.id);
          rowVersion = fresh.rowVersion;
        }
      }
      toast.success("Kalite kararı ve stok hareketi kaydedildi.");
      decided();
    } catch (error) {
      toast.error(message(error, "Kalite kararı kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const docTypeKey =
    detail.header.sourceDocumentType === "GR"
      ? "GoodsReceipt"
      : detail.header.sourceDocumentType;

  return (
    <div className="wms-ops-quality-detail space-y-3 rounded-2xl bg-[var(--wms-app-panel)] p-3.5">
      <div className="wms-ops-quality-detail__head">
        <div className="wms-ops-quality-detail__identity min-w-0">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-brand-primary)]">
            Kalite satır detayı
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">
              {detail.header.inspectionNo}
            </h3>
            <OpsStatusBadge
              tone={inferOpsStatusTone(detail.header.status)}
              className="wms-ops-quality-detail__badge"
            >
              {localizeEnumValue(detail.header.status)}
            </OpsStatusBadge>
            <OpsStatusBadge
              tone={inferDocumentTypeTone(docTypeKey)}
              className="wms-ops-quality-detail__badge"
            >
              {localizeEnumValue(docTypeKey)}
            </OpsStatusBadge>
          </div>
          <p className="text-xs text-slate-500">
            {detail.header.sourceDocumentNo} · {detail.header.warehouseCode}{" "}
            {detail.header.warehouseName}
          </p>
        </div>

        <div className="wms-ops-quality-detail__meta">
          <MetaChip
            label="İrsaliye"
            value={detail.header.sourceWaybillNo || "—"}
            mono
          />
          <MetaChip
            label="İşlemi yapan"
            value={
              detail.header.createdByName ||
              `Kullanıcı #${detail.header.createdBy ?? "—"}`
            }
          />
          <MetaChip
            label="Oluşturma"
            value={formatProjectDateTime(detail.header.createdAtUtc)}
          />
          <MetaChip
            label="Kaliteye gönderilme"
            value={formatProjectDateTime(
              detail.header.queuedAtUtc ?? detail.header.createdAtUtc,
            )}
          />
          <MetaChip
            label="Onay tarihi"
            value={
              detail.header.decidedAtUtc
                ? formatProjectDateTime(detail.header.decidedAtUtc)
                : "—"
            }
          />
          <MetaChip
            label="Toplam"
            value={formatProjectNumber(detail.header.totalQuantity)}
            mono
            accent
          />
        </div>

        <button
          type="button"
          onClick={close}
          className="wms-ops-quality-detail__close shrink-0 rounded-lg border border-[var(--wms-app-border)] px-2.5 py-1 text-[0.65rem] font-semibold"
        >
          Kapat
        </button>
      </div>

      {detail.requireManagerApprovalForRelease &&
        detail.header.status === "Quarantined" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
            Karantinadan serbest bırakma işlemi ayrı yönetici yetkisi
            gerektirir.
          </div>
        )}

      {!final && actionable.length > 0 && (
        <section className="wms-ops-quality-bulk">
          <div className="wms-ops-quality-bulk__top">
            <p className="wms-ops-quality-bulk__title">Seçilenlere karar</p>
            <span className="wms-ops-quality-bulk__count">
              {selected.length}/{actionable.length} seçili · {decidedCount}{" "}
              satırda karar
            </span>
            <div className="wms-ops-quality-bulk__selects">
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={selectAll}
                className="wms-ops-quality-decide-btn wms-ops-quality-bulk__btn"
              >
                Tümünü seç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={clearSelection}
                disabled={selected.length === 0}
                className="wms-ops-quality-decide-btn wms-ops-quality-bulk__btn"
              >
                Seçimi kaldır
              </OpsActionButton>
            </div>
          </div>
          <div className="wms-ops-quality-bulk__fields">
            <label className="wms-ops-quality-bulk__field">
              <span>Karar</span>
              <AppDropdown
                value={bulkDecision || null}
                onValueChange={setBulkDecision}
                options={options}
                placeholder="Karar seçin"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
                portalContainer={null}
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>Karar kodu</span>
              <AppInput
                value={bulkReasonCode}
                onChange={(e) => setBulkReasonCode(e.target.value)}
                placeholder="Ret / karantina / iade"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>Neden</span>
              <AppInput
                value={bulkReasonNote}
                onChange={(e) => setBulkReasonNote(e.target.value)}
                placeholder="Kısa neden"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={applyBulkToSelected}
              className="wms-ops-quality-decide-btn wms-ops-quality-bulk__apply"
            >
              Uygula
            </OpsActionButton>
          </div>
        </section>
      )}

      <div className="wms-ops-quality-lines overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)] text-left">
              <th className="wms-ops-quality-lines__cell w-12 p-2.5">
                {!final && actionable.length > 0 ? (
                  <OpsSkinCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(next) =>
                      next ? selectAll() : clearSelection()
                    }
                    aria-label="Tüm kontrole tabi satırları seç"
                  />
                ) : null}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                Stok
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                Lot / Seri
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                SKT
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider">
                Miktar
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider">
                Numune
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                Durum
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                Karar
              </th>
              <th className="wms-ops-quality-lines__cell w-28 p-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedLines.map((line) => {
              const active = isActionableLine(line);
              const draft = drafts[line.id];
              return (
                <tr
                  key={line.id}
                  className={cn(
                    active
                      ? "bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,transparent)]"
                      : "opacity-60",
                  )}
                >
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      <OpsSkinCheckbox
                        checked={selected.includes(line.id)}
                        onCheckedChange={() => toggle(line.id)}
                        aria-label={`${line.stockCode} satırını seç`}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    <strong className="block text-[0.8125rem] leading-tight">
                      {line.stockCode}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {line.stockName}
                    </span>
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle font-mono text-xs">
                    {line.lotNo || "—"} / {line.serialNo || "—"}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {line.expiryDate ? formatProjectDate(line.expiryDate) : "—"}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-right font-mono">
                    {formatProjectNumber(line.quantity)}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-right font-mono">
                    {formatProjectNumber(line.sampleQuantity)}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      <OpsStatusBadge tone="pending">Kontrole tabi</OpsStatusBadge>
                    ) : (
                      <OpsStatusBadge tone="neutral">
                        Kontrole tabi değil
                      </OpsStatusBadge>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      draft?.decision ? (
                        <div className="space-y-1">
                          <OpsStatusBadge
                            tone={inferOpsStatusTone(draft.decision)}
                          >
                            {localizeEnumValue(draft.decision)}
                          </OpsStatusBadge>
                          {draft.reasonCode ? (
                            <div className="font-mono text-[0.65rem] text-slate-500">
                              {draft.reasonCode}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Bekliyor</span>
                      )
                    ) : (
                      <OpsStatusBadge tone={inferOpsStatusTone(line.decision)}>
                        {localizeEnumValue(line.decision)}
                      </OpsStatusBadge>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-center">
                    {active && !final ? (
                      <LineDecisionPopover
                        open={openLineId === line.id}
                        onOpenChange={(open) =>
                          setOpenLineId(open ? line.id : null)
                        }
                        options={options}
                        draft={draft ?? emptyDraft()}
                        onChange={(patch) => patchDraft(line.id, patch)}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!final && actionable.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_22%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,transparent)] p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 space-y-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">
              Genel not
            </span>
            <AppInput
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              placeholder="Opsiyonel genel not"
              className="wms-ops-quality-field h-8 text-xs"
            />
            <span className="block text-xs text-slate-500">
              {decidedCount}/{actionable.length} kontrole tabi satırda karar
              hazır
              {detail.allowPartialDecision
                ? " · Kısmi karar açık"
                : " · Tüm satırlar zorunlu"}
            </span>
          </label>
          <OpsActionButton
            type="button"
            disabled={saving || decidedCount === 0}
            onClick={() => void save()}
            className="wms-ops-quality-decide-btn shrink-0 !min-h-8 !px-4 !text-[0.65rem]"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Kararları Kaydet
          </OpsActionButton>
        </section>
      )}
    </div>
  );
}

function LineDecisionPopover({
  open,
  onOpenChange,
  options,
  draft,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: Array<{ value: string; label: string }>;
  draft: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
}): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 288;
    const estimatedHeight = panelRef.current?.offsetHeight || 300;
    const gap = 6;
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    // Always open above the trigger so it stays over the table, not outside below.
    const top = Math.max(8, rect.top - estimatedHeight - gap);
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Remeasure after paint (real panel height).
    const frame = window.requestAnimationFrame(() => updatePosition());
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        target.closest(
          '.wms-ops-list-select-content, .wms-floating-surface, [data-radix-popper-content-wrapper], [role="listbox"]',
        )
      ) {
        return;
      }
      onOpenChange(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <OpsActionButton
        ref={triggerRef}
        type="button"
        variant="secondary"
        title="Karar vermek için tıklayın"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        className={cn(
          "wms-ops-quality-decide-btn inline-flex !min-h-9 !flex-row !items-center !justify-center !gap-1.5 !whitespace-nowrap !px-2.5 !text-xs",
          draft.decision && "wms-ops-list-toolbar-btn--active",
        )}
      >
        <ClipboardPen className="size-3.5 shrink-0" aria-hidden />
        <span>{draft.decision ? "Düzenle" : "Karar ver"}</span>
      </OpsActionButton>

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Satır kararı"
              style={{ top: coords.top, left: coords.left }}
              className="wms-ops-quality-decision-popover wms-ops-list-popover fixed z-[5000] max-h-[min(22rem,calc(100vh-1rem))] w-72 space-y-2.5 overflow-y-auto border-0 p-3 shadow-none outline-none"
            >
              <div className="wms-ops-list-popover__section-title">
                Satır kararı
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Karar
                </span>
                <AppDropdown
                  value={draft.decision || null}
                  onValueChange={(value) => onChange({ decision: value })}
                  options={options}
                  placeholder="Karar seçin"
                  className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                  portalContainer={null}
                  contentClassName="!z-[5100]"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Karar kodu
                </span>
                <AppInput
                  value={draft.reasonCode}
                  onChange={(e) => onChange({ reasonCode: e.target.value })}
                  placeholder="Ret / karantina / iade"
                  className="wms-ops-quality-field h-10 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Neden
                </span>
                <OpsFieldShell className="wms-ops-quality-field-shell">
                  <textarea
                    className={cn(
                      OPS_FIELD_CLASS,
                      "wms-ops-quality-field min-h-16 w-full resize-y border px-3 py-2 text-sm outline-none",
                    )}
                    value={draft.reasonNote}
                    onChange={(e) => onChange({ reasonNote: e.target.value })}
                    placeholder="Açıklama (opsiyonel)"
                    maxLength={500}
                  />
                </OpsFieldShell>
              </label>
              <OpsActionButton
                type="button"
                onClick={() => onOpenChange(false)}
                className="wms-ops-quality-decide-btn w-full !min-h-9 !text-xs"
              >
                Tamam
              </OpsActionButton>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MetaChip({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  accent?: boolean;
}): ReactElement {
  return (
    <div
      className={cn(
        "wms-ops-quality-detail__chip",
        accent && "wms-ops-quality-detail__chip--accent",
      )}
    >
      <span className="wms-ops-quality-detail__chip-label">{label}</span>
      <span
        className={cn(
          "wms-ops-quality-detail__chip-value",
          mono && "wms-ops-quality-detail__chip-value--mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const QualityQuarantinePage = (): ReactElement => (
  <QualityInspectionsPage quarantineOnly />
);
