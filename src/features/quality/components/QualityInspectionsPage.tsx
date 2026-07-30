import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { goodsReceiptV2Api } from "@/features/goods-receipt-v2/api/goods-receipt.api";
import {
  qualityApi,
  type QualityInspection,
  type QualityInspectionDetail,
  type QualityInspectionLine,
} from "../api/quality.api";

const ACTIONABLE_DECISIONS = new Set(["Pending", "Hold", "Quarantined"]);
const QTY_EPS = 0.000001;

type LineDraft = {
  decision: string;
  quantity: string;
  remainderDecision: string;
  reasonCode: string;
  reasonNote: string;
};

function isActionableLine(line: QualityInspectionLine): boolean {
  return ACTIONABLE_DECISIONS.has(line.decision);
}

function isSerialTracked(line: QualityInspectionLine): boolean {
  return Boolean(line.serialNo?.trim());
}

/** Backend ActionableQuantity ile aynı mantık. */
function actionableQuantity(line: QualityInspectionLine): number {
  if (line.decision === "Quarantined") {
    return Math.max(0, line.quarantineQuantity);
  }
  return Math.max(
    0,
    line.quantity -
      line.acceptedQuantity -
      line.rejectedQuantity -
      line.quarantineQuantity,
  );
}

async function notifyGoodsReceiptAfterDecision(
  detail: QualityInspectionDetail,
  openGoodsReceiptList: () => void,
): Promise<void> {
  const docNo = detail.header.sourceDocumentNo?.trim();
  const isGoodsReceipt =
    detail.header.sourceDocumentType === "GR" ||
    detail.header.sourceDocumentType === "GoodsReceipt";

  toast.success("Kalite kararı ve stok hareketi kaydedildi.", {
    description: docNo
      ? `Kaynak belge ${docNo}. Mal kabul listesinden kontrol edebilirsiniz.`
      : "Mal kabul listesinden ilgili belgeyi kontrol edebilirsiniz.",
    action: {
      label: "Mal kabul listesi",
      onClick: openGoodsReceiptList,
    },
  });

  if (!isGoodsReceipt || !docNo) return;

  try {
    const page = await goodsReceiptV2Api.paged({
      pageNumber: 1,
      pageSize: 20,
      search: docNo,
      searchFields: ["documentNo"],
      filterLogic: "and",
      filters: [],
    });
    const rows = page.items ?? page.data ?? [];
    const row =
      rows.find((item) => item.documentNo === docNo) ??
      rows.find((item) =>
        item.documentNo.toLocaleUpperCase("tr-TR").includes(
          docNo.toLocaleUpperCase("tr-TR"),
        ),
      );
    if (!row) {
      toast.message(
        "Mal kabul kaydı listede aranabilir; belge no ile kontrol edin.",
        {
          description: docNo,
          action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
        },
      );
      return;
    }

    const erp = row.erpIntegrationStatus;
    const erpLabel = localizeEnumValue(erp);
    if (erp === "Succeeded") {
      toast.success("Netsis irsaliyesi aktarıldı.", {
        description: `${docNo} — Mal kabul listesinden kontrol edebilirsiniz.`,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      });
    } else if (erp === "Pending" || erp === "Processing") {
      toast.message("Netsis irsaliyesi henüz tamamlanmadı.", {
        description: `${docNo} · ${erpLabel}. Mal kabul detayından ERP durumunu kontrol edin.`,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      });
    } else if (erp === "Failed" || erp === "CommitUncertain") {
      toast.warning("Netsis irsaliyesi tamamlanamadı veya belirsiz.", {
        description: `${docNo} · ${erpLabel}. Mal kabul detayından ERP tekrar gönderimini kontrol edin.`,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      });
    } else if (erp === "NotRequired") {
      toast.message("Bu mal kabul için ERP / Netsis aktarımı gerekmiyor.", {
        description: docNo,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      });
    } else {
      toast.message("Mal kabul kaydı güncellendi.", {
        description: `${docNo}${erp ? ` · ERP: ${erpLabel}` : ""}. Listeden kontrol edebilirsiniz.`,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      });
    }
  } catch {
    toast.message(
      "Netsis durumu şu an doğrulanamadı; mal kabul listesinden kontrol edin.",
      {
        description: docNo,
        action: { label: "Mal kabul listesi", onClick: openGoodsReceiptList },
      },
    );
  }
}

function emptyDraft(
  defaultDecision = "",
  quantity = 0,
  remainderDecision = "Quarantined",
): LineDraft {
  return {
    decision: defaultDecision,
    quantity: quantity > 0 ? String(quantity) : "",
    remainderDecision,
    reasonCode: "",
    reasonNote: "",
  };
}

function parseQty(value: string): number {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function roundQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function remainderOptionsFor(
  decision: string,
  quarantineAvailable: boolean,
): Array<{ value: string; label: string }> {
  const all = [
    { value: "Accepted", label: "Kabul" },
    { value: "Quarantined", label: "Karantina" },
    { value: "Rejected", label: "Ret" },
  ].filter((option) => option.value !== decision);
  return quarantineAvailable
    ? all
    : all.filter((option) => option.value !== "Quarantined");
}

function buildQuantityDecision(
  line: QualityInspectionLine,
  draft: LineDraft,
): {
  lineId: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quarantineQuantity: number;
} {
  const remaining = actionableQuantity(line);
  const qty = roundQty(parseQty(draft.quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`‘${line.stockCode}’ için miktar 0’dan büyük olmalıdır.`);
  }
  if (qty - remaining > QTY_EPS) {
    throw new Error(
      `‘${line.stockCode}’ için miktar kalan ${formatProjectNumber(remaining)} değerini aşamaz.`,
    );
  }

  const primary = draft.decision;
  if (primary === "Returned") {
    throw new Error(
      `‘${line.stockCode}’ iade kararı miktar bölünmeden tam satır olarak kaydedilir.`,
    );
  }

  let accepted = 0;
  let rejected = 0;
  let quarantine = 0;
  if (primary === "Accepted") accepted = qty;
  else if (primary === "Rejected") rejected = qty;
  else if (primary === "Quarantined") quarantine = qty;
  else throw new Error(`‘${line.stockCode}’ için geçerli bir karar seçin.`);

  const rest = roundQty(remaining - qty);
  if (rest > QTY_EPS) {
    if (isSerialTracked(line)) {
      throw new Error(
        `‘${line.serialNo || line.stockCode}’ seri takipli satır miktara bölünemez.`,
      );
    }
    const remainder = draft.remainderDecision;
    if (!remainder || remainder === primary) {
      throw new Error(
        `‘${line.stockCode}’ için kalan ${formatProjectNumber(rest)} miktarın kararını seçin.`,
      );
    }
    if (remainder === "Accepted") accepted += rest;
    else if (remainder === "Rejected") rejected += rest;
    else if (remainder === "Quarantined") quarantine += rest;
    else {
      throw new Error(
        `‘${line.stockCode}’ kalan miktarı için kabul, ret veya karantina seçin.`,
      );
    }
  }

  return {
    lineId: line.id,
    acceptedQuantity: roundQty(accepted),
    rejectedQuantity: roundQty(rejected),
    quarantineQuantity: roundQty(quarantine),
  };
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildApplySummary(
  lines: QualityInspectionLine[],
  drafts: Record<number, LineDraft>,
): { title: string; bullets: string[] } {
  const pending = lines.filter((line) => drafts[line.id]?.decision);
  if (pending.length === 0) {
    return {
      title: "Uygulama özeti",
      bullets: ["Önce en az bir satır için karar seçin."],
    };
  }

  let accepted = 0;
  let rejected = 0;
  let quarantine = 0;
  let returned = 0;
  let invalid = 0;

  for (const line of pending) {
    const draft = drafts[line.id] ?? emptyDraft();
    if (draft.decision === "Returned") {
      returned += actionableQuantity(line);
      continue;
    }
    try {
      const allocation = buildQuantityDecision(line, draft);
      accepted += allocation.acceptedQuantity;
      rejected += allocation.rejectedQuantity;
      quarantine += allocation.quarantineQuantity;
    } catch {
      invalid += 1;
    }
  }

  const qtyParts: string[] = [];
  if (accepted > QTY_EPS) {
    qtyParts.push(`${formatProjectNumber(accepted)} kabul`);
  }
  if (quarantine > QTY_EPS) {
    qtyParts.push(`${formatProjectNumber(quarantine)} karantina`);
  }
  if (rejected > QTY_EPS) {
    qtyParts.push(`${formatProjectNumber(rejected)} ret`);
  }
  if (returned > QTY_EPS) {
    qtyParts.push(`${formatProjectNumber(returned)} iade`);
  }

  const bullets: string[] = [
    `${pending.length} satır kararı uygulanacak.`,
  ];
  if (qtyParts.length > 0) {
    bullets.push(`Miktar: ${qtyParts.join(" · ")}.`);
  }
  if (invalid > 0) {
    bullets.push(`${invalid} satırda miktar dağılımı henüz geçersiz.`);
  }
  bullets.push("Stok hareketi ve hedef raf yönlendirmesi oluşur.");
  if (quarantine > QTY_EPS) {
    bullets.push("Karantina miktarı karantina rafına alınır.");
  }
  if (rejected > QTY_EPS || returned > QTY_EPS) {
    bullets.push("Ret / iade miktarı ilgili süreç ve raflara işlenir.");
  }
  if (accepted > QTY_EPS) {
    bullets.push("Kabul edilen miktar kullanılabilir stoğa geçer.");
  }
  bullets.push(
    "Gerekirse DAT ve ERP / irsaliye gönderimi politikalara göre tetiklenir.",
  );
  bullets.push(
    "Sonuç sonrası mal kabul listesinden belgeyi ve Netsis durumunu kontrol edebilirsiniz.",
  );

  return { title: "Uygulama özeti", bullets };
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
  const navigate = useNavigate();
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
  const quarantineInOptions = options.some((o) => o.value === "Quarantined");
  const allowQuarantineRemainder =
    quarantineInOptions ||
    detail.header.status === "Quarantined" ||
    actionable.some((line) => line.decision === "Quarantined");
  const defaultRemainder = allowQuarantineRemainder
    ? "Quarantined"
    : "Rejected";

  const [selected, setSelected] = useState<number[]>(() =>
    actionable.map((line) => line.id),
  );
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      actionable.map((line) => [
        line.id,
        emptyDraft(
          defaultDecision,
          actionableQuantity(line),
          defaultRemainder,
        ),
      ]),
    ),
  );
  const [bulkDecision, setBulkDecision] = useState(defaultDecision);
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [bulkRemainderDecision, setBulkRemainderDecision] =
    useState(defaultRemainder);
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
  const canApplyDecision = !final && actionable.length > 0 && decidedCount > 0;
  const bulkRemainderOptions = remainderOptionsFor(
    bulkDecision,
    allowQuarantineRemainder,
  );
  const applySummary = useMemo(
    () => buildApplySummary(actionable, drafts),
    [actionable, drafts],
  );

  const toggle = (id: number) =>
    setSelected((value) =>
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );

  const selectAll = () => setSelected(actionable.map((line) => line.id));
  const clearSelection = () => setSelected([]);

  const patchDraft = (id: number, patch: Partial<LineDraft>) =>
    setDrafts((current) => {
      const line = actionable.find((item) => item.id === id);
      const fallback = emptyDraft(
        defaultDecision,
        line ? actionableQuantity(line) : 0,
        defaultRemainder,
      );
      return {
        ...current,
        [id]: { ...(current[id] ?? fallback), ...patch },
      };
    });

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
    const bulkQty = bulkQuantity.trim() ? parseQty(bulkQuantity) : null;
    if (bulkQty != null && (!Number.isFinite(bulkQty) || bulkQty <= 0)) {
      toast.error("Toplu miktar geçersiz.");
      return;
    }

    const selectedLines = actionable.filter((line) =>
      selected.includes(line.id),
    );
    for (const line of selectedLines) {
      const remaining = actionableQuantity(line);
      if (bulkQty != null && bulkQty - remaining > QTY_EPS) {
        toast.error(
          `‘${line.stockCode}’ kalan miktarı ${formatProjectNumber(remaining)}; toplu miktar daha büyük olamaz.`,
        );
        return;
      }
      if (
        bulkQty != null &&
        remaining - bulkQty > QTY_EPS &&
        bulkDecision !== "Returned"
      ) {
        if (isSerialTracked(line)) {
          toast.error(
            `‘${line.serialNo || line.stockCode}’ seri satırı bölünemez; miktarı tam bırakın.`,
          );
          return;
        }
        if (
          !bulkRemainderDecision ||
          bulkRemainderDecision === bulkDecision
        ) {
          toast.error("Kısmi miktar için kalan miktarın kararını seçin.");
          return;
        }
      }
    }

    setDrafts((current) => {
      const next = { ...current };
      for (const line of selectedLines) {
        const remaining = actionableQuantity(line);
        const qty =
          bulkDecision === "Returned"
            ? remaining
            : bulkQty == null
              ? remaining
              : Math.min(bulkQty, remaining);
        next[line.id] = {
          decision: bulkDecision,
          quantity: String(roundQty(qty)),
          remainderDecision:
            bulkRemainderDecision === bulkDecision
              ? defaultRemainder === bulkDecision
                ? "Rejected"
                : defaultRemainder
              : bulkRemainderDecision,
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
        return { line, draft };
      })
      .filter((row) => row.draft.decision);

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
    for (const { line, draft } of pending) {
      const needsReason =
        draft.decision !== "Accepted" ||
        (() => {
          const qty = parseQty(draft.quantity);
          const rem = actionableQuantity(line);
          return (
            Number.isFinite(qty) &&
            rem - qty > QTY_EPS &&
            draft.remainderDecision !== "Accepted"
          );
        })();
      if (needsReason && !draft.reasonCode.trim()) {
        toast.error(
          "Ret, karantina ve iade kararlarında her satır için karar kodu zorunludur.",
        );
        return;
      }
    }

    const returnedRows = pending.filter(
      (row) => row.draft.decision === "Returned",
    );
    const quantityRows = pending.filter(
      (row) => row.draft.decision !== "Returned",
    );

    let quantityDecisions: Array<{
      lineId: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      quarantineQuantity: number;
    }> = [];
    try {
      quantityDecisions = quantityRows.map(({ line, draft }) =>
        buildQuantityDecision(line, draft),
      );
    } catch (error) {
      toast.error(message(error, "Miktar dağılımı geçersiz."));
      return;
    }

    for (const { line, draft } of returnedRows) {
      const remaining = actionableQuantity(line);
      const qty = roundQty(parseQty(draft.quantity));
      if (!Number.isFinite(qty) || Math.abs(qty - remaining) > QTY_EPS) {
        toast.error(
          `‘${line.stockCode}’ iade için miktar kalanın tamamı (${formatProjectNumber(remaining)}) olmalıdır.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      let rowVersion = detail.rowVersion;
      const calls: Array<() => ReturnType<typeof qualityApi.decide>> = [];
      let completionMessage = "";

      if (quantityDecisions.length > 0) {
        const notes = quantityRows
          .map(({ draft }) => draft.reasonNote.trim())
          .filter(Boolean);
        const reasonCodes = [
          ...new Set(
            quantityRows
              .map(({ draft }) => draft.reasonCode.trim())
              .filter(Boolean),
          ),
        ];
        const primaryDecision =
          quantityRows.find(({ draft }) => draft.decision === "Accepted")
            ?.draft.decision ??
          quantityRows[0]?.draft.decision ??
          "Accepted";
        calls.push(async () => {
          return await qualityApi.decide(detail.header.id, {
            idempotencyKey: crypto.randomUUID(),
            decision: primaryDecision,
            note:
              [headerNote.trim(), ...notes].filter(Boolean).join(" · ") ||
              undefined,
            reasonCode: reasonCodes[0] || undefined,
            rowVersion,
            quantityDecisions,
          });
        });
      }

      const returnedGroups = new Map<
        string,
        { reasonCode: string; lineIds: number[]; notes: string[] }
      >();
      for (const { line, draft } of returnedRows) {
        const key = draft.reasonCode.trim();
        const existing = returnedGroups.get(key);
        if (existing) {
          existing.lineIds.push(line.id);
          if (draft.reasonNote.trim()) existing.notes.push(draft.reasonNote.trim());
        } else {
          returnedGroups.set(key, {
            reasonCode: key,
            lineIds: [line.id],
            notes: draft.reasonNote.trim() ? [draft.reasonNote.trim()] : [],
          });
        }
      }
      for (const group of returnedGroups.values()) {
        calls.push(async () => {
          return await qualityApi.decide(detail.header.id, {
            idempotencyKey: crypto.randomUUID(),
            decision: "Returned",
            note:
              [headerNote.trim(), ...group.notes].filter(Boolean).join(" · ") ||
              undefined,
            reasonCode: group.reasonCode || undefined,
            lineIds: group.lineIds,
            rowVersion,
          });
        });
      }

      for (let i = 0; i < calls.length; i += 1) {
        const result = await calls[i]();
        completionMessage = result.message;
        if (i < calls.length - 1) {
          const fresh = await qualityApi.inspection(detail.header.id);
          rowVersion = fresh.rowVersion;
        }
      }
      await notifyGoodsReceiptAfterDecision(detail, () =>
        navigate("/warehouse/goods-receipts/list")
      );
      toast.success(
        completionMessage || "Kalite kararı ve stok hareketi kaydedildi.",
        { duration: 7000 }
      );
      );
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
                onValueChange={(value) => {
                  setBulkDecision(value);
                  if (value === bulkRemainderDecision) {
                    const next = remainderOptionsFor(
                      value,
                      allowQuarantineRemainder,
                    )[0]?.value;
                    if (next) setBulkRemainderDecision(next);
                  }
                }}
                options={options}
                placeholder="Karar seçin"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
                portalContainer={null}
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>Miktar</span>
              <AppInput
                value={bulkQuantity}
                onChange={(e) => setBulkQuantity(e.target.value)}
                placeholder="Boş = kalanın tamamı"
                inputMode="decimal"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>Kalan karar</span>
              <AppDropdown
                value={bulkRemainderDecision || null}
                onValueChange={setBulkRemainderDecision}
                options={bulkRemainderOptions}
                placeholder="Kalan için"
                disabled={
                  bulkDecision === "Returned" || !bulkQuantity.trim()
                }
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
                Miktar / Kalan
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
                    <span className="block">
                      {formatProjectNumber(line.quantity)}
                    </span>
                    {active ? (
                      <span className="block text-[0.65rem] text-slate-500">
                        kalan {formatProjectNumber(actionableQuantity(line))}
                      </span>
                    ) : null}
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
                            {draft.quantity
                              ? ` · ${formatProjectNumber(parseQty(draft.quantity) || 0)}`
                              : ""}
                          </OpsStatusBadge>
                          {(() => {
                            const remaining = actionableQuantity(line);
                            const qty = parseQty(draft.quantity);
                            const rest =
                              Number.isFinite(qty) && remaining - qty > QTY_EPS
                                ? roundQty(remaining - qty)
                                : 0;
                            if (rest <= QTY_EPS || !draft.remainderDecision) {
                              return null;
                            }
                            return (
                              <OpsStatusBadge
                                tone={inferOpsStatusTone(
                                  draft.remainderDecision,
                                )}
                              >
                                {localizeEnumValue(draft.remainderDecision)} ·{" "}
                                {formatProjectNumber(rest)}
                              </OpsStatusBadge>
                            );
                          })()}
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
                        line={line}
                        draft={
                          draft ??
                          emptyDraft(
                            defaultDecision,
                            actionableQuantity(line),
                            defaultRemainder,
                          )
                        }
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

      {final ? (
        <section className="rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,transparent)] px-4 py-3 text-sm">
          <p className="font-semibold">Kalite kontrolü tamamlandı.</p>
          <p className="mt-1 text-xs text-slate-500">
            {detail.header.sourceDocumentNo
              ? `Kaynak belge ${detail.header.sourceDocumentNo}. `
              : ""}
            Mal kabul listesinden kaydı ve Netsis / ERP durumunu kontrol
            edebilirsiniz.
          </p>
          <OpsActionButton
            type="button"
            variant="secondary"
            className="mt-3 !min-h-8 !px-3 !text-[0.65rem]"
            onClick={() => navigate("/warehouse/goods-receipts/list")}
          >
            Mal kabul listesi
          </OpsActionButton>
        </section>
      ) : null}

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
            <span className="block text-xs text-slate-500">
              Uygulama sonrası stok hareketi kaydedilir; Netsis irsaliyesi
              politikalara göre gidebilir. Sonucu mal kabul listesinden
              kontrol edin
              {detail.header.sourceDocumentNo
                ? ` (${detail.header.sourceDocumentNo})`
                : ""}
              .
            </span>
          </label>
          <TooltipProvider delayDuration={180}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0">
                  <OpsActionButton
                    type="button"
                    disabled={saving || !canApplyDecision}
                    onClick={() => void save()}
                    className="wms-ops-quality-decide-btn !min-h-8 !px-4 !text-[0.65rem]"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    Kararı uygula
                  </OpsActionButton>
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                sideOffset={10}
                className={cn(
                  "wms-ops-quality-apply-tooltip max-w-[22rem] overflow-hidden rounded-xl border p-0 text-left shadow-[0_12px_40px_color-mix(in_oklab,black_45%,transparent)]",
                  "!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]",
                  "border-[color-mix(in_oklab,var(--wms-brand-primary)_32%,var(--wms-app-border))]",
                  "!text-[var(--wms-app-text)]",
                )}
              >
                <div className="border-b border-[color-mix(in_oklab,var(--wms-brand-primary)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)] px-3.5 py-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-brand-primary)]">
                    {applySummary.title}
                  </span>
                </div>
                <ul className="space-y-1.5 px-3.5 py-3 text-[0.78rem] leading-5 text-[color-mix(in_oklab,hsl(var(--foreground))_78%,transparent)]">
                  {applySummary.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span
                        className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--wms-brand-primary)]"
                        aria-hidden
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </section>
      )}
    </div>
  );
}

function LineDecisionPopover({
  open,
  onOpenChange,
  options,
  line,
  draft,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: Array<{ value: string; label: string }>;
  line: QualityInspectionLine;
  draft: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
}): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const remaining = actionableQuantity(line);
  const serial = isSerialTracked(line);
  const qty = parseQty(draft.quantity);
  const hasRemainder =
    draft.decision !== "Returned" &&
    !serial &&
    Number.isFinite(qty) &&
    remaining - qty > QTY_EPS;
  const remainderChoices = remainderOptionsFor(
    draft.decision,
    options.some((o) => o.value === "Quarantined") ||
      line.decision === "Quarantined",
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 300;
    const estimatedHeight = panelRef.current?.offsetHeight || 360;
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
  }, [open, updatePosition, hasRemainder]);

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
              className="wms-ops-quality-decision-popover wms-ops-list-popover fixed z-[5000] max-h-[min(26rem,calc(100vh-1rem))] w-[18.75rem] space-y-2.5 overflow-y-auto border-0 p-3 shadow-none outline-none"
            >
              <div className="wms-ops-list-popover__section-title">
                Satır kararı
              </div>
              <p className="text-[0.65rem] text-slate-500">
                Kalan miktar:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatProjectNumber(remaining)}
                </span>
                {serial ? " · seri — bölünemez" : null}
              </p>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Karar
                </span>
                <AppDropdown
                  value={draft.decision || null}
                  onValueChange={(value) => {
                    const nextRemainder = remainderOptionsFor(
                      value,
                      options.some((o) => o.value === "Quarantined") ||
                        line.decision === "Quarantined",
                    )[0]?.value;
                    onChange({
                      decision: value,
                      quantity:
                        value === "Returned" || serial
                          ? String(remaining)
                          : draft.quantity || String(remaining),
                      ...(nextRemainder &&
                      nextRemainder !== draft.remainderDecision
                        ? { remainderDecision: nextRemainder }
                        : {}),
                    });
                  }}
                  options={options}
                  placeholder="Karar seçin"
                  className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                  portalContainer={null}
                  contentClassName="!z-[5100]"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Bu karar miktarı
                </span>
                <AppInput
                  value={draft.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                  placeholder={formatProjectNumber(remaining)}
                  inputMode="decimal"
                  disabled={serial || draft.decision === "Returned"}
                  className="wms-ops-quality-field h-10 text-sm"
                />
              </label>
              {hasRemainder ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    Kalan ({formatProjectNumber(roundQty(remaining - qty))})
                  </span>
                  <AppDropdown
                    value={draft.remainderDecision || null}
                    onValueChange={(value) =>
                      onChange({ remainderDecision: value })
                    }
                    options={remainderChoices}
                    placeholder="Kalan karar"
                    className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                    portalContainer={null}
                    contentClassName="!z-[5100]"
                  />
                </label>
              ) : null}
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
